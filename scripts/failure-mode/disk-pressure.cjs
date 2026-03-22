#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const mode = process.argv[2] || '';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const ALERTS_FILE = process.env.FM_DISK_ALERTS_FILE || 'config/prometheus-alerts.yml';
const FILL_FILE = process.env.FM_DISK_FILL_FILE || '/tmp/fm-disk-fill.bin';
const FILL_MB = Number(process.env.FM_DISK_FILL_MB || '256');

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gatewayContainerId() {
  const id = run('docker compose ps -q gateway-api');
  if (!id) throw new Error('gateway-api container not found');
  return id;
}

async function assertGatewayHealth() {
  const res = await fetch(`${API_URL}/healthz`);
  if (res.status !== 200) {
    throw new Error(`Gateway health check failed with status=${res.status}`);
  }
}

function assertAlertRules() {
  const text = fs.readFileSync(ALERTS_FILE, 'utf8');
  if (!text.includes('alert: SvenDiskUsageWarning')) {
    throw new Error('Missing alert rule SvenDiskUsageWarning');
  }
  if (!text.includes('alert: SvenDiskUsageCritical')) {
    throw new Error('Missing alert rule SvenDiskUsageCritical');
  }
}

function induce() {
  const id = gatewayContainerId();
  const cmd = `docker exec ${id} sh -lc "rm -f ${FILL_FILE} && dd if=/dev/zero of=${FILL_FILE} bs=1M count=${FILL_MB} conv=fsync status=none && test -f ${FILL_FILE}"`;
  run(cmd);
  console.log(`disk-pressure: induced ${FILL_MB}MB file at ${FILL_FILE} in ${id}`);
}

async function verifyDegraded() {
  const id = gatewayContainerId();
  run(`docker exec ${id} sh -lc "test -f ${FILL_FILE}"`);
  assertAlertRules();
  await assertGatewayHealth();
  console.log(`disk-pressure: degraded verification passed (alerts + health + fill file present)`);
}

function recover() {
  const id = gatewayContainerId();
  run(`docker exec ${id} sh -lc "rm -f ${FILL_FILE}"`);
  console.log(`disk-pressure: recovered (removed ${FILL_FILE} from ${id})`);
}

async function verifyRecovered() {
  const id = gatewayContainerId();
  run(`docker exec ${id} sh -lc "test ! -f ${FILL_FILE}"`);
  await assertGatewayHealth();
  console.log('disk-pressure: recovery verification passed');
}

async function main() {
  if (mode === 'induce') return induce();
  if (mode === 'verify-degraded') return verifyDegraded();
  if (mode === 'recover') return recover();
  if (mode === 'verify-recovered') return verifyRecovered();
  throw new Error('Usage: node scripts/failure-mode/disk-pressure.cjs <induce|verify-degraded|recover|verify-recovered>');
}

main().catch((err) => {
  console.error('disk-pressure failed:', err);
  process.exit(1);
});
