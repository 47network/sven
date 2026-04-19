import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Quota Management verticals', () => {
  const verticals = [
    {
      name: 'quota_management', migration: '20260629450000_agent_quota_management.sql',
      typeFile: 'agent-quota-management.ts', skillDir: 'quota-management',
      interfaces: ['QuotaManagementEntry', 'QuotaManagementConfig', 'QuotaManagementResult'],
      bk: 'quota_management', eks: ['qm.entry_created', 'qm.config_updated', 'qm.export_emitted'],
      subjects: ['sven.qm.entry_created', 'sven.qm.config_updated', 'sven.qm.export_emitted'],
      cases: ['qm_planner', 'qm_enforcer', 'qm_reporter'],
    },
    {
      name: 'quota_management_monitor', migration: '20260629460000_agent_quota_management_monitor.sql',
      typeFile: 'agent-quota-management-monitor.ts', skillDir: 'quota-management-monitor',
      interfaces: ['QuotaManagementMonitorCheck', 'QuotaManagementMonitorConfig', 'QuotaManagementMonitorResult'],
      bk: 'quota_management_monitor', eks: ['qmm.check_passed', 'qmm.alert_raised', 'qmm.export_emitted'],
      subjects: ['sven.qmm.check_passed', 'sven.qmm.alert_raised', 'sven.qmm.export_emitted'],
      cases: ['qmm_watcher', 'qmm_alerter', 'qmm_reporter'],
    },
    {
      name: 'quota_management_auditor', migration: '20260629470000_agent_quota_management_auditor.sql',
      typeFile: 'agent-quota-management-auditor.ts', skillDir: 'quota-management-auditor',
      interfaces: ['QuotaManagementAuditEntry', 'QuotaManagementAuditConfig', 'QuotaManagementAuditResult'],
      bk: 'quota_management_auditor', eks: ['qma.entry_logged', 'qma.violation_found', 'qma.export_emitted'],
      subjects: ['sven.qma.entry_logged', 'sven.qma.violation_found', 'sven.qma.export_emitted'],
      cases: ['qma_scanner', 'qma_enforcer', 'qma_reporter'],
    },
    {
      name: 'quota_management_reporter', migration: '20260629480000_agent_quota_management_reporter.sql',
      typeFile: 'agent-quota-management-reporter.ts', skillDir: 'quota-management-reporter',
      interfaces: ['QuotaManagementReport', 'QuotaManagementReportConfig', 'QuotaManagementReportResult'],
      bk: 'quota_management_reporter', eks: ['qmr.report_generated', 'qmr.insight_found', 'qmr.export_emitted'],
      subjects: ['sven.qmr.report_generated', 'sven.qmr.insight_found', 'sven.qmr.export_emitted'],
      cases: ['qmr_builder', 'qmr_analyst', 'qmr_reporter'],
    },
    {
      name: 'quota_management_optimizer', migration: '20260629490000_agent_quota_management_optimizer.sql',
      typeFile: 'agent-quota-management-optimizer.ts', skillDir: 'quota-management-optimizer',
      interfaces: ['QuotaManagementOptPlan', 'QuotaManagementOptConfig', 'QuotaManagementOptResult'],
      bk: 'quota_management_optimizer', eks: ['qmo.plan_created', 'qmo.optimization_applied', 'qmo.export_emitted'],
      subjects: ['sven.qmo.plan_created', 'sven.qmo.optimization_applied', 'sven.qmo.export_emitted'],
      cases: ['qmo_planner', 'qmo_executor', 'qmo_reporter'],
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
