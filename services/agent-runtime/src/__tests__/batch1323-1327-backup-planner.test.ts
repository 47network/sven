import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Backup Planner management verticals', () => {
  const verticals = [
    {
      name: 'backup_planner', migration: '20260629600000_agent_backup_planner.sql',
      typeFile: 'agent-backup-planner.ts', skillDir: 'backup-planner',
      interfaces: ['BackupPlannerEntry', 'BackupPlannerConfig', 'BackupPlannerResult'],
      bk: 'backup_planner', eks: ['bp.entry_created', 'bp.config_updated', 'bp.export_emitted'],
      subjects: ['sven.bp.entry_created', 'sven.bp.config_updated', 'sven.bp.export_emitted'],
      cases: ['bp_planner', 'bp_scheduler', 'bp_reporter'],
    },
    {
      name: 'backup_planner_monitor', migration: '20260629610000_agent_backup_planner_monitor.sql',
      typeFile: 'agent-backup-planner-monitor.ts', skillDir: 'backup-planner-monitor',
      interfaces: ['BackupPlannerMonitorCheck', 'BackupPlannerMonitorConfig', 'BackupPlannerMonitorResult'],
      bk: 'backup_planner_monitor', eks: ['bpm.check_passed', 'bpm.alert_raised', 'bpm.export_emitted'],
      subjects: ['sven.bpm.check_passed', 'sven.bpm.alert_raised', 'sven.bpm.export_emitted'],
      cases: ['bpm_watcher', 'bpm_alerter', 'bpm_reporter'],
    },
    {
      name: 'backup_planner_auditor', migration: '20260629620000_agent_backup_planner_auditor.sql',
      typeFile: 'agent-backup-planner-auditor.ts', skillDir: 'backup-planner-auditor',
      interfaces: ['BackupPlannerAuditEntry', 'BackupPlannerAuditConfig', 'BackupPlannerAuditResult'],
      bk: 'backup_planner_auditor', eks: ['bpa.entry_logged', 'bpa.violation_found', 'bpa.export_emitted'],
      subjects: ['sven.bpa.entry_logged', 'sven.bpa.violation_found', 'sven.bpa.export_emitted'],
      cases: ['bpa_scanner', 'bpa_enforcer', 'bpa_reporter'],
    },
    {
      name: 'backup_planner_reporter', migration: '20260629630000_agent_backup_planner_reporter.sql',
      typeFile: 'agent-backup-planner-reporter.ts', skillDir: 'backup-planner-reporter',
      interfaces: ['BackupPlannerReport', 'BackupPlannerReportConfig', 'BackupPlannerReportResult'],
      bk: 'backup_planner_reporter', eks: ['bpr.report_generated', 'bpr.insight_found', 'bpr.export_emitted'],
      subjects: ['sven.bpr.report_generated', 'sven.bpr.insight_found', 'sven.bpr.export_emitted'],
      cases: ['bpr_builder', 'bpr_analyst', 'bpr_reporter'],
    },
    {
      name: 'backup_planner_optimizer', migration: '20260629640000_agent_backup_planner_optimizer.sql',
      typeFile: 'agent-backup-planner-optimizer.ts', skillDir: 'backup-planner-optimizer',
      interfaces: ['BackupPlannerOptPlan', 'BackupPlannerOptConfig', 'BackupPlannerOptResult'],
      bk: 'backup_planner_optimizer', eks: ['bpo.plan_created', 'bpo.optimization_applied', 'bpo.export_emitted'],
      subjects: ['sven.bpo.plan_created', 'sven.bpo.optimization_applied', 'sven.bpo.export_emitted'],
      cases: ['bpo_planner', 'bpo_executor', 'bpo_reporter'],
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
