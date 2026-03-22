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
  const analyticsRoute = read('services/gateway-api/src/routes/admin/agent-analytics.ts');
  const chatCommands = read('services/agent-runtime/src/chat-commands.ts');
  const operatorObservabilityTest = read('services/agent-runtime/src/__tests__/operator-observability-command.test.ts');
  const agentsE2e = read('services/gateway-api/src/__tests__/agents.e2e.ts');
  const analyticsOrgScopeContract = read('services/gateway-api/src/__tests__/agent-analytics-org-scope-contract.test.ts');
  const crewSharedContextContract = read(
    'services/gateway-api/src/__tests__/crewai-parity-w04-shared-context-contract.test.ts',
  );
  const contractSource = read('services/gateway-api/src/__tests__/crewai-parity-w08-crew-observability-contract.test.ts');
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w08_crew_timeline_surface_present',
    agentsRoute.includes("app.get('/agents/sessions/:sessionId/history'") &&
      agentsRoute.includes('FROM messages m') &&
      agentsRoute.includes('ORDER BY created_at DESC') &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes('INSERT INTO inter_agent_messages') &&
      agentsRoute.includes('[AGENT:${fromAgent}->${toAgent}] ${message}') &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'") &&
      agentsRoute.includes('[SUPERVISOR:${supervisorAgentId}] task="${task}" sub_agents=${assignments.length}'),
    'crew timeline persists delegated/supervisor activity and exposes session history retrieval for diagnostics',
  );

  add(
    'crewai_w08_operator_diagnostics_snapshot_present',
    chatCommands.includes('${parsed.prefix}operator status|observability [limit]') &&
      chatCommands.includes('Operator observability:') &&
      chatCommands.includes('Queue metrics:') &&
      chatCommands.includes('Recent workflow runs:') &&
      chatCommands.includes('getOperatorObservabilitySnapshot(ctx.pool, ctx.event.chat_id, limit)') &&
      chatCommands.includes('getQueueStatusSummary(pool)') &&
      chatCommands.includes('FROM workflow_runs wr'),
    'runtime exposes crew-level diagnostics snapshot with queue/backpressure and workflow timeline signals',
  );

  add(
    'crewai_w08_fleet_telemetry_org_scope_present',
    analyticsRoute.includes("app.get('/agents/analytics'") &&
      analyticsRoute.includes("app.get('/agents/analytics/export'") &&
      analyticsRoute.includes('org_agents AS (') &&
      analyticsRoute.includes('FROM agent_chat') &&
      analyticsRoute.includes('JOIN agents a ON a.id = oa.agent_id') &&
      analyticsRoute.includes('task_success_rate_pct') &&
      analyticsRoute.includes('error_rate_pct') &&
      analyticsRoute.includes('self_correction_success_rate_pct') &&
      analyticsRoute.includes('total_cost_usd'),
    'crew observability lane includes org-scoped analytics telemetry across success/error/self-correction/cost dimensions',
  );

  add(
    'crewai_w08_runtime_and_contract_coverage_present',
    operatorObservabilityTest.includes('shows queue, agent, and recent workflow diagnostics') &&
      operatorObservabilityTest.includes('handles empty observability data safely') &&
      agentsE2e.includes('supports create/list/spawn/send/history/destroy flow (optional)') &&
      analyticsOrgScopeContract.includes('agent analytics org scope contract') &&
      crewSharedContextContract.includes('CrewAI W04 shared context handoff parity contract') &&
      contractSource.includes('CrewAI W08 crew observability parity contract') &&
      contractSource.includes("'crewai_w08_crew_timeline_surface_present'"),
    'crew observability behavior is anchored by runtime diagnostics tests plus e2e/org-scope/contract coverage',
  );

  add(
    'crewai_w08_matrix_binding_present',
    matrixSource.includes('| CW-W08 | Multi-agent observability (crew timeline + agent diagnostics) | implemented |') &&
      matrixSource.includes('crewai_parity_w08_crew_observability_contract') &&
      matrixSource.includes('crewai-w08-crew-observability-latest'),
    'Wave 5 matrix binds CW-W08 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w08-crew-observability-latest.json');
  const outMd = path.join(outDir, 'crewai-w08-crew-observability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W08 Crew Observability Status',
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
