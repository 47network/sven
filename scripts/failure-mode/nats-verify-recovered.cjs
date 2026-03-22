#!/usr/bin/env node
/* eslint-disable no-console */
const { connect, StringCodec } = require('nats');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const MARKER_PATH =
  process.env.FM_NATS_MARKER_FILE || path.join('docs', 'release', 'status', 'failure-mode-nats-marker.json');
const DEADLINE_MS = Number(process.env.FM_NATS_VERIFY_TIMEOUT_MS || 120000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGatewayHealthy() {
  const deadline = Date.now() + DEADLINE_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_URL}/healthz`);
      if (res.status === 200) {
        const body = await res.json();
        const nats = Array.isArray(body?.checks)
          ? body.checks.find((c) => c?.name === 'nats')
          : null;
        if (!nats || nats.status === 'pass') return;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error('Gateway did not become healthy within timeout');
}

function readMarker() {
  const raw = readFileSync(MARKER_PATH, 'utf8');
  return JSON.parse(raw);
}

async function verifyMarkerReplay(marker) {
  const nc = await connect({ servers: NATS_URL, name: 'failure-mode-nats-verify' });
  try {
    const jsm = await nc.jetstreamManager();
    const sc = StringCodec();
    const res = await jsm.streams.getMessage(marker.stream || 'TOOLS', { seq: Number(marker.seq) });
    const encoded = res?.smr?.message?.data || '';
    const decoded = sc.decode(Buffer.from(encoded, 'base64'));
    if (!decoded.includes(marker.marker)) {
      throw new Error(`Marker not found in recovered JetStream message seq=${marker.seq}`);
    }
  } finally {
    await nc.drain();
  }
}

async function main() {
  const marker = readMarker();
  await waitForGatewayHealthy();
  await verifyMarkerReplay(marker);
  console.log(`nats-verify-recovered: replay verified for seq=${marker.seq}`);
}

main().catch((err) => {
  console.error('nats-verify-recovered failed:', err);
  process.exit(1);
});

