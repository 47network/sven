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
  const memoryRoute = read('services/gateway-api/src/routes/admin/memory.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read('services/gateway-api/src/__tests__/letta-parity-w04-memory-write-gate-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w04_org_required_memory_write_gate_present',
    memoryRoute.includes('function requireOrgId(request: any, reply: any): string | null') &&
      memoryRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active organization required' }") &&
      memoryRoute.includes("app.post('/memories', async (request, reply) => {"),
    'memory write routes fail closed without active organization context',
  );

  add(
    'letta_w04_target_membership_validation_present',
    memoryRoute.includes('async function validateUserInOrg(orgId: string, userId: string): Promise<boolean>') &&
      memoryRoute.includes('async function validateChatInOrg(orgId: string, chatId: string): Promise<boolean>') &&
      memoryRoute.includes("message: 'user_id is not in active organization'") &&
      memoryRoute.includes("message: 'chat_id is not in active organization'"),
    'memory writes enforce active-org policy for user/chat targets',
  );

  add(
    'letta_w04_consent_gated_session_indexing_present',
    runtimeSource.includes('async function hasSessionIndexConsent(pool: pg.Pool, chatId: string): Promise<boolean>') &&
      runtimeSource.includes('SELECT memory_index_consent FROM session_settings WHERE session_id = $1 LIMIT 1') &&
      runtimeSource.includes('const consent = await hasSessionIndexConsent(pool, chatId);') &&
      runtimeSource.includes('if (!consent) return;') &&
      runtimeSource.includes("INSERT INTO memories (id, user_id, chat_id, visibility, key, value, source, importance, created_at, updated_at)"),
    'session transcript memory writes are consent-gated and fail closed when consent is absent',
  );

  add(
    'letta_w04_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W04 | Memory write gate with policy + consent fail-closed semantics | implemented |') &&
      matrixSource.includes('letta_parity_w04_memory_write_gate_contract') &&
      matrixSource.includes('letta-w04-memory-write-gate-latest') &&
      contractSource.includes('Letta W04 memory write gate parity contract') &&
      contractSource.includes("'letta_w04_org_required_memory_write_gate_present'"),
    'Wave 6 matrix and contract test bind LT-W04 to strict write-gate artifact lane',
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
  const outJson = path.join(outDir, 'letta-w04-memory-write-gate-latest.json');
  const outMd = path.join(outDir, 'letta-w04-memory-write-gate-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W04 Memory Write Gate Status',
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
