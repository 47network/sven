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

  const rollupPath = path.join('docs', 'release', 'status', 'framework-wave4-rollup-latest.json');
  let rollup = null;
  if (exists(rollupPath)) {
    rollup = readJson(rollupPath);
  }

  add(
    'framework_wave4_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );

  add(
    'framework_wave4_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');
  add(
    'framework_wave4_matrix_first10_implemented',
    matrix.includes('| FW-W01 | Multi-agent control plane (spawn-session, routing rules, supervisor orchestration) | implemented |') &&
      matrix.includes('| FW-W02 | Role-based agent handoff and delegated execution policy | implemented |') &&
      matrix.includes('| FW-W03 | Persistent agent memory profile lifecycle (consolidation + recall cadence) | implemented |') &&
      matrix.includes('| FW-W04 | Graph-state orchestration guardrails (state transitions + fail-closed checks) | implemented |') &&
      matrix.includes('| FW-W05 | Multi-agent routing conflict resolution and aggregation policy | implemented |') &&
      matrix.includes('| FW-W06 | Autonomous loop safety envelope (policy scope + bounded retries + stop semantics) | implemented |') &&
      matrix.includes('| FW-W07 | Tool-augmented planner runtime with deterministic audit chain | implemented |') &&
      matrix.includes('| FW-W08 | Long-horizon objective tracking with resumable execution context | implemented |') &&
      matrix.includes('| FW-W09 | Operator governance dashboard for agent fleets (health, controls, telemetry) | implemented |') &&
      matrix.includes('| FW-W10 | Developer-facing framework pattern packaging (contracts + runbooks + examples) | implemented |') &&
      matrix.includes('## First 10 Implemented End-to-End'),
    'matrix marks FW-W01..FW-W10 implemented with first-10 section',
  );

  const program = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  add(
    'framework_wave4_program_snapshot_first10_present',
    program.includes('Wave 4 execution is now bound with first ten framework-absorption lanes and machine evidence:') &&
      program.includes('FW-W10') &&
      program.includes('Wave 4 first-10 rollup'),
    'competitive reproduction program snapshot reflects first-10 Wave 4 execution',
  );

  const packageSource = read('package.json');
  add(
    'framework_wave4_npm_aliases_complete',
    packageSource.includes('"release:framework:w01:status"') &&
      packageSource.includes('"release:framework:w02:status"') &&
      packageSource.includes('"release:framework:w03:status"') &&
      packageSource.includes('"release:framework:w04:status"') &&
      packageSource.includes('"release:framework:w05:status"') &&
      packageSource.includes('"release:framework:w06:status"') &&
      packageSource.includes('"release:framework:w07:status"') &&
      packageSource.includes('"release:framework:w08:status"') &&
      packageSource.includes('"release:framework:w09:status"') &&
      packageSource.includes('"release:framework:w10:status"') &&
      packageSource.includes('"release:framework:wave4:rollup"') &&
      packageSource.includes('"release:framework:wave4:closeout"'),
    'package.json exposes complete first-10 framework aliases and closeout alias',
  );

  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  add(
    'framework_wave4_ci_binding_complete',
    parityWorkflow.includes('npm run -s release:framework:w01:status') &&
      parityWorkflow.includes('npm run -s release:framework:w02:status') &&
      parityWorkflow.includes('npm run -s release:framework:w03:status') &&
      parityWorkflow.includes('npm run -s release:framework:w04:status') &&
      parityWorkflow.includes('npm run -s release:framework:w05:status') &&
      parityWorkflow.includes('npm run -s release:framework:w06:status') &&
      parityWorkflow.includes('npm run -s release:framework:w07:status') &&
      parityWorkflow.includes('npm run -s release:framework:w08:status') &&
      parityWorkflow.includes('npm run -s release:framework:w09:status') &&
      parityWorkflow.includes('npm run -s release:framework:w10:status') &&
      parityWorkflow.includes('npm run -s release:framework:wave4:rollup') &&
      parityWorkflow.includes('npm run -s release:framework:wave4:closeout') &&
      parityWorkflow.includes('framework-w10-pattern-packaging-latest.json') &&
      parityWorkflow.includes('framework-wave4-closeout-latest.json'),
    'parity-e2e workflow binds first-10 framework gates, rollup, closeout, and evidence uploads',
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
  const outJson = path.join(outDir, 'framework-wave4-closeout-latest.json');
  const outMd = path.join(outDir, 'framework-wave4-closeout-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework Wave 4 Closeout Status',
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
