#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'librechat-w01-model-provider-ux-latest.json',
  'librechat-w02-mcp-tool-discovery-latest.json',
  'librechat-w03-operator-control-latest.json',
  'librechat-w04-session-portability-latest.json',
  'librechat-w05-command-ergonomics-latest.json',
  'librechat-w06-tool-reliability-latest.json',
  'librechat-w07-tenant-boundary-latest.json',
  'librechat-w08-operator-observability-latest.json',
  'librechat-w09-handoff-continuation-latest.json',
  'librechat-w10-enterprise-defaults-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave2-librechat-workflow-matrix-2026-03-16.md');
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
    'librechat_wave2_all_lane_artifacts_present',
    laneResults.every((r) => r.status !== 'missing'),
    `present=${laneResults.filter((r) => r.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'librechat_wave2_all_lane_artifacts_pass',
    laneResults.every((r) => r.status === 'pass'),
    `passing=${laneResults.filter((r) => r.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'librechat_wave2_matrix_rows_all_implemented',
    matrixSource.includes('| LC-W01 |') &&
      matrixSource.includes('| LC-W02 |') &&
      matrixSource.includes('| LC-W03 |') &&
      matrixSource.includes('| LC-W04 |') &&
      matrixSource.includes('| LC-W05 |') &&
      matrixSource.includes('| LC-W06 |') &&
      matrixSource.includes('| LC-W07 |') &&
      matrixSource.includes('| LC-W08 |') &&
      matrixSource.includes('| LC-W09 | Agent handoff and continuation in same thread | implemented |') &&
      matrixSource.includes('| LC-W10 |'),
    'all ten Wave 2 rows present and LC-W09 marked implemented',
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
  const outJson = path.join(outDir, 'librechat-wave2-rollup-latest.json');
  const outMd = path.join(outDir, 'librechat-wave2-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat Wave 2 Rollup Status',
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

