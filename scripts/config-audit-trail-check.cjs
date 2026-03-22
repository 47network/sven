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

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function run() {
  const migration = 'services/gateway-api/src/db/migrations/113_config_change_audit.sql';
  const settingsRoute = 'services/gateway-api/src/routes/admin/settings.ts';

  const migrationBody = fs.existsSync(path.join(root, migration)) ? read(migration) : '';
  const routeBody = fs.existsSync(path.join(root, settingsRoute)) ? read(settingsRoute) : '';

  const checks = [
    {
      id: 'config_change_audit_migration_present',
      pass: migrationBody.includes('CREATE TABLE IF NOT EXISTS config_change_audit'),
      detail: migration,
    },
    {
      id: 'settings_route_writes_audit_entries',
      pass: routeBody.includes('INSERT INTO config_change_audit'),
      detail: settingsRoute,
    },
    {
      id: 'settings_audit_endpoint_exposed',
      pass: routeBody.includes("app.get('/settings/audit'"),
      detail: '/v1/admin/settings/audit',
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'config-audit-trail-latest.json');
  const outMd = path.join(outDir, 'config-audit-trail-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Config Change Audit Trail Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
