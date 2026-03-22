#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'bridge-vm-ci-lanes-latest.json');
const outMd = path.join(outDir, 'bridge-vm-ci-lanes-latest.md');
const strict = process.argv.includes('--strict');
const skipRemote = process.argv.includes('--skip-remote');

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return {
    code: result.status ?? -1,
    out: String(result.stdout || '').trim(),
    err: String(result.stderr || '').trim(),
  };
}

function commandResult(id, cmd, args) {
  const full = [cmd, ...args].join(' ');
  const startedAt = new Date().toISOString();
  const r = run(cmd, args);
  const endedAt = new Date().toISOString();
  return {
    id,
    command: full,
    started_at: startedAt,
    ended_at: endedAt,
    pass: r.code === 0,
    exit_code: r.code,
    detail: r.code === 0
      ? 'ok'
      : (r.err || r.out || `exit ${String(r.code)}`),
    stdout_tail: r.out.split('\n').slice(-20).join('\n'),
    stderr_tail: r.err.split('\n').slice(-20).join('\n'),
  };
}

const checks = [];

checks.push(
  commandResult('ci_required_local', 'npm', ['run', '-s', 'release:ci:required:check:local']),
);
checks.push(
  commandResult('final_signoff_local', 'npm', ['run', '-s', 'release:final:signoff:check:local']),
);
checks.push(
  commandResult('bridge_lanes_local_strict', 'npm', ['run', '-s', 'ops:release:bridge-ci-lanes:check:local:strict']),
);

if (!skipRemote) {
  checks.push(
    commandResult('bridge_lanes_remote_strict', 'npm', ['run', '-s', 'ops:release:bridge-ci-lanes:remote:strict']),
  );
}

const localChecks = checks.filter((check) => check.id !== 'bridge_lanes_remote_strict');
const status = localChecks.every((check) => check.pass) ? 'pass' : 'fail';
const remoteStatus = checks.find((check) => check.id === 'bridge_lanes_remote_strict') || null;

const report = {
  generated_at: new Date().toISOString(),
  status,
  execution: {
    strict,
    skip_remote: skipRemote,
    authority: 'vm-local',
  },
  checks,
  artifact_paths: {
    ci_required_local: 'docs/release/status/ci-required-checks-local-only.json',
    final_signoff_local: 'docs/release/status/final-signoff-local-latest.json',
    bridge_lanes_local: 'docs/release/status/bridge-ci-lanes-latest.json',
    bridge_lanes_remote: 'docs/release/status/bridge-ci-lanes-remote-latest.json',
    output_json: 'docs/release/status/bridge-vm-ci-lanes-latest.json',
    output_md: 'docs/release/status/bridge-vm-ci-lanes-latest.md',
  },
  notes: {
    remote_check: skipRemote
      ? 'skipped by --skip-remote'
      : remoteStatus && remoteStatus.pass
        ? 'remote bridge lane check passed'
        : 'remote bridge lane check failed or unavailable (non-blocking for vm-local status)',
  },
};

const md = [
  '# Bridge VM CI Lanes',
  '',
  `- Generated at: ${report.generated_at}`,
  `- Status (vm-local authority): ${report.status}`,
  `- strict: ${String(strict)}`,
  `- skip_remote: ${String(skipRemote)}`,
  '',
  '## Checks',
  ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.command} -> ${check.detail}`),
  '',
  '## Artifacts',
  ...Object.entries(report.artifact_paths).map(([key, value]) => `- ${key}: ${value}`),
  '',
  '## Notes',
  `- remote_check: ${report.notes.remote_check}`,
  '',
].join('\n');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');
fs.writeFileSync(outMd, md, 'utf8');

console.log(`Wrote ${path.relative(root, outJson).replace(/\\/g, '/')}`);
console.log(`Wrote ${path.relative(root, outMd).replace(/\\/g, '/')}`);

if (strict && status !== 'pass') {
  process.exitCode = 1;
}
