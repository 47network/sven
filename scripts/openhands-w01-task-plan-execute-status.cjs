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
  const contractSource = read('services/agent-runtime/src/__tests__/chat-commands-workflow-dispatch-contract.test.ts');
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');
  const has = (pattern) => pattern.test(commandSource);

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w01_task_plan_execute_flow_present',
    commandSource.includes('Prose run queued:') &&
      commandSource.includes('plan_id: ${run.planId}') &&
      commandSource.includes('trace: ${run.traceSteps.join(\' -> \')}'),
    'chat command emits run, plan_id, and deterministic trace summary',
  );

  add(
    'openhands_w01_plan_artifact_persisted',
    commandSource.includes('openhands_w01') &&
      commandSource.includes("lane: 'OH-W01'") &&
      commandSource.includes("trace_mode: 'deterministic'") &&
      has(/planActions:\s*\[[\s\S]*kind:\s*'summarize'[\s\S]*action:\s*'emit_operator_summary'[\s\S]*\]/m),
    'workflow run input_variables include explicit OH-W01 plan artifact',
  );

  add(
    'openhands_w01_deterministic_trace_steps',
    has(/traceSteps:\s*\[\s*'task_received'\s*,\s*'plan_resolved'\s*,\s*'dispatch_published'\s*\]/m) &&
      has(/const\s+executionTrace\s*=\s*traceSteps\.map\(/m) &&
      commandSource.includes('execution_trace: executionTrace'),
    'deterministic step trace is persisted with stable ordering',
  );

  add(
    'openhands_w01_contract_test_coverage',
    contractSource.includes('trace: task_received -> plan_resolved -> dispatch_published') &&
      contractSource.includes("inputVariables?.openhands_w01?.lane).toBe('OH-W01'"),
    'contract test asserts emitted trace and persisted plan payload',
  );

  add(
    'openhands_w01_matrix_binding_present',
    matrixSource.includes('| OH-W01 | Task -> plan -> execute tools -> summarize outcome |') &&
      matrixSource.includes('openhands_parity_w01_task_plan_execute_contract'),
    'Wave 1 matrix binds OH-W01 to planned contract test ID',
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
  const outJson = path.join(outDir, 'openhands-w01-task-plan-execute-latest.json');
  const outMd = path.join(outDir, 'openhands-w01-task-plan-execute-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W01 Task-Plan-Execute Status',
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
