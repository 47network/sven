import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Change Management verticals', () => {
  const verticals = [
    {
      name: 'change_management', migration: '20260630200000_agent_change_management.sql',
      typeFile: 'agent-change-management.ts', skillDir: 'change-management',
      interfaces: ['ChangeManagementEntry', 'ChangeManagementConfig', 'ChangeManagementResult'],
      bk: 'change_management', eks: ['cm.entry_created', 'cm.config_updated', 'cm.export_emitted'],
      subjects: ['sven.cm.entry_created', 'sven.cm.config_updated', 'sven.cm.export_emitted'],
      cases: ['cm_planner', 'cm_approver', 'cm_reporter'],
    },
    {
      name: 'change_management_monitor', migration: '20260630210000_agent_change_management_monitor.sql',
      typeFile: 'agent-change-management-monitor.ts', skillDir: 'change-management-monitor',
      interfaces: ['ChangeManagementMonitorCheck', 'ChangeManagementMonitorConfig', 'ChangeManagementMonitorResult'],
      bk: 'change_management_monitor', eks: ['cmm.check_passed', 'cmm.alert_raised', 'cmm.export_emitted'],
      subjects: ['sven.cmm.check_passed', 'sven.cmm.alert_raised', 'sven.cmm.export_emitted'],
      cases: ['cmm_watcher', 'cmm_alerter', 'cmm_reporter'],
    },
    {
      name: 'change_management_auditor', migration: '20260630220000_agent_change_management_auditor.sql',
      typeFile: 'agent-change-management-auditor.ts', skillDir: 'change-management-auditor',
      interfaces: ['ChangeManagementAuditEntry', 'ChangeManagementAuditConfig', 'ChangeManagementAuditResult'],
      bk: 'change_management_auditor', eks: ['cma.entry_logged', 'cma.violation_found', 'cma.export_emitted'],
      subjects: ['sven.cma.entry_logged', 'sven.cma.violation_found', 'sven.cma.export_emitted'],
      cases: ['cma_scanner', 'cma_enforcer', 'cma_reporter'],
    },
    {
      name: 'change_management_reporter', migration: '20260630230000_agent_change_management_reporter.sql',
      typeFile: 'agent-change-management-reporter.ts', skillDir: 'change-management-reporter',
      interfaces: ['ChangeManagementReport', 'ChangeManagementReportConfig', 'ChangeManagementReportResult'],
      bk: 'change_management_reporter', eks: ['cmr.report_generated', 'cmr.insight_found', 'cmr.export_emitted'],
      subjects: ['sven.cmr.report_generated', 'sven.cmr.insight_found', 'sven.cmr.export_emitted'],
      cases: ['cmr_builder', 'cmr_analyst', 'cmr_reporter'],
    },
    {
      name: 'change_management_optimizer', migration: '20260630240000_agent_change_management_optimizer.sql',
      typeFile: 'agent-change-management-optimizer.ts', skillDir: 'change-management-optimizer',
      interfaces: ['ChangeManagementOptPlan', 'ChangeManagementOptConfig', 'ChangeManagementOptResult'],
      bk: 'change_management_optimizer', eks: ['cmo.plan_created', 'cmo.optimization_applied', 'cmo.export_emitted'],
      subjects: ['sven.cmo.plan_created', 'sven.cmo.optimization_applied', 'sven.cmo.export_emitted'],
      cases: ['cmo_planner', 'cmo_executor', 'cmo_reporter'],
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
