#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'openhands-w01-task-plan-execute-latest.json',
  'openhands-w02-issue-to-patch-latest.json',
  'openhands-w03-multifile-refactor-latest.json',
  'openhands-w04-resume-latest.json',
  'openhands-w05-clarification-latest.json',
  'openhands-w06-approval-gate-latest.json',
  'openhands-w07-retry-recovery-latest.json',
  'openhands-w08-compaction-fidelity-latest.json',
  'openhands-w09-policy-audit-latest.json',
  'openhands-w10-observability-latest.json',
];

const firstWaveObjectives = [
  'openhands-w01-task-plan-execute-latest.json',
  'openhands-w02-issue-to-patch-latest.json',
  'openhands-w04-resume-latest.json',
  'openhands-w05-clarification-latest.json',
  'openhands-w06-approval-gate-latest.json',
  'openhands-w07-retry-recovery-latest.json',
  'openhands-w08-compaction-fidelity-latest.json',
  'openhands-w09-policy-audit-latest.json',
  'openhands-w10-observability-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave1-openhands-workflow-matrix-2026-03-16.md');
  const matrixSource = fs.readFileSync(matrixPath, 'utf8');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  const laneResults = [];
  for (const file of lanes) {
    const full = path.join(outDir, file);
    if (!fs.existsSync(full)) {
      laneResults.push({ file, status: 'missing' });
      continue;
    }
    const parsed = readJson(full);
    laneResults.push({ file, status: String(parsed.status || 'unknown'), generated_at: parsed.generated_at || null });
  }

  add(
    'openhands_wave1_w01_w10_lane_artifacts_present',
    laneResults.every((r) => r.status !== 'missing'),
    `present=${laneResults.filter((r) => r.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'openhands_wave1_w01_w10_lane_artifacts_pass',
    laneResults.every((r) => r.status === 'pass'),
    `passing=${laneResults.filter((r) => r.status === 'pass').length}/${lanes.length}`,
  );

  const firstObjectiveResults = laneResults.filter((lane) => firstWaveObjectives.includes(lane.file));
  add(
    'openhands_wave1_first_objective_pass',
    firstObjectiveResults.length === firstWaveObjectives.length && firstObjectiveResults.every((lane) => lane.status === 'pass'),
    `passing=${firstObjectiveResults.filter((lane) => lane.status === 'pass').length}/${firstWaveObjectives.length} (W01,W02,W04,W05,W06,W07,W08,W09,W10)`,
  );

  add(
    'openhands_wave1_matrix_rows_w01_w10_implemented',
    matrixSource.includes('| OH-W01 | Task -> plan -> execute tools -> summarize outcome | implemented |') &&
      matrixSource.includes('| OH-W02 | Repository issue -> code patch -> tests -> patch summary | implemented |') &&
      matrixSource.includes('| OH-W03 | Multi-file refactor with safety checks and rollback path | implemented |') &&
      matrixSource.includes('| OH-W04 | Long-running task continuity (resume after interruption) | implemented |') &&
      matrixSource.includes('| OH-W05 | Clarification-first behavior on ambiguous requests | implemented |') &&
      matrixSource.includes('| OH-W06 | Approval-gated risky operation (write/exec) | implemented |') &&
      matrixSource.includes('| OH-W07 | Tool failure recovery with bounded retries | implemented |') &&
      matrixSource.includes('| OH-W08 | Session context compaction without losing task intent | implemented |') &&
      matrixSource.includes('| OH-W09 | Runtime policy enforcement + auditability for every action | implemented |') &&
      matrixSource.includes('| OH-W10 | Operator observability for active run (timeline + diagnostics) | implemented |'),
    'Wave 1 matrix rows OH-W01..OH-W10 are present and marked implemented',
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
    lanes: laneResults,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'openhands-wave1-rollup-latest.json');
  const outMd = path.join(outDir, 'openhands-wave1-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands Wave 1 Rollup Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Lanes',
      ...laneResults.map((lane) => `- ${lane.file}: ${lane.status}${lane.generated_at ? ` (generated_at=${lane.generated_at})` : ''}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
