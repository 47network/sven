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

  const rollupPath = path.join('docs', 'release', 'status', 'crewai-wave5-rollup-latest.json');
  let rollup = null;
  if (exists(rollupPath)) {
    rollup = readJson(rollupPath);
  }

  add(
    'crewai_wave5_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );

  add(
    'crewai_wave5_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');
  add(
    'crewai_wave5_matrix_rows_implemented',
    matrix.includes('| CW-W01 | Role-based crew orchestration with routed inter-agent tasks | implemented |') &&
      matrix.includes('| CW-W02 | Sequential crew handoff with deterministic task ownership | implemented |') &&
      matrix.includes('| CW-W03 | Hierarchical manager-worker delegation model | implemented |') &&
      matrix.includes('| CW-W04 | Shared memory/context handoff between agents | implemented |') &&
      matrix.includes('| CW-W05 | Tool-using specialist agents with per-role guardrails | implemented |') &&
      matrix.includes('| CW-W06 | Human-in-the-loop checkpoint in crew execution | implemented |') &&
      matrix.includes('| CW-W07 | Crew retry/recovery for failed delegated tasks | implemented |') &&
      matrix.includes('| CW-W08 | Multi-agent observability (crew timeline + agent diagnostics) | implemented |') &&
      matrix.includes('| CW-W09 | Organization-scoped crew governance and policy boundaries | implemented |') &&
      matrix.includes('| CW-W10 | Reusable crew templates and packaging for production reuse | implemented |'),
    'Wave 5 matrix rows CW-W01..CW-W10 are present and implemented',
  );

  const packageSource = read('package.json');
  add(
    'crewai_wave5_npm_aliases_complete',
    packageSource.includes('"release:crewai:w01:status"') &&
      packageSource.includes('"release:crewai:w10:status"') &&
      packageSource.includes('"release:crewai:wave5:rollup"') &&
      packageSource.includes('"release:crewai:wave5:closeout"'),
    'package.json exposes complete Wave 5 lane/rollup/closeout aliases',
  );

  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  add(
    'crewai_wave5_ci_binding_complete',
    parityWorkflow.includes('npm run -s release:crewai:w01:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w10:status') &&
      parityWorkflow.includes('npm run -s release:crewai:wave5:rollup') &&
      parityWorkflow.includes('npm run -s release:crewai:wave5:closeout') &&
      parityWorkflow.includes('crewai-wave5-closeout-latest.json') &&
      parityWorkflow.includes('crewai-wave5-closeout-latest.md'),
    'parity-e2e workflow binds Wave 5 gates + rollup + closeout and uploads closeout artifacts',
  );

  const program = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  add(
    'crewai_wave5_program_snapshot_present',
    program.includes('CW-W10') &&
      program.includes('crewai-wave5-rollup-latest.json') &&
      program.includes('crewai-wave5-closeout-latest.json'),
    'competitive reproduction program snapshot reflects Wave 5 rollup and closeout evidence',
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
  const outJson = path.join(outDir, 'crewai-wave5-closeout-latest.json');
  const outMd = path.join(outDir, 'crewai-wave5-closeout-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI Wave 5 Closeout Status',
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
