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
  const integrationsCatalogRoute = read('services/gateway-api/src/routes/admin/integrations-catalog.ts');
  const integrationsTemplateContract = read('services/gateway-api/src/__tests__/admin-integrations-catalog-template-option-validation-contract.test.ts');
  const integrationsPage = read('apps/admin-ui/src/app/integrations/page.tsx');
  const hooksSource = read('apps/admin-ui/src/lib/hooks.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w06_template_catalog_route_surface_present',
    integrationsCatalogRoute.includes("app.get('/integrations/catalog'") &&
      integrationsCatalogRoute.includes("app.get('/integrations/catalog/library'") &&
      integrationsCatalogRoute.includes("app.post('/integrations/catalog/:integrationId/apply-template'"),
    'integration template catalog/list/apply routes are exposed through admin API',
  );

  add(
    'n8n_w06_template_apply_runtime_controls_present',
    integrationsCatalogRoute.includes('function parseOptionalBooleanOption(') &&
      integrationsCatalogRoute.includes("'deploy_runtime'") &&
      integrationsCatalogRoute.includes("'overwrite_existing'") &&
      integrationsCatalogRoute.includes('const shouldDeploy = deployRuntimeParsed.value ?? true;') &&
      integrationsCatalogRoute.includes('const overwriteExisting = overwriteExistingParsed.value ?? false;'),
    'template apply path enforces typed deploy/overwrite controls and deterministic defaults',
  );

  add(
    'n8n_w06_admin_ui_template_operations_present',
    integrationsPage.includes('applyIntegrationTemplateCore(') &&
      integrationsPage.includes('applyTemplatesToUnconfiguredIntegrations') &&
      integrationsPage.includes('Apply templates to unconfigured') &&
      hooksSource.includes('export function useApplyIntegrationTemplate() {'),
    'admin UI exposes template apply workflows (single + bulk) backed by API hooks',
  );

  add(
    'n8n_w06_contract_tests_bound',
    integrationsTemplateContract.includes("describe('integrations catalog template option boolean validation contract'") &&
      integrationsTemplateContract.includes('parseOptionalBooleanOption('),
    'template catalog option handling is bound to dedicated gateway contract test',
  );

  add(
    'n8n_w06_matrix_binding_present',
    matrixSource.includes('| NN-W06 | Template-driven workflow catalog | implemented |') &&
      matrixSource.includes('n8n_parity_w06_template_catalog_contract'),
    'Wave 3 matrix binds NN-W06 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w06-template-catalog-latest.json');
  const outMd = path.join(outDir, 'n8n-w06-template-catalog-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W06 Template Catalog Status',
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
