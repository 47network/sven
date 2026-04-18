/**
 * Batch 59 — Agent Backup & Recovery  tests
 *
 * 62 tests across 8 describe blocks covering:
 * migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus SUBJECT_MAP, task-executor handlers, barrel export,
 * .gitattributes privacy filtering.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ------------------------------------------------------------------ */
/*  1. Migration SQL                                                  */
/* ------------------------------------------------------------------ */
describe('Batch 59 — migration SQL', () => {
  const sql = read(
    'services/gateway-api/migrations/20260601120000_agent_backup_recovery.sql',
  );

  it('creates agent_backup_jobs table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_backup_jobs');
  });

  it('creates agent_recovery_points table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_recovery_points');
  });

  it('creates agent_retention_policies table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_retention_policies');
  });

  it('creates agent_disaster_recovery_plans table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_disaster_recovery_plans');
  });

  it('creates agent_restore_logs table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_restore_logs');
  });

  it('has 17 indexes', () => {
    const idxCount = (sql.match(/CREATE INDEX/g) || []).length;
    expect(idxCount).toBe(17);
  });

  it('enforces backup_type CHECK constraint', () => {
    expect(sql).toContain("'full','incremental','differential','snapshot','selective'");
  });

  it('enforces recovery_type CHECK constraint', () => {
    expect(sql).toContain("'full','partial','point_in_time','granular','cross_region'");
  });

  it('enforces dr priority CHECK constraint', () => {
    expect(sql).toContain("'low','medium','high','critical','emergency'");
  });

  it('has foreign key from recovery_points to backup_jobs', () => {
    expect(sql).toContain('REFERENCES agent_backup_jobs(id)');
  });
});

