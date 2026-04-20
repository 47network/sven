import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Ingress Routing management verticals', () => {
  const verticals = [
    {
      name: 'ingress_routing', migration: '20260627950000_agent_ingress_routing.sql',
      typeFile: 'agent-ingress-routing.ts', skillDir: 'ingress-routing',
      interfaces: ['IngressRoutingRule', 'IngressRoutingConfig', 'IngressRoutingResult'],
      bk: 'ingress_routing', eks: ['ir.rule_created', 'ir.config_updated', 'ir.export_emitted'],
      subjects: ['sven.ir.rule_created', 'sven.ir.config_updated', 'sven.ir.export_emitted'],
      cases: ['ir_planner', 'ir_enforcer', 'ir_reporter'],
    },
    {
      name: 'ingress_routing_monitor', migration: '20260627960000_agent_ingress_routing_monitor.sql',
      typeFile: 'agent-ingress-routing-monitor.ts', skillDir: 'ingress-routing-monitor',
      interfaces: ['IngressRoutingMonitorCheck', 'IngressRoutingMonitorConfig', 'IngressRoutingMonitorResult'],
      bk: 'ingress_routing_monitor', eks: ['irm.check_passed', 'irm.alert_raised', 'irm.export_emitted'],
      subjects: ['sven.irm.check_passed', 'sven.irm.alert_raised', 'sven.irm.export_emitted'],
      cases: ['irm_watcher', 'irm_alerter', 'irm_reporter'],
    },
    {
      name: 'ingress_routing_auditor', migration: '20260627970000_agent_ingress_routing_auditor.sql',
      typeFile: 'agent-ingress-routing-auditor.ts', skillDir: 'ingress-routing-auditor',
      interfaces: ['IngressRoutingAuditEntry', 'IngressRoutingAuditConfig', 'IngressRoutingAuditResult'],
      bk: 'ingress_routing_auditor', eks: ['ira.entry_logged', 'ira.violation_found', 'ira.export_emitted'],
      subjects: ['sven.ira.entry_logged', 'sven.ira.violation_found', 'sven.ira.export_emitted'],
      cases: ['ira_scanner', 'ira_enforcer', 'ira_reporter'],
    },
    {
      name: 'ingress_routing_reporter', migration: '20260627980000_agent_ingress_routing_reporter.sql',
      typeFile: 'agent-ingress-routing-reporter.ts', skillDir: 'ingress-routing-reporter',
      interfaces: ['IngressRoutingReport', 'IngressRoutingReportConfig', 'IngressRoutingReportResult'],
      bk: 'ingress_routing_reporter', eks: ['irr.report_generated', 'irr.insight_found', 'irr.export_emitted'],
      subjects: ['sven.irr.report_generated', 'sven.irr.insight_found', 'sven.irr.export_emitted'],
      cases: ['irr_builder', 'irr_analyst', 'irr_reporter'],
    },
    {
      name: 'ingress_routing_optimizer', migration: '20260627990000_agent_ingress_routing_optimizer.sql',
      typeFile: 'agent-ingress-routing-optimizer.ts', skillDir: 'ingress-routing-optimizer',
      interfaces: ['IngressRoutingOptPlan', 'IngressRoutingOptConfig', 'IngressRoutingOptResult'],
      bk: 'ingress_routing_optimizer', eks: ['iro.plan_created', 'iro.optimization_applied', 'iro.export_emitted'],
      subjects: ['sven.iro.plan_created', 'sven.iro.optimization_applied', 'sven.iro.export_emitted'],
      cases: ['iro_planner', 'iro_executor', 'iro_reporter'],
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
