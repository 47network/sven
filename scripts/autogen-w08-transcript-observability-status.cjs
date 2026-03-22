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

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const chatCommands = read('services/agent-runtime/src/chat-commands.ts');
  const toolRunsRoute = read('services/gateway-api/src/routes/admin/tool-runs.ts');
  const replayRoute = read('services/gateway-api/src/routes/admin/replay.ts');
  const replayService = read('services/gateway-api/src/services/ReplayService.ts');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read('services/gateway-api/src/__tests__/autogen-parity-w08-transcript-observability-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w08_team_transcript_history_surface_present',
    agentsRoute.includes("app.get('/agents/sessions/:sessionId/history'") &&
      agentsRoute.includes('SELECT id, role, content_type, text, created_at') &&
      agentsRoute.includes('FROM messages m') &&
      agentsRoute.includes('ORDER BY created_at DESC') &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes('INSERT INTO inter_agent_messages') &&
      agentsRoute.includes('[AGENT:${fromAgent}->${toAgent}] ${message}'),
    'team conversation transcript history is queryable and delegated sends persist inter-agent message records',
  );

  add(
    'autogen_w08_operator_observability_snapshot_present',
    chatCommands.includes('${parsed.prefix}operator status|observability [limit]') &&
      chatCommands.includes('const snapshot = await getOperatorObservabilitySnapshot(ctx.pool, ctx.event.chat_id, limit);') &&
      chatCommands.includes('Operator observability:') &&
      chatCommands.includes('Queue metrics:') &&
      chatCommands.includes('Recent workflow runs:') &&
      chatCommands.includes('FROM workflow_runs wr'),
    'runtime exposes operator observability snapshot with queue state and recent workflow run diagnostics',
  );

  add(
    'autogen_w08_tool_audit_export_surface_present',
    toolRunsRoute.includes("app.get('/audit/export'") &&
      toolRunsRoute.includes('FROM tool_execution_audit_log al') &&
      toolRunsRoute.includes('function projectAuditExportRow') &&
      toolRunsRoute.includes('function redactAuditValue') &&
      toolRunsRoute.includes('attachment; filename="sven-audit-export.json"'),
    'team tool-execution timeline can be exported from append-only audit records with redaction-aware projection',
  );

  add(
    'autogen_w08_replay_diagnostics_surface_present',
    replayRoute.includes("app.post('/replay/run'") &&
      replayRoute.includes("app.get('/replay/runs'") &&
      replayRoute.includes("app.get('/replay/run/:runId/results'") &&
      replayRoute.includes("app.get('/replay/run/:runId/summary'") &&
      replayRoute.includes("app.post('/replay/compare'") &&
      replayService.includes('SVEN_REPLAY_EXECUTION_MODE') &&
      replayService.includes('/v1/chats/${encodeURIComponent(chatId)}/messages') &&
      replayService.includes('Replay live execution timed out waiting for assistant response'),
    'replay diagnostics lane supports live run execution, results/summary retrieval, and baseline-vs-new comparison',
  );

  add(
    'autogen_w08_runtime_and_contract_coverage_present',
    exists('services/agent-runtime/src/__tests__/operator-observability-command.test.ts') &&
      exists('services/gateway-api/src/__tests__/replay-route.validation.test.ts') &&
      exists('services/gateway-api/src/__tests__/admin-replay-org-scope-w978.contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/replay-live-execution-contract.test.ts'),
    'transcript/replay observability is anchored by operator snapshot, replay validation, org-scope, and live-execution contracts',
  );

  add(
    'autogen_w08_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W08 | Team transcript observability and replay diagnostics | implemented |') &&
      matrixSource.includes('autogen_parity_w08_transcript_observability_contract') &&
      matrixSource.includes('autogen-w08-transcript-observability-latest') &&
      programSource.includes('AG-W08') &&
      packageSource.includes('"release:autogen:w08:status"') &&
      packageSource.includes('"release:autogen:w08:status:local"') &&
      contractSource.includes('AutoGen W08 transcript observability parity contract'),
    'Wave 7 docs and npm bindings include AG-W08 strict evidence lane',
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
  const outJson = path.join(outDir, 'autogen-w08-transcript-observability-latest.json');
  const outMd = path.join(outDir, 'autogen-w08-transcript-observability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W08 Transcript Observability Status',
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
