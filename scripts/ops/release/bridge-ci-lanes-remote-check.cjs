#!/usr/bin/env node
// bridge-ci-lanes-remote-check.cjs — Queries GitHub Actions for bridge workflow evidence.
// Usage: node scripts/ops/release/bridge-ci-lanes-remote-check.cjs [--strict]

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const strict = process.argv.includes('--strict');
const BRIDGE_CI_LANES_GH_REPO = process.env.BRIDGE_CI_LANES_GH_REPO || '47network/thesven';

const WORKFLOWS = [
  'bridge-runtime-tests',
  'gateway-bridge-contract-tests',
];

const results = { workflows: [], passed: true, repo: BRIDGE_CI_LANES_GH_REPO, timestamp: new Date().toISOString() };

for (const wf of WORKFLOWS) {
  try {
    const out = execSync(
      `gh run list --workflow="${wf}" --repo ${BRIDGE_CI_LANES_GH_REPO} --status=completed --limit=1 --json conclusion`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    const runs = JSON.parse(out || '[]');
    const passed = runs.length > 0 && runs[0].conclusion === 'success';
    results.workflows.push({ name: wf, passed, conclusion: runs[0]?.conclusion });
    if (!passed) results.passed = false;
  } catch {
    results.workflows.push({ name: wf, passed: false, error: 'gh query failed' });
    results.passed = false;
  }
}

const output = path.join(__dirname, '..', '..', '..', 'docs', 'release', 'status', 'bridge-ci-lanes-remote-latest.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(results, null, 2));

console.log(`[bridge-ci-lanes-remote] ${results.passed ? 'PASS' : 'FAIL'} — ${BRIDGE_CI_LANES_GH_REPO}`);

if (strict && !results.passed) {
  process.exit(1);
}
