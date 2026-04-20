import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Access Control management verticals', () => {
  const verticals = [
    {
      name: 'access_control', migration: '20260628750000_agent_access_control.sql',
      typeFile: 'agent-access-control.ts', skillDir: 'access-control',
      interfaces: ['AccessControlRule', 'AccessControlConfig', 'AccessControlResult'],
      bk: 'access_control', eks: ['ac.rule_created', 'ac.config_updated', 'ac.export_emitted'],
      subjects: ['sven.ac.rule_created', 'sven.ac.config_updated', 'sven.ac.export_emitted'],
      cases: ['ac_planner', 'ac_enforcer', 'ac_reporter'],
    },
    {
      name: 'access_control_monitor', migration: '20260628760000_agent_access_control_monitor.sql',
      typeFile: 'agent-access-control-monitor.ts', skillDir: 'access-control-monitor',
      interfaces: ['AccessControlMonitorCheck', 'AccessControlMonitorConfig', 'AccessControlMonitorResult'],
      bk: 'access_control_monitor', eks: ['acm.check_passed', 'acm.alert_raised', 'acm.export_emitted'],
      subjects: ['sven.acm.check_passed', 'sven.acm.alert_raised', 'sven.acm.export_emitted'],
      cases: ['acm_watcher', 'acm_alerter', 'acm_reporter'],
    },
    {
      name: 'access_control_auditor', migration: '20260628770000_agent_access_control_auditor.sql',
      typeFile: 'agent-access-control-auditor.ts', skillDir: 'access-control-auditor',
      interfaces: ['AccessControlAuditEntry', 'AccessControlAuditConfig', 'AccessControlAuditResult'],
      bk: 'access_control_auditor', eks: ['aca.entry_logged', 'aca.violation_found', 'aca.export_emitted'],
      subjects: ['sven.aca.entry_logged', 'sven.aca.violation_found', 'sven.aca.export_emitted'],
      cases: ['aca_scanner', 'aca_enforcer', 'aca_reporter'],
    },
    {
      name: 'access_control_reporter', migration: '20260628780000_agent_access_control_reporter.sql',
      typeFile: 'agent-access-control-reporter.ts', skillDir: 'access-control-reporter',
      interfaces: ['AccessControlReport', 'AccessControlReportConfig', 'AccessControlReportResult'],
      bk: 'access_control_reporter', eks: ['acr.report_generated', 'acr.insight_found', 'acr.export_emitted'],
      subjects: ['sven.acr.report_generated', 'sven.acr.insight_found', 'sven.acr.export_emitted'],
      cases: ['acr_builder', 'acr_analyst', 'acr_reporter'],
    },
    {
      name: 'access_control_optimizer', migration: '20260628790000_agent_access_control_optimizer.sql',
      typeFile: 'agent-access-control-optimizer.ts', skillDir: 'access-control-optimizer',
      interfaces: ['AccessControlOptPlan', 'AccessControlOptConfig', 'AccessControlOptResult'],
      bk: 'access_control_optimizer', eks: ['aco.plan_created', 'aco.optimization_applied', 'aco.export_emitted'],
      subjects: ['sven.aco.plan_created', 'sven.aco.optimization_applied', 'sven.aco.export_emitted'],
      cases: ['aco_planner', 'aco_executor', 'aco_reporter'],
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
