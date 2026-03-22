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
  const commandSource = read('services/agent-runtime/src/chat-commands.ts');
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/operator-observability-command.test.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/openhands-parity-w10-runtime-observability-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w10_operator_observability_surface_present',
    commandSource.includes('${parsed.prefix}operator status|observability [limit]') &&
      commandSource.includes('Usage: ${parsed.prefix}operator status | ${parsed.prefix}operator observability [limit]') &&
      commandSource.includes('if (sub === \'observability\') {') &&
      commandSource.includes('Operator observability:'),
    'operator command surface exposes active observability diagnostics mode',
  );

  add(
    'openhands_w10_active_run_diagnostics_present',
    commandSource.includes('const snapshot = await getOperatorObservabilitySnapshot(ctx.pool, ctx.event.chat_id, limit);') &&
      commandSource.includes('Recent workflow runs:') &&
      commandSource.includes('FROM workflow_runs wr') &&
      commandSource.includes('ORDER BY wr.updated_at DESC') &&
      commandSource.includes('queue_backpressure:'),
    'observability command reports active workflow-run timeline and queue backpressure diagnostics',
  );

  add(
    'openhands_w10_observability_snapshot_aggregator_present',
    commandSource.includes('async function getOperatorObservabilitySnapshot(') &&
      commandSource.includes('const [agent, queue] = await Promise.all([') &&
      commandSource.includes('getAgentChatState(pool, chatId)') &&
      commandSource.includes('getQueueStatusSummary(pool)') &&
      commandSource.includes('let recentWorkflowRuns: OperatorObservabilitySnapshot[\'recentWorkflowRuns\'] = [];') &&
      commandSource.includes('FROM workflow_runs wr'),
    'runtime includes a deterministic observability snapshot aggregator (agent + queue + workflow runs)',
  );

  add(
    'openhands_w10_runtime_test_and_contract_coverage_present',
    runtimeTestSource.includes('shows queue, agent, and recent workflow diagnostics') &&
      runtimeTestSource.includes('handles empty observability data safely') &&
      contractSource.includes('OpenHands W10 runtime observability parity contract') &&
      contractSource.includes("'openhands_w10_operator_observability_surface_present'"),
    'observability behavior is anchored by runtime tests and dedicated parity contract',
  );

  add(
    'openhands_w10_matrix_binding_present',
    matrixSource.includes('| OH-W10 | Operator observability for active run (timeline + diagnostics) | implemented |') &&
      matrixSource.includes('openhands_parity_w10_runtime_observability') &&
      matrixSource.includes('openhands-w10-observability-latest'),
    'Wave 1 matrix binds OH-W10 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'openhands-w10-observability-latest.json');
  const outMd = path.join(outDir, 'openhands-w10-observability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W10 Runtime Observability Status',
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
