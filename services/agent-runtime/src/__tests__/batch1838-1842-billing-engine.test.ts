import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Billing Engine verticals', () => {
  const verticals = [
    {
      name: 'billing_engine', migration: '20260634750000_agent_billing_engine.sql',
      typeFile: 'agent-billing-engine.ts', skillDir: 'billing-engine',
      interfaces: ['BillingEngineEntry', 'BillingEngineConfig', 'BillingEngineResult'],
      bk: 'billing_engine', eks: ['be.entry_created', 'be.config_updated', 'be.export_emitted'],
      subjects: ['sven.be.entry_created', 'sven.be.config_updated', 'sven.be.export_emitted'],
      cases: ['be_calculator', 'be_processor', 'be_reporter'],
    },
    {
      name: 'billing_engine_monitor', migration: '20260634760000_agent_billing_engine_monitor.sql',
      typeFile: 'agent-billing-engine-monitor.ts', skillDir: 'billing-engine-monitor',
      interfaces: ['BillingEngineMonitorCheck', 'BillingEngineMonitorConfig', 'BillingEngineMonitorResult'],
      bk: 'billing_engine_monitor', eks: ['bem.check_passed', 'bem.alert_raised', 'bem.export_emitted'],
      subjects: ['sven.bem.check_passed', 'sven.bem.alert_raised', 'sven.bem.export_emitted'],
      cases: ['bem_watcher', 'bem_alerter', 'bem_reporter'],
    },
    {
      name: 'billing_engine_auditor', migration: '20260634770000_agent_billing_engine_auditor.sql',
      typeFile: 'agent-billing-engine-auditor.ts', skillDir: 'billing-engine-auditor',
      interfaces: ['BillingEngineAuditEntry', 'BillingEngineAuditConfig', 'BillingEngineAuditResult'],
      bk: 'billing_engine_auditor', eks: ['bea.entry_logged', 'bea.violation_found', 'bea.export_emitted'],
      subjects: ['sven.bea.entry_logged', 'sven.bea.violation_found', 'sven.bea.export_emitted'],
      cases: ['bea_scanner', 'bea_enforcer', 'bea_reporter'],
    },
    {
      name: 'billing_engine_reporter', migration: '20260634780000_agent_billing_engine_reporter.sql',
      typeFile: 'agent-billing-engine-reporter.ts', skillDir: 'billing-engine-reporter',
      interfaces: ['BillingEngineReport', 'BillingEngineReportConfig', 'BillingEngineReportResult'],
      bk: 'billing_engine_reporter', eks: ['ber.report_generated', 'ber.insight_found', 'ber.export_emitted'],
      subjects: ['sven.ber.report_generated', 'sven.ber.insight_found', 'sven.ber.export_emitted'],
      cases: ['ber_builder', 'ber_analyst', 'ber_reporter'],
    },
    {
      name: 'billing_engine_optimizer', migration: '20260634790000_agent_billing_engine_optimizer.sql',
      typeFile: 'agent-billing-engine-optimizer.ts', skillDir: 'billing-engine-optimizer',
      interfaces: ['BillingEngineOptPlan', 'BillingEngineOptConfig', 'BillingEngineOptResult'],
      bk: 'billing_engine_optimizer', eks: ['beo.plan_created', 'beo.optimization_applied', 'beo.export_emitted'],
      subjects: ['sven.beo.plan_created', 'sven.beo.optimization_applied', 'sven.beo.export_emitted'],
      cases: ['beo_planner', 'beo_executor', 'beo_reporter'],
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
