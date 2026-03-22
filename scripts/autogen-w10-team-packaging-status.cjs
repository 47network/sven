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

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w10_wave7_docs_and_program_packaged',
    exists('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/sven-competitive-reproduction-program-2026.md') &&
      exists('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md') &&
      exists('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md') &&
      programSource.includes('### 9.8) Wave 7 Kickoff Snapshot (2026-03-16)'),
    'Wave 7 template packaging includes autogen matrix + multi-wave program references for reproducible parity bundle context',
  );

  add(
    'autogen_w10_wave7_contract_suite_packaged',
    exists('services/gateway-api/src/__tests__/autogen-parity-w01-agentchat-orchestration-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w02-team-lifecycle-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w03-speaker-selection-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w04-hitl-checkpoints-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w05-team-tool-use-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w06-code-execution-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w07-retry-recovery-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w08-transcript-observability-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w09-team-policy-isolation-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/autogen-parity-w10-team-packaging-contract.test.ts'),
    'Wave 7 contract suite is packaged as a reusable ten-lane verification bundle',
  );

  add(
    'autogen_w10_wave7_status_lane_bundle_packaged',
    exists('scripts/autogen-w01-agentchat-orchestration-status.cjs') &&
      exists('scripts/autogen-w02-team-lifecycle-status.cjs') &&
      exists('scripts/autogen-w03-speaker-selection-status.cjs') &&
      exists('scripts/autogen-w04-hitl-checkpoints-status.cjs') &&
      exists('scripts/autogen-w05-team-tool-use-status.cjs') &&
      exists('scripts/autogen-w06-code-execution-status.cjs') &&
      exists('scripts/autogen-w07-retry-recovery-status.cjs') &&
      exists('scripts/autogen-w08-transcript-observability-status.cjs') &&
      exists('scripts/autogen-w09-team-policy-isolation-status.cjs') &&
      exists('scripts/autogen-w10-team-packaging-status.cjs'),
    'Wave 7 status scripts are bundled for local/CI template packaging verification',
  );

  add(
    'autogen_w10_ci_and_alias_packaging_present',
    packageSource.includes('"release:autogen:w01:status"') &&
      packageSource.includes('"release:autogen:w02:status"') &&
      packageSource.includes('"release:autogen:w03:status"') &&
      packageSource.includes('"release:autogen:w04:status"') &&
      packageSource.includes('"release:autogen:w05:status"') &&
      packageSource.includes('"release:autogen:w06:status"') &&
      packageSource.includes('"release:autogen:w07:status"') &&
      packageSource.includes('"release:autogen:w08:status"') &&
      packageSource.includes('"release:autogen:w09:status"') &&
      packageSource.includes('"release:autogen:w10:status"') &&
      packageSource.includes('"release:autogen:wave7:rollup"') &&
      packageSource.includes('"release:autogen:wave7:closeout"') &&
      parityWorkflow.includes('npm run -s release:autogen:w01:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w02:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w03:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w04:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w05:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w06:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w07:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w08:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w09:status') &&
      parityWorkflow.includes('npm run -s release:autogen:w10:status') &&
      parityWorkflow.includes('npm run -s release:autogen:wave7:rollup') &&
      parityWorkflow.includes('npm run -s release:autogen:wave7:closeout') &&
      parityWorkflow.includes('autogen-w10-team-packaging-latest.json') &&
      parityWorkflow.includes('autogen-w10-team-packaging-latest.md') &&
      parityWorkflow.includes('autogen-wave7-rollup-latest.json') &&
      parityWorkflow.includes('autogen-wave7-rollup-latest.md') &&
      parityWorkflow.includes('autogen-wave7-closeout-latest.json') &&
      parityWorkflow.includes('autogen-wave7-closeout-latest.md'),
    'Wave 7 packaging lane is verifiable through npm aliases and parity-e2e artifact publishing',
  );

  add(
    'autogen_w10_matrix_binding_present',
    matrixSource.includes('| AG-W10 | Reusable AutoGen-style team templates and packaging | implemented |') &&
      matrixSource.includes('autogen_parity_w10_team_packaging_contract') &&
      matrixSource.includes('autogen-w10-team-packaging-latest'),
    'Wave 7 matrix binds AG-W10 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'autogen-w10-team-packaging-latest.json');
  const outMd = path.join(outDir, 'autogen-w10-team-packaging-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W10 Team Packaging Status',
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

