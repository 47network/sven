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
  const chatCommandsSource = read('services/agent-runtime/src/chat-commands.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const opsCommandsTestSource = read('services/agent-runtime/src/__tests__/ops-commands.test.ts');
  const sessionsE2ESource = read('services/gateway-api/src/__tests__/sessions.e2e.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/openhands-parity-w08-compaction-intent-preserve-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w08_compaction_summary_structure_present',
    chatCommandsSource.includes("const COMPACTION_SUMMARY_PREFIX = '[SVEN_COMPACTION_SUMMARY]';") &&
      chatCommandsSource.includes("'conversation_summary:'") &&
      chatCommandsSource.includes("'preserved_facts:'") &&
      chatCommandsSource.includes("'recent_tool_results:'"),
    'compaction summary has deterministic sections preserving intent, facts, and recent tool context',
  );

  add(
    'openhands_w08_context_boundary_and_recent_window_present',
    chatCommandsSource.includes('const keepRecent = 10;') &&
      chatCommandsSource.includes("AND (text = $2 OR text LIKE $3)") &&
      chatCommandsSource.includes('[chatId, SESSION_RESET_MARKER, `${COMPACTION_SUMMARY_PREFIX}%`]') &&
      runtimeSource.includes('if (autoCompaction.compacted) {') &&
      runtimeSource.includes("logger.info('Auto compaction applied before LLM routing'"),
    'compaction preserves recent turns and uses summary/reset markers as context boundaries',
  );

  add(
    'openhands_w08_scope_preserved_facts_query_present',
    chatCommandsSource.includes("visibility = 'global'") &&
      chatCommandsSource.includes("(visibility = 'chat_shared' AND chat_id = $1)") &&
      chatCommandsSource.includes("(visibility = 'user_private' AND user_id = $2)") &&
      chatCommandsSource.includes('AND archived_at IS NULL') &&
      chatCommandsSource.includes('AND merged_into IS NULL'),
    'preserved facts extraction is scope-safe and excludes archived/merged memory rows',
  );

  add(
    'openhands_w08_test_and_contract_coverage_present',
    opsCommandsTestSource.includes('/compact uses active-memory + user-scoped visibility filters') &&
      sessionsE2ESource.includes('pinned facts are preserved in compaction summary (optional)') &&
      contractSource.includes('OpenHands W08 compaction intent-preservation parity contract') &&
      contractSource.includes("'openhands_w08_compaction_summary_structure_present'"),
    'compaction fidelity behavior is anchored by runtime/e2e tests and parity contract',
  );

  add(
    'openhands_w08_matrix_binding_present',
    matrixSource.includes('| OH-W08 | Session context compaction without losing task intent | implemented |') &&
      matrixSource.includes('openhands_parity_w08_compaction_intent_preserve') &&
      matrixSource.includes('openhands-w08-compaction-fidelity-latest'),
    'Wave 1 matrix binds OH-W08 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'openhands-w08-compaction-fidelity-latest.json');
  const outMd = path.join(outDir, 'openhands-w08-compaction-fidelity-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W08 Compaction Fidelity Status',
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
