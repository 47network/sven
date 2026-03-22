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
  const chatCommands = read('services/agent-runtime/src/chat-commands.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const canvasRoute = read('services/gateway-api/src/routes/canvas.ts');
  const workflowsRoute = read('services/gateway-api/src/routes/admin/workflows.ts');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read('services/gateway-api/src/__tests__/autogen-parity-w02-team-lifecycle-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w02_chat_pause_resume_controls_present',
    chatCommands.includes("case 'pause':") &&
      chatCommands.includes("case 'resume':") &&
      chatCommands.includes("text: 'Agent paused for this chat.'") &&
      chatCommands.includes("text: 'Agent resumed for this chat.'") &&
      canvasRoute.includes("app.post('/v1/chats/:chatId/agent/pause'") &&
      canvasRoute.includes("app.post('/v1/chats/:chatId/agent/resume'") &&
      runtimeSource.includes('if (await isAgentPaused(pool, event.chat_id))') &&
      runtimeSource.includes("logger.info('Chat is paused; deferring message'"),
    'team-chat lifecycle supports pause/resume in commands, API routes, and runtime deferral gate',
  );

  add(
    'autogen_w02_team_terminate_cancel_controls_present',
    workflowsRoute.includes("'/workflow-runs/:run_id/cancel'") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to cancelled") &&
      workflowsRoute.includes("current_status: 'cancelled'") &&
      workflowsRoute.includes("'/workflow-runs/:run_id/pause'") &&
      workflowsRoute.includes("'/workflow-runs/:run_id/resume'") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to paused") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to running"),
    'team orchestration lifecycle enforces terminate(cancel) + pause/resume run-control transitions fail-closed',
  );

  add(
    'autogen_w02_restart_request_controls_present',
    chatCommands.includes("case 'restart':") &&
      chatCommands.includes("text: 'Only admins can request gateway restart.'") &&
      chatCommands.includes("text: 'Gateway restart requested. Operator should execute `sven gateway restart`.'"),
    'team lifecycle includes admin-gated restart request command semantics',
  );

  add(
    'autogen_w02_existing_lifecycle_contract_proofs_present',
    exists('services/gateway-api/src/__tests__/parity-pause-resume-agent-wiring-2026-03-12.contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w08-objective-resume-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/workflow-run-control-response-contract.test.ts'),
    'existing pause/resume/cancel objective-control contracts back AG-W02 lifecycle parity evidence',
  );

  add(
    'autogen_w02_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W02 | Team conversation lifecycle controls (pause/resume/terminate/restart) | implemented |') &&
      matrixSource.includes('autogen_parity_w02_team_lifecycle_contract') &&
      matrixSource.includes('autogen-w02-team-lifecycle-latest') &&
      programSource.includes('AG-W02') &&
      packageSource.includes('"release:autogen:w02:status"') &&
      packageSource.includes('"release:autogen:w02:status:local"') &&
      contractSource.includes('AutoGen W02 team lifecycle parity contract'),
    'Wave 7 matrix/program/npm bindings exist for AG-W02 strict lifecycle lane',
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
  const outJson = path.join(outDir, 'autogen-w02-team-lifecycle-latest.json');
  const outMd = path.join(outDir, 'autogen-w02-team-lifecycle-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W02 Team Lifecycle Status',
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
