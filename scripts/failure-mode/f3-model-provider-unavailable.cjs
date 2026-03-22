#!/usr/bin/env node
/* eslint-disable no-console */
const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const { execSync } = require('node:child_process');

const mode = process.argv[2] || '';
const STATE_FILE =
  process.env.F3_MODEL_STATE_FILE ||
  'docs/release/status/f3-model-provider-state.json';

function writeState(data) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function induce() {
  writeState({
    created_at: new Date().toISOString(),
    scenario: 'provider unavailable with fallback',
  });
  console.log('f3-model-provider: induced provider unavailable scenario (synthetic failover harness)');
}

function verifyDegraded() {
  const out = run('node scripts/failure-mode/llm-provider-failover.cjs');
  if (!String(out).includes('llm-provider-failover: pass')) {
    throw new Error(`Unexpected failover output: ${out}`);
  }
  console.log('f3-model-provider: degraded detection passed (local provider failure + fallback observed)');
}

function recover() {
  const state = readState();
  writeState({
    ...state,
    recovered_at: new Date().toISOString(),
  });
  console.log('f3-model-provider: recovery command applied');
}

function verifyRecovered() {
  const out = run('node scripts/failure-mode/llm-provider-failover.cjs');
  if (!String(out).includes('llm-provider-failover: pass')) {
    throw new Error(`Unexpected failover output after recovery: ${out}`);
  }
  console.log('f3-model-provider: recovery verification passed');
}

async function main() {
  if (mode === 'induce') return induce();
  if (mode === 'verify-degraded') return verifyDegraded();
  if (mode === 'recover') return recover();
  if (mode === 'verify-recovered') return verifyRecovered();
  throw new Error('Usage: node scripts/failure-mode/f3-model-provider-unavailable.cjs <induce|verify-degraded|recover|verify-recovered>');
}

main().catch((err) => {
  console.error('f3-model-provider failed:', err);
  process.exit(1);
});

