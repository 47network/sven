#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'framework-w01-multi-agent-control-plane-latest.json',
  'framework-w02-delegated-handoff-latest.json',
  'framework-w03-memory-profile-latest.json',
  'framework-w04-graph-state-latest.json',
  'framework-w05-conflict-resolution-latest.json',
  'framework-w06-autonomous-loop-safety-latest.json',
  'framework-w07-planner-audit-latest.json',
  'framework-w08-objective-resume-latest.json',
  'framework-w09-fleet-governance-latest.json',
  'framework-w10-pattern-packaging-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave4-framework-absorption-matrix-2026-03-16.md');
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
    'framework_wave4_first10_lane_artifacts_present',
    laneResults.every((result) => result.status !== 'missing'),
    `present=${laneResults.filter((result) => result.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'framework_wave4_first10_lane_artifacts_pass',
    laneResults.every((result) => result.status === 'pass'),
    `passing=${laneResults.filter((result) => result.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'framework_wave4_matrix_first10_rows_implemented',
    matrixSource.includes('| FW-W01 | Multi-agent control plane (spawn-session, routing rules, supervisor orchestration) | implemented |') &&
      matrixSource.includes('| FW-W02 | Role-based agent handoff and delegated execution policy | implemented |') &&
      matrixSource.includes('| FW-W03 | Persistent agent memory profile lifecycle (consolidation + recall cadence) | implemented |') &&
      matrixSource.includes('| FW-W04 | Graph-state orchestration guardrails (state transitions + fail-closed checks) | implemented |') &&
      matrixSource.includes('| FW-W05 | Multi-agent routing conflict resolution and aggregation policy | implemented |') &&
      matrixSource.includes('| FW-W06 | Autonomous loop safety envelope (policy scope + bounded retries + stop semantics) | implemented |') &&
      matrixSource.includes('| FW-W07 | Tool-augmented planner runtime with deterministic audit chain | implemented |') &&
      matrixSource.includes('| FW-W08 | Long-horizon objective tracking with resumable execution context | implemented |') &&
      matrixSource.includes('| FW-W09 | Operator governance dashboard for agent fleets (health, controls, telemetry) | implemented |') &&
      matrixSource.includes('| FW-W10 | Developer-facing framework pattern packaging (contracts + runbooks + examples) | implemented |'),
    'Wave 4 matrix first-10 rows present and marked implemented',
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
  const outJson = path.join(outDir, 'framework-wave4-rollup-latest.json');
  const outMd = path.join(outDir, 'framework-wave4-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework Wave 4 Rollup Status',
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
