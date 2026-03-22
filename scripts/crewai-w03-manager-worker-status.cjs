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
  const commandSource = read('services/agent-runtime/src/chat-commands.ts');
  const e2eSource = read('services/gateway-api/src/__tests__/agents.e2e.ts');
  const subagentTests = read('services/agent-runtime/src/__tests__/subagent-config.test.ts');
  const atomicityContract = read('services/gateway-api/src/__tests__/admin-agents-spawn-session-atomicity-contract.test.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/crewai-parity-w03-manager-worker-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w03_manager_worker_spawn_delegation_surface_present',
    agentsRoute.includes("app.post('/agents/:id/spawn-session'") &&
      agentsRoute.includes('parent_agent_id?: string;') &&
      agentsRoute.includes('policy_scope?: string[] | string;') &&
      agentsRoute.includes('subordinate_overrides') &&
      agentsRoute.includes('parent_agent_id is not mapped to this session') &&
      agentsRoute.includes('Maximum subagent nesting depth exceeded'),
    'manager-worker spawn path exposes parent linkage, bounded delegation depth, and scoped override controls',
  );

  add(
    'crewai_w03_delegation_ownership_and_transactionality_present',
    agentsRoute.includes('const client = await pool.connect();') &&
      agentsRoute.includes("await client.query('BEGIN');") &&
      agentsRoute.includes('INSERT INTO chats') &&
      agentsRoute.includes("await upsertChatMember(client, { chatId: sessionId, userId, role: 'owner' });") &&
      agentsRoute.includes('INSERT INTO agent_sessions') &&
      agentsRoute.includes('routing_rules: routingRules') &&
      agentsRoute.includes('c.organization_id = $2'),
    'delegation path is org-scoped and persisted atomically across chat/member/session ownership records',
  );

  add(
    'crewai_w03_runtime_policy_envelope_present',
    runtimeConfig.includes('resolveSubagentConfig(') &&
      runtimeConfig.includes('const parentAgentId = String(routingRules.parent_agent_id || \'\').trim();') &&
      runtimeConfig.includes('const mergedScope = mergePolicyScopes(parentPolicy, ownScope);') &&
      runtimeConfig.includes('policy_scope: hasExplicitPolicyScope ? mergedScope : undefined,') &&
      runtimeConfig.includes('if (allowedScopes.length === 0) return false;') &&
      runtimeIndex.includes('if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {'),
    'worker runtime inherits manager policy envelope and fails closed when delegated scope is denied',
  );

  add(
    'crewai_w03_manager_controls_and_tests_present',
    commandSource.includes('${parsed.prefix}steer <agent_id|all> <instruction>') &&
      commandSource.includes('target.toLowerCase() === \'all\' ? ids : ids.filter((id) => id === target)') &&
      commandSource.includes('Steering instruction applied to ${targetIds.length} subagent(s).') &&
      e2eSource.includes('integration: subordinate spawn accepts config overrides and enforces nesting depth (optional)') &&
      e2eSource.includes('parent_agent_id: parentId,') &&
      e2eSource.includes('policy_scope: [\'web.fetch\', \'nas.read\']') &&
      subagentTests.includes('integration: subordinate inherits parent config and applies explicit overrides') &&
      atomicityContract.includes('admin agents spawn-session atomicity contract') &&
      contractSource.includes('CrewAI W03 manager worker delegation parity contract'),
    'manager controls and worker delegation behavior are anchored by runtime/e2e/contract coverage',
  );

  add(
    'crewai_w03_matrix_binding_present',
    matrixSource.includes('| CW-W03 | Hierarchical manager-worker delegation model | implemented |') &&
      matrixSource.includes('crewai_parity_w03_manager_worker_contract') &&
      matrixSource.includes('crewai-w03-manager-worker-latest'),
    'Wave 5 matrix binds CW-W03 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w03-manager-worker-latest.json');
  const outMd = path.join(outDir, 'crewai-w03-manager-worker-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W03 Manager Worker Status',
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
