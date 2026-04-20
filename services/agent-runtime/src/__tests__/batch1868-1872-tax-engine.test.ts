import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Tax Engine verticals', () => {
  const verticals = [
    {
      name: 'tax_engine', migration: '20260635050000_agent_tax_engine.sql',
      typeFile: 'agent-tax-engine.ts', skillDir: 'tax-engine',
      interfaces: ['TaxEngineEntry', 'TaxEngineConfig', 'TaxEngineResult'],
      bk: 'tax_engine', eks: ['te.entry_created', 'te.config_updated', 'te.export_emitted'],
      subjects: ['sven.te.entry_created', 'sven.te.config_updated', 'sven.te.export_emitted'],
      cases: ['te_calculator', 'te_validator', 'te_reporter'],
    },
    {
      name: 'tax_engine_monitor', migration: '20260635060000_agent_tax_engine_monitor.sql',
      typeFile: 'agent-tax-engine-monitor.ts', skillDir: 'tax-engine-monitor',
      interfaces: ['TaxEngineMonitorCheck', 'TaxEngineMonitorConfig', 'TaxEngineMonitorResult'],
      bk: 'tax_engine_monitor', eks: ['tem.check_passed', 'tem.alert_raised', 'tem.export_emitted'],
      subjects: ['sven.tem.check_passed', 'sven.tem.alert_raised', 'sven.tem.export_emitted'],
      cases: ['tem_watcher', 'tem_alerter', 'tem_reporter'],
    },
    {
      name: 'tax_engine_auditor', migration: '20260635070000_agent_tax_engine_auditor.sql',
      typeFile: 'agent-tax-engine-auditor.ts', skillDir: 'tax-engine-auditor',
      interfaces: ['TaxEngineAuditEntry', 'TaxEngineAuditConfig', 'TaxEngineAuditResult'],
      bk: 'tax_engine_auditor', eks: ['tea.entry_logged', 'tea.violation_found', 'tea.export_emitted'],
      subjects: ['sven.tea.entry_logged', 'sven.tea.violation_found', 'sven.tea.export_emitted'],
      cases: ['tea_scanner', 'tea_enforcer', 'tea_reporter'],
    },
    {
      name: 'tax_engine_reporter', migration: '20260635080000_agent_tax_engine_reporter.sql',
      typeFile: 'agent-tax-engine-reporter.ts', skillDir: 'tax-engine-reporter',
      interfaces: ['TaxEngineReport', 'TaxEngineReportConfig', 'TaxEngineReportResult'],
      bk: 'tax_engine_reporter', eks: ['ter.report_generated', 'ter.insight_found', 'ter.export_emitted'],
      subjects: ['sven.ter.report_generated', 'sven.ter.insight_found', 'sven.ter.export_emitted'],
      cases: ['ter_builder', 'ter_analyst', 'ter_reporter'],
    },
    {
      name: 'tax_engine_optimizer', migration: '20260635090000_agent_tax_engine_optimizer.sql',
      typeFile: 'agent-tax-engine-optimizer.ts', skillDir: 'tax-engine-optimizer',
      interfaces: ['TaxEngineOptPlan', 'TaxEngineOptConfig', 'TaxEngineOptResult'],
      bk: 'tax_engine_optimizer', eks: ['teo.plan_created', 'teo.optimization_applied', 'teo.export_emitted'],
      subjects: ['sven.teo.plan_created', 'sven.teo.optimization_applied', 'sven.teo.export_emitted'],
      cases: ['teo_planner', 'teo_executor', 'teo_reporter'],
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
