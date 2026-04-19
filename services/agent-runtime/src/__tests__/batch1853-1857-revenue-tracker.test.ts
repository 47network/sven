import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Revenue Tracker verticals', () => {
  const verticals = [
    {
      name: 'revenue_tracker', migration: '20260634900000_agent_revenue_tracker.sql',
      typeFile: 'agent-revenue-tracker.ts', skillDir: 'revenue-tracker',
      interfaces: ['RevenueTrackerEntry', 'RevenueTrackerConfig', 'RevenueTrackerResult'],
      bk: 'revenue_tracker', eks: ['rt.entry_created', 'rt.config_updated', 'rt.export_emitted'],
      subjects: ['sven.rt.entry_created', 'sven.rt.config_updated', 'sven.rt.export_emitted'],
      cases: ['rt_collector', 'rt_analyzer', 'rt_reporter'],
    },
    {
      name: 'revenue_tracker_monitor', migration: '20260634910000_agent_revenue_tracker_monitor.sql',
      typeFile: 'agent-revenue-tracker-monitor.ts', skillDir: 'revenue-tracker-monitor',
      interfaces: ['RevenueTrackerMonitorCheck', 'RevenueTrackerMonitorConfig', 'RevenueTrackerMonitorResult'],
      bk: 'revenue_tracker_monitor', eks: ['rtm.check_passed', 'rtm.alert_raised', 'rtm.export_emitted'],
      subjects: ['sven.rtm.check_passed', 'sven.rtm.alert_raised', 'sven.rtm.export_emitted'],
      cases: ['rtm_watcher', 'rtm_alerter', 'rtm_reporter'],
    },
    {
      name: 'revenue_tracker_auditor', migration: '20260634920000_agent_revenue_tracker_auditor.sql',
      typeFile: 'agent-revenue-tracker-auditor.ts', skillDir: 'revenue-tracker-auditor',
      interfaces: ['RevenueTrackerAuditEntry', 'RevenueTrackerAuditConfig', 'RevenueTrackerAuditResult'],
      bk: 'revenue_tracker_auditor', eks: ['rta.entry_logged', 'rta.violation_found', 'rta.export_emitted'],
      subjects: ['sven.rta.entry_logged', 'sven.rta.violation_found', 'sven.rta.export_emitted'],
      cases: ['rta_scanner', 'rta_enforcer', 'rta_reporter'],
    },
    {
      name: 'revenue_tracker_reporter', migration: '20260634930000_agent_revenue_tracker_reporter.sql',
      typeFile: 'agent-revenue-tracker-reporter.ts', skillDir: 'revenue-tracker-reporter',
      interfaces: ['RevenueTrackerReport', 'RevenueTrackerReportConfig', 'RevenueTrackerReportResult'],
      bk: 'revenue_tracker_reporter', eks: ['rtr.report_generated', 'rtr.insight_found', 'rtr.export_emitted'],
      subjects: ['sven.rtr.report_generated', 'sven.rtr.insight_found', 'sven.rtr.export_emitted'],
      cases: ['rtr_builder', 'rtr_analyst', 'rtr_reporter'],
    },
    {
      name: 'revenue_tracker_optimizer', migration: '20260634940000_agent_revenue_tracker_optimizer.sql',
      typeFile: 'agent-revenue-tracker-optimizer.ts', skillDir: 'revenue-tracker-optimizer',
      interfaces: ['RevenueTrackerOptPlan', 'RevenueTrackerOptConfig', 'RevenueTrackerOptResult'],
      bk: 'revenue_tracker_optimizer', eks: ['rto.plan_created', 'rto.optimization_applied', 'rto.export_emitted'],
      subjects: ['sven.rto.plan_created', 'sven.rto.optimization_applied', 'sven.rto.export_emitted'],
      cases: ['rto_planner', 'rto_executor', 'rto_reporter'],
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
