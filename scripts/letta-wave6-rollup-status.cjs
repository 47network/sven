#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'letta-w01-memory-block-lifecycle-latest.json',
  'letta-w02-identity-profile-governance-latest.json',
  'letta-w03-memory-scope-separation-latest.json',
  'letta-w04-memory-write-gate-latest.json',
  'letta-w05-memory-retrieval-quality-latest.json',
  'letta-w06-memory-maintenance-jobs-latest.json',
  'letta-w07-memory-inspection-ux-latest.json',
  'letta-w08-compaction-safeguards-latest.json',
  'letta-w09-shared-memory-isolation-latest.json',
  'letta-w10-memory-packaging-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave6-letta-workflow-matrix-2026-03-16.md');
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
    'letta_wave6_all_lane_artifacts_present',
    laneResults.every((r) => r.status !== 'missing'),
    `present=${laneResults.filter((r) => r.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'letta_wave6_all_lane_artifacts_pass',
    laneResults.every((r) => r.status === 'pass'),
    `passing=${laneResults.filter((r) => r.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'letta_wave6_matrix_rows_all_implemented',
    matrixSource.includes('| LT-W01 | Memory block lifecycle (capture -> consolidate -> delayed recall) | implemented |') &&
      matrixSource.includes('| LT-W02 | Editable identity memory profile with governance boundaries | implemented |') &&
      matrixSource.includes('| LT-W03 | Session memory scopes (short-term vs long-term recall policy) | implemented |') &&
      matrixSource.includes('| LT-W04 | Memory write gate with policy + consent fail-closed semantics | implemented |') &&
      matrixSource.includes('| LT-W05 | Memory retrieval quality controls (overlap, decay, relevance tuning) | implemented |') &&
      matrixSource.includes('| LT-W06 | Background memory maintenance jobs with bounded retries | implemented |') &&
      matrixSource.includes('| LT-W07 | Memory inspection UX for operators and developers | implemented |') &&
      matrixSource.includes('| LT-W08 | Memory compaction safeguards under high-turn sessions | implemented |') &&
      matrixSource.includes('| LT-W09 | Multi-agent shared memory hygiene with org isolation | implemented |') &&
      matrixSource.includes('| LT-W10 | Memory package/runbook packaging for production operations | implemented |'),
    'all ten Wave 6 rows are present and implemented',
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
  const outJson = path.join(outDir, 'letta-wave6-rollup-latest.json');
  const outMd = path.join(outDir, 'letta-wave6-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta Wave 6 Rollup Status',
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
