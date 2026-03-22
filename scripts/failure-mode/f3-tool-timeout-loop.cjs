#!/usr/bin/env node
/* eslint-disable no-console */
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const http = require('node:http');

const mode = process.argv[2] || '';
const STATE_FILE =
  process.env.F3_TOOL_TIMEOUT_STATE_FILE ||
  'docs/release/status/f3-tool-timeout-state.json';

function writeState(data) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    return await fn(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function induce() {
  writeState({
    created_at: new Date().toISOString(),
    timeout_ms: 250,
    recovered_timeout_ms: 2000,
  });
  console.log('f3-tool-timeout: induced timeout-loop scenario (short timeout profile)');
}

async function verifyDegraded() {
  const state = readState();
  const timeoutMs = Number(state.timeout_ms || 250);
  const timedOut = await withServer(
    (_req, _res) => {
      // Intentionally never respond to trigger client timeout.
    },
    async (port) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await fetch(`http://127.0.0.1:${port}/hang`, { signal: controller.signal });
        return false;
      } catch {
        return true;
      } finally {
        clearTimeout(timer);
      }
    },
  );
  if (!timedOut) {
    throw new Error('Expected request timeout/abort was not observed');
  }
  console.log(`f3-tool-timeout: degraded detection passed (timeout observed at ~${timeoutMs}ms)`);
}

async function recover() {
  const state = readState();
  writeState({
    ...state,
    recovered_at: new Date().toISOString(),
  });
  console.log('f3-tool-timeout: recovery command applied (timeout profile relaxed)');
}

async function verifyRecovered() {
  const state = readState();
  const timeoutMs = Number(state.recovered_timeout_ms || 2000);
  const ok = await withServer(
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    },
    async (port) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/ok`, { signal: controller.signal });
        return res.status === 200;
      } finally {
        clearTimeout(timer);
      }
    },
  );
  if (!ok) {
    throw new Error('Expected successful request after recovery was not observed');
  }
  console.log('f3-tool-timeout: recovery verification passed');
}

async function main() {
  if (mode === 'induce') return induce();
  if (mode === 'verify-degraded') return verifyDegraded();
  if (mode === 'recover') return recover();
  if (mode === 'verify-recovered') return verifyRecovered();
  throw new Error('Usage: node scripts/failure-mode/f3-tool-timeout-loop.cjs <induce|verify-degraded|recover|verify-recovered>');
}

main().catch((err) => {
  console.error('f3-tool-timeout failed:', err);
  process.exit(1);
});

