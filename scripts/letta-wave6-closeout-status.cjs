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

  const rollupPath = path.join('docs', 'release', 'status', 'letta-wave6-rollup-latest.json');
  const rollup = exists(rollupPath) ? readJson(rollupPath) : null;
  add(
    'letta_wave6_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );
  add(
    'letta_wave6_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  add(
    'letta_wave6_matrix_rows_implemented',
    matrix.includes('| LT-W01 | Memory block lifecycle (capture -> consolidate -> delayed recall) | implemented |') &&
      matrix.includes('| LT-W02 | Editable identity memory profile with governance boundaries | implemented |') &&
      matrix.includes('| LT-W03 | Session memory scopes (short-term vs long-term recall policy) | implemented |') &&
      matrix.includes('| LT-W04 | Memory write gate with policy + consent fail-closed semantics | implemented |') &&
      matrix.includes('| LT-W05 | Memory retrieval quality controls (overlap, decay, relevance tuning) | implemented |') &&
      matrix.includes('| LT-W06 | Background memory maintenance jobs with bounded retries | implemented |') &&
      matrix.includes('| LT-W07 | Memory inspection UX for operators and developers | implemented |') &&
      matrix.includes('| LT-W08 | Memory compaction safeguards under high-turn sessions | implemented |') &&
      matrix.includes('| LT-W09 | Multi-agent shared memory hygiene with org isolation | implemented |') &&
      matrix.includes('| LT-W10 | Memory package/runbook packaging for production operations | implemented |'),
    'Wave 6 matrix rows LT-W01..LT-W10 are present and implemented',
  );

  const packageSource = read('package.json');
  add(
    'letta_wave6_npm_aliases_complete',
    packageSource.includes('"release:letta:w01:status"') &&
      packageSource.includes('"release:letta:w10:status"') &&
      packageSource.includes('"release:letta:wave6:rollup"') &&
      packageSource.includes('"release:letta:wave6:closeout"'),
    'package.json exposes complete Wave 6 lane/rollup/closeout aliases',
  );

  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  add(
    'letta_wave6_ci_binding_complete',
    parityWorkflow.includes('npm run -s release:letta:w01:status') &&
      parityWorkflow.includes('npm run -s release:letta:w10:status') &&
      parityWorkflow.includes('npm run -s release:letta:wave6:rollup') &&
      parityWorkflow.includes('npm run -s release:letta:wave6:closeout') &&
      parityWorkflow.includes('letta-wave6-closeout-latest.json') &&
      parityWorkflow.includes('letta-wave6-closeout-latest.md'),
    'parity-e2e workflow binds Wave 6 gates + rollup + closeout and uploads closeout artifacts',
  );

  const program = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  add(
    'letta_wave6_program_snapshot_present',
    program.includes('LT-W10') &&
      program.includes('letta-wave6-rollup-latest.json') &&
      program.includes('letta-wave6-closeout-latest.json'),
    'competitive reproduction program snapshot reflects Wave 6 rollup and closeout evidence',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = {
    generated_at: generatedAt,
    status,
    passed,
    failed,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'letta-wave6-closeout-latest.json');
  const outMd = path.join(outDir, 'letta-wave6-closeout-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta Wave 6 Closeout Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