/* ------------------------------------------------------------------ */
/*  2. Shared types                                                   */
/* ------------------------------------------------------------------ */
describe('Batch 59 — shared types', () => {
  const src = read('packages/shared/src/agent-backup-recovery.ts');

  it('exports BackupType with 5 values', () => {
    const m = src.match(/export type BackupType\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports BackupStatus with 5 values', () => {
    const m = src.match(/export type BackupStatus\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports RecoveryType with 5 values', () => {
    const m = src.match(/export type RecoveryType\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports RecoveryPointStatus with 5 values', () => {
    const m = src.match(/export type RecoveryPointStatus\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports DrPriority with 5 values', () => {
    const m = src.match(/export type DrPriority\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports RestoreType with 5 values', () => {
    const m = src.match(/export type RestoreType\s*=\s*([^;]+);/);
    expect(m).not.toBeNull();
    const count = (m![1].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });

  it('exports BackupRecoveryAction with 7 values', () => {
    const m = src.match(/export type BackupRecoveryAction[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(7);
  });

  it('exports 5 interfaces', () => {
    const count = (src.match(/export interface /g) || []).length;
    expect(count).toBe(5);
  });

  it('exports 6 constants', () => {
    const count = (src.match(/export const /g) || []).length;
    expect(count).toBe(6);
  });

  it('exports isBackupComplete helper', () => {
    expect(src).toContain('export function isBackupComplete');
  });

  it('exports isRecoveryPointUsable helper', () => {
    expect(src).toContain('export function isRecoveryPointUsable');
  });

  it('exports isDrPlanCritical helper', () => {
    expect(src).toContain('export function isDrPlanCritical');
  });

  it('exports formatBackupSize helper', () => {
    expect(src).toContain('export function formatBackupSize');
  });
});

/* ------------------------------------------------------------------ */
/*  3. Barrel export                                                  */
/* ------------------------------------------------------------------ */
describe('Batch 59 — barrel export', () => {
  const idx = read('packages/shared/src/index.ts');

  it('exports agent-backup-recovery module', () => {
    expect(idx).toContain("./agent-backup-recovery");
  });

  it('has at least 84 lines', () => {
    expect(idx.split('\n').length).toBeGreaterThanOrEqual(84);
  });
});

/* ------------------------------------------------------------------ */
/*  4. SKILL.md                                                       */
/* ------------------------------------------------------------------ */
describe('Batch 59 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/agent-backup-recovery/SKILL.md');

  it('has correct skill identifier', () => {
    expect(skill).toMatch(/skill:\s*agent-backup-recovery/);
  });

  it('defines backup_create action', () => {
    expect(skill).toContain('backup_create');
  });

  it('defines backup_restore action', () => {
    expect(skill).toContain('backup_restore');
  });

  it('defines recovery_point_create action', () => {
    expect(skill).toContain('recovery_point_create');
  });

  it('defines retention_set action', () => {
    expect(skill).toContain('retention_set');
  });

  it('defines dr_plan_create action', () => {
    expect(skill).toContain('dr_plan_create');
  });

  it('defines dr_test action', () => {
    expect(skill).toContain('dr_test');
  });

  it('defines restore_log_query action', () => {
    expect(skill).toContain('restore_log_query');
  });
});

/* ------------------------------------------------------------------ */
/*  5. Eidolon types.ts wiring                                        */
/* ------------------------------------------------------------------ */
describe('Batch 59 — Eidolon types', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('adds vault_bunker to EidolonBuildingKind', () => {
    expect(types).toContain("'vault_bunker'");
  });

  it('has 42 building kinds', () => {
    const block = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
    expect(block).not.toBeNull();
    const pipeCount = (block![0].match(/\|/g) || []).length;
    expect(pipeCount).toBe(42);
  });

  it('has 184 event kinds', () => {
    const block = types.match(/export type EidolonEventKind[\s\S]*?;/);
    expect(block).not.toBeNull();
    const pipeCount = (block![0].match(/\|/g) || []).length;
    expect(pipeCount).toBe(184);
  });

  it('adds backup.job_created event kind', () => {
    expect(types).toContain("'backup.job_created'");
  });

  it('adds backup.restore_completed event kind', () => {
    expect(types).toContain("'backup.restore_completed'");
  });

  it('adds backup.dr_plan_tested event kind', () => {
    expect(types).toContain("'backup.dr_plan_tested'");
  });

  it('adds backup.retention_applied event kind', () => {
    expect(types).toContain("'backup.retention_applied'");
  });

  it('maps vault_bunker to industrial district', () => {
    expect(types).toContain("case 'vault_bunker'");
    expect(types).toContain("return 'industrial'");
  });

  it('has 42 districtFor cases', () => {
    const fn = types.match(/districtFor[\s\S]*?^}/m);
    expect(fn).not.toBeNull();
    const caseCount = (fn![0].match(/case '/g) || []).length;
    expect(caseCount).toBe(42);
  });
});

/* ------------------------------------------------------------------ */
/*  6. Event-bus SUBJECT_MAP                                          */
/* ------------------------------------------------------------------ */
describe('Batch 59 — event-bus SUBJECT_MAP', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.backup.job_created', () => {
    expect(bus).toContain("'sven.backup.job_created': 'backup.job_created'");
  });

  it('maps sven.backup.restore_completed', () => {
    expect(bus).toContain("'sven.backup.restore_completed': 'backup.restore_completed'");
  });

  it('maps sven.backup.dr_plan_tested', () => {
    expect(bus).toContain("'sven.backup.dr_plan_tested': 'backup.dr_plan_tested'");
  });

  it('maps sven.backup.retention_applied', () => {
    expect(bus).toContain("'sven.backup.retention_applied': 'backup.retention_applied'");
  });

  it('has 183 total SUBJECT_MAP entries', () => {
    const block = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
    expect(block).not.toBeNull();
    const entryCount = (block![1].match(/^\s+'/gm) || []).length;
    expect(entryCount).toBe(183);
  });
});

/* ------------------------------------------------------------------ */
/*  7. Task-executor handlers                                         */
/* ------------------------------------------------------------------ */
describe('Batch 59 — task-executor', () => {
  const te = read('services/sven-marketplace/src/task-executor.ts');

  it('has case for backup_create', () => {
    expect(te).toContain("case 'backup_create'");
  });

  it('has case for backup_restore', () => {
    expect(te).toContain("case 'backup_restore'");
  });

  it('has case for recovery_point_create', () => {
    expect(te).toContain("case 'recovery_point_create'");
  });

  it('has case for retention_set', () => {
    expect(te).toContain("case 'retention_set'");
  });

  it('has case for dr_plan_create', () => {
    expect(te).toContain("case 'dr_plan_create'");
  });

  it('has case for dr_test', () => {
    expect(te).toContain("case 'dr_test'");
  });

  it('has case for restore_log_query', () => {
    expect(te).toContain("case 'restore_log_query'");
  });

  it('has 194 total switch cases', () => {
    const count = (te.match(/case '/g) || []).length;
    expect(count).toBe(194);
  });

  it('has handleBackupCreate handler', () => {
    expect(te).toMatch(/private (?:async )?handleBackupCreate/);
  });

  it('has handleBackupRestore handler', () => {
    expect(te).toMatch(/private (?:async )?handleBackupRestore/);
  });

  it('has handleRecoveryPointCreate handler', () => {
    expect(te).toMatch(/private (?:async )?handleRecoveryPointCreate/);
  });

  it('has handleRetentionSet handler', () => {
    expect(te).toMatch(/private (?:async )?handleRetentionSet/);
  });

  it('has handleDrPlanCreate handler', () => {
    expect(te).toMatch(/private (?:async )?handleDrPlanCreate/);
  });

  it('has handleDrTest handler', () => {
    expect(te).toMatch(/private (?:async )?handleDrTest/);
  });

  it('has handleRestoreLogQuery handler', () => {
    expect(te).toMatch(/private (?:async )?handleRestoreLogQuery/);
  });

  it('has 190 total handler methods', () => {
    const count = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
    expect(count).toBe(190);
  });
});

/* ------------------------------------------------------------------ */
/*  8. .gitattributes privacy                                         */
/* ------------------------------------------------------------------ */
describe('Batch 59 — .gitattributes', () => {
  const ga = read('.gitattributes');

  it('marks migration as export-ignore', () => {
    expect(ga).toContain('20260601120000_agent_backup_recovery.sql export-ignore');
  });

  it('marks shared types as export-ignore', () => {
    expect(ga).toContain('agent-backup-recovery.ts export-ignore');
  });

  it('marks skill directory as export-ignore', () => {
    expect(ga).toContain('agent-backup-recovery/** export-ignore');
  });
});
