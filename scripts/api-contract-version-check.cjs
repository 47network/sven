#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function run() {
  const sourceRunId =
    String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim()
    || `local-${Date.now()}`;
  const headSha =
    String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim()
    || (() => {
      try {
        return execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString('utf8')
          .trim();
      } catch {
        return '';
      }
    })();

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  const sharedContractRel = 'packages/shared/src/contracts/api-contract.ts';
  const healthRouteRel = 'services/gateway-api/src/routes/health.ts';
  const indexRel = 'services/gateway-api/src/index.ts';
  const testRel = 'services/gateway-api/src/__tests__/api-contract.version.test.ts';

  const sharedContract = read(sharedContractRel);
  const healthRoute = read(healthRouteRel);
  const indexFile = read(indexRel);
  const testFile = read(testRel);

  add('shared_contract_file_exists', /API_CONTRACT_VERSION/.test(sharedContract), `${sharedContractRel} exports API_CONTRACT_VERSION`);
  add('shared_contract_version_format', /API_CONTRACT_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2}\.v\d+)'/.test(sharedContract), 'version matches YYYY-MM-DD.vN');
  add('gateway_contract_endpoint', /\/v1\/contracts\/version/.test(healthRoute), `${healthRouteRel} includes /v1/contracts/version`);
  add('gateway_contract_header_hook', /API_CONTRACT_HEADER/.test(indexFile) && /addHook\('onSend'/.test(indexFile), `${indexRel} injects contract header`);
  add('contract_version_test_present', /api contract version metadata/.test(testFile), `${testRel} validates contract metadata`);

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const at = new Date().toISOString();

  const report = {
    generated_at: at,
    status,
    evidence_mode: process.env.CI ? 'ci' : 'local',
    source_run_id: sourceRunId,
    head_sha: headSha || null,
    passed,
    failed,
    checks,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'api-contract-version-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# API Contract Version Check',
    '',
    `Generated: ${at}`,
    `Status: ${status}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'api-contract-version-latest.md'), `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.join(outDir, 'api-contract-version-latest.json')}`);
  console.log(`Wrote ${path.join(outDir, 'api-contract-version-latest.md')}`);
  if (failed > 0) process.exit(2);
}

run();
