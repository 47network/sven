import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Refund Processor verticals', () => {
  const verticals = [
    {
      name: 'refund_processor', migration: '20260635400000_agent_refund_processor.sql',
      typeFile: 'agent-refund-processor.ts', skillDir: 'refund-processor',
      interfaces: ['RefundProcessorEntry', 'RefundProcessorConfig', 'RefundProcessorResult'],
      bk: 'refund_processor', eks: ['rp.entry_created', 'rp.config_updated', 'rp.export_emitted'],
      subjects: ['sven.rp.entry_created', 'sven.rp.config_updated', 'sven.rp.export_emitted'],
      cases: ['rp_validator', 'rp_issuer', 'rp_reporter'],
    },
    {
      name: 'refund_processor_monitor', migration: '20260635410000_agent_refund_processor_monitor.sql',
      typeFile: 'agent-refund-processor-monitor.ts', skillDir: 'refund-processor-monitor',
      interfaces: ['RefundProcessorMonitorCheck', 'RefundProcessorMonitorConfig', 'RefundProcessorMonitorResult'],
      bk: 'refund_processor_monitor', eks: ['rpm.check_passed', 'rpm.alert_raised', 'rpm.export_emitted'],
      subjects: ['sven.rpm.check_passed', 'sven.rpm.alert_raised', 'sven.rpm.export_emitted'],
      cases: ['rpm_watcher', 'rpm_alerter', 'rpm_reporter'],
    },
    {
      name: 'refund_processor_auditor', migration: '20260635420000_agent_refund_processor_auditor.sql',
      typeFile: 'agent-refund-processor-auditor.ts', skillDir: 'refund-processor-auditor',
      interfaces: ['RefundProcessorAuditEntry', 'RefundProcessorAuditConfig', 'RefundProcessorAuditResult'],
      bk: 'refund_processor_auditor', eks: ['rpa.entry_logged', 'rpa.violation_found', 'rpa.export_emitted'],
      subjects: ['sven.rpa.entry_logged', 'sven.rpa.violation_found', 'sven.rpa.export_emitted'],
      cases: ['rpa_scanner', 'rpa_enforcer', 'rpa_reporter'],
    },
    {
      name: 'refund_processor_reporter', migration: '20260635430000_agent_refund_processor_reporter.sql',
      typeFile: 'agent-refund-processor-reporter.ts', skillDir: 'refund-processor-reporter',
      interfaces: ['RefundProcessorReport', 'RefundProcessorReportConfig', 'RefundProcessorReportResult'],
      bk: 'refund_processor_reporter', eks: ['rpr.report_generated', 'rpr.insight_found', 'rpr.export_emitted'],
      subjects: ['sven.rpr.report_generated', 'sven.rpr.insight_found', 'sven.rpr.export_emitted'],
      cases: ['rpr_builder', 'rpr_analyst', 'rpr_reporter'],
    },
    {
      name: 'refund_processor_optimizer', migration: '20260635440000_agent_refund_processor_optimizer.sql',
      typeFile: 'agent-refund-processor-optimizer.ts', skillDir: 'refund-processor-optimizer',
      interfaces: ['RefundProcessorOptPlan', 'RefundProcessorOptConfig', 'RefundProcessorOptResult'],
      bk: 'refund_processor_optimizer', eks: ['rpo.plan_created', 'rpo.optimization_applied', 'rpo.export_emitted'],
      subjects: ['sven.rpo.plan_created', 'sven.rpo.optimization_applied', 'sven.rpo.export_emitted'],
      cases: ['rpo_planner', 'rpo_executor', 'rpo_reporter'],
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
