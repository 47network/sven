#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const promoteWeek4 = args.has('--promote-week4');

const summaryPath = path.join(root, 'docs', 'release', 'status', 'soak-72h-summary.json');
const runPath = path.join(root, 'docs', 'release', 'status', 'soak-72h-run.json');
const gatesPath = path.join(root, 'docs', 'release', 'status', 'ci-gates.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(absPath, label) {
  if (!fs.existsSync(absPath)) {
    fail(`Missing ${label}: ${path.relative(root, absPath)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    fail(`Failed to parse ${label}: ${String(err && err.message ? err.message : err)}`);
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function validateSoak(summary, run) {
  const status = String(summary && summary.status ? summary.status : '').toLowerCase();
  if (status !== 'pass') {
    fail(`Cannot promote soak gate: summary status is '${status || 'missing'}' (must be 'pass').`);
  }

  const failures = Number(summary && summary.failures != null ? summary.failures : 0);
  if (!Number.isFinite(failures) || failures > 0) {
    fail(`Cannot promote soak gate: failures=${String(summary && summary.failures)} (must be 0).`);
  }

  const samples = Number(summary && summary.samples != null ? summary.samples : NaN);
  const expectedSamples = Number(summary && summary.expected_samples != null ? summary.expected_samples : NaN);
  if (Number.isFinite(samples) && Number.isFinite(expectedSamples) && expectedSamples > 0 && samples < expectedSamples) {
    fail(`Cannot promote soak gate: samples=${samples} < expected_samples=${expectedSamples}.`);
  }

  const pid = Number(run && run.soak_pid != null ? run.soak_pid : NaN);
  if (Number.isFinite(pid) && isPidAlive(pid)) {
    fail(`Cannot promote soak gate while soak process is still running (PID=${pid}).`);
  }
}

function runCommand(cmd, argv) {
  const result = spawnSync(cmd, argv, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const summary = readJson(summaryPath, 'soak summary');
  const run = readJson(runPath, 'soak run metadata');
  const gates = readJson(gatesPath, 'release gates');

  validateSoak(summary, run);

  const next = { ...gates, generated_at: new Date().toISOString(), soak_72h: true };
  if (promoteWeek4) {
    next.week4_rc_complete = true;
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          action: 'dry-run',
          updates: {
            soak_72h: true,
            week4_rc_complete: promoteWeek4 ? true : gates.week4_rc_complete,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  fs.writeFileSync(gatesPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  runCommand('npm', ['run', 'release:status']);
  runCommand('npm', ['run', 'release:checklist:update']);

  console.log(`Promoted soak gates from ${path.relative(root, summaryPath)}.`);
  console.log(`Updated ${path.relative(root, gatesPath)} (soak_72h=true${promoteWeek4 ? ', week4_rc_complete=true' : ''}).`);
}

main();
