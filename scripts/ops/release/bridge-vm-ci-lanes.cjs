#!/usr/bin/env node
// bridge-vm-ci-lanes.cjs — Authoritative local release gate checker for VM bridge CI lanes.
// Usage: node scripts/ops/release/bridge-vm-ci-lanes.cjs [--strict] [--skip-remote]

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const strict = process.argv.includes('--strict');
const skipRemote = process.argv.includes('--skip-remote');

const LOCAL_GATES = [
  'release:ci:required:check:local',
  'release:final:signoff:check:local',
  'ops:release:bridge-ci-lanes:check:local:strict',
];

const results = { gates: [], passed: true, skipRemote, timestamp: new Date().toISOString() };

for (const gate of LOCAL_GATES) {
  try {
    execSync(`npm run ${gate}`, { encoding: 'utf8', stdio: 'pipe', timeout: 60000 });
    results.gates.push({ name: gate, passed: true });
  } catch {
    results.gates.push({ name: gate, passed: false });
    results.passed = false;
  }
}

const output = path.join(__dirname, '..', '..', '..', 'docs', 'release', 'status', 'bridge-vm-ci-lanes-latest.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(results, null, 2));

console.log(`[bridge-vm-ci-lanes] ${results.passed ? 'PASS' : 'FAIL'}`);

if (strict && !results.passed) {
  process.exit(1);
}
