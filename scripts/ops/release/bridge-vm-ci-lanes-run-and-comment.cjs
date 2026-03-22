#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');

const strict = process.argv.includes('--strict');
const includeRemote = process.argv.includes('--include-remote');
const dryRun = process.argv.includes('--dry-run');
const repoArgIndex = process.argv.findIndex((arg) => arg === '--repo');
const prArgIndex = process.argv.findIndex((arg) => arg === '--pr');

const repoArg = repoArgIndex >= 0 ? String(process.argv[repoArgIndex + 1] || '').trim() : '';
const prArg = prArgIndex >= 0 ? String(process.argv[prArgIndex + 1] || '').trim() : '';

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return result.status ?? -1;
}

const vmFlags = [];
if (strict) vmFlags.push('--strict');
if (!includeRemote) vmFlags.push('--skip-remote');
const vmLaneArgs = ['run', '-s', 'ops:release:bridge-vm-ci-lanes', ...(vmFlags.length ? ['--', ...vmFlags] : [])];

const vmExit = run('npm', vmLaneArgs);
if (vmExit !== 0) {
  process.exit(vmExit);
}

const prCommentArgs = ['run', '-s', 'ops:release:bridge-vm-ci-lanes:pr-comment', '--'];
if (dryRun) prCommentArgs.push('--dry-run');
if (repoArg) prCommentArgs.push('--repo', repoArg);
if (prArg) prCommentArgs.push('--pr', prArg);

const commentExit = run('npm', prCommentArgs);
if (commentExit !== 0) {
  process.exit(commentExit);
}
