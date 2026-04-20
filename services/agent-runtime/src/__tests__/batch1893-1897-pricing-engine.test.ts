import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Pricing Engine verticals', () => {
  const verticals = [
    {
      name: 'pricing_engine', migration: '20260635300000_agent_pricing_engine.sql',
      typeFile: 'agent-pricing-engine.ts', skillDir: 'pricing-engine',
      interfaces: ['PricingEngineEntry', 'PricingEngineConfig', 'PricingEngineResult'],
      bk: 'pricing_engine', eks: ['pe.entry_created', 'pe.config_updated', 'pe.export_emitted'],
      subjects: ['sven.pe.entry_created', 'sven.pe.config_updated', 'sven.pe.export_emitted'],
      cases: ['pe_calculator', 'pe_optimizer', 'pe_reporter'],
    },
    {
      name: 'pricing_engine_monitor', migration: '20260635310000_agent_pricing_engine_monitor.sql',
      typeFile: 'agent-pricing-engine-monitor.ts', skillDir: 'pricing-engine-monitor',
      interfaces: ['PricingEngineMonitorCheck', 'PricingEngineMonitorConfig', 'PricingEngineMonitorResult'],
      bk: 'pricing_engine_monitor', eks: ['pem.check_passed', 'pem.alert_raised', 'pem.export_emitted'],
      subjects: ['sven.pem.check_passed', 'sven.pem.alert_raised', 'sven.pem.export_emitted'],
      cases: ['pem_watcher', 'pem_alerter', 'pem_reporter'],
    },
    {
      name: 'pricing_engine_auditor', migration: '20260635320000_agent_pricing_engine_auditor.sql',
      typeFile: 'agent-pricing-engine-auditor.ts', skillDir: 'pricing-engine-auditor',
      interfaces: ['PricingEngineAuditEntry', 'PricingEngineAuditConfig', 'PricingEngineAuditResult'],
      bk: 'pricing_engine_auditor', eks: ['pea.entry_logged', 'pea.violation_found', 'pea.export_emitted'],
      subjects: ['sven.pea.entry_logged', 'sven.pea.violation_found', 'sven.pea.export_emitted'],
      cases: ['pea_scanner', 'pea_enforcer', 'pea_reporter'],
    },
    {
      name: 'pricing_engine_reporter', migration: '20260635330000_agent_pricing_engine_reporter.sql',
      typeFile: 'agent-pricing-engine-reporter.ts', skillDir: 'pricing-engine-reporter',
      interfaces: ['PricingEngineReport', 'PricingEngineReportConfig', 'PricingEngineReportResult'],
      bk: 'pricing_engine_reporter', eks: ['per.report_generated', 'per.insight_found', 'per.export_emitted'],
      subjects: ['sven.per.report_generated', 'sven.per.insight_found', 'sven.per.export_emitted'],
      cases: ['per_builder', 'per_analyst', 'per_reporter'],
    },
    {
      name: 'pricing_engine_optimizer', migration: '20260635340000_agent_pricing_engine_optimizer.sql',
      typeFile: 'agent-pricing-engine-optimizer.ts', skillDir: 'pricing-engine-optimizer',
      interfaces: ['PricingEngineOptPlan', 'PricingEngineOptConfig', 'PricingEngineOptResult'],
      bk: 'pricing_engine_optimizer', eks: ['peo.plan_created', 'peo.optimization_applied', 'peo.export_emitted'],
      subjects: ['sven.peo.plan_created', 'sven.peo.optimization_applied', 'sven.peo.export_emitted'],
      cases: ['peo_planner', 'peo_executor', 'peo_reporter'],
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
