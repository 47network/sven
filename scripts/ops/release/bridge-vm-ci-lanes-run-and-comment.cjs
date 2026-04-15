#!/usr/bin/env node
// bridge-vm-ci-lanes-run-and-comment.cjs — Runs VM CI lanes check then posts PR comment.
// Usage: node scripts/ops/release/bridge-vm-ci-lanes-run-and-comment.cjs [--strict] [--skip-remote] [--dry-run]

'use strict';

const { execSync } = require('node:child_process');

const strict = process.argv.includes('--strict');
const skipRemote = process.argv.includes('--skip-remote');
const dryRun = process.argv.includes('--dry-run');

const vmArgs = ['ops:release:bridge-vm-ci-lanes'];
if (strict) vmArgs[0] += ':strict';
if (skipRemote) vmArgs.push('-- --skip-remote');

try {
  console.log(`[run-and-comment] Running: npm run ${vmArgs.join(' ')}`);
  execSync(`npm run ${vmArgs.join(' ')}`, { encoding: 'utf8', stdio: 'inherit' });
} catch (err) {
  console.error('[run-and-comment] VM lanes check failed.');
  if (strict) process.exit(1);
}

const commentArgs = ['ops:release:bridge-vm-ci-lanes:pr-comment'];
if (dryRun) commentArgs[0] += ':dry';

try {
  console.log(`[run-and-comment] Running: npm run ${commentArgs.join(' ')}`);
  execSync(`npm run ${commentArgs.join(' ')}`, { encoding: 'utf8', stdio: 'inherit' });
} catch (err) {
  console.error('[run-and-comment] PR comment failed:', err.message);
}
