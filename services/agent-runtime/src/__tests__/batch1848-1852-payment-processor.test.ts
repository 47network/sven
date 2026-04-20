import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Payment Processor verticals', () => {
  const verticals = [
    {
      name: 'payment_processor', migration: '20260634850000_agent_payment_processor.sql',
      typeFile: 'agent-payment-processor.ts', skillDir: 'payment-processor',
      interfaces: ['PaymentProcessorEntry', 'PaymentProcessorConfig', 'PaymentProcessorResult'],
      bk: 'payment_processor', eks: ['pp.entry_created', 'pp.config_updated', 'pp.export_emitted'],
      subjects: ['sven.pp.entry_created', 'sven.pp.config_updated', 'sven.pp.export_emitted'],
      cases: ['pp_validator', 'pp_settler', 'pp_reporter'],
    },
    {
      name: 'payment_processor_monitor', migration: '20260634860000_agent_payment_processor_monitor.sql',
      typeFile: 'agent-payment-processor-monitor.ts', skillDir: 'payment-processor-monitor',
      interfaces: ['PaymentProcessorMonitorCheck', 'PaymentProcessorMonitorConfig', 'PaymentProcessorMonitorResult'],
      bk: 'payment_processor_monitor', eks: ['ppm.check_passed', 'ppm.alert_raised', 'ppm.export_emitted'],
      subjects: ['sven.ppm.check_passed', 'sven.ppm.alert_raised', 'sven.ppm.export_emitted'],
      cases: ['ppm_watcher', 'ppm_alerter', 'ppm_reporter'],
    },
    {
      name: 'payment_processor_auditor', migration: '20260634870000_agent_payment_processor_auditor.sql',
      typeFile: 'agent-payment-processor-auditor.ts', skillDir: 'payment-processor-auditor',
      interfaces: ['PaymentProcessorAuditEntry', 'PaymentProcessorAuditConfig', 'PaymentProcessorAuditResult'],
      bk: 'payment_processor_auditor', eks: ['ppa.entry_logged', 'ppa.violation_found', 'ppa.export_emitted'],
      subjects: ['sven.ppa.entry_logged', 'sven.ppa.violation_found', 'sven.ppa.export_emitted'],
      cases: ['ppa_scanner', 'ppa_enforcer', 'ppa_reporter'],
    },
    {
      name: 'payment_processor_reporter', migration: '20260634880000_agent_payment_processor_reporter.sql',
      typeFile: 'agent-payment-processor-reporter.ts', skillDir: 'payment-processor-reporter',
      interfaces: ['PaymentProcessorReport', 'PaymentProcessorReportConfig', 'PaymentProcessorReportResult'],
      bk: 'payment_processor_reporter', eks: ['ppr.report_generated', 'ppr.insight_found', 'ppr.export_emitted'],
      subjects: ['sven.ppr.report_generated', 'sven.ppr.insight_found', 'sven.ppr.export_emitted'],
      cases: ['ppr_builder', 'ppr_analyst', 'ppr_reporter'],
    },
    {
      name: 'payment_processor_optimizer', migration: '20260634890000_agent_payment_processor_optimizer.sql',
      typeFile: 'agent-payment-processor-optimizer.ts', skillDir: 'payment-processor-optimizer',
      interfaces: ['PaymentProcessorOptPlan', 'PaymentProcessorOptConfig', 'PaymentProcessorOptResult'],
      bk: 'payment_processor_optimizer', eks: ['ppo.plan_created', 'ppo.optimization_applied', 'ppo.export_emitted'],
      subjects: ['sven.ppo.plan_created', 'sven.ppo.optimization_applied', 'sven.ppo.export_emitted'],
      cases: ['ppo_planner', 'ppo_executor', 'ppo_reporter'],
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
