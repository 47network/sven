#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const migrationsDir = path.join(root, 'services', 'gateway-api', 'src', 'db', 'migrations');
const rollbacksDir = path.join(root, 'services', 'gateway-api', 'src', 'db', 'rollbacks');
const evidencePath = path.join(
  root,
  'docs',
  'release',
  'evidence',
  'db-migration-rollback-scripts-c4-1-2026-02-22.md',
);
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'migration-rollback-coverage-latest.json');
const outMd = path.join(outDir, 'migration-rollback-coverage-latest.md');

function listSql(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function run() {
  const checks = [];

  checks.push({
    id: 'migrations_dir_present',
    pass: fs.existsSync(migrationsDir),
    detail: path.relative(root, migrationsDir),
  });
  checks.push({
    id: 'rollbacks_dir_present',
    pass: fs.existsSync(rollbacksDir),
    detail: path.relative(root, rollbacksDir),
  });

  const migrations = listSql(migrationsDir);
  const rollbacks = listSql(rollbacksDir);
  const rollbackSet = new Set(rollbacks);
  const missingRollbacks = migrations.filter((file) => !rollbackSet.has(file));

  checks.push({
    id: 'rollback_sql_exists_for_each_migration',
    pass: missingRollbacks.length === 0,
    detail:
      missingRollbacks.length === 0
        ? `${migrations.length}/${migrations.length} covered`
        : `missing ${missingRollbacks.length} rollback files`,
  });

  checks.push({
    id: 'rollback_coverage_evidence_present',
    pass: fs.existsSync(evidencePath),
    detail: path.relative(root, evidencePath),
  });

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.every((c) => c.pass) ? 'pass' : 'fail',
    strict,
    provenance: {
      run_id: process.env.GITHUB_RUN_ID || null,
      head_sha: process.env.GITHUB_SHA || null,
      ref: process.env.GITHUB_REF || null,
    },
    summary: {
      migrations_count: migrations.length,
      rollbacks_count: rollbacks.length,
      missing_rollbacks: missingRollbacks,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# DB Migration Rollback Coverage',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      '',
      '## Summary',
      `- Migrations: ${migrations.length}`,
      `- Rollback SQL files: ${rollbacks.length}`,
      `- Missing rollback files: ${missingRollbacks.length}`,
      '',
      '## Checks',
      ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
      ...(missingRollbacks.length
        ? ['## Missing Rollbacks', ...missingRollbacks.map((name) => `- ${name}`), '']
        : []),
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && report.status !== 'pass') {
    process.exit(2);
  }
}

run();

