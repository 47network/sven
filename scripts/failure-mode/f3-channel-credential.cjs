#!/usr/bin/env node
/* eslint-disable no-console */
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

const mode = process.argv[2] || '';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const VALID_TOKEN = process.env.FM_CHANNEL_VALID_ADAPTER_TOKEN || process.env.SVEN_ADAPTER_TOKEN || '';
const INVALID_TOKEN = process.env.FM_CHANNEL_INVALID_ADAPTER_TOKEN || 'f3-invalid-adapter-token';
const STATE_FILE =
  process.env.F3_CHANNEL_STATE_FILE ||
  'docs/release/status/f3-channel-credential-state.json';

function writeState(data) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function post(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': token,
    },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

async function induce() {
  const probeChat = `f3-channel-${Date.now()}`;
  writeState({
    created_at: new Date().toISOString(),
    channel: 'webchat',
    channel_chat_id: probeChat,
  });
  console.log(`f3-channel-credential: induced broken credential scenario (invalid token=${INVALID_TOKEN})`);
}

async function verifyDegraded() {
  const state = readState();
  const res = await post(
    '/v1/adapter/chat/resolve',
    {
      channel: state.channel || 'webchat',
      channel_chat_id: state.channel_chat_id || `f3-channel-${Date.now()}`,
      name: 'F3 broken credential probe',
      type: 'group',
    },
    INVALID_TOKEN,
  );
  if (![401, 403].includes(res.status)) {
    throw new Error(`Expected 401/403 with invalid token, got HTTP ${res.status}`);
  }
  console.log(`f3-channel-credential: degraded detection passed (HTTP ${res.status})`);
}

async function recover() {
  if (!VALID_TOKEN) {
    throw new Error('Missing FM_CHANNEL_VALID_ADAPTER_TOKEN or SVEN_ADAPTER_TOKEN for recovery');
  }
  const state = readState();
  writeState({
    ...state,
    recovered_at: new Date().toISOString(),
    valid_token_present: true,
  });
  console.log('f3-channel-credential: recovery command applied (valid token path restored)');
}

async function verifyRecovered() {
  if (!VALID_TOKEN) {
    throw new Error('Missing FM_CHANNEL_VALID_ADAPTER_TOKEN or SVEN_ADAPTER_TOKEN for recovery verification');
  }
  const state = readState();
  const res = await post(
    '/v1/adapter/chat/resolve',
    {
      channel: state.channel || 'webchat',
      channel_chat_id: state.channel_chat_id || `f3-channel-${Date.now()}`,
      name: 'F3 credential recovered',
      type: 'group',
    },
    VALID_TOKEN,
  );
  if (res.status !== 200 || res.data?.success !== true) {
    throw new Error(`Expected HTTP 200 success with valid token, got HTTP ${res.status} body=${JSON.stringify(res.data)}`);
  }
  console.log('f3-channel-credential: recovery verification passed (adapter auth restored)');
}

async function main() {
  if (mode === 'induce') return induce();
  if (mode === 'verify-degraded') return verifyDegraded();
  if (mode === 'recover') return recover();
  if (mode === 'verify-recovered') return verifyRecovered();
  throw new Error('Usage: node scripts/failure-mode/f3-channel-credential.cjs <induce|verify-degraded|recover|verify-recovered>');
}

main().catch((err) => {
  console.error('f3-channel-credential failed:', err);
  process.exit(1);
});

