#!/usr/bin/env node
/* eslint-disable no-console */
const { connect, StringCodec } = require('nats');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

async function main() {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  const markerPath =
    process.env.FM_NATS_MARKER_FILE || path.join('docs', 'release', 'status', 'failure-mode-nats-marker.json');
  const marker = `fm-nats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nc = await connect({ servers: natsUrl, name: 'failure-mode-nats-induce' });
  try {
    const js = nc.jetstream();
    const sc = StringCodec();
    const payload = JSON.stringify({ marker, created_at: new Date().toISOString() });
    const ack = await js.publish('tool.run.result', sc.encode(payload));
    const data = {
      marker,
      stream: ack.stream,
      seq: ack.seq,
      subject: 'tool.run.result',
      created_at: new Date().toISOString(),
      nats_url: natsUrl,
    };
    mkdirSync(path.dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`nats-induce: wrote marker seq=${ack.seq} stream=${ack.stream} file=${markerPath}`);
  } finally {
    await nc.drain();
  }
}

main().catch((err) => {
  console.error('nats-induce failed:', err);
  process.exit(1);
});

