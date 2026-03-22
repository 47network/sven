#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  const rollupPath = path.join('docs', 'release', 'status', 'openhands-wave1-rollup-latest.json');
  const rollup = exists(rollupPath) ? readJson(rollupPath) : null;
  add(
    'openhands_wave1_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );
  add(
    'openhands_wave1_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');
  add(
    'openhands_wave1_matrix_rows_implemented',
    matrix.includes('| OH-W01 | Task -> plan -> execute tools -> summarize outcome | implemented |') &&
      matrix.includes('| OH-W02 | Repository issue -> code patch -> tests -> patch summary | implemented |') &&
      matrix.includes('| OH-W03 | Multi-file refactor with safety checks and rollback path | implemented |') &&
      matrix.includes('| OH-W04 | Long-running task continuity (resume after interruption) | implemented |') &&
      matrix.includes('| OH-W05 | Clarification-first behavior on ambiguous requests | implemented |') &&
      matrix.includes('| OH-W06 | Approval-gated risky operation (write/exec) | implemented |') &&
      matrix.includes('| OH-W07 | Tool failure recovery with bounded retries | implemented |') &&
      matrix.includes('| OH-W08 | Session context compaction without losing task intent | implemented |') &&
      matrix.includes('| OH-W09 | Runtime policy enforcement + auditability for every action | implemented |') &&
      matrix.includes('| OH-W10 | Operator observability for active run (timeline + diagnostics) | implemented |'),
    'Wave 1 matrix rows OH-W01..OH-W10 are present and implemented',
  );

  const pkg = read('package.json');
  add(
    'openhands_wave1_aliases_present',
    pkg.includes('"release:openhands:w01:status"') &&
      pkg.includes('"release:openhands:w02:status"') &&
      pkg.includes('"release:openhands:w03:status"') &&
      pkg.includes('"release:openhands:w04:status"') &&
      pkg.includes('"release:openhands:w05:status"') &&
      pkg.includes('"release:openhands:w06:status"') &&
      pkg.includes('"release:openhands:w07:status"') &&
      pkg.includes('"release:openhands:w08:status"') &&
      pkg.includes('"release:openhands:w09:status"') &&
      pkg.includes('"release:openhands:w10:status"') &&
      pkg.includes('"release:openhands:wave1:rollup"') &&
      pkg.includes('"release:openhands:wave1:closeout"'),
    'package.json exposes OpenHands Wave 1 lane/rollup/closeout aliases',
  );

  const workflow = read('.github/workflows/parity-e2e.yml');
  add(
    'openhands_wave1_ci_binding_present',
    workflow.includes('npm run -s release:openhands:w01:status') &&
      workflow.includes('npm run -s release:openhands:w02:status') &&
      workflow.includes('npm run -s release:openhands:w03:status') &&
      workflow.includes('npm run -s release:openhands:w04:status') &&
      workflow.includes('npm run -s release:openhands:w05:status') &&
      workflow.includes('npm run -s release:openhands:w06:status') &&
      workflow.includes('npm run -s release:openhands:w07:status') &&
      workflow.includes('npm run -s release:openhands:w08:status') &&
      workflow.includes('npm run -s release:openhands:w09:status') &&
      workflow.includes('npm run -s release:openhands:w10:status') &&
      workflow.includes('npm run -s release:openhands:wave1:rollup') &&
      workflow.includes('npm run -s release:openhands:wave1:closeout') &&
      workflow.includes('openhands-wave1-closeout-latest.json') &&
      workflow.includes('openhands-wave1-closeout-latest.md'),
    'parity-e2e workflow binds OpenHands Wave 1 closeout execution and artifact upload',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = { generated_at: generatedAt, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'openhands-wave1-closeout-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'openhands-wave1-closeout-latest.md'),
    ['# OpenHands Wave 1 Closeout Status', '', `Generated: ${generatedAt}`, `Status: ${status}`, `Passed: ${passed}`, `Failed: ${failed}`, '', '## Checks', ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`), ''].join('\n'),
    'utf8',
  );
  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
