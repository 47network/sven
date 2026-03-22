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
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w08_operator_observability_surface_present',
    commandSource.includes('${parsed.prefix}operator status|observability [limit]') &&
      commandSource.includes('operator observability [limit]') &&
      commandSource.includes('Operator observability:'),
    'operator command surface exposes observability mode',
  );

  add(
    'librechat_w08_snapshot_aggregator_present',
    commandSource.includes('getOperatorObservabilitySnapshot') &&
      commandSource.includes('getAgentChatState(pool, chatId)') &&
      commandSource.includes('getQueueStatusSummary(pool)') &&
      commandSource.includes('FROM workflow_runs wr'),
    'observability snapshot aggregates agent/queue/workflow diagnostics',
  );

  add(
    'librechat_w08_empty_state_guards_present',
    commandSource.includes('- no queue metrics available') &&
      commandSource.includes('- no recent workflow runs for this chat'),
    'observability output includes deterministic empty-state guards',
  );

  add(
    'librechat_w08_runtime_test_coverage_present',
    runtimeTestSource.includes('shows queue, agent, and recent workflow diagnostics') &&
      runtimeTestSource.includes('handles empty observability data safely'),
    'runtime tests cover populated and empty observability flows',
  );

  add(
    'librechat_w08_matrix_binding_present',
    matrixSource.includes('| LC-W08 | Conversation observability for operators (queue/state diagnostics) | implemented |') &&
      matrixSource.includes('librechat_parity_w08_operator_observability_contract'),
    'Wave 2 matrix binds LC-W08 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w08-operator-observability-latest.json');
  const outMd = path.join(outDir, 'librechat-w08-operator-observability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W08 Operator Observability Status',
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
