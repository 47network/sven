#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const checklistPath = path.join(root, 'docs', 'Sven_Master_Checklist.md');
const uiSecretsPagePath = path.join(root, 'apps', 'admin-ui', 'src', 'app', 'secrets', 'page.tsx');
const adminIndexPath = path.join(root, 'services', 'gateway-api', 'src', 'routes', 'admin', 'index.ts');
const integrationRuntimeRoutePath = path.join(root, 'services', 'gateway-api', 'src', 'routes', 'admin', 'integration-runtime.ts');
const smokeTestPath = path.join(root, 'services', 'gateway-api', 'src', '__tests__', 'admin-secrets-route-claim-w6.contract.test.ts');

const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'admin-secrets-route-claim-latest.json');
const outMd = path.join(outDir, 'admin-secrets-route-claim-latest.md');

function check(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const checks = [];
  let checklist = '';
  let adminIndex = '';
  let integrationRoute = '';

  try {
    checklist = readUtf8(checklistPath);
  } catch (error) {
    checks.push(
      check(
        'master_checklist_readable',
        false,
        `failed to read ${path.relative(root, checklistPath)}: ${String(error && error.message ? error.message : error)}`,
      ),
    );
  }

  try {
    adminIndex = readUtf8(adminIndexPath);
    integrationRoute = readUtf8(integrationRuntimeRoutePath);
  } catch (error) {
    checks.push(
      check(
        'admin_routes_readable',
        false,
        `failed reading admin routes: ${String(error && error.message ? error.message : error)}`,
      ),
    );
  }

  const existsUiRoute = fs.existsSync(uiSecretsPagePath);
  checks.push(
    check(
      'exists_ui_route',
      existsUiRoute,
      existsUiRoute
        ? `${path.relative(root, uiSecretsPagePath)} exists`
        : `${path.relative(root, uiSecretsPagePath)} missing`,
    ),
  );

  const apiRegistered = adminIndex.includes('registerIntegrationRuntimeRoutes');
  const apiRouteEvidence =
    integrationRoute.includes("app.get('/integrations/runtime/:integrationType'")
    && integrationRoute.includes("app.put('/integrations/runtime/:integrationType/config'");
  const existsApiRoute = apiRegistered && apiRouteEvidence;
  checks.push(
    check(
      'exists_api_route',
      existsApiRoute,
      existsApiRoute
        ? 'admin integration-runtime routes are registered and config/detail endpoints exist'
        : `route evidence missing: registered=${apiRegistered}; config/detail endpoints=${apiRouteEvidence}`,
    ),
  );

  const smokeTested = fs.existsSync(smokeTestPath);
  checks.push(
    check(
      'smoke_tested',
      smokeTested,
      smokeTested
        ? `${path.relative(root, smokeTestPath)} exists`
        : `${path.relative(root, smokeTestPath)} missing`,
    ),
  );

  const secretsLine = checklist
    ? checklist.split(/\r?\n/).find((line) => /\/secrets/i.test(line))
    : '';
  const hasMarkers =
    /exists_ui_route\s*=\s*yes/i.test(secretsLine || '')
    && /exists_api_route\s*=\s*yes/i.test(secretsLine || '')
    && /smoke_tested\s*=\s*yes/i.test(secretsLine || '');
  checks.push(
    check(
      'checklist_secrets_row_has_verification_markers',
      hasMarkers,
      hasMarkers
        ? 'secrets checklist row includes exists_ui_route/exists_api_route/smoke_tested markers'
        : 'update /secrets checklist row to include exists_ui_route=yes; exists_api_route=yes; smoke_tested=yes',
    ),
  );

  const failed = checks.filter((item) => item.status !== 'pass');
  const status = {
    generated_at: new Date().toISOString(),
    status: failed.length === 0 ? 'pass' : 'fail',
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  const lines = [
    '# Admin Secrets Route Claim Check',
    '',
    `Status: ${status.status}`,
    `Generated: ${status.generated_at}`,
    '',
    '## Checks',
    '',
    ...checks.map((item) => `- ${item.id}: ${item.status} (${item.detail})`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify(status, null, 2));
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && failed.length > 0) {
    process.exit(2);
  }
}

main();
