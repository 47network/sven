#!/usr/bin/env node
/* eslint-disable no-console */
const { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const OUTPUT_JSON = argValue('--output-json', 'docs/release/status/data-integrity-latest.json');
const OUTPUT_MD = argValue('--output-md', 'docs/release/status/data-integrity-latest.md');

function read(path) {
  return readFileSync(path, 'utf8');
}

function checkFile(path) {
  return existsSync(path);
}

function checkBackupEvidence() {
  const evidenceA = 'docs/release/evidence/migration-backup-drill-2026-02-12.md';
  const evidenceB = 'docs/release/evidence/migration-backup-drill-2026-02-13.md';
  const okA = checkFile(evidenceA);
  const okB = checkFile(evidenceB);
  return {
    id: 'backup_script_tested',
    checklist: 'Database backup script tested (pg_dump + restore)',
    status: okA || okB ? 'pass' : 'fail',
    detail: okA || okB
      ? `Found drill evidence: ${okA ? evidenceA : evidenceB}`
      : 'No migration-backup drill evidence found',
    evidence: [evidenceA, evidenceB].filter(checkFile),
  };
}

function checkWalArchivingConfigured() {
  const composePath = 'docker-compose.yml';
  if (!checkFile(composePath)) {
    return {
      id: 'wal_archiving',
      checklist: 'WAL archiving configured for point-in-time recovery',
      status: 'fail',
      detail: 'docker-compose.yml not found',
      evidence: [],
    };
  }
  const text = read(composePath);
  const hasWal = /wal_level|archive_mode|archive_command|restore_command/i.test(text);
  return {
    id: 'wal_archiving',
    checklist: 'WAL archiving configured for point-in-time recovery',
    status: hasWal ? 'pass' : 'fail',
    detail: hasWal
      ? 'Postgres WAL/PITR markers detected in compose config'
      : 'No explicit WAL/PITR postgres settings detected in docker-compose.yml',
    evidence: [composePath],
  };
}

function checkNightlyBackupCronConfigured() {
  const migration = 'services/gateway-api/src/db/migrations/030_backups_disaster_recovery.sql';
  const backupService = 'services/gateway-api/src/services/BackupService.ts';
  const gatewayIndex = 'services/gateway-api/src/index.ts';
  const evidence = 'docs/release/evidence/nightly-backup-cron-verify-2026-02-21.md';
  if (!checkFile(migration) || !checkFile(backupService) || !checkFile(gatewayIndex)) {
    return {
      id: 'nightly_backup_cron',
      checklist: 'Nightly backup cron job active',
      status: 'fail',
      detail: 'Required backup scheduling source files not found',
      evidence: [],
    };
  }
  const text = read(migration);
  const backupSource = read(backupService);
  const indexSource = read(gatewayIndex);
  const hasDaily = /default-daily-backup/.test(text) && /0 2 \* \* \*/.test(text);
  const hasCronSyncLogic = /export async function syncBackupCronJobs/.test(backupSource);
  const hasStartupSync = /syncBackupCronJobs\(\)/.test(indexSource);
  const hasEvidence = checkFile(evidence);
  const pass = hasDaily && hasCronSyncLogic && hasStartupSync && hasEvidence;
  return {
    id: 'nightly_backup_cron',
    checklist: 'Nightly backup cron job active',
    status: pass ? 'pass' : hasDaily && hasCronSyncLogic && hasStartupSync ? 'warn' : 'fail',
    detail: pass
      ? 'Backup cron config, startup sync logic, and runtime verification evidence are present'
      : hasDaily && hasCronSyncLogic && hasStartupSync
        ? 'Backup cron sync logic is wired; runtime verification evidence file still missing'
        : 'Backup cron config/sync wiring is incomplete',
    evidence: [migration, backupService, gatewayIndex, evidence].filter(checkFile),
  };
}

function checkRestoreDrillDocumented() {
  const evidenceA = 'docs/release/evidence/migration-backup-drill-2026-02-12.md';
  const evidenceB = 'docs/release/evidence/migration-backup-drill-2026-02-13.md';
  const okA = checkFile(evidenceA);
  const okB = checkFile(evidenceB);
  return {
    id: 'restore_drill',
    checklist: 'Backup restore drill completed and documented',
    status: okA || okB ? 'pass' : 'fail',
    detail: okA || okB
      ? `Found restore drill evidence: ${okA ? evidenceA : evidenceB}`
      : 'No restore drill evidence found',
    evidence: [evidenceA, evidenceB].filter(checkFile),
  };
}

function checkNatsJetstreamPersistence() {
  const composePath = 'docker-compose.yml';
  const evidence = 'docs/release/evidence/nats-jetstream-persistence-2026-02-21.md';
  if (!checkFile(composePath)) {
    return {
      id: 'nats_jetstream_persistence',
      checklist: 'NATS JetStream persistence verified across restart',
      status: 'fail',
      detail: 'docker-compose.yml not found',
      evidence: [],
    };
  }
  const text = read(composePath);
  const configured = /--jetstream/.test(text) && /natsdata:\/data/.test(text);
  const verified = configured && checkFile(evidence);
  return {
    id: 'nats_jetstream_persistence',
    checklist: 'NATS JetStream persistence verified across restart',
    status: verified ? 'pass' : configured ? 'warn' : 'fail',
    detail: verified
      ? 'JetStream persistence config and restart verification evidence are present'
      : configured
      ? 'JetStream file store + persistent volume configured; restart verification run still required'
      : 'JetStream persistence configuration not detected',
    evidence: [composePath, evidence].filter(checkFile),
  };
}

function checkMigrationRollbackLast3() {
  const migrationsDir = 'services/gateway-api/src/db/migrations';
  const plan = 'docs/db/migration-rollback-plan.md';
  const evidenceDir = 'docs/release/evidence';
  if (!checkFile(plan) || !checkFile(migrationsDir)) {
    return {
      id: 'migration_rollback_last3',
      checklist: 'Migration rollback tested for latest 3 migrations',
      status: 'fail',
      detail: !checkFile(plan) ? 'Rollback plan file not found' : 'Migration directory not found',
      evidence: [],
    };
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
  const latest = migrationFiles.slice(-3).map((name) => name.replace(/\.sql$/i, ''));
  if (latest.length < 3) {
    return {
      id: 'migration_rollback_last3',
      checklist: 'Migration rollback tested for latest 3 migrations',
      status: 'fail',
      detail: `insufficient migration files (${latest.length}) to validate latest 3`,
      evidence: [plan],
    };
  }

  const text = read(plan);
  const planCoversLatest3 = latest.every((id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text));

  const evidenceCandidates = checkFile(evidenceDir)
    ? readdirSync(evidenceDir)
        .filter((name) => /^migration-rollback-test-.*\.md$/i.test(name))
        .sort((a, b) => a.localeCompare(b))
    : [];
  const latestEvidence = evidenceCandidates.length > 0 ? join(evidenceDir, evidenceCandidates[evidenceCandidates.length - 1]) : null;
  const evidenceMentionsLatest3 = latestEvidence
    ? latest.every((id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(read(latestEvidence)))
    : false;
  const verified = planCoversLatest3 && Boolean(latestEvidence) && evidenceMentionsLatest3;

  return {
    id: 'migration_rollback_last3',
    checklist: 'Migration rollback tested for latest 3 migrations',
    status: verified ? 'pass' : planCoversLatest3 ? 'warn' : 'fail',
    detail: verified
      ? `Rollback plan + evidence cover latest migration series: ${latest.join(', ')}`
      : planCoversLatest3
      ? `Rollback plan covers latest migration series (${latest.join(', ')}); evidence missing or stale`
      : `Rollback plan does not cover latest migration series: ${latest.join(', ')}`,
    evidence: [plan, latestEvidence].filter(Boolean),
  };
}

function toMarkdown(payload) {
  const lines = [];
  lines.push('# Data Integrity Check');
  lines.push('');
  lines.push(`Generated: ${payload.generated_at}`);
  lines.push(`Status: ${payload.status}`);
  lines.push('');
  lines.push('## Checks');
  for (const c of payload.checks) {
    lines.push(`- ${c.id}: ${c.status}`);
    lines.push(`  checklist: ${c.checklist}`);
    lines.push(`  detail: ${c.detail}`);
    if (Array.isArray(c.evidence) && c.evidence.length > 0) {
      lines.push(`  evidence: ${c.evidence.join(', ')}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const checks = [
    checkBackupEvidence(),
    checkWalArchivingConfigured(),
    checkNightlyBackupCronConfigured(),
    checkRestoreDrillDocumented(),
    checkNatsJetstreamPersistence(),
    checkMigrationRollbackLast3(),
  ];

  const failed = checks.filter((c) => c.status === 'fail').length;
  const warned = checks.filter((c) => c.status === 'warn').length;
  const passed = checks.filter((c) => c.status === 'pass').length;

  const payload = {
    generated_at: new Date().toISOString(),
    status: failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass',
    summary: {
      pass: passed,
      warn: warned,
      fail: failed,
      total: checks.length,
    },
    checks,
  };

  mkdirSync(dirname(OUTPUT_JSON), { recursive: true });
  mkdirSync(dirname(OUTPUT_MD), { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  writeFileSync(OUTPUT_MD, toMarkdown(payload), 'utf8');
  console.log(`data-integrity-check: ${payload.status} (pass=${passed} warn=${warned} fail=${failed})`);
  if (failed > 0) process.exit(1);
}

main();
