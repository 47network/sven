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
  const memoryRoute = read('services/gateway-api/src/routes/admin/memory.ts');
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const memoryRouteScopeTest = read('services/gateway-api/src/__tests__/memory.route.org-scope.test.ts');
  const memoryStoreScopeTest = read('services/gateway-api/src/__tests__/memory-store.organization-scope.unit.test.ts');
  const agentsOrgScopeTest = read('services/gateway-api/src/__tests__/admin-agents-control-plane-org-scope.runtime.test.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w09-shared-memory-isolation-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w09_memory_store_org_scope_guards_present',
    memoryStore.includes('organization_id IS NOT DISTINCT FROM') &&
      memoryStore.includes('AND (organization_id IS NOT DISTINCT FROM $') &&
      memoryStore.includes('organization_id?: string | null') &&
      memoryStore.includes('AND (organization_id IS NOT DISTINCT FROM $2)') &&
      memoryStore.includes('AND (organization_id IS NOT DISTINCT FROM $3)'),
    'memory store operations enforce organization-scoped predicates across list/search/update/delete/consolidate/decay lanes',
  );

  add(
    'letta_w09_memory_route_org_and_membership_validation_present',
    memoryRoute.includes('function requireOrgId(request: any, reply: any): string | null') &&
      memoryRoute.includes('validateUserInOrg') &&
      memoryRoute.includes('validateChatInOrg') &&
      memoryRoute.includes("message: 'user_id is not in active organization'") &&
      memoryRoute.includes("message: 'chat_id is not in active organization'") &&
      memoryRoute.includes("app.get('/memories'") &&
      memoryRoute.includes("app.post('/memories/search'"),
    'admin memory routes require active organization and reject user/chat scopes outside tenant membership',
  );

  add(
    'letta_w09_multi_agent_org_scope_controls_present',
    agentsRoute.includes('function requireActiveOrg(request: any, reply: any): boolean') &&
      agentsRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' },") &&
      agentsRoute.includes("message: 'session_id is not accessible in active account'") &&
      agentsRoute.includes('c.organization_id::text = $3::text') &&
      agentsRoute.includes('c.organization_id::text = $4::text') &&
      agentsRoute.includes('JOIN chats c ON c.id = asn.session_id') &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'"),
    'multi-agent control plane enforces tenant-scoped session ownership and org joins for delegated/shared-memory interactions',
  );

  add(
    'letta_w09_shared_memory_hygiene_scope_filters_present',
    runtimeSource.includes("visibility = 'global'") &&
      runtimeSource.includes("(visibility = 'chat_shared' AND chat_id = $1)") &&
      runtimeSource.includes("(visibility = 'user_private' AND user_id = $2)") &&
      runtimeSource.includes('AND archived_at IS NULL') &&
      runtimeSource.includes('AND merged_into IS NULL') &&
      runtimeSource.includes("'preserved_facts:'"),
    'shared memory compaction hygiene keeps global/chat/user-private scope separation and excludes archived/merged rows',
  );

  add(
    'letta_w09_scope_tests_and_matrix_binding_present',
    memoryRouteScopeTest.includes('admin memory route org scoping') &&
      memoryStoreScopeTest.includes('MemoryStore organization scoping') &&
      agentsOrgScopeTest.includes('admin agents control-plane org-scope runtime') &&
      matrixSource.includes('| LT-W09 | Multi-agent shared memory hygiene with org isolation | implemented |') &&
      matrixSource.includes('letta_parity_w09_shared_memory_isolation_contract') &&
      matrixSource.includes('letta-w09-shared-memory-isolation-latest') &&
      contractSource.includes('Letta W09 shared memory isolation parity contract') &&
      contractSource.includes("'letta_w09_memory_store_org_scope_guards_present'"),
    'scope-focused tests and Wave 6 matrix bind LT-W09 to strict shared-memory isolation artifact lane',
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
  const outJson = path.join(outDir, 'letta-w09-shared-memory-isolation-latest.json');
  const outMd = path.join(outDir, 'letta-w09-shared-memory-isolation-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W09 Shared Memory Isolation Status',
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
