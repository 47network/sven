import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('SLA Compliance verticals', () => {
  const verticals = [
    {
      name: 'sla_compliance', migration: '20260629950000_agent_sla_compliance.sql',
      typeFile: 'agent-sla-compliance.ts', skillDir: 'sla-compliance',
      interfaces: ['SlaComplianceEntry', 'SlaComplianceConfig', 'SlaComplianceResult'],
      bk: 'sla_compliance', eks: ['slc.entry_created', 'slc.config_updated', 'slc.export_emitted'],
      subjects: ['sven.slc.entry_created', 'sven.slc.config_updated', 'sven.slc.export_emitted'],
      cases: ['slc_tracker', 'slc_enforcer', 'slc_reporter'],
    },
    {
      name: 'sla_compliance_monitor', migration: '20260629960000_agent_sla_compliance_monitor.sql',
      typeFile: 'agent-sla-compliance-monitor.ts', skillDir: 'sla-compliance-monitor',
      interfaces: ['SlaComplianceMonitorCheck', 'SlaComplianceMonitorConfig', 'SlaComplianceMonitorResult'],
      bk: 'sla_compliance_monitor', eks: ['slcm.check_passed', 'slcm.alert_raised', 'slcm.export_emitted'],
      subjects: ['sven.slcm.check_passed', 'sven.slcm.alert_raised', 'sven.slcm.export_emitted'],
      cases: ['slcm_watcher', 'slcm_alerter', 'slcm_reporter'],
    },
    {
      name: 'sla_compliance_auditor', migration: '20260629970000_agent_sla_compliance_auditor.sql',
      typeFile: 'agent-sla-compliance-auditor.ts', skillDir: 'sla-compliance-auditor',
      interfaces: ['SlaComplianceAuditEntry', 'SlaComplianceAuditConfig', 'SlaComplianceAuditResult'],
      bk: 'sla_compliance_auditor', eks: ['slca.entry_logged', 'slca.violation_found', 'slca.export_emitted'],
      subjects: ['sven.slca.entry_logged', 'sven.slca.violation_found', 'sven.slca.export_emitted'],
      cases: ['slca_scanner', 'slca_enforcer', 'slca_reporter'],
    },
    {
      name: 'sla_compliance_reporter', migration: '20260629980000_agent_sla_compliance_reporter.sql',
      typeFile: 'agent-sla-compliance-reporter.ts', skillDir: 'sla-compliance-reporter',
      interfaces: ['SlaComplianceReport', 'SlaComplianceReportConfig', 'SlaComplianceReportResult'],
      bk: 'sla_compliance_reporter', eks: ['slcr.report_generated', 'slcr.insight_found', 'slcr.export_emitted'],
      subjects: ['sven.slcr.report_generated', 'sven.slcr.insight_found', 'sven.slcr.export_emitted'],
      cases: ['slcr_builder', 'slcr_analyst', 'slcr_reporter'],
    },
    {
      name: 'sla_compliance_optimizer', migration: '20260629990000_agent_sla_compliance_optimizer.sql',
      typeFile: 'agent-sla-compliance-optimizer.ts', skillDir: 'sla-compliance-optimizer',
      interfaces: ['SlaComplianceOptPlan', 'SlaComplianceOptConfig', 'SlaComplianceOptResult'],
      bk: 'sla_compliance_optimizer', eks: ['slco.plan_created', 'slco.optimization_applied', 'slco.export_emitted'],
      subjects: ['sven.slco.plan_created', 'sven.slco.optimization_applied', 'sven.slco.export_emitted'],
      cases: ['slco_planner', 'slco_executor', 'slco_reporter'],
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
