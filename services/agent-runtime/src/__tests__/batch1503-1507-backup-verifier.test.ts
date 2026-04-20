import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Backup Verifier verticals', () => {
  const verticals = [
    {
      name: 'backup_verifier', migration: '20260631400000_agent_backup_verifier.sql',
      typeFile: 'agent-backup-verifier.ts', skillDir: 'backup-verifier',
      interfaces: ['BackupVerifierEntry', 'BackupVerifierConfig', 'BackupVerifierResult'],
      bk: 'backup_verifier', eks: ['bv.entry_created', 'bv.config_updated', 'bv.export_emitted'],
      subjects: ['sven.bv.entry_created', 'sven.bv.config_updated', 'sven.bv.export_emitted'],
      cases: ['bv_checker', 'bv_restorer', 'bv_reporter'],
    },
    {
      name: 'backup_verifier_monitor', migration: '20260631410000_agent_backup_verifier_monitor.sql',
      typeFile: 'agent-backup-verifier-monitor.ts', skillDir: 'backup-verifier-monitor',
      interfaces: ['BackupVerifierMonitorCheck', 'BackupVerifierMonitorConfig', 'BackupVerifierMonitorResult'],
      bk: 'backup_verifier_monitor', eks: ['bvm.check_passed', 'bvm.alert_raised', 'bvm.export_emitted'],
      subjects: ['sven.bvm.check_passed', 'sven.bvm.alert_raised', 'sven.bvm.export_emitted'],
      cases: ['bvm_watcher', 'bvm_alerter', 'bvm_reporter'],
    },
    {
      name: 'backup_verifier_auditor', migration: '20260631420000_agent_backup_verifier_auditor.sql',
      typeFile: 'agent-backup-verifier-auditor.ts', skillDir: 'backup-verifier-auditor',
      interfaces: ['BackupVerifierAuditEntry', 'BackupVerifierAuditConfig', 'BackupVerifierAuditResult'],
      bk: 'backup_verifier_auditor', eks: ['bva.entry_logged', 'bva.violation_found', 'bva.export_emitted'],
      subjects: ['sven.bva.entry_logged', 'sven.bva.violation_found', 'sven.bva.export_emitted'],
      cases: ['bva_scanner', 'bva_enforcer', 'bva_reporter'],
    },
    {
      name: 'backup_verifier_reporter', migration: '20260631430000_agent_backup_verifier_reporter.sql',
      typeFile: 'agent-backup-verifier-reporter.ts', skillDir: 'backup-verifier-reporter',
      interfaces: ['BackupVerifierReport', 'BackupVerifierReportConfig', 'BackupVerifierReportResult'],
      bk: 'backup_verifier_reporter', eks: ['bvr.report_generated', 'bvr.insight_found', 'bvr.export_emitted'],
      subjects: ['sven.bvr.report_generated', 'sven.bvr.insight_found', 'sven.bvr.export_emitted'],
      cases: ['bvr_builder', 'bvr_analyst', 'bvr_reporter'],
    },
    {
      name: 'backup_verifier_optimizer', migration: '20260631440000_agent_backup_verifier_optimizer.sql',
      typeFile: 'agent-backup-verifier-optimizer.ts', skillDir: 'backup-verifier-optimizer',
      interfaces: ['BackupVerifierOptPlan', 'BackupVerifierOptConfig', 'BackupVerifierOptResult'],
      bk: 'backup_verifier_optimizer', eks: ['bvo.plan_created', 'bvo.optimization_applied', 'bvo.export_emitted'],
      subjects: ['sven.bvo.plan_created', 'sven.bvo.optimization_applied', 'sven.bvo.export_emitted'],
      cases: ['bvo_planner', 'bvo_executor', 'bvo_reporter'],
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
