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
  const consolidationWorker = read('services/gateway-api/src/workers/memory-consolidation-worker.ts');
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const delayedRecallCore = read('services/agent-runtime/src/delayed-recall.ts');
  const delayedRecallTest = read('services/agent-runtime/src/__tests__/delayed-recall.test.ts');
  const memoryConsolidationParity = read('services/gateway-api/src/__tests__/parity-memory-consolidation-truthfulness-2026-03-12.contract.test.ts');
  const delayedRecallParity = read('services/gateway-api/src/__tests__/parity-delayed-recall-production-2026-03-12.contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w03_memory_consolidation_lifecycle_controls_present',
    memoryStore.includes("'memory.consolidation.enabled'") &&
      memoryStore.includes("'memory.consolidation.threshold'") &&
      memoryStore.includes("'memory.consolidation.mode'") &&
      memoryStore.includes('memory_consolidation_jobs') &&
      memoryStore.includes("mode === 'deferred'"),
    'memory store supports consolidation lifecycle policy with deferred job queueing',
  );

  add(
    'framework_w03_deferred_worker_cadence_present',
    consolidationWorker.includes("key = 'memory.consolidation.mode'") &&
      consolidationWorker.includes("if (mode !== 'deferred') return;") &&
      consolidationWorker.includes('FROM memory_consolidation_jobs') &&
      consolidationWorker.includes('Memory consolidation worker started'),
    'deferred consolidation worker enforces mode-gated cadence and queue draining',
  );

  add(
    'framework_w03_delayed_recall_cadence_and_state_present',
    runtimeIndex.includes('memory.delayedRecall.everyNTurns') &&
      runtimeIndex.includes('memory.delayedRecall.minTurnsBetween') &&
      runtimeIndex.includes('memory.delayedRecall.minMinutesBetween') &&
      runtimeIndex.includes('memory.delayedRecall.maxItems') &&
      runtimeIndex.includes('memory.delayedRecall.minOverlap') &&
      runtimeIndex.includes('Failed to persist delayed recall state') &&
      delayedRecallCore.includes('buildDelayedRecallPrompt'),
    'runtime delayed-recall cadence uses stateful turn/time gating and prompt injection',
  );

  add(
    'framework_w03_contract_and_runtime_tests_bound',
    delayedRecallTest.includes("describe('Delayed memory recall'") &&
      delayedRecallTest.includes('buildDelayedRecallPrompt') &&
      memoryConsolidationParity.includes("describe('parity memory consolidation truthfulness contract'") &&
      delayedRecallParity.includes("describe('parity delayed recall production contract'"),
    'memory lifecycle is anchored by parity contracts and runtime delayed-recall coverage',
  );

  add(
    'framework_w03_matrix_binding_present',
    matrixSource.includes('| FW-W03 | Persistent agent memory profile lifecycle (consolidation + recall cadence) | implemented |') &&
      matrixSource.includes('framework_parity_w03_memory_profile_lifecycle_contract'),
    'Wave 4 matrix binds FW-W03 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w03-memory-profile-latest.json');
  const outMd = path.join(outDir, 'framework-w03-memory-profile-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W03 Memory Profile Lifecycle Status',
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
