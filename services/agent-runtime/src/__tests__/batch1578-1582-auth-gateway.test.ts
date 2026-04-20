import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Auth Gateway verticals', () => {
  const verticals = [
    {
      name: 'auth_gateway', migration: '20260632150000_agent_auth_gateway.sql',
      typeFile: 'agent-auth-gateway.ts', skillDir: 'auth-gateway',
      interfaces: ['AuthGatewayEntry', 'AuthGatewayConfig', 'AuthGatewayResult'],
      bk: 'auth_gateway', eks: ['ag.entry_created', 'ag.config_updated', 'ag.export_emitted'],
      subjects: ['sven.ag.entry_created', 'sven.ag.config_updated', 'sven.ag.export_emitted'],
      cases: ['ag_router', 'ag_validator', 'ag_reporter'],
    },
    {
      name: 'auth_gateway_monitor', migration: '20260632160000_agent_auth_gateway_monitor.sql',
      typeFile: 'agent-auth-gateway-monitor.ts', skillDir: 'auth-gateway-monitor',
      interfaces: ['AuthGatewayMonitorCheck', 'AuthGatewayMonitorConfig', 'AuthGatewayMonitorResult'],
      bk: 'auth_gateway_monitor', eks: ['agm.check_passed', 'agm.alert_raised', 'agm.export_emitted'],
      subjects: ['sven.agm.check_passed', 'sven.agm.alert_raised', 'sven.agm.export_emitted'],
      cases: ['agm_watcher', 'agm_alerter', 'agm_reporter'],
    },
    {
      name: 'auth_gateway_auditor', migration: '20260632170000_agent_auth_gateway_auditor.sql',
      typeFile: 'agent-auth-gateway-auditor.ts', skillDir: 'auth-gateway-auditor',
      interfaces: ['AuthGatewayAuditEntry', 'AuthGatewayAuditConfig', 'AuthGatewayAuditResult'],
      bk: 'auth_gateway_auditor', eks: ['aga.entry_logged', 'aga.violation_found', 'aga.export_emitted'],
      subjects: ['sven.aga.entry_logged', 'sven.aga.violation_found', 'sven.aga.export_emitted'],
      cases: ['aga_scanner', 'aga_enforcer', 'aga_reporter'],
    },
    {
      name: 'auth_gateway_reporter', migration: '20260632180000_agent_auth_gateway_reporter.sql',
      typeFile: 'agent-auth-gateway-reporter.ts', skillDir: 'auth-gateway-reporter',
      interfaces: ['AuthGatewayReport', 'AuthGatewayReportConfig', 'AuthGatewayReportResult'],
      bk: 'auth_gateway_reporter', eks: ['agr.report_generated', 'agr.insight_found', 'agr.export_emitted'],
      subjects: ['sven.agr.report_generated', 'sven.agr.insight_found', 'sven.agr.export_emitted'],
      cases: ['agr_builder', 'agr_analyst', 'agr_reporter'],
    },
    {
      name: 'auth_gateway_optimizer', migration: '20260632190000_agent_auth_gateway_optimizer.sql',
      typeFile: 'agent-auth-gateway-optimizer.ts', skillDir: 'auth-gateway-optimizer',
      interfaces: ['AuthGatewayOptPlan', 'AuthGatewayOptConfig', 'AuthGatewayOptResult'],
      bk: 'auth_gateway_optimizer', eks: ['ago.plan_created', 'ago.optimization_applied', 'ago.export_emitted'],
      subjects: ['sven.ago.plan_created', 'sven.ago.optimization_applied', 'sven.ago.export_emitted'],
      cases: ['ago_planner', 'ago_executor', 'ago_reporter'],
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
