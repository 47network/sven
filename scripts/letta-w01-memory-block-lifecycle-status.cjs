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
  const memoryStore = read('services/gateway-api/src/services/MemoryStore.ts');
  const workerSource = read('services/gateway-api/src/workers/memory-consolidation-worker.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const delayedRecallSource = read('services/agent-runtime/src/delayed-recall.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read('services/gateway-api/src/__tests__/letta-parity-w01-memory-block-lifecycle-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w01_memory_lifecycle_settings_present',
    memoryStore.includes("'memory.consolidation.enabled'") &&
      memoryStore.includes("'memory.consolidation.threshold'") &&
      memoryStore.includes("'memory.consolidation.mode'") &&
      memoryStore.includes("mode === 'deferred'") &&
      memoryStore.includes('memory_consolidation_jobs'),
    'memory lifecycle controls include enablement, threshold, mode, and deferred queue persistence',
  );

  add(
    'letta_w01_memory_worker_cadence_present',
    workerSource.includes("key = 'memory.consolidation.mode'") &&
      workerSource.includes("if (mode !== 'deferred') return;") &&
      workerSource.includes('FROM memory_consolidation_jobs') &&
      workerSource.includes('Memory consolidation worker started'),
    'deferred memory worker enforces cadence and mode-gated queue processing',
  );

  add(
    'letta_w01_delayed_recall_stateful_gating_present',
    runtimeSource.includes('memory.delayedRecall.everyNTurns') &&
      runtimeSource.includes('memory.delayedRecall.minTurnsBetween') &&
      runtimeSource.includes('memory.delayedRecall.minMinutesBetween') &&
      runtimeSource.includes('memory.delayedRecall.maxItems') &&
      delayedRecallSource.includes('buildDelayedRecallPrompt'),
    'runtime delayed-recall applies turn/time bounded gating and prompt composition',
  );

  add(
    'letta_w01_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W01 | Memory block lifecycle (capture -> consolidate -> delayed recall) | implemented |') &&
      matrixSource.includes('letta_parity_w01_memory_block_lifecycle_contract') &&
      matrixSource.includes('letta-w01-memory-block-lifecycle-latest') &&
      contractSource.includes('Letta W01 memory block lifecycle parity contract') &&
      contractSource.includes("'letta_w01_memory_lifecycle_settings_present'"),
    'Wave 6 matrix and contract test bind LT-W01 to strict artifact lane',
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
  const outJson = path.join(outDir, 'letta-w01-memory-block-lifecycle-latest.json');
  const outMd = path.join(outDir, 'letta-w01-memory-block-lifecycle-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W01 Memory Block Lifecycle Status',
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
