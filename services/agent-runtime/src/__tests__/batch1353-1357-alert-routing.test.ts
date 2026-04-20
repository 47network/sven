import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Alert Routing verticals', () => {
  const verticals = [
    {
      name: 'alert_routing', migration: '20260629900000_agent_alert_routing.sql',
      typeFile: 'agent-alert-routing.ts', skillDir: 'alert-routing',
      interfaces: ['AlertRoutingRule', 'AlertRoutingConfig', 'AlertRoutingResult'],
      bk: 'alert_routing', eks: ['ar.rule_created', 'ar.config_updated', 'ar.export_emitted'],
      subjects: ['sven.ar.rule_created', 'sven.ar.config_updated', 'sven.ar.export_emitted'],
      cases: ['ar_planner', 'ar_dispatcher', 'ar_reporter'],
    },
    {
      name: 'alert_routing_monitor', migration: '20260629910000_agent_alert_routing_monitor.sql',
      typeFile: 'agent-alert-routing-monitor.ts', skillDir: 'alert-routing-monitor',
      interfaces: ['AlertRoutingMonitorCheck', 'AlertRoutingMonitorConfig', 'AlertRoutingMonitorResult'],
      bk: 'alert_routing_monitor', eks: ['arm.check_passed', 'arm.alert_raised', 'arm.export_emitted'],
      subjects: ['sven.arm.check_passed', 'sven.arm.alert_raised', 'sven.arm.export_emitted'],
      cases: ['arm_watcher', 'arm_alerter', 'arm_reporter'],
    },
    {
      name: 'alert_routing_auditor', migration: '20260629920000_agent_alert_routing_auditor.sql',
      typeFile: 'agent-alert-routing-auditor.ts', skillDir: 'alert-routing-auditor',
      interfaces: ['AlertRoutingAuditEntry', 'AlertRoutingAuditConfig', 'AlertRoutingAuditResult'],
      bk: 'alert_routing_auditor', eks: ['ara.entry_logged', 'ara.violation_found', 'ara.export_emitted'],
      subjects: ['sven.ara.entry_logged', 'sven.ara.violation_found', 'sven.ara.export_emitted'],
      cases: ['ara_scanner', 'ara_enforcer', 'ara_reporter'],
    },
    {
      name: 'alert_routing_reporter', migration: '20260629930000_agent_alert_routing_reporter.sql',
      typeFile: 'agent-alert-routing-reporter.ts', skillDir: 'alert-routing-reporter',
      interfaces: ['AlertRoutingReport', 'AlertRoutingReportConfig', 'AlertRoutingReportResult'],
      bk: 'alert_routing_reporter', eks: ['arr.report_generated', 'arr.insight_found', 'arr.export_emitted'],
      subjects: ['sven.arr.report_generated', 'sven.arr.insight_found', 'sven.arr.export_emitted'],
      cases: ['arr_builder', 'arr_analyst', 'arr_reporter'],
    },
    {
      name: 'alert_routing_optimizer', migration: '20260629940000_agent_alert_routing_optimizer.sql',
      typeFile: 'agent-alert-routing-optimizer.ts', skillDir: 'alert-routing-optimizer',
      interfaces: ['AlertRoutingOptPlan', 'AlertRoutingOptConfig', 'AlertRoutingOptResult'],
      bk: 'alert_routing_optimizer', eks: ['aro.plan_created', 'aro.optimization_applied', 'aro.export_emitted'],
      subjects: ['sven.aro.plan_created', 'sven.aro.optimization_applied', 'sven.aro.export_emitted'],
      cases: ['aro_planner', 'aro_executor', 'aro_reporter'],
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
