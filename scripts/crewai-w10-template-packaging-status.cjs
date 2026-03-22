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
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w10_wave5_docs_and_program_packaged',
    exists('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/sven-competitive-reproduction-program-2026.md') &&
      exists('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md') &&
      programSource.includes('### 9.6) Wave 5 Kickoff Snapshot (2026-03-16)'),
    'Wave 5 template packaging includes crew matrix + multi-wave program references for reproducible parity bundle context',
  );

  add(
    'crewai_w10_wave5_contract_suite_packaged',
    exists('services/gateway-api/src/__tests__/crewai-parity-w01-role-task-crew-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w02-sequential-handoff-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w03-manager-worker-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w04-shared-context-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w05-specialist-tools-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w06-human-checkpoint-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w07-delegated-retry-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w08-crew-observability-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w09-crew-governance-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w10-template-packaging-contract.test.ts'),
    'Wave 5 contract suite is packaged as a reusable ten-lane verification bundle',
  );

  add(
    'crewai_w10_wave5_status_lane_bundle_packaged',
    exists('scripts/crewai-w01-role-task-crew-status.cjs') &&
      exists('scripts/crewai-w02-sequential-handoff-status.cjs') &&
      exists('scripts/crewai-w03-manager-worker-status.cjs') &&
      exists('scripts/crewai-w04-shared-context-status.cjs') &&
      exists('scripts/crewai-w05-specialist-tools-status.cjs') &&
      exists('scripts/crewai-w06-human-checkpoint-status.cjs') &&
      exists('scripts/crewai-w07-delegated-retry-status.cjs') &&
      exists('scripts/crewai-w08-crew-observability-status.cjs') &&
      exists('scripts/crewai-w09-crew-governance-status.cjs') &&
      exists('scripts/crewai-w10-template-packaging-status.cjs'),
    'Wave 5 status scripts are bundled for local/CI template packaging verification',
  );

  add(
    'crewai_w10_ci_and_alias_packaging_present',
    packageSource.includes('"release:crewai:w01:status"') &&
      packageSource.includes('"release:crewai:w02:status"') &&
      packageSource.includes('"release:crewai:w03:status"') &&
      packageSource.includes('"release:crewai:w04:status"') &&
      packageSource.includes('"release:crewai:w05:status"') &&
      packageSource.includes('"release:crewai:w06:status"') &&
      packageSource.includes('"release:crewai:w07:status"') &&
      packageSource.includes('"release:crewai:w08:status"') &&
      packageSource.includes('"release:crewai:w09:status"') &&
      packageSource.includes('"release:crewai:w10:status"') &&
      parityWorkflow.includes('npm run -s release:crewai:w01:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w02:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w03:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w04:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w05:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w06:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w07:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w08:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w09:status') &&
      parityWorkflow.includes('npm run -s release:crewai:w10:status') &&
      parityWorkflow.includes('crewai-w10-template-packaging-latest.json') &&
      parityWorkflow.includes('crewai-w10-template-packaging-latest.md'),
    'Wave 5 packaging lane is verifiable through npm aliases and parity-e2e artifact publishing',
  );

  add(
    'crewai_w10_matrix_binding_present',
    matrixSource.includes('| CW-W10 | Reusable crew templates and packaging for production reuse | implemented |') &&
      matrixSource.includes('crewai_parity_w10_template_packaging_contract') &&
      matrixSource.includes('crewai-w10-template-packaging-latest'),
    'Wave 5 matrix binds CW-W10 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'crewai-w10-template-packaging-latest.json');
  const outMd = path.join(outDir, 'crewai-w10-template-packaging-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W10 Template Packaging Status',
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
