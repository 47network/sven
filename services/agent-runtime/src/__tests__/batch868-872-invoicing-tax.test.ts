import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 868-872: Invoicing, Tax & Revenue', () => {
  const verticals = [
    {
      name: 'invoice_pdf_generator', migration: '20260625050000_agent_invoice_pdf_generator.sql',
      typeFile: 'agent-invoice-pdf-generator.ts', skillDir: 'invoice-pdf-generator',
      interfaces: ['InvoicePdfGeneratorConfig', 'InvoiceJob', 'GeneratorEvent'],
      bk: 'invoice_pdf_generator', eks: ['ipdg.job_received', 'ipdg.template_resolved', 'ipdg.pdf_rendered', 'ipdg.artifact_persisted'],
      subjects: ['sven.ipdg.job_received', 'sven.ipdg.template_resolved', 'sven.ipdg.pdf_rendered', 'sven.ipdg.artifact_persisted'],
      cases: ['ipdg_receive', 'ipdg_resolve', 'ipdg_render', 'ipdg_persist', 'ipdg_report', 'ipdg_monitor'],
    },
    {
      name: 'tax_jurisdiction_resolver', migration: '20260625060000_agent_tax_jurisdiction_resolver.sql',
      typeFile: 'agent-tax-jurisdiction-resolver.ts', skillDir: 'tax-jurisdiction-resolver',
      interfaces: ['TaxJurisdictionResolverConfig', 'JurisdictionQuery', 'ResolverEvent'],
      bk: 'tax_jurisdiction_resolver', eks: ['tjur.query_received', 'tjur.address_normalized', 'tjur.jurisdictions_resolved', 'tjur.result_returned'],
      subjects: ['sven.tjur.query_received', 'sven.tjur.address_normalized', 'sven.tjur.jurisdictions_resolved', 'sven.tjur.result_returned'],
      cases: ['tjur_receive', 'tjur_normalize', 'tjur_resolve', 'tjur_return', 'tjur_report', 'tjur_monitor'],
    },
    {
      name: 'tax_rate_calculator', migration: '20260625070000_agent_tax_rate_calculator.sql',
      typeFile: 'agent-tax-rate-calculator.ts', skillDir: 'tax-rate-calculator',
      interfaces: ['TaxRateCalculatorConfig', 'TaxCalculation', 'CalculatorEvent'],
      bk: 'tax_rate_calculator', eks: ['trcl.request_received', 'trcl.rates_loaded', 'trcl.tax_computed', 'trcl.breakdown_returned'],
      subjects: ['sven.trcl.request_received', 'sven.trcl.rates_loaded', 'sven.trcl.tax_computed', 'sven.trcl.breakdown_returned'],
      cases: ['trcl_receive', 'trcl_load', 'trcl_compute', 'trcl_return', 'trcl_report', 'trcl_monitor'],
    },
    {
      name: 'revenue_recognition_engine', migration: '20260625080000_agent_revenue_recognition_engine.sql',
      typeFile: 'agent-revenue-recognition-engine.ts', skillDir: 'revenue-recognition-engine',
      interfaces: ['RevenueRecognitionEngineConfig', 'RecognitionEvent', 'EngineEvent'],
      bk: 'revenue_recognition_engine', eks: ['rrec.event_received', 'rrec.policy_evaluated', 'rrec.entries_posted', 'rrec.period_closed'],
      subjects: ['sven.rrec.event_received', 'sven.rrec.policy_evaluated', 'sven.rrec.entries_posted', 'sven.rrec.period_closed'],
      cases: ['rrec_receive', 'rrec_evaluate', 'rrec_post', 'rrec_close', 'rrec_report', 'rrec_monitor'],
    },
    {
      name: 'refund_dispatcher', migration: '20260625090000_agent_refund_dispatcher.sql',
      typeFile: 'agent-refund-dispatcher.ts', skillDir: 'refund-dispatcher',
      interfaces: ['RefundDispatcherConfig', 'RefundRequest', 'DispatcherEvent'],
      bk: 'refund_dispatcher', eks: ['rfdp.request_received', 'rfdp.eligibility_checked', 'rfdp.processor_called', 'rfdp.outcome_recorded'],
      subjects: ['sven.rfdp.request_received', 'sven.rfdp.eligibility_checked', 'sven.rfdp.processor_called', 'sven.rfdp.outcome_recorded'],
      cases: ['rfdp_receive', 'rfdp_check', 'rfdp_call', 'rfdp_record', 'rfdp_report', 'rfdp_monitor'],
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
