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
  const pageSource = read('apps/admin-ui/src/app/memories/page.tsx');
  const hooksSource = read('apps/admin-ui/src/lib/hooks.ts');
  const apiSource = read('apps/admin-ui/src/lib/api.ts');
  const routeSource = read('services/gateway-api/src/routes/admin/memory.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w07-memory-inspection-ux-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w07_memory_console_surface_present',
    pageSource.includes('PageHeader title="Memories"') &&
      pageSource.includes('Browse, search, edit, export, import, and monitor memory health') &&
      pageSource.includes('Semantic Search') &&
      pageSource.includes('Export JSON') &&
      pageSource.includes('Export CSV') &&
      pageSource.includes('Import JSON') &&
      pageSource.includes('Bulk Delete') &&
      pageSource.includes('Memory Detail') &&
      pageSource.includes('Memory Stats'),
    'memory inspection UI exposes operator console for browse/search/edit/import/export/delete and stats surfaces',
  );

  add(
    'letta_w07_memory_ui_query_mutation_hooks_present',
    hooksSource.includes('export function useMemory(') &&
      hooksSource.includes('export function useMemoryStats()') &&
      hooksSource.includes('export function useMemoryDetail(id?: string)') &&
      hooksSource.includes('export function useUpdateMemory()') &&
      hooksSource.includes('export function useDeleteMemory()') &&
      hooksSource.includes('export function useBulkDeleteMemories()') &&
      hooksSource.includes('export function useImportMemories()') &&
      hooksSource.includes('export function useSemanticMemorySearch()') &&
      hooksSource.includes('export function useExportMemories()'),
    'admin hooks wire inspection UX to list/detail/stats and mutation lanes',
  );

  add(
    'letta_w07_memory_admin_api_bindings_present',
    apiSource.includes('/admin/memories') &&
      apiSource.includes('/admin/memories/stats') &&
      apiSource.includes('/admin/memories/search') &&
      apiSource.includes('/admin/memories/export') &&
      apiSource.includes('/admin/memories/import') &&
      apiSource.includes('/admin/memories/bulk'),
    'admin API client binds memory inspection UX to list/search/stats/export/import/bulk-delete routes',
  );

  add(
    'letta_w07_memory_route_org_scoped_controls_present',
    routeSource.includes('function requireOrgId(request: any, reply: any): string | null') &&
      routeSource.includes("app.get('/memories'") &&
      routeSource.includes("app.get('/memories/:id'") &&
      routeSource.includes("app.put('/memories/:id', updateMemoryHandler)") &&
      routeSource.includes("app.delete('/memories/:id'") &&
      routeSource.includes("app.delete('/memories/bulk'") &&
      routeSource.includes("app.get('/memories/export'") &&
      routeSource.includes("app.post('/memories/import'") &&
      routeSource.includes("app.get('/memories/stats'"),
    'memory inspection routes enforce active-organization scope and provide full operator CRUD/import-export/stats surface',
  );

  add(
    'letta_w07_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W07 | Memory inspection UX for operators and developers | implemented |') &&
      matrixSource.includes('letta_parity_w07_memory_inspection_ux_contract') &&
      matrixSource.includes('letta-w07-memory-inspection-ux-latest') &&
      contractSource.includes('Letta W07 memory inspection UX parity contract') &&
      contractSource.includes("'letta_w07_memory_console_surface_present'"),
    'Wave 6 matrix and contract test bind LT-W07 to strict memory-inspection artifact lane',
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
  const outJson = path.join(outDir, 'letta-w07-memory-inspection-ux-latest.json');
  const outMd = path.join(outDir, 'letta-w07-memory-inspection-ux-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W07 Memory Inspection UX Status',
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
