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
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w10_wave6_docs_and_program_packaged',
    exists('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/sven-competitive-reproduction-program-2026.md') &&
      exists('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md') &&
      programSource.includes('### 9.7) Wave 6 Kickoff Snapshot (2026-03-16)'),
    'Wave 6 template packaging includes Letta matrix + multi-wave program references for reproducible parity bundle context',
  );

  add(
    'letta_w10_wave6_contract_suite_packaged',
    exists('services/gateway-api/src/__tests__/letta-parity-w01-memory-block-lifecycle-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w02-identity-profile-governance-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w03-memory-scope-separation-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w04-memory-write-gate-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w05-memory-retrieval-quality-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w06-memory-maintenance-jobs-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w07-memory-inspection-ux-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w08-compaction-safeguards-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w09-shared-memory-isolation-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/letta-parity-w10-memory-packaging-contract.test.ts'),
    'Wave 6 contract suite is packaged as a reusable ten-lane verification bundle',
  );

  add(
    'letta_w10_wave6_status_lane_bundle_packaged',
    exists('scripts/letta-w01-memory-block-lifecycle-status.cjs') &&
      exists('scripts/letta-w02-identity-profile-governance-status.cjs') &&
      exists('scripts/letta-w03-memory-scope-separation-status.cjs') &&
      exists('scripts/letta-w04-memory-write-gate-status.cjs') &&
      exists('scripts/letta-w05-memory-retrieval-quality-status.cjs') &&
      exists('scripts/letta-w06-memory-maintenance-jobs-status.cjs') &&
      exists('scripts/letta-w07-memory-inspection-ux-status.cjs') &&
      exists('scripts/letta-w08-compaction-safeguards-status.cjs') &&
      exists('scripts/letta-w09-shared-memory-isolation-status.cjs') &&
      exists('scripts/letta-w10-memory-packaging-status.cjs') &&
      exists('scripts/letta-wave6-rollup-status.cjs') &&
      exists('scripts/letta-wave6-closeout-status.cjs'),
    'Wave 6 status scripts are bundled for local/CI template packaging and closeout verification',
  );

  add(
    'letta_w10_ci_and_alias_packaging_present',
    packageSource.includes('"release:letta:w01:status"') &&
      packageSource.includes('"release:letta:w02:status"') &&
      packageSource.includes('"release:letta:w03:status"') &&
      packageSource.includes('"release:letta:w04:status"') &&
      packageSource.includes('"release:letta:w05:status"') &&
      packageSource.includes('"release:letta:w06:status"') &&
      packageSource.includes('"release:letta:w07:status"') &&
      packageSource.includes('"release:letta:w08:status"') &&
      packageSource.includes('"release:letta:w09:status"') &&
      packageSource.includes('"release:letta:w10:status"') &&
      packageSource.includes('"release:letta:wave6:rollup"') &&
      packageSource.includes('"release:letta:wave6:closeout"') &&
      parityWorkflow.includes('npm run -s release:letta:w01:status') &&
      parityWorkflow.includes('npm run -s release:letta:w02:status') &&
      parityWorkflow.includes('npm run -s release:letta:w03:status') &&
      parityWorkflow.includes('npm run -s release:letta:w04:status') &&
      parityWorkflow.includes('npm run -s release:letta:w05:status') &&
      parityWorkflow.includes('npm run -s release:letta:w06:status') &&
      parityWorkflow.includes('npm run -s release:letta:w07:status') &&
      parityWorkflow.includes('npm run -s release:letta:w08:status') &&
      parityWorkflow.includes('npm run -s release:letta:w09:status') &&
      parityWorkflow.includes('npm run -s release:letta:w10:status') &&
      parityWorkflow.includes('npm run -s release:letta:wave6:rollup') &&
      parityWorkflow.includes('npm run -s release:letta:wave6:closeout') &&
      parityWorkflow.includes('letta-w10-memory-packaging-latest.json') &&
      parityWorkflow.includes('letta-wave6-closeout-latest.json'),
    'Wave 6 packaging lane is verifiable through npm aliases and parity-e2e artifact publishing',
  );

  add(
    'letta_w10_matrix_binding_present',
    matrixSource.includes('| LT-W10 | Memory package/runbook packaging for production operations | implemented |') &&
      matrixSource.includes('letta_parity_w10_memory_packaging_contract') &&
      matrixSource.includes('letta-w10-memory-packaging-latest'),
    'Wave 6 matrix binds LT-W10 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'letta-w10-memory-packaging-latest.json');
  const outMd = path.join(outDir, 'letta-w10-memory-packaging-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W10 Memory Packaging Status',
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
