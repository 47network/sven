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
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w03-memory-scope-separation-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w03_visibility_partition_context_present',
    runtimeSource.includes('SELECT key, value FROM memories') &&
      runtimeSource.includes("WHERE (visibility = 'global')") &&
      runtimeSource.includes("OR (visibility = 'chat_shared' AND chat_id = $1)") &&
      runtimeSource.includes("OR (visibility = 'user_private' AND user_id = $2)") &&
      runtimeSource.includes('ORDER BY updated_at DESC LIMIT 20'),
    'context loading partitions memory scopes by global/chat-shared/user-private visibility',
  );

  add(
    'letta_w03_session_stitching_short_term_boundary_present',
    runtimeSource.includes('async function maybeBuildSessionStitchingPrompt(') &&
      runtimeSource.includes('WHERE chat_id <> $1') &&
      runtimeSource.includes("AND source = 'session'") &&
      runtimeSource.includes('AND user_id = $2') &&
      runtimeSource.includes("AND (visibility = 'chat_shared' OR visibility = 'user_private')"),
    'session-stitching keeps short-term recall bounded to same-user cross-chat session memories',
  );

  add(
    'letta_w03_compaction_scope_reuse_present',
    runtimeSource.includes('async function composeCompactionSummary(') &&
      runtimeSource.includes("visibility = 'global'") &&
      runtimeSource.includes("OR (visibility = 'chat_shared' AND chat_id = $1)") &&
      runtimeSource.includes("OR (visibility = 'user_private' AND user_id = $2)") &&
      runtimeSource.includes('AND archived_at IS NULL') &&
      runtimeSource.includes('AND merged_into IS NULL'),
    'compaction summary reuses separated memory scopes with archived/merged exclusion guards',
  );

  add(
    'letta_w03_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W03 | Session memory scopes (short-term vs long-term recall policy) | implemented |') &&
      matrixSource.includes('letta_parity_w03_memory_scope_separation_contract') &&
      matrixSource.includes('letta-w03-memory-scope-separation-latest') &&
      contractSource.includes('Letta W03 memory scope separation parity contract') &&
      contractSource.includes("'letta_w03_visibility_partition_context_present'"),
    'Wave 6 matrix and contract test bind LT-W03 to strict scope-separation artifact lane',
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
  const outJson = path.join(outDir, 'letta-w03-memory-scope-separation-latest.json');
  const outMd = path.join(outDir, 'letta-w03-memory-scope-separation-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W03 Memory Scope Separation Status',
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
