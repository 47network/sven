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
  const agentAnalyticsRoute = read('services/gateway-api/src/routes/admin/agent-analytics.ts');
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const operatorCommands = read('services/agent-runtime/src/chat-commands.ts');
  const operatorObservabilityRuntimeTest = read('services/agent-runtime/src/__tests__/operator-observability-command.test.ts');
  const analyticsOrgScopeContract = read('services/gateway-api/src/__tests__/agent-analytics-org-scope-contract.test.ts');
  const librechatObservabilityContract = read('services/gateway-api/src/__tests__/librechat-parity-w08-operator-observability-contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w09_fleet_analytics_surface_present',
    agentAnalyticsRoute.includes("app.get('/agents/analytics'") &&
      agentAnalyticsRoute.includes("app.get('/agents/analytics/export'") &&
      agentAnalyticsRoute.includes("app.get('/agents/analytics/alerts'") &&
      agentAnalyticsRoute.includes("app.put('/agents/analytics/alerts'") &&
      agentAnalyticsRoute.includes("app.get('/agents/analytics/alerts/evaluate'") &&
      agentAnalyticsRoute.includes('return reply.send({ success: true, data: { window, rows } });'),
    'admin fleet dashboard exposes analytics, CSV export, threshold config, and alert evaluation endpoints',
  );

  add(
    'framework_w09_fleet_org_scoped_health_telemetry_present',
    agentAnalyticsRoute.includes('org_agents AS (') &&
      agentAnalyticsRoute.includes('FROM agent_chat') &&
      agentAnalyticsRoute.includes('JOIN agents a ON a.id = oa.agent_id') &&
      agentAnalyticsRoute.includes('task_success_rate_pct') &&
      agentAnalyticsRoute.includes('error_rate_pct') &&
      agentAnalyticsRoute.includes('self_correction_success_rate_pct') &&
      agentAnalyticsRoute.includes('total_cost_usd'),
    'fleet health telemetry remains organization-scoped and includes success/error/self-correction/cost metrics',
  );

  add(
    'framework_w09_fleet_control_plane_present',
    agentsRoute.includes("app.get('/agents/sessions/list'") &&
      agentsRoute.includes("app.post('/agents/sessions/:sessionId/routing'") &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'") &&
      agentsRoute.includes('max_agents') &&
      agentsRoute.includes('conflict_resolution') &&
      agentsRoute.includes('aggregation'),
    'fleet control plane exposes session inventory, routing controls, delegated messaging, and supervisor orchestration policy',
  );

  add(
    'framework_w09_operator_observability_runtime_present',
    operatorCommands.includes('Operator observability:') &&
      operatorCommands.includes('Queue metrics:') &&
      operatorCommands.includes('Recent workflow runs:') &&
      operatorCommands.includes('FROM queue_metrics') &&
      operatorCommands.includes('FROM workflow_runs wr') &&
      operatorObservabilityRuntimeTest.includes("describe('/operator observability command'") &&
      operatorObservabilityRuntimeTest.includes('shows queue, agent, and recent workflow diagnostics') &&
      operatorObservabilityRuntimeTest.includes('handles empty observability data safely'),
    'runtime operator observability exposes queue/workflow diagnostics with tested populated + empty states',
  );

  add(
    'framework_w09_contract_suite_bound',
    analyticsOrgScopeContract.includes("describe('agent analytics org scope contract'") &&
      librechatObservabilityContract.includes("describe('LibreChat W08 operator observability parity contract'"),
    'fleet governance parity is anchored by org-scoped analytics and operator observability contract suites',
  );

  add(
    'framework_w09_matrix_binding_present',
    matrixSource.includes('| FW-W09 | Operator governance dashboard for agent fleets (health, controls, telemetry) | implemented |') &&
      matrixSource.includes('framework_parity_w09_fleet_governance_contract'),
    'Wave 4 matrix binds FW-W09 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w09-fleet-governance-latest.json');
  const outMd = path.join(outDir, 'framework-w09-fleet-governance-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W09 Fleet Governance Status',
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
