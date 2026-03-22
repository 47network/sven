#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const lanes = [
  'autogen-w01-agentchat-orchestration-latest.json',
  'autogen-w02-team-lifecycle-latest.json',
  'autogen-w03-speaker-selection-latest.json',
  'autogen-w04-hitl-checkpoints-latest.json',
  'autogen-w05-team-tool-use-latest.json',
  'autogen-w06-code-execution-latest.json',
  'autogen-w07-retry-recovery-latest.json',
  'autogen-w08-transcript-observability-latest.json',
  'autogen-w09-team-policy-isolation-latest.json',
  'autogen-w10-team-packaging-latest.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  const matrixPath = path.join(root, 'docs', 'parity', 'wave7-autogen-workflow-matrix-2026-03-16.md');
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
    'autogen_wave7_all_lane_artifacts_present',
    laneResults.every((r) => r.status !== 'missing'),
    `present=${laneResults.filter((r) => r.status !== 'missing').length}/${lanes.length}`,
  );

  add(
    'autogen_wave7_all_lane_artifacts_pass',
    laneResults.every((r) => r.status === 'pass'),
    `passing=${laneResults.filter((r) => r.status === 'pass').length}/${lanes.length}`,
  );

  add(
    'autogen_wave7_matrix_rows_all_implemented',
    matrixSource.includes('| AG-W01 | Multi-agent AgentChat orchestration with supervisor + delegated worker turns | implemented |') &&
      matrixSource.includes('| AG-W02 | Team conversation lifecycle controls (pause/resume/terminate/restart) | implemented |') &&
      matrixSource.includes('| AG-W03 | Agent role envelopes with deterministic speaker-selection policy | implemented |') &&
      matrixSource.includes('| AG-W04 | Human-in-the-loop checkpoints in agent team conversations | implemented |') &&
      matrixSource.includes('| AG-W05 | Tool-using assistant agent within team chat | implemented |') &&
      matrixSource.includes('| AG-W06 | Code-execution agent participation with safety boundaries | implemented |') &&
      matrixSource.includes('| AG-W07 | Bounded retry and recovery behavior in multi-agent chat loops | implemented |') &&
      matrixSource.includes('| AG-W08 | Team transcript observability and replay diagnostics | implemented |') &&
      matrixSource.includes('| AG-W09 | Org-scoped policy and isolation across team-agent conversations | implemented |') &&
      matrixSource.includes('| AG-W10 | Reusable AutoGen-style team templates and packaging | implemented |'),
    'all ten Wave 7 rows are present and implemented',
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
  const outJson = path.join(outDir, 'autogen-wave7-rollup-latest.json');
  const outMd = path.join(outDir, 'autogen-wave7-rollup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen Wave 7 Rollup Status',
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

