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

  const rollupPath = path.join('docs', 'release', 'status', 'langgraph-wave8-rollup-latest.json');
  const rollup = exists(rollupPath) ? readJson(rollupPath) : null;
  add(
    'langgraph_wave8_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );
  add(
    'langgraph_wave8_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  add(
    'langgraph_wave8_matrix_rows_implemented',
    matrix.includes('| LG-W01 | Stateful graph orchestration with DAG validation and fail-closed transitions | implemented |') &&
      matrix.includes('| LG-W02 | Conditional branch routing with deterministic edge predicates | implemented |') &&
      matrix.includes('| LG-W03 | Checkpointed graph state snapshots and resumable execution | implemented |') &&
      matrix.includes('| LG-W04 | Human-in-the-loop interrupt nodes with explicit approval resume | implemented |') &&
      matrix.includes('| LG-W05 | Tool node execution guardrails with per-node policy scope | implemented |') &&
      matrix.includes('| LG-W06 | Retry policies and bounded error recovery edges | implemented |') &&
      matrix.includes('| LG-W07 | Shared graph context propagation across nodes and steps | implemented |') &&
      matrix.includes('| LG-W08 | Graph execution observability timeline + per-node diagnostics | implemented |') &&
      matrix.includes('| LG-W09 | Organization-scoped graph governance and policy isolation | implemented |') &&
      matrix.includes('| LG-W10 | Reusable graph template packaging for production operations | implemented |'),
    'Wave 8 matrix rows LG-W01..LG-W10 are present and implemented',
  );

  const packageSource = read('package.json');
  add(
    'langgraph_wave8_npm_aliases_complete',
    packageSource.includes('"release:langgraph:w01:status"') &&
      packageSource.includes('"release:langgraph:w10:status"') &&
      packageSource.includes('"release:langgraph:wave8:rollup"') &&
      packageSource.includes('"release:langgraph:wave8:closeout"'),
    'package.json exposes complete Wave 8 lane/rollup/closeout aliases',
  );

  const program = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  add(
    'langgraph_wave8_program_snapshot_present',
    program.includes('LG-W10') &&
      program.includes('langgraph-wave8-rollup-latest.json') &&
      program.includes('langgraph-wave8-closeout-latest.json'),
    'competitive reproduction program snapshot reflects Wave 8 rollup and closeout evidence',
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
  const outJson = path.join(outDir, 'langgraph-wave8-closeout-latest.json');
  const outMd = path.join(outDir, 'langgraph-wave8-closeout-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph Wave 8 Closeout Status',
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

