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

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w03_rollback_command_present',
    commandSource.includes("if (sub === 'rollback')") &&
      commandSource.includes('Usage: ${parsed.prefix}prose rollback <run_id> [reason]') &&
      commandSource.includes('Workflow rollback complete: ${rolledBack.runId}'),
    'chat command exposes rollback lane and emits rollback summary',
  );

  add(
    'openhands_w03_rollback_metadata_present',
    commandSource.includes("lane: 'OH-W03'") &&
      commandSource.includes("const traceSteps = ['failure_or_risk_detected', 'rollback_prepared', 'rollback_applied'];") &&
      commandSource.includes("action, actor_id, details, created_at)\n     VALUES ($1, $2, $3, 'rollback'") &&
      commandSource.includes("source: 'chat.prose.rollback'"),
    'rollback path persists deterministic W03 metadata in run payload + audit',
  );

  add(
    'openhands_w03_contract_test_coverage',
    contractSource.includes('/prose rollback applies deterministic rollback path with W03 metadata') &&
      contractSource.includes("updatePayload?.openhands_w03?.lane).toBe('OH-W03'"),
    'contract test asserts rollback summary and persisted W03 payload',
  );

  add(
    'openhands_w03_matrix_binding_present',
    matrixSource.includes('| OH-W03 | Multi-file refactor with safety checks and rollback path |') &&
      matrixSource.includes('openhands_parity_w03_multifile_refactor_recovery'),
    'Wave 1 matrix binds W03 to planned contract test id',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = { generated_at: generatedAt, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'openhands-w03-multifile-refactor-latest.json');
  const outMd = path.join(outDir, 'openhands-w03-multifile-refactor-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W03 Multi-file Refactor Recovery Status',
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
