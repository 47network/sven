import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 938-942: Database Data Management', () => {
  const verticals = [
    {
      name: 'db_schema_migrator', migration: '20260625750000_agent_db_schema_migrator.sql',
      typeFile: 'agent-db-schema-migrator.ts', skillDir: 'db-schema-migrator',
      interfaces: ['DbSchemaMigratorConfig', 'MigrationPlan', 'MigratorEvent'],
      bk: 'db_schema_migrator', eks: ['dsmg.plan_received', 'dsmg.preflight_validated', 'dsmg.migration_applied', 'dsmg.audit_recorded'],
      subjects: ['sven.dsmg.plan_received', 'sven.dsmg.preflight_validated', 'sven.dsmg.migration_applied', 'sven.dsmg.audit_recorded'],
      cases: ['dsmg_receive', 'dsmg_validate', 'dsmg_apply', 'dsmg_audit', 'dsmg_report', 'dsmg_monitor'],
    },
    {
      name: 'db_data_redactor', migration: '20260625760000_agent_db_data_redactor.sql',
      typeFile: 'agent-db-data-redactor.ts', skillDir: 'db-data-redactor',
      interfaces: ['DbDataRedactorConfig', 'RedactionJob', 'RedactorEvent'],
      bk: 'db_data_redactor', eks: ['dddr.job_received', 'dddr.policy_loaded', 'dddr.records_redacted', 'dddr.audit_recorded'],
      subjects: ['sven.dddr.job_received', 'sven.dddr.policy_loaded', 'sven.dddr.records_redacted', 'sven.dddr.audit_recorded'],
      cases: ['dddr_receive', 'dddr_load', 'dddr_redact', 'dddr_audit', 'dddr_report', 'dddr_monitor'],
    },
    {
      name: 'db_backup_orchestrator', migration: '20260625770000_agent_db_backup_orchestrator.sql',
      typeFile: 'agent-db-backup-orchestrator.ts', skillDir: 'db-backup-orchestrator',
      interfaces: ['DbBackupOrchestratorConfig', 'BackupJob', 'OrchestratorEvent'],
      bk: 'db_backup_orchestrator', eks: ['dbbo.job_received', 'dbbo.snapshot_taken', 'dbbo.backup_persisted', 'dbbo.checksum_recorded'],
      subjects: ['sven.dbbo.job_received', 'sven.dbbo.snapshot_taken', 'sven.dbbo.backup_persisted', 'sven.dbbo.checksum_recorded'],
      cases: ['dbbo_receive', 'dbbo_snapshot', 'dbbo_persist', 'dbbo_record', 'dbbo_report', 'dbbo_monitor'],
    },
    {
      name: 'db_restore_validator', migration: '20260625780000_agent_db_restore_validator.sql',
      typeFile: 'agent-db-restore-validator.ts', skillDir: 'db-restore-validator',
      interfaces: ['DbRestoreValidatorConfig', 'RestoreCheck', 'ValidatorEvent'],
      bk: 'db_restore_validator', eks: ['dbrv.check_scheduled', 'dbrv.restore_executed', 'dbrv.integrity_verified', 'dbrv.report_emitted'],
      subjects: ['sven.dbrv.check_scheduled', 'sven.dbrv.restore_executed', 'sven.dbrv.integrity_verified', 'sven.dbrv.report_emitted'],
      cases: ['dbrv_schedule', 'dbrv_execute', 'dbrv_verify', 'dbrv_emit', 'dbrv_report', 'dbrv_monitor'],
    },
    {
      name: 'db_archive_tierer', migration: '20260625790000_agent_db_archive_tierer.sql',
      typeFile: 'agent-db-archive-tierer.ts', skillDir: 'db-archive-tierer',
      interfaces: ['DbArchiveTiererConfig', 'ArchivePolicy', 'TiererEvent'],
      bk: 'db_archive_tierer', eks: ['dbat.policy_received', 'dbat.candidates_selected', 'dbat.records_tiered', 'dbat.audit_recorded'],
      subjects: ['sven.dbat.policy_received', 'sven.dbat.candidates_selected', 'sven.dbat.records_tiered', 'sven.dbat.audit_recorded'],
      cases: ['dbat_receive', 'dbat_select', 'dbat_tier', 'dbat_audit', 'dbat_report', 'dbat_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
