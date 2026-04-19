import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Currency Converter verticals', () => {
  const verticals = [
    {
      name: 'currency_converter', migration: '20260635450000_agent_currency_converter.sql',
      typeFile: 'agent-currency-converter.ts', skillDir: 'currency-converter',
      interfaces: ['CurrencyConverterEntry', 'CurrencyConverterConfig', 'CurrencyConverterResult'],
      bk: 'currency_converter', eks: ['cc.entry_created', 'cc.config_updated', 'cc.export_emitted'],
      subjects: ['sven.cc.entry_created', 'sven.cc.config_updated', 'sven.cc.export_emitted'],
      cases: ['cc_converter', 'cc_rate_fetcher', 'cc_reporter'],
    },
    {
      name: 'currency_converter_monitor', migration: '20260635460000_agent_currency_converter_monitor.sql',
      typeFile: 'agent-currency-converter-monitor.ts', skillDir: 'currency-converter-monitor',
      interfaces: ['CurrencyConverterMonitorCheck', 'CurrencyConverterMonitorConfig', 'CurrencyConverterMonitorResult'],
      bk: 'currency_converter_monitor', eks: ['ccm.check_passed', 'ccm.alert_raised', 'ccm.export_emitted'],
      subjects: ['sven.ccm.check_passed', 'sven.ccm.alert_raised', 'sven.ccm.export_emitted'],
      cases: ['ccm_watcher', 'ccm_alerter', 'ccm_reporter'],
    },
    {
      name: 'currency_converter_auditor', migration: '20260635470000_agent_currency_converter_auditor.sql',
      typeFile: 'agent-currency-converter-auditor.ts', skillDir: 'currency-converter-auditor',
      interfaces: ['CurrencyConverterAuditEntry', 'CurrencyConverterAuditConfig', 'CurrencyConverterAuditResult'],
      bk: 'currency_converter_auditor', eks: ['cca.entry_logged', 'cca.violation_found', 'cca.export_emitted'],
      subjects: ['sven.cca.entry_logged', 'sven.cca.violation_found', 'sven.cca.export_emitted'],
      cases: ['cca_scanner', 'cca_enforcer', 'cca_reporter'],
    },
    {
      name: 'currency_converter_reporter', migration: '20260635480000_agent_currency_converter_reporter.sql',
      typeFile: 'agent-currency-converter-reporter.ts', skillDir: 'currency-converter-reporter',
      interfaces: ['CurrencyConverterReport', 'CurrencyConverterReportConfig', 'CurrencyConverterReportResult'],
      bk: 'currency_converter_reporter', eks: ['ccr.report_generated', 'ccr.insight_found', 'ccr.export_emitted'],
      subjects: ['sven.ccr.report_generated', 'sven.ccr.insight_found', 'sven.ccr.export_emitted'],
      cases: ['ccr_builder', 'ccr_analyst', 'ccr_reporter'],
    },
    {
      name: 'currency_converter_optimizer', migration: '20260635490000_agent_currency_converter_optimizer.sql',
      typeFile: 'agent-currency-converter-optimizer.ts', skillDir: 'currency-converter-optimizer',
      interfaces: ['CurrencyConverterOptPlan', 'CurrencyConverterOptConfig', 'CurrencyConverterOptResult'],
      bk: 'currency_converter_optimizer', eks: ['cco.plan_created', 'cco.optimization_applied', 'cco.export_emitted'],
      subjects: ['sven.cco.plan_created', 'sven.cco.optimization_applied', 'sven.cco.export_emitted'],
      cases: ['cco_planner', 'cco_executor', 'cco_reporter'],
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
