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
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const sendValidationTest = read('services/gateway-api/src/__tests__/agents-send.validation.test.ts');
  const supervisorValidationTest = read('services/gateway-api/src/__tests__/agents-supervisor.validation.test.ts');
  const e2eSource = read('services/gateway-api/src/__tests__/agents.e2e.ts');
  const contractSource = read('services/gateway-api/src/__tests__/crewai-parity-w04-shared-context-contract.test.ts');
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w04_inter_agent_memory_log_surface_present',
    agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes('INSERT INTO inter_agent_messages') &&
      agentsRoute.includes("(id, from_agent, to_agent, session_id, message, status, control_flags, created_at, delivered_at)") &&
      agentsRoute.includes("VALUES ($1, $2, $3, $4, $5, 'delivered', $6, NOW(), NOW())") &&
      agentsRoute.includes("INSERT INTO messages (id, chat_id, role, content_type, text, created_at)") &&
      agentsRoute.includes("[AGENT:${fromAgent}->${toAgent}] ${message}") &&
      agentsRoute.includes("SET status = 'responded', response_message = $2, responded_at = NOW()") &&
      agentsRoute.includes("[AGENT:${toAgent}->${fromAgent}] ${replyText}"),
    'agent-to-agent messages persist both queue record and mirrored chat timeline context for carryover',
  );

  add(
    'crewai_w04_supervisor_context_aggregation_present',
    agentsRoute.includes("app.post('/agents/supervisor/orchestrate'") &&
      agentsRoute.includes("VALUES ($1, $2, $3, $4, $5, 'responded', $6, $7, NOW(), NOW(), NOW())") &&
      agentsRoute.includes('const uniqueResponses = new Set(assignments.map((x) => x.response.trim().toLowerCase()));') &&
      agentsRoute.includes('[SUPERVISOR:${supervisorAgentId}] task="${task}" sub_agents=${assignments.length} conflict=${hasConflict ? \'yes\' : \'no\'} result="${aggregatedResult.slice(0, 500)}"'),
    'supervisor orchestration writes bounded aggregated context back into shared session timeline',
  );

  add(
    'crewai_w04_runtime_context_reload_present',
    runtimeIndex.includes('SELECT role, content_type, text, blocks, created_at') &&
      runtimeIndex.includes('FROM messages WHERE chat_id = $1') &&
      runtimeIndex.includes('ORDER BY created_at DESC LIMIT 50') &&
      runtimeIndex.includes('const messages = messagesRes.rows.reverse();') &&
      runtimeIndex.includes('return {') &&
      runtimeIndex.includes('messages,'),
    'runtime context loader rehydrates shared message timeline (including agent/supervisor handoff records)',
  );

  add(
    'crewai_w04_test_and_contract_coverage_present',
    sendValidationTest.includes("describe('agent send flag validation'") &&
      sendValidationTest.includes('respects strict boolean semantics for reply path') &&
      supervisorValidationTest.includes("describe('supervisor orchestrate validation'") &&
      supervisorValidationTest.includes('clamps max_agents to upper bound and limits assignments') &&
      e2eSource.includes('supports create/list/spawn/send/history/destroy flow (optional)') &&
      contractSource.includes('CrewAI W04 shared context handoff parity contract') &&
      contractSource.includes("'crewai_w04_inter_agent_memory_log_surface_present'"),
    'shared-context handoff is anchored by route validation, e2e session history flow, and dedicated parity contract',
  );

  add(
    'crewai_w04_matrix_binding_present',
    matrixSource.includes('| CW-W04 | Shared memory/context handoff between agents | implemented |') &&
      matrixSource.includes('crewai_parity_w04_shared_context_contract') &&
      matrixSource.includes('crewai-w04-shared-context-latest'),
    'Wave 5 matrix binds CW-W04 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w04-shared-context-latest.json');
  const outMd = path.join(outDir, 'crewai-w04-shared-context-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W04 Shared Context Status',
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
