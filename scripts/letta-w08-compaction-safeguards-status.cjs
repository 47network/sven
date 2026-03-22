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
  const compactionService = read('services/gateway-api/src/services/CompactionService.ts');
  const sessionsRoute = read('services/gateway-api/src/routes/sessions.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const opsCommandsTest = read('services/agent-runtime/src/__tests__/ops-commands.test.ts');
  const scopeContract = read('services/gateway-api/src/__tests__/sessions-route.scope-authorization-contract.test.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w08-compaction-safeguards-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w08_threshold_and_budget_guardrails_present',
    compactionService.includes('async shouldCompact(sessionId: string, context: SessionAccessContext)') &&
      compactionService.includes('threshold_tokens') &&
      compactionService.includes('warning_tokens') &&
      compactionService.includes('approaching_limit') &&
      compactionService.includes('auto_compact_enabled') &&
      compactionService.includes("['chat.compaction.auto', 'chat.compaction.safeguard']") &&
      compactionService.includes("['chat.compaction.threshold_pct', 'chat.compaction.memoryFlush.softThresholdPct']") &&
      compactionService.includes("['chat.compaction.memoryFlush.softThresholdTokens']"),
    'compaction lane exposes threshold/warning budget guardrails and alias-backed settings for high-turn sessions',
  );

  add(
    'letta_w08_long_session_boundary_and_event_persistence_present',
    compactionService.includes('const keepRecent = Math.max(1, Number(options?.keepRecent || 10));') &&
      compactionService.includes('if (rows.length <= keepRecent) {') &&
      compactionService.includes('reason: \'not_enough_messages\'') &&
      compactionService.includes('const older = rows.slice(0, Math.max(0, rows.length - keepRecent));') &&
      compactionService.includes('const recent = rows.slice(Math.max(0, rows.length - keepRecent));') &&
      compactionService.includes('getContextBoundaryTimestamp(sessionId)') &&
      compactionService.includes('INSERT INTO compaction_events'),
    'high-turn compaction keeps a recent-turn safety window, respects summary/reset boundaries, and persists compaction evidence',
  );

  add(
    'letta_w08_runtime_auto_compaction_controls_present',
    runtimeSource.includes('async function maybeAutoCompactSession(') &&
      runtimeSource.includes("['chat.compaction.auto', 'chat.compaction.safeguard']") &&
      runtimeSource.includes("['chat.compaction.threshold_pct', 'chat.compaction.memoryFlush.softThresholdPct']") &&
      runtimeSource.includes("['chat.compaction.memoryFlush.softThresholdTokens']") &&
      runtimeSource.includes('if (estimatedTokens < thresholdTokens) {') &&
      runtimeSource.includes("logger.info('Auto compaction applied before LLM routing'"),
    'runtime path enforces bounded auto-compaction thresholds before model routing under long-turn pressure',
  );

  add(
    'letta_w08_scope_and_operator_guard_proofs_present',
    runtimeSource.includes("visibility = 'global'") &&
      runtimeSource.includes("(visibility = 'chat_shared' AND chat_id = $1)") &&
      runtimeSource.includes("(visibility = 'user_private' AND user_id = $2)") &&
      runtimeSource.includes('AND archived_at IS NULL') &&
      runtimeSource.includes('AND merged_into IS NULL') &&
      sessionsRoute.includes("app.get('/v1/sessions/:id/token-usage'") &&
      sessionsRoute.includes("app.get('/v1/sessions/:id/compaction-history'") &&
      scopeContract.includes('sessions route scope authorization contract') &&
      opsCommandsTest.includes('/compact uses active-memory + user-scoped visibility filters'),
    'compaction safeguards preserve scope isolation and expose operator introspection lanes with contract-backed proofs',
  );

  add(
    'letta_w08_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W08 | Memory compaction safeguards under high-turn sessions | implemented |') &&
      matrixSource.includes('letta_parity_w08_compaction_safeguards_contract') &&
      matrixSource.includes('letta-w08-compaction-safeguards-latest') &&
      contractSource.includes('Letta W08 compaction safeguards parity contract') &&
      contractSource.includes("'letta_w08_threshold_and_budget_guardrails_present'"),
    'Wave 6 matrix and contract test bind LT-W08 to strict compaction-safeguards artifact lane',
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
  const outJson = path.join(outDir, 'letta-w08-compaction-safeguards-latest.json');
  const outMd = path.join(outDir, 'letta-w08-compaction-safeguards-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W08 Compaction Safeguards Status',
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
