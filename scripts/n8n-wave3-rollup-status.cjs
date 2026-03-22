#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'n8n-w01-workflow-orchestration-latest.json',
  'n8n-w02-trigger-scheduling-latest.json',
  'n8n-w03-webhook-trigger-latest.json',
  'n8n-w04-retry-backoff-latest.json',
  'n8n-w05-failure-observability-latest.json',
  'n8n-w06-template-catalog-latest.json',
  'n8n-w07-mapping-branching-latest.json',
  'n8n-w08-approval-nodes-latest.json',
  'n8n-w09-integration-runtime-latest.json',
  'n8n-w10-workflow-ops-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave3-n8n-workflow-matrix-2026-03-16.md');
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
    'n8n_wave3_first10_lane_artifacts_present',
    laneResults.every((result) => result.status !== 'missing'),
    `present=${laneResults.filter((result) => result.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'n8n_wave3_first10_lane_artifacts_pass',
    laneResults.every((result) => result.status === 'pass'),
    `passing=${laneResults.filter((result) => result.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'n8n_wave3_matrix_first10_rows_implemented',
    matrixSource.includes('| NN-W01 | Workflow graph execution pipeline (create/update/execute + run visibility) | implemented |') &&
      matrixSource.includes('| NN-W02 | Trigger and schedule automation (cron/scheduler + guarded run targets) | implemented |') &&
      matrixSource.includes('| NN-W03 | Webhook trigger to workflow execution (signed ingress + replay defense) | implemented |') &&
      matrixSource.includes('| NN-W04 | Retry and backoff policy per step/run | implemented |') &&
      matrixSource.includes('| NN-W05 | Failure path and dead-letter style observability | implemented |') &&
      matrixSource.includes('| NN-W06 | Template-driven workflow catalog | implemented |') &&
      matrixSource.includes('| NN-W07 | Multi-step data mapping and conditional branching | implemented |') &&
      matrixSource.includes('| NN-W08 | Human-in-the-loop approval nodes in automation chains | implemented |') &&
      matrixSource.includes('| NN-W09 | External integration runtime orchestration reliability | implemented |') &&
      matrixSource.includes('| NN-W10 | Workflow operations dashboard (runs, stale runs, controls) | implemented |'),
    'Wave 3 matrix first-10 rows present and marked implemented',
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
  const outJson = path.join(outDir, 'n8n-wave3-rollup-latest.json');
  const outMd = path.join(outDir, 'n8n-wave3-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n Wave 3 Rollup Status',
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
