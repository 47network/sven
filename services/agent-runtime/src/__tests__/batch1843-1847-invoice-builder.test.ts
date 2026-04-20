import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Invoice Builder verticals', () => {
  const verticals = [
    {
      name: 'invoice_builder', migration: '20260634800000_agent_invoice_builder.sql',
      typeFile: 'agent-invoice-builder.ts', skillDir: 'invoice-builder',
      interfaces: ['InvoiceBuilderEntry', 'InvoiceBuilderConfig', 'InvoiceBuilderResult'],
      bk: 'invoice_builder', eks: ['ib.entry_created', 'ib.config_updated', 'ib.export_emitted'],
      subjects: ['sven.ib.entry_created', 'sven.ib.config_updated', 'sven.ib.export_emitted'],
      cases: ['ib_creator', 'ib_formatter', 'ib_reporter'],
    },
    {
      name: 'invoice_builder_monitor', migration: '20260634810000_agent_invoice_builder_monitor.sql',
      typeFile: 'agent-invoice-builder-monitor.ts', skillDir: 'invoice-builder-monitor',
      interfaces: ['InvoiceBuilderMonitorCheck', 'InvoiceBuilderMonitorConfig', 'InvoiceBuilderMonitorResult'],
      bk: 'invoice_builder_monitor', eks: ['ibm.check_passed', 'ibm.alert_raised', 'ibm.export_emitted'],
      subjects: ['sven.ibm.check_passed', 'sven.ibm.alert_raised', 'sven.ibm.export_emitted'],
      cases: ['ibm_watcher', 'ibm_alerter', 'ibm_reporter'],
    },
    {
      name: 'invoice_builder_auditor', migration: '20260634820000_agent_invoice_builder_auditor.sql',
      typeFile: 'agent-invoice-builder-auditor.ts', skillDir: 'invoice-builder-auditor',
      interfaces: ['InvoiceBuilderAuditEntry', 'InvoiceBuilderAuditConfig', 'InvoiceBuilderAuditResult'],
      bk: 'invoice_builder_auditor', eks: ['iba.entry_logged', 'iba.violation_found', 'iba.export_emitted'],
      subjects: ['sven.iba.entry_logged', 'sven.iba.violation_found', 'sven.iba.export_emitted'],
      cases: ['iba_scanner', 'iba_enforcer', 'iba_reporter'],
    },
    {
      name: 'invoice_builder_reporter', migration: '20260634830000_agent_invoice_builder_reporter.sql',
      typeFile: 'agent-invoice-builder-reporter.ts', skillDir: 'invoice-builder-reporter',
      interfaces: ['InvoiceBuilderReport', 'InvoiceBuilderReportConfig', 'InvoiceBuilderReportResult'],
      bk: 'invoice_builder_reporter', eks: ['ibr.report_generated', 'ibr.insight_found', 'ibr.export_emitted'],
      subjects: ['sven.ibr.report_generated', 'sven.ibr.insight_found', 'sven.ibr.export_emitted'],
      cases: ['ibr_builder', 'ibr_analyst', 'ibr_reporter'],
    },
    {
      name: 'invoice_builder_optimizer', migration: '20260634840000_agent_invoice_builder_optimizer.sql',
      typeFile: 'agent-invoice-builder-optimizer.ts', skillDir: 'invoice-builder-optimizer',
      interfaces: ['InvoiceBuilderOptPlan', 'InvoiceBuilderOptConfig', 'InvoiceBuilderOptResult'],
      bk: 'invoice_builder_optimizer', eks: ['ibo.plan_created', 'ibo.optimization_applied', 'ibo.export_emitted'],
      subjects: ['sven.ibo.plan_created', 'sven.ibo.optimization_applied', 'sven.ibo.export_emitted'],
      cases: ['ibo_planner', 'ibo_executor', 'ibo_reporter'],
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
