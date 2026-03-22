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
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');
  const parityWorkflow = read('.github/workflows/parity-e2e.yml');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w10_wave_pattern_docs_present',
    exists('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md') &&
      exists('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md') &&
      exists('docs/parity/sven-competitive-reproduction-program-2026.md') &&
      exists('docs/api/parity-contracts.md'),
    'wave matrices + program + parity API contracts are packaged as developer-facing framework pattern docs',
  );

  add(
    'framework_w10_runbook_packaging_present',
    exists('docs/release/runbooks/mirror-mode-quick-start.md') &&
      exists('docs/release/runbooks/mirror-mode-e2e-test-guide.md') &&
      exists('docs/release/runbooks/mirror-agent-packaging-validation.md') &&
      exists('docs/release/runbooks/multi-device-deployment-validation.md') &&
      exists('docs/release/soak-72h-runbook.md'),
    'operator runbook bundle exists for deployment, validation, packaging, and soak lifecycle',
  );

  add(
    'framework_w10_examples_packaged_present',
    exists('docs/examples/openclaw-main/README.md') &&
      exists('docs/examples/agent-zero-main/README.md') &&
      exists('docs/parity/competitor-baseline-manifest.json') &&
      exists('docs/parity/competitor-evidence-ledger.json'),
    'example baseline references and evidence ledger are packaged for reproducible competitor-pattern comparison',
  );

  add(
    'framework_w10_framework_contract_suite_packaged',
    exists('services/gateway-api/src/__tests__/framework-parity-w02-delegated-handoff-policy-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w03-memory-profile-lifecycle-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w04-graph-state-guardrails-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w05-conflict-resolution-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w06-autonomous-loop-safety-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w07-planner-audit-chain-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w08-objective-resume-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w09-fleet-governance-contract.test.ts'),
    'framework absorption contracts are packaged as a reusable parity suite for developer verification',
  );

  add(
    'framework_w10_ci_packaging_and_aliases_present',
    packageSource.includes('"release:framework:w01:status"') &&
      packageSource.includes('"release:framework:w02:status"') &&
      packageSource.includes('"release:framework:w03:status"') &&
      packageSource.includes('"release:framework:w04:status"') &&
      packageSource.includes('"release:framework:w05:status"') &&
      packageSource.includes('"release:framework:w06:status"') &&
      packageSource.includes('"release:framework:w07:status"') &&
      packageSource.includes('"release:framework:w08:status"') &&
      packageSource.includes('"release:framework:w09:status"') &&
      packageSource.includes('"release:framework:w10:status"') &&
      packageSource.includes('"release:framework:wave4:rollup"') &&
      parityWorkflow.includes('npm run -s release:framework:w01:status') &&
      parityWorkflow.includes('npm run -s release:framework:w02:status') &&
      parityWorkflow.includes('npm run -s release:framework:w03:status') &&
      parityWorkflow.includes('npm run -s release:framework:w04:status') &&
      parityWorkflow.includes('npm run -s release:framework:w05:status') &&
      parityWorkflow.includes('npm run -s release:framework:w06:status') &&
      parityWorkflow.includes('npm run -s release:framework:w07:status') &&
      parityWorkflow.includes('npm run -s release:framework:w08:status') &&
      parityWorkflow.includes('npm run -s release:framework:w09:status') &&
      parityWorkflow.includes('npm run -s release:framework:w10:status') &&
      parityWorkflow.includes('framework-w10-pattern-packaging-latest.json') &&
      parityWorkflow.includes('framework-w10-pattern-packaging-latest.md'),
    'framework parity lanes are packageable via npm aliases and parity-e2e CI evidence uploads',
  );

  add(
    'framework_w10_matrix_binding_present',
    matrixSource.includes('| FW-W10 | Developer-facing framework pattern packaging (contracts + runbooks + examples) | implemented |') &&
      matrixSource.includes('framework_parity_w10_pattern_packaging_contract'),
    'Wave 4 matrix binds FW-W10 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w10-pattern-packaging-latest.json');
  const outMd = path.join(outDir, 'framework-w10-pattern-packaging-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W10 Pattern Packaging Status',
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
