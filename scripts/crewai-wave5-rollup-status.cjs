#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'crewai-w01-role-task-crew-latest.json',
  'crewai-w02-sequential-handoff-latest.json',
  'crewai-w03-manager-worker-latest.json',
  'crewai-w04-shared-context-latest.json',
  'crewai-w05-specialist-tools-latest.json',
  'crewai-w06-human-checkpoint-latest.json',
  'crewai-w07-delegated-retry-latest.json',
  'crewai-w08-crew-observability-latest.json',
  'crewai-w09-crew-governance-latest.json',
  'crewai-w10-template-packaging-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave5-crewai-workflow-matrix-2026-03-16.md');
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
    'crewai_wave5_all_lane_artifacts_present',
    laneResults.every((r) => r.status !== 'missing'),
    `present=${laneResults.filter((r) => r.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'crewai_wave5_all_lane_artifacts_pass',
    laneResults.every((r) => r.status === 'pass'),
    `passing=${laneResults.filter((r) => r.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'crewai_wave5_matrix_rows_all_implemented',
    matrixSource.includes('| CW-W01 | Role-based crew orchestration with routed inter-agent tasks | implemented |') &&
      matrixSource.includes('| CW-W02 | Sequential crew handoff with deterministic task ownership | implemented |') &&
      matrixSource.includes('| CW-W03 | Hierarchical manager-worker delegation model | implemented |') &&
      matrixSource.includes('| CW-W04 | Shared memory/context handoff between agents | implemented |') &&
      matrixSource.includes('| CW-W05 | Tool-using specialist agents with per-role guardrails | implemented |') &&
      matrixSource.includes('| CW-W06 | Human-in-the-loop checkpoint in crew execution | implemented |') &&
      matrixSource.includes('| CW-W07 | Crew retry/recovery for failed delegated tasks | implemented |') &&
      matrixSource.includes('| CW-W08 | Multi-agent observability (crew timeline + agent diagnostics) | implemented |') &&
      matrixSource.includes('| CW-W09 | Organization-scoped crew governance and policy boundaries | implemented |') &&
      matrixSource.includes('| CW-W10 | Reusable crew templates and packaging for production reuse | implemented |'),
    'all ten Wave 5 rows are present and implemented',
  );

  const passed = checks.filter((c) => c.pass).length;
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
  const outJson = path.join(outDir, 'crewai-wave5-rollup-latest.json');
  const outMd = path.join(outDir, 'crewai-wave5-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI Wave 5 Rollup Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
      '## Lanes',
      ...laneResults.map((l) => `- ${l.file}: ${l.status}${l.generated_at ? ` (generated_at=${l.generated_at})` : ''}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
