#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const mode = process.argv[2] || '';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const STATE_FILE =
  process.env.FM_OOM_STATE_FILE || path.join('docs', 'release', 'status', 'failure-mode-oom-state.json');

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function inspectGateway() {
  const id = run('docker compose ps -aq gateway-api');
  if (!id) throw new Error('gateway-api container not found');
  const inspectRaw = run(`docker inspect ${id}`);
  const parsed = JSON.parse(inspectRaw);
  const data = parsed[0] || {};
  return {
    id,
    restartCount: Number(data.RestartCount || 0),
    running: Boolean(data?.State?.Running),
    health: data?.State?.Health?.Status || 'unknown',
    startedAt: data?.State?.StartedAt || '',
  };
}

function readState() {
  const text = readFileSync(STATE_FILE, 'utf8');
  return JSON.parse(text);
}

function writeState(state) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function waitFor(check, timeoutMs, label) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await check();
      if (ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (lastErr) {
    throw new Error(`${label} timed out: ${lastErr.message}`);
  }
  throw new Error(`${label} timed out`);
}

function induce() {
  const before = inspectGateway();
  writeState({
    created_at: new Date().toISOString(),
    container_id: before.id,
    baseline_restart_count: before.restartCount,
    baseline_started_at: before.startedAt,
  });
  run(`docker kill -s SIGKILL ${before.id}`);
  console.log(
    `oom-restart: induced SIGKILL for ${before.id} (baseline_restart_count=${before.restartCount})`
  );
}

async function verifyDegraded() {
  await waitFor(() => {
    const current = inspectGateway();
    return !current.running;
  }, 90000, 'gateway process stopped after SIGKILL');
  console.log('oom-restart: degraded verification passed (gateway stopped after SIGKILL)');
}

function recover() {
  run('docker compose up -d gateway-api');
  console.log('oom-restart: recover command applied (docker compose up -d gateway-api)');
}

async function verifyRecovered() {
  const state = readState();
  await waitFor(async () => {
    const current = inspectGateway();
    const res = await fetch(`${API_URL}/healthz`);
    const restarted =
      current.id !== String(state.container_id || '') ||
      current.startedAt !== String(state.baseline_started_at || '') ||
      current.restartCount > Number(state.baseline_restart_count || 0);
    return (
      current.running &&
      current.health === 'healthy' &&
      restarted &&
      res.status === 200
    );
  }, 120000, 'gateway recovery health');
  console.log('oom-restart: recovery verification passed (healthy + restarted + /healthz=200)');
}

async function main() {
  if (mode === 'induce') return induce();
  if (mode === 'verify-degraded') return verifyDegraded();
  if (mode === 'recover') return recover();
  if (mode === 'verify-recovered') return verifyRecovered();
  throw new Error('Usage: node scripts/failure-mode/oom-restart.cjs <induce|verify-degraded|recover|verify-recovered>');
}

main().catch((err) => {
  console.error('oom-restart failed:', err);
  process.exit(1);
});
