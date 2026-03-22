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

  const rollupPath = path.join('docs', 'release', 'status', 'librechat-wave2-rollup-latest.json');
  const rollup = exists(rollupPath) ? readJson(rollupPath) : null;
  add(
    'librechat_wave2_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );
  add(
    'librechat_wave2_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');
  add(
    'librechat_wave2_matrix_rows_implemented',
    matrix.includes('| LC-W01 |') &&
      matrix.includes('| LC-W02 |') &&
      matrix.includes('| LC-W03 |') &&
      matrix.includes('| LC-W04 |') &&
      matrix.includes('| LC-W05 |') &&
      matrix.includes('| LC-W06 |') &&
      matrix.includes('| LC-W07 |') &&
      matrix.includes('| LC-W08 |') &&
      matrix.includes('| LC-W09 | Agent handoff and continuation in same thread | implemented |') &&
      matrix.includes('| LC-W10 |'),
    'Wave 2 matrix rows LC-W01..LC-W10 are present with implemented state anchors',
  );

  const pkg = read('package.json');
  add(
    'librechat_wave2_aliases_present',
    pkg.includes('"release:librechat:w01:status"') &&
      pkg.includes('"release:librechat:w10:status"') &&
      pkg.includes('"release:librechat:wave2:rollup"') &&
      pkg.includes('"release:librechat:wave2:closeout"'),
    'package.json exposes LibreChat Wave 2 lane/rollup/closeout aliases',
  );

  const workflow = read('.github/workflows/parity-e2e.yml');
  add(
    'librechat_wave2_ci_binding_present',
    workflow.includes('npm run -s release:librechat:w01:status') &&
      workflow.includes('npm run -s release:librechat:w10:status') &&
      workflow.includes('npm run -s release:librechat:wave2:rollup') &&
      workflow.includes('npm run -s release:librechat:wave2:closeout') &&
      workflow.includes('librechat-wave2-closeout-latest.json') &&
      workflow.includes('librechat-wave2-closeout-latest.md'),
    'parity-e2e workflow binds LibreChat Wave 2 closeout execution and artifact upload',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = { generated_at: generatedAt, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'librechat-wave2-closeout-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'librechat-wave2-closeout-latest.md'),
    ['# LibreChat Wave 2 Closeout Status', '', `Generated: ${generatedAt}`, `Status: ${status}`, `Passed: ${passed}`, `Failed: ${failed}`, '', '## Checks', ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`), ''].join('\n'),
    'utf8',
  );
  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
