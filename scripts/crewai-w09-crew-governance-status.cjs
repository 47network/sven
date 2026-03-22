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
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const runtimeConfig = read('services/agent-runtime/src/subagent-config.ts');
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const authorizationContract = read(
    'services/gateway-api/src/__tests__/admin-agents-control-plane-authorization-contract.test.ts',
  );
  const orgScopeRuntime = read('services/gateway-api/src/__tests__/admin-agents-control-plane-org-scope.runtime.test.ts');
  const activeOrgGuardContract = read('services/gateway-api/src/__tests__/admin-agents-active-org-guard-contract.test.ts');
  const subagentConfigTest = read('services/agent-runtime/src/__tests__/subagent-config.test.ts');
  const contractSource = read('services/gateway-api/src/__tests__/crewai-parity-w09-crew-governance-contract.test.ts');
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w09_admin_and_active_org_gate_present',
    agentsRoute.includes('function requireGlobalAdmin(request: any, reply: any): boolean') &&
      agentsRoute.includes('function requireActiveOrg(request: any, reply: any): boolean') &&
      agentsRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' },") &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'") &&
      agentsRoute.includes("app.post('/agents/:id/spawn-session'") &&
      agentsRoute.includes("app.post('/agents/routing/resolve'") &&
      agentsRoute.includes("if (!requireGlobalAdmin(request, reply)) return;") &&
      agentsRoute.includes("if (!requireActiveOrg(request, reply)) return;"),
    'crew control-plane mutation routes are guarded by platform-admin + active-org fail-closed checks',
  );

  add(
    'crewai_w09_org_scoped_query_boundaries_present',
    agentsRoute.includes('JOIN chats c ON c.id = asn.session_id') &&
      agentsRoute.includes('WHERE c.organization_id = $1') &&
      agentsRoute.includes('c.organization_id::text = $3::text') &&
      agentsRoute.includes('c.organization_id::text = $4::text') &&
      agentsRoute.includes('session_id is required for org-scoped routing rules') &&
      agentsRoute.includes('parent_agent_id is not mapped to this session') &&
      agentsRoute.includes('organization_id::text = $2::text'),
    'crew routing/session/delegation queries are organization-scoped with fail-closed membership boundaries',
  );

  add(
    'crewai_w09_policy_scope_boundary_enforcement_present',
    runtimeConfig.includes('const mergedScope = mergePolicyScopes(parentPolicy, ownScope);') &&
      runtimeConfig.includes('policy_scope: hasExplicitPolicyScope ? mergedScope : undefined,') &&
      runtimeConfig.includes('if (allowedScopes.length === 0) return false;') &&
      runtimeIndex.includes('if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {') &&
      runtimeIndex.includes('Subagent policy scope denied'),
    'delegated workers inherit governance scope envelope and runtime blocks out-of-scope tool execution',
  );

  add(
    'crewai_w09_runtime_and_contract_coverage_present',
    authorizationContract.includes('admin agents control-plane authorization contract') &&
      authorizationContract.includes("app.post('/agents/supervisor/orchestrate'") &&
      orgScopeRuntime.includes('admin agents control-plane org-scope runtime') &&
      orgScopeRuntime.includes('scopes inter-agent send precheck by organization through chats join') &&
      activeOrgGuardContract.includes('admin agents active-org guard contract') &&
      subagentConfigTest.includes('integration: subordinate inherits parent config and applies explicit overrides') &&
      contractSource.includes('CrewAI W09 crew governance parity contract') &&
      contractSource.includes("'crewai_w09_admin_and_active_org_gate_present'"),
    'crew governance boundaries are anchored by authorization/org-scope/runtime policy tests and dedicated parity contract',
  );

  add(
    'crewai_w09_matrix_binding_present',
    matrixSource.includes('| CW-W09 | Organization-scoped crew governance and policy boundaries | implemented |') &&
      matrixSource.includes('crewai_parity_w09_crew_governance_contract') &&
      matrixSource.includes('crewai-w09-crew-governance-latest'),
    'Wave 5 matrix binds CW-W09 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w09-crew-governance-latest.json');
  const outMd = path.join(outDir, 'crewai-w09-crew-governance-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W09 Crew Governance Status',
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
