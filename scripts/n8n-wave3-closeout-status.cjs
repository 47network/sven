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

  const rollupPath = path.join('docs', 'release', 'status', 'n8n-wave3-rollup-latest.json');
  const rollup = exists(rollupPath) ? readJson(rollupPath) : null;
  add(
    'n8n_wave3_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );
  add(
    'n8n_wave3_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');
  add(
    'n8n_wave3_matrix_rows_implemented',
    matrix.includes('| NN-W01 | Workflow graph execution pipeline (create/update/execute + run visibility) | implemented |') &&
      matrix.includes('| NN-W02 | Trigger and schedule automation (cron/scheduler + guarded run targets) | implemented |') &&
      matrix.includes('| NN-W03 | Webhook trigger to workflow execution (signed ingress + replay defense) | implemented |') &&
      matrix.includes('| NN-W04 | Retry and backoff policy per step/run | implemented |') &&
      matrix.includes('| NN-W05 | Failure path and dead-letter style observability | implemented |') &&
      matrix.includes('| NN-W06 | Template-driven workflow catalog | implemented |') &&
      matrix.includes('| NN-W07 | Multi-step data mapping and conditional branching | implemented |') &&
      matrix.includes('| NN-W08 | Human-in-the-loop approval nodes in automation chains | implemented |') &&
      matrix.includes('| NN-W09 | External integration runtime orchestration reliability | implemented |') &&
      matrix.includes('| NN-W10 | Workflow operations dashboard (runs, stale runs, controls) | implemented |'),
    'Wave 3 matrix rows NN-W01..NN-W10 are present and implemented',
  );

  const pkg = read('package.json');
  add(
    'n8n_wave3_aliases_present',
    pkg.includes('"release:n8n:w01:status"') &&
      pkg.includes('"release:n8n:w10:status"') &&
      pkg.includes('"release:n8n:wave3:rollup"') &&
      pkg.includes('"release:n8n:wave3:closeout"'),
    'package.json exposes n8n Wave 3 lane/rollup/closeout aliases',
  );

  const workflow = read('.github/workflows/parity-e2e.yml');
  add(
    'n8n_wave3_ci_binding_present',
    workflow.includes('npm run -s release:n8n:w01:status') &&
      workflow.includes('npm run -s release:n8n:w10:status') &&
      workflow.includes('npm run -s release:n8n:wave3:rollup') &&
      workflow.includes('npm run -s release:n8n:wave3:closeout') &&
      workflow.includes('n8n-wave3-closeout-latest.json') &&
      workflow.includes('n8n-wave3-closeout-latest.md'),
    'parity-e2e workflow binds n8n Wave 3 closeout execution and artifact upload',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = { generated_at: generatedAt, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'n8n-wave3-closeout-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'n8n-wave3-closeout-latest.md'),
    ['# n8n Wave 3 Closeout Status', '', `Generated: ${generatedAt}`, `Status: ${status}`, `Passed: ${passed}`, `Failed: ${failed}`, '', '## Checks', ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`), ''].join('\n'),
    'utf8',
  );
  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
