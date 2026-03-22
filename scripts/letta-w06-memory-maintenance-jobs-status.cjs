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
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w06-memory-maintenance-jobs-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w06_deferred_job_queueing_present',
    memoryStore.includes('INSERT INTO memory_consolidation_jobs') &&
      memoryStore.includes('scope_fingerprint') &&
      memoryStore.includes('ON CONFLICT (scope_fingerprint)') &&
      memoryStore.includes("status = CASE WHEN memory_consolidation_jobs.status = 'processing' THEN memory_consolidation_jobs.status ELSE 'pending' END"),
    'memory maintenance queue deduplicates scope jobs and requeues safely for deferred processing',
  );

  add(
    'letta_w06_worker_claim_and_locking_present',
    workerSource.includes('const ADVISORY_LOCK_KEY') &&
      workerSource.includes('SELECT pg_try_advisory_lock($1) AS locked') &&
      workerSource.includes("WHERE status = 'pending'") &&
      workerSource.includes('FOR UPDATE SKIP LOCKED') &&
      workerSource.includes("SET status = 'processing'") &&
      workerSource.includes('attempts = j.attempts + 1'),
    'worker claims jobs under advisory lock with skip-locked semantics and atomic processing-state transition',
  );

  add(
    'letta_w06_bounded_retry_backoff_present',
    workerSource.includes('const retrySeconds = Math.min(300, Math.max(15, attempts * 15));') &&
      workerSource.includes("status = CASE WHEN attempts >= 10 THEN 'failed' ELSE 'pending' END") &&
      workerSource.includes('run_after = NOW() + make_interval(secs => $3)') &&
      workerSource.includes('Deferred memory consolidation job failed'),
    'maintenance retries are bounded with escalating backoff and terminal failed state',
  );

  add(
    'letta_w06_worker_cadence_controls_present',
    workerSource.includes('MEMORY_CONSOLIDATION_DEFERRED_WORKER_INTERVAL_MS') &&
      workerSource.includes('MEMORY_CONSOLIDATION_DEFERRED_WORKER_BATCH_SIZE') &&
      workerSource.includes('Math.max(2000, intervalMs)') &&
      workerSource.includes('Memory consolidation worker started'),
    'worker cadence and throughput are controlled by bounded environment knobs',
  );

  add(
    'letta_w06_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W06 | Background memory maintenance jobs with bounded retries | implemented |') &&
      matrixSource.includes('letta_parity_w06_memory_maintenance_jobs_contract') &&
      matrixSource.includes('letta-w06-memory-maintenance-jobs-latest') &&
      contractSource.includes('Letta W06 memory maintenance jobs parity contract') &&
      contractSource.includes("'letta_w06_deferred_job_queueing_present'"),
    'Wave 6 matrix and contract test bind LT-W06 to strict maintenance-job artifact lane',
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
  const outJson = path.join(outDir, 'letta-w06-memory-maintenance-jobs-latest.json');
  const outMd = path.join(outDir, 'letta-w06-memory-maintenance-jobs-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W06 Memory Maintenance Jobs Status',
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
