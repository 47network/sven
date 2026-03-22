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

  const rollupPath = path.join('docs', 'release', 'status', 'autogen-wave7-rollup-latest.json');
  const rollup = exists(rollupPath) ? readJson(rollupPath) : null;
  add(
    'autogen_wave7_rollup_status_pass',
    Boolean(rollup && rollup.status === 'pass'),
    rollup ? `rollup_status=${String(rollup.status || 'unknown')}` : 'rollup artifact missing',
  );
  add(
    'autogen_wave7_rollup_lanes_complete',
    Boolean(rollup && Array.isArray(rollup.lanes) && rollup.lanes.length === 10 && rollup.lanes.every((lane) => lane.status === 'pass')),
    rollup && Array.isArray(rollup.lanes)
      ? `lanes_pass=${rollup.lanes.filter((lane) => lane.status === 'pass').length}/${rollup.lanes.length}`
      : 'rollup lanes missing',
  );

  const matrix = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  add(
    'autogen_wave7_matrix_rows_implemented',
    matrix.includes('| AG-W01 | Multi-agent AgentChat orchestration with supervisor + delegated worker turns | implemented |') &&
      matrix.includes('| AG-W02 | Team conversation lifecycle controls (pause/resume/terminate/restart) | implemented |') &&
      matrix.includes('| AG-W03 | Agent role envelopes with deterministic speaker-selection policy | implemented |') &&
      matrix.includes('| AG-W04 | Human-in-the-loop checkpoints in agent team conversations | implemented |') &&
      matrix.includes('| AG-W05 | Tool-using assistant agent within team chat | implemented |') &&
      matrix.includes('| AG-W06 | Code-execution agent participation with safety boundaries | implemented |') &&
      matrix.includes('| AG-W07 | Bounded retry and recovery behavior in multi-agent chat loops | implemented |') &&
      matrix.includes('| AG-W08 | Team transcript observability and replay diagnostics | implemented |') &&
      matrix.includes('| AG-W09 | Org-scoped policy and isolation across team-agent conversations | implemented |') &&
      matrix.includes('| AG-W10 | Reusable AutoGen-style team templates and packaging | implemented |'),
    'Wave 7 matrix rows AG-W01..AG-W10 are present and implemented',
  );

  const packageSource = read('package.json');
  add(
    'autogen_wave7_npm_aliases_complete',
    packageSource.includes('"release:autogen:w01:status"') &&
      packageSource.includes('"release:autogen:w10:status"') &&
      packageSource.includes('"release:autogen:wave7:rollup"') &&
      packageSource.includes('"release:autogen:wave7:closeout"'),
    'package.json exposes complete Wave 7 lane/rollup/closeout aliases',
  );

  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  add(
    'autogen_wave7_ci_binding_complete',
    parityWorkflow.includes('npm run -s release:autogen:w01:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w10:status') &&
      parityWorkflow.includes('npm run -s release:autogen:wave7:rollup') &&
      parityWorkflow.includes('npm run -s release:autogen:wave7:closeout') &&
      parityWorkflow.includes('autogen-wave7-closeout-latest.json') &&
      parityWorkflow.includes('autogen-wave7-closeout-latest.md'),
    'parity-e2e workflow binds Wave 7 gates + rollup + closeout and uploads closeout artifacts',
  );

  const program = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  add(
    'autogen_wave7_program_snapshot_present',
    program.includes('AG-W10') &&
      program.includes('autogen-wave7-rollup-latest.json') &&
      program.includes('autogen-wave7-closeout-latest.json'),
    'competitive reproduction program snapshot reflects Wave 7 rollup and closeout evidence',
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
  const outJson = path.join(outDir, 'autogen-wave7-closeout-latest.json');
  const outMd = path.join(outDir, 'autogen-wave7-closeout-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen Wave 7 Closeout Status',
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

