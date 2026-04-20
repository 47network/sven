import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Egress Gateway management verticals', () => {
  const verticals = [
    {
      name: 'egress_gateway', migration: '20260628000000_agent_egress_gateway.sql',
      typeFile: 'agent-egress-gateway.ts', skillDir: 'egress-gateway',
      interfaces: ['EgressGatewayRule', 'EgressGatewayConfig', 'EgressGatewayResult'],
      bk: 'egress_gateway', eks: ['eg.rule_created', 'eg.config_updated', 'eg.export_emitted'],
      subjects: ['sven.eg.rule_created', 'sven.eg.config_updated', 'sven.eg.export_emitted'],
      cases: ['eg_planner', 'eg_enforcer', 'eg_reporter'],
    },
    {
      name: 'egress_gateway_monitor', migration: '20260628010000_agent_egress_gateway_monitor.sql',
      typeFile: 'agent-egress-gateway-monitor.ts', skillDir: 'egress-gateway-monitor',
      interfaces: ['EgressGatewayMonitorCheck', 'EgressGatewayMonitorConfig', 'EgressGatewayMonitorResult'],
      bk: 'egress_gateway_monitor', eks: ['egm.check_passed', 'egm.alert_raised', 'egm.export_emitted'],
      subjects: ['sven.egm.check_passed', 'sven.egm.alert_raised', 'sven.egm.export_emitted'],
      cases: ['egm_watcher', 'egm_alerter', 'egm_reporter'],
    },
    {
      name: 'egress_gateway_auditor', migration: '20260628020000_agent_egress_gateway_auditor.sql',
      typeFile: 'agent-egress-gateway-auditor.ts', skillDir: 'egress-gateway-auditor',
      interfaces: ['EgressGatewayAuditEntry', 'EgressGatewayAuditConfig', 'EgressGatewayAuditResult'],
      bk: 'egress_gateway_auditor', eks: ['ega.entry_logged', 'ega.violation_found', 'ega.export_emitted'],
      subjects: ['sven.ega.entry_logged', 'sven.ega.violation_found', 'sven.ega.export_emitted'],
      cases: ['ega_scanner', 'ega_enforcer', 'ega_reporter'],
    },
    {
      name: 'egress_gateway_reporter', migration: '20260628030000_agent_egress_gateway_reporter.sql',
      typeFile: 'agent-egress-gateway-reporter.ts', skillDir: 'egress-gateway-reporter',
      interfaces: ['EgressGatewayReport', 'EgressGatewayReportConfig', 'EgressGatewayReportResult'],
      bk: 'egress_gateway_reporter', eks: ['egr.report_generated', 'egr.insight_found', 'egr.export_emitted'],
      subjects: ['sven.egr.report_generated', 'sven.egr.insight_found', 'sven.egr.export_emitted'],
      cases: ['egr_builder', 'egr_analyst', 'egr_reporter'],
    },
    {
      name: 'egress_gateway_optimizer', migration: '20260628040000_agent_egress_gateway_optimizer.sql',
      typeFile: 'agent-egress-gateway-optimizer.ts', skillDir: 'egress-gateway-optimizer',
      interfaces: ['EgressGatewayOptPlan', 'EgressGatewayOptConfig', 'EgressGatewayOptResult'],
      bk: 'egress_gateway_optimizer', eks: ['ego.plan_created', 'ego.optimization_applied', 'ego.export_emitted'],
      subjects: ['sven.ego.plan_created', 'sven.ego.optimization_applied', 'sven.ego.export_emitted'],
      cases: ['ego_planner', 'ego_executor', 'ego_reporter'],
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
