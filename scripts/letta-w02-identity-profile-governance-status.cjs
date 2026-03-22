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

function run() {
  const soulsRoute = read('services/gateway-api/src/routes/admin/souls.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w02-identity-profile-governance-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w02_org_required_fail_closed_present',
    soulsRoute.includes('function requireActiveOrg(request: any, reply: any): string | null') &&
      soulsRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' }"),
    'identity profile governance fails closed when no active organization is resolved',
  );

  add(
    'letta_w02_global_admin_gate_present',
    soulsRoute.includes("if (String(request.userRole || '') === 'platform_admin') return;") &&
      soulsRoute.includes("error: { code: 'FORBIDDEN', message: 'Global admin privileges required' }"),
    'identity profile mutation surfaces are protected by platform-admin governance gate',
  );

  add(
    'letta_w02_identity_doc_atomic_activation_present',
    soulsRoute.includes('async function activateSoul(') &&
      soulsRoute.includes(`UPDATE souls_installed SET status = 'installed' WHERE status = 'active' AND organization_id = $1`) &&
      soulsRoute.includes(`UPDATE souls_installed SET status = 'active', activated_at = NOW() WHERE id = $1`) &&
      soulsRoute.includes('INSERT INTO sven_identity_docs (id, organization_id, scope, content, version, updated_by, updated_at)') &&
      soulsRoute.includes("ON CONFLICT (organization_id, scope) WHERE scope = 'global'"),
    'active soul lifecycle atomically updates org-scoped global identity document profile',
  );

  add(
    'letta_w02_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W02 | Editable identity memory profile with governance boundaries | implemented |') &&
      matrixSource.includes('letta_parity_w02_identity_profile_governance_contract') &&
      matrixSource.includes('letta-w02-identity-profile-governance-latest') &&
      contractSource.includes('Letta W02 identity profile governance parity contract') &&
      contractSource.includes("'letta_w02_org_required_fail_closed_present'"),
    'Wave 6 matrix and contract test bind LT-W02 to strict governance artifact lane',
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
  const outJson = path.join(outDir, 'letta-w02-identity-profile-governance-latest.json');
  const outMd = path.join(outDir, 'letta-w02-identity-profile-governance-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W02 Identity Profile Governance Status',
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
