#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'langgraph-w01-stateful-graph-orchestration-latest.json',
  'langgraph-w02-branch-routing-latest.json',
  'langgraph-w03-checkpoint-resume-latest.json',
  'langgraph-w04-hitl-interrupt-latest.json',
  'langgraph-w05-tool-node-policy-latest.json',
  'langgraph-w06-retry-recovery-edges-latest.json',
  'langgraph-w07-shared-context-latest.json',
  'langgraph-w08-graph-observability-latest.json',
  'langgraph-w09-graph-policy-isolation-latest.json',
  'langgraph-w10-graph-packaging-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave8-langgraph-workflow-matrix-2026-03-16.md');
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
    'langgraph_wave8_all_lane_artifacts_present',
    laneResults.every((r) => r.status !== 'missing'),
    `present=${laneResults.filter((r) => r.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'langgraph_wave8_all_lane_artifacts_pass',
    laneResults.every((r) => r.status === 'pass'),
    `passing=${laneResults.filter((r) => r.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'langgraph_wave8_matrix_rows_all_implemented',
    matrixSource.includes('| LG-W01 | Stateful graph orchestration with DAG validation and fail-closed transitions | implemented |') &&
      matrixSource.includes('| LG-W02 | Conditional branch routing with deterministic edge predicates | implemented |') &&
      matrixSource.includes('| LG-W03 | Checkpointed graph state snapshots and resumable execution | implemented |') &&
      matrixSource.includes('| LG-W04 | Human-in-the-loop interrupt nodes with explicit approval resume | implemented |') &&
      matrixSource.includes('| LG-W05 | Tool node execution guardrails with per-node policy scope | implemented |') &&
      matrixSource.includes('| LG-W06 | Retry policies and bounded error recovery edges | implemented |') &&
      matrixSource.includes('| LG-W07 | Shared graph context propagation across nodes and steps | implemented |') &&
      matrixSource.includes('| LG-W08 | Graph execution observability timeline + per-node diagnostics | implemented |') &&
      matrixSource.includes('| LG-W09 | Organization-scoped graph governance and policy isolation | implemented |') &&
      matrixSource.includes('| LG-W10 | Reusable graph template packaging for production operations | implemented |'),
    'all ten Wave 8 rows are present and implemented',
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
  const outJson = path.join(outDir, 'langgraph-wave8-rollup-latest.json');
  const outMd = path.join(outDir, 'langgraph-wave8-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph Wave 8 Rollup Status',
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

