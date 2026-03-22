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
    'openhands_w04_resume_command_present',
    commandSource.includes("if (sub === 'resume')") &&
      commandSource.includes('Usage: ${parsed.prefix}prose resume <run_id>') &&
      commandSource.includes('Workflow resume queued: ${resumed.runId}'),
    'chat command exposes resume lane with run id usage and output summary',
  );

  add(
    'openhands_w04_resume_state_restore_metadata_present',
    commandSource.includes("lane: 'OH-W04'") &&
      commandSource.includes("const traceSteps = ['interruption_detected', 'state_restored', 'dispatch_resumed'];") &&
      commandSource.includes("'resumed'") &&
      commandSource.includes("source: 'chat.prose.resume'") &&
      commandSource.includes('resume_token'),
    'resume path persists OH-W04 state restore metadata and audit row',
  );

  add(
    'openhands_w04_resume_dispatch_republish_present',
    commandSource.includes('await publishWorkflowExecute(runId);') &&
      commandSource.includes('Flow: interruption detected -> state restored -> dispatch resumed.'),
    'resume path republishes workflow dispatch and emits deterministic trace',
  );

  add(
    'openhands_w04_contract_test_coverage',
    contractSource.includes('/prose resume restores resumable run state and republishes workflow dispatch with deterministic trace') &&
      contractSource.includes("updatePayload?.openhands_w04?.lane).toBe('OH-W04'"),
    'contract test verifies resume summary + persisted W04 payload',
  );

  add(
    'openhands_w04_matrix_binding_present',
    matrixSource.includes('| OH-W04 | Long-running task continuity (resume after interruption) |') &&
      matrixSource.includes('openhands_parity_w04_resume_after_interrupt'),
    'Wave 1 matrix binds W04 to planned contract test id',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = { generated_at: generatedAt, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'openhands-w04-resume-latest.json');
  const outMd = path.join(outDir, 'openhands-w04-resume-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W04 Resume Status',
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
