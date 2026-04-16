#!/usr/bin/env node
// bridge-vm-ci-lanes-pr-comment.cjs — Publishes bridge VM CI lane results as a PR comment.
// Usage: node scripts/ops/release/bridge-vm-ci-lanes-pr-comment.cjs [--dry-run]

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dryRun = process.argv.includes('--dry-run');

const vmLanesPath = path.join(__dirname, '..', '..', '..', 'docs', 'release', 'status', 'bridge-vm-ci-lanes-latest.json');
const remotePath = path.join(__dirname, '..', '..', '..', 'docs', 'release', 'status', 'bridge-ci-lanes-remote-latest.json');

let vmLanes = { gates: [], passed: false };
let remote = { workflows: [], passed: false };

try { vmLanes = JSON.parse(fs.readFileSync(vmLanesPath, 'utf8')); } catch { /* noop */ }
try { remote = JSON.parse(fs.readFileSync(remotePath, 'utf8')); } catch { /* noop */ }

const body = [
  '## Bridge CI Lanes — Release Gate Report',
  '',
  `**VM Lanes**: ${vmLanes.passed ? '✅ PASS' : '❌ FAIL'}`,
  `**Remote Lanes**: ${remote.passed ? '✅ PASS' : '❌ FAIL'}`,
  '',
  '### VM Gates',
  ...vmLanes.gates.map(g => `- ${g.passed ? '✅' : '❌'} ${g.name}`),
  '',
  '### Remote Workflows',
  ...remote.workflows.map(w => `- ${w.passed ? '✅' : '❌'} ${w.name}`),
].join('\n');

if (dryRun) {
  console.log('[bridge-vm-ci-lanes-pr-comment] DRY RUN — would post:');
  console.log(body);
} else {
  try {
    execSync('gh pr comment --body-file -', { encoding: 'utf8', input: body, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log('[bridge-vm-ci-lanes-pr-comment] PR comment posted.');
  } catch (err) {
    console.error('[bridge-vm-ci-lanes-pr-comment] Failed to post pr comment:', err.message);
    process.exit(1);
  }
}
