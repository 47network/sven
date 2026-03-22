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
  const agentsE2e = read('services/gateway-api/src/__tests__/agents.e2e.ts');
  const controlPlaneAuthContract = read('services/gateway-api/src/__tests__/admin-agents-control-plane-authorization-contract.test.ts');
  const spawnAtomicityContract = read('services/gateway-api/src/__tests__/admin-agents-spawn-session-atomicity-contract.test.ts');
  const spawnOrgScopeContract = read('services/gateway-api/src/__tests__/admin-agents-spawn-session-org-scope-contract.test.ts');
  const routingValidationContract = read('services/gateway-api/src/__tests__/admin-agents-routing-enabled-validation-contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w01_multi_agent_route_surface_present',
    agentsRoute.includes("app.post('/agents/:id/spawn-session'") &&
      agentsRoute.includes("app.get('/agents/sessions/list'") &&
      agentsRoute.includes("app.post('/agents/sessions/:sessionId/routing'") &&
      agentsRoute.includes("app.post('/agents/routing/resolve'") &&
      agentsRoute.includes("app.get('/agents/routing-rules'") &&
      agentsRoute.includes("app.post('/agents/routing-rules'") &&
      agentsRoute.includes("app.put('/agents/routing-rules/:id'") &&
      agentsRoute.includes("app.delete('/agents/routing-rules/:id'") &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'"),
    'agents admin route exposes framework-style session/routing/supervisor orchestration control plane',
  );

  add(
    'framework_w01_spawn_session_org_atomicity_controls_present',
    agentsRoute.includes("const orgId = String((request as any).orgId || '').trim();") &&
      agentsRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' },") &&
      agentsRoute.includes('const client = await pool.connect();') &&
      agentsRoute.includes("await client.query('BEGIN');") &&
      agentsRoute.includes("await client.query('COMMIT');") &&
      agentsRoute.includes("await client.query('ROLLBACK');") &&
      agentsRoute.includes('INSERT INTO chats (id, organization_id, name, type, channel, channel_chat_id, created_at, updated_at)') &&
      agentsRoute.includes('INSERT INTO agent_sessions'),
    'spawn-session flow is org-scoped and transactionally persists chat/member/session mapping',
  );

  add(
    'framework_w01_supervisor_orchestration_policy_present',
    agentsRoute.includes('const VALID_CONFLICT_RESOLUTION = [\'priority\', \'first\', \'merge\'] as const;') &&
      agentsRoute.includes('const VALID_AGGREGATION = [\'all\', \'best\', \'first\'] as const;') &&
      agentsRoute.includes('required_capabilities') &&
      agentsRoute.includes('conflict_resolution') &&
      agentsRoute.includes('aggregation') &&
      agentsRoute.includes('aggregated_result'),
    'supervisor orchestrator supports required capability routing, conflict resolution policy, and aggregation policy',
  );

  add(
    'framework_w01_contract_and_e2e_tests_bound',
    controlPlaneAuthContract.includes("describe('admin agents control-plane authorization contract'") &&
      spawnAtomicityContract.includes("describe('admin agents spawn-session atomicity contract'") &&
      spawnOrgScopeContract.includes("describe('admin agents spawn-session org scope contract'") &&
      routingValidationContract.includes("describe('admin agents routing-rule enabled validation contract'") &&
      agentsE2e.includes("describe('Agents API'"),
    'multi-agent control plane is bound to auth/atomicity/org-scope/validation contracts plus e2e coverage',
  );

  add(
    'framework_w01_matrix_binding_present',
    matrixSource.includes('| FW-W01 | Multi-agent control plane (spawn-session, routing rules, supervisor orchestration) | implemented |') &&
      matrixSource.includes('framework_parity_w01_multi_agent_control_plane_contract'),
    'Wave 4 matrix binds FW-W01 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w01-multi-agent-control-plane-latest.json');
  const outMd = path.join(outDir, 'framework-w01-multi-agent-control-plane-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W01 Multi-Agent Control Plane Status',
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
