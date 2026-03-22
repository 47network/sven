#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function includesAll(file, patterns) {
  const body = read(file);
  const missing = patterns.filter((pattern) => !body.includes(pattern));
  return { pass: missing.length === 0, missing };
}

function run() {
  const requiredFiles = [
    'docker-compose.dev.yml',
    'docker-compose.staging.yml',
    'docker-compose.production.yml',
    'config/env/.env.development.example',
    'config/env/.env.staging.example',
    'config/env/.env.production.example',
    'config/env/dev.required.json',
    'config/env/staging.required.json',
    'config/env/prod.required.json',
  ];

  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

  const devCompose = includesAll('docker-compose.dev.yml', [
    'SVEN_DEPLOYMENT_MODE: development',
    'NODE_ENV: development',
  ]);
  const stagingCompose = includesAll('docker-compose.staging.yml', ['SVEN_DEPLOYMENT_MODE: staging']);
  const prodCompose = includesAll('docker-compose.production.yml', [
    'SVEN_DEPLOYMENT_MODE: production',
    'NODE_ENV: production',
  ]);

  const devEnv = includesAll('config/env/.env.development.example', [
    'ENVIRONMENT=development',
    'SVEN_DEPLOYMENT_MODE=development',
    'SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED=',
    'SVEN_INTEGRATION_RUNTIME_RECONCILE_ENABLED=',
  ]);
  const stagingEnv = includesAll('config/env/.env.staging.example', [
    'ENVIRONMENT=staging',
    'SVEN_DEPLOYMENT_MODE=staging',
    'SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED=',
    'SVEN_INTEGRATION_RUNTIME_RECONCILE_ENABLED=',
  ]);
  const prodEnv = includesAll('config/env/.env.production.example', [
    'ENVIRONMENT=production',
    'SVEN_DEPLOYMENT_MODE=production',
    'SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED=',
    'SVEN_INTEGRATION_RUNTIME_RECONCILE_ENABLED=',
  ]);
  const gatewayComposeRuntimeEnv = includesAll('docker-compose.yml', [
    'SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED=',
    'SVEN_INTEGRATION_DEPLOY_CMD_TEMPLATE=',
    'SVEN_INTEGRATION_STOP_CMD_TEMPLATE=',
    'SVEN_INTEGRATION_STATUS_CMD_TEMPLATE=',
    'SVEN_INTEGRATION_RUNTIME_RECONCILE_ENABLED=',
    'SVEN_INTEGRATION_RUNTIME_RECONCILE_INTERVAL_MS=',
    'SVEN_INTEGRATION_RUNTIME_AUTOHEAL=',
  ]);

  const checks = [
    {
      id: 'environment_specific_files_present',
      pass: missingFiles.length === 0,
      detail: missingFiles.length ? missingFiles.join(', ') : 'all required files present',
    },
    {
      id: 'compose_dev_mode_declared',
      pass: devCompose.pass,
      detail: devCompose.pass ? 'ok' : `missing: ${devCompose.missing.join(', ')}`,
    },
    {
      id: 'compose_staging_mode_declared',
      pass: stagingCompose.pass,
      detail: stagingCompose.pass ? 'ok' : `missing: ${stagingCompose.missing.join(', ')}`,
    },
    {
      id: 'compose_production_mode_declared',
      pass: prodCompose.pass,
      detail: prodCompose.pass ? 'ok' : `missing: ${prodCompose.missing.join(', ')}`,
    },
    {
      id: 'env_template_development_present',
      pass: devEnv.pass,
      detail: devEnv.pass ? 'ok' : `missing: ${devEnv.missing.join(', ')}`,
    },
    {
      id: 'env_template_staging_present',
      pass: stagingEnv.pass,
      detail: stagingEnv.pass ? 'ok' : `missing: ${stagingEnv.missing.join(', ')}`,
    },
    {
      id: 'env_template_production_present',
      pass: prodEnv.pass,
      detail: prodEnv.pass ? 'ok' : `missing: ${prodEnv.missing.join(', ')}`,
    },
    {
      id: 'gateway_compose_runtime_hook_env_declared',
      pass: gatewayComposeRuntimeEnv.pass,
      detail: gatewayComposeRuntimeEnv.pass ? 'ok' : `missing: ${gatewayComposeRuntimeEnv.missing.join(', ')}`,
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'environment-config-latest.json');
  const outMd = path.join(outDir, 'environment-config-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Environment Config Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
