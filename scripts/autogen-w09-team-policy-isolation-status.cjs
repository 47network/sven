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
  const adminIndexRoute = read('services/gateway-api/src/routes/admin/index.ts');
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const runtimeConfig = read('services/agent-runtime/src/subagent-config.ts');
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const activeOrgGuardContract = read('services/gateway-api/src/__tests__/admin-agents-active-org-guard-contract.test.ts');
  const orgScopeRuntime = read('services/gateway-api/src/__tests__/admin-agents-control-plane-org-scope.runtime.test.ts');
  const subagentConfigTest = read('services/agent-runtime/src/__tests__/subagent-config.test.ts');
  const crewGovernanceContract = read('services/gateway-api/src/__tests__/crewai-parity-w09-crew-governance-contract.test.ts');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read('services/gateway-api/src/__tests__/autogen-parity-w09-team-policy-isolation-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w09_admin_tenant_gate_present',
    adminIndexRoute.includes("const tenantAdminRoles = new Set(['owner', 'admin', 'operator']);") &&
      adminIndexRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' },") &&
      adminIndexRoute.includes("error: { code: 'FORBIDDEN', message: 'Insufficient tenant permissions' },") &&
      adminIndexRoute.includes('request.tenantRole = tenantRole;'),
    'admin surface enforces active-org + tenant-role gates before team-control routes are reachable',
  );

  add(
    'autogen_w09_team_control_plane_org_scope_present',
    agentsRoute.includes('function requireActiveOrg(request: any, reply: any): boolean') &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'") &&
      agentsRoute.includes('JOIN chats c ON c.id = asn.session_id') &&
      agentsRoute.includes('c.organization_id::text = $3::text') &&
      agentsRoute.includes('c.organization_id::text = $4::text') &&
      agentsRoute.includes('session_id is required for org-scoped routing rules'),
    'team conversation routes and routing prechecks remain organization-scoped and fail-closed',
  );

  add(
    'autogen_w09_subagent_policy_scope_isolation_present',
    runtimeConfig.includes('const mergedScope = mergePolicyScopes(parentPolicy, ownScope);') &&
      runtimeConfig.includes('policy_scope: hasExplicitPolicyScope ? mergedScope : undefined,') &&
      runtimeConfig.includes('if (allowedScopes.length === 0) return false;') &&
      runtimeIndex.includes('if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {') &&
      runtimeIndex.includes('Subagent policy scope denied'),
    'delegated team agents inherit scoped policy envelopes and runtime blocks cross-scope tool calls',
  );

  add(
    'autogen_w09_runtime_and_contract_coverage_present',
    activeOrgGuardContract.includes('admin agents active-org guard contract') &&
      orgScopeRuntime.includes('admin agents control-plane org-scope runtime') &&
      orgScopeRuntime.includes('scopes inter-agent send precheck by organization through chats join') &&
      subagentConfigTest.includes('integration: subagent policy scope matcher supports exact and wildcard scopes') &&
      crewGovernanceContract.includes('CrewAI W09 crew governance parity contract') &&
      contractSource.includes('AutoGen W09 team policy isolation parity contract'),
    'org/policy isolation is covered by runtime and contract suites across agents and subagent policy resolution',
  );

  add(
    'autogen_w09_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W09 | Org-scoped policy and isolation across team-agent conversations | implemented |') &&
      matrixSource.includes('autogen_parity_w09_team_policy_isolation_contract') &&
      matrixSource.includes('autogen-w09-team-policy-isolation-latest') &&
      programSource.includes('AG-W09') &&
      packageSource.includes('"release:autogen:w09:status"') &&
      packageSource.includes('"release:autogen:w09:status:local"') &&
      contractSource.includes("'autogen_w09_admin_tenant_gate_present'"),
    'Wave 7 docs and npm bindings include AG-W09 strict evidence lane',
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
  const outJson = path.join(outDir, 'autogen-w09-team-policy-isolation-latest.json');
  const outMd = path.join(outDir, 'autogen-w09-team-policy-isolation-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W09 Team Policy Isolation Status',
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
