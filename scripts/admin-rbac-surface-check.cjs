#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const adminRoutesPath = path.join(root, 'services', 'gateway-api', 'src', 'routes', 'admin', 'index.ts');
const checklistPath = path.join(root, 'docs', 'Sven_Master_Checklist.md');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'admin-rbac-surface-latest.json');
const outMd = path.join(outDir, 'admin-rbac-surface-latest.md');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function makeCheck(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

const checks = [];
let adminSource = '';
let checklistSource = '';

try {
  adminSource = readUtf8(adminRoutesPath);
  checklistSource = readUtf8(checklistPath);
} catch (error) {
  const status = {
    generated_at: new Date().toISOString(),
    status: 'fail',
    checks: [
      makeCheck(
        'inputs_readable',
        false,
        `failed reading required inputs: ${String(error && error.message ? error.message : error)}`,
      ),
    ],
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Admin RBAC Surface Check\n\nStatus: fail\n\n- inputs_readable: fail - ${status.checks[0].detail}\n`,
    'utf8',
  );
  process.exit(2);
}

const baseRolesAligned = adminSource.includes("const authenticatedAdminSurface = requireRole(pool, 'admin', 'operator', 'user');");
checks.push(
  makeCheck(
    'admin_surface_base_roles_documented',
    baseRolesAligned,
    baseRolesAligned
      ? "admin route auth base is requireRole(pool, 'admin', 'operator', 'user')"
      : "admin route auth base does not match expected requireRole(pool, 'admin', 'operator', 'user')",
  ),
);

const tenantGateAligned = adminSource.includes("const tenantAdminRoles = new Set(['owner', 'admin', 'operator']);");
checks.push(
  makeCheck(
    'admin_surface_tenant_gate_owner_admin_operator',
    tenantGateAligned,
    tenantGateAligned
      ? "tenant admin gate matches ['owner', 'admin', 'operator']"
      : "tenant admin gate is not owner/admin/operator as expected",
  ),
);

const checklistTieredClaim =
  checklistSource.includes('RBAC middleware in place (tiered admin surface: authenticated session + tenant `owner/admin/operator` gate') &&
  checklistSource.includes('limited tenant self-service exceptions') &&
  checklistSource.includes('docs/release/status/admin-rbac-surface-latest.json');
checks.push(
  makeCheck(
    'master_checklist_rbac_claim_matches_route_model',
    checklistTieredClaim,
    checklistTieredClaim
      ? 'master checklist RBAC claim matches route model wording'
      : 'master checklist RBAC claim is missing or drifted from route model wording',
  ),
);

const checklistNoAdminOnlyRoutesClaim = !checklistSource.includes('admin-only routes');
checks.push(
  makeCheck(
    'master_checklist_no_admin_only_routes_overclaim',
    checklistNoAdminOnlyRoutesClaim,
    checklistNoAdminOnlyRoutesClaim
      ? "master checklist avoids overstated 'admin-only routes' claim for /v1/admin surface"
      : "master checklist includes outdated 'admin-only routes' claim that conflicts with tiered RBAC model",
  ),
);

const matrix = {
  entrypoint: '/v1/admin/*',
  session_roles_required: ['admin', 'operator', 'user'],
  tenant_gate_default: ['owner', 'admin', 'operator'],
  tenant_self_service_exceptions: ['GET /v1/admin/accounts', 'POST /v1/admin/accounts', 'POST /v1/admin/accounts/:id/activate'],
};

const failed = checks.filter((c) => c.status !== 'pass');
const status = {
  generated_at: new Date().toISOString(),
  status: failed.length === 0 ? 'pass' : 'fail',
  matrix,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const md = [
  '# Admin RBAC Surface Check',
  '',
  `Status: ${status.status}`,
  '',
  '## Matrix',
  '',
  `- entrypoint: ${matrix.entrypoint}`,
  `- session_roles_required: ${matrix.session_roles_required.join(', ')}`,
  `- tenant_gate_default: ${matrix.tenant_gate_default.join(', ')}`,
  `- tenant_self_service_exceptions: ${matrix.tenant_self_service_exceptions.join('; ')}`,
  '',
  '## Checks',
  '',
  ...checks.map((c) => `- ${c.id}: ${c.status} (${c.detail})`),
  '',
].join('\n');
fs.writeFileSync(outMd, `${md}\n`, 'utf8');

console.log(JSON.stringify(status, null, 2));
console.log(`Wrote ${path.relative(root, outJson)}`);
console.log(`Wrote ${path.relative(root, outMd)}`);

if (strict && failed.length > 0) {
  process.exit(2);
}
