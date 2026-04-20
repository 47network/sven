import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Compliance Verifier verticals', () => {
  const verticals = [
    {
      name: 'compliance_verifier', migration: '20260634600000_agent_compliance_verifier.sql',
      typeFile: 'agent-compliance-verifier.ts', skillDir: 'compliance-verifier',
      interfaces: ['ComplianceVerifierEntry', 'ComplianceVerifierConfig', 'ComplianceVerifierResult'],
      bk: 'compliance_verifier', eks: ['cv.entry_created', 'cv.config_updated', 'cv.export_emitted'],
      subjects: ['sven.cv.entry_created', 'sven.cv.config_updated', 'sven.cv.export_emitted'],
      cases: ['cv_checker', 'cv_enforcer', 'cv_reporter'],
    },
    {
      name: 'compliance_verifier_monitor', migration: '20260634610000_agent_compliance_verifier_monitor.sql',
      typeFile: 'agent-compliance-verifier-monitor.ts', skillDir: 'compliance-verifier-monitor',
      interfaces: ['ComplianceVerifierMonitorCheck', 'ComplianceVerifierMonitorConfig', 'ComplianceVerifierMonitorResult'],
      bk: 'compliance_verifier_monitor', eks: ['cvm.check_passed', 'cvm.alert_raised', 'cvm.export_emitted'],
      subjects: ['sven.cvm.check_passed', 'sven.cvm.alert_raised', 'sven.cvm.export_emitted'],
      cases: ['cvm_watcher', 'cvm_alerter', 'cvm_reporter'],
    },
    {
      name: 'compliance_verifier_auditor', migration: '20260634620000_agent_compliance_verifier_auditor.sql',
      typeFile: 'agent-compliance-verifier-auditor.ts', skillDir: 'compliance-verifier-auditor',
      interfaces: ['ComplianceVerifierAuditEntry', 'ComplianceVerifierAuditConfig', 'ComplianceVerifierAuditResult'],
      bk: 'compliance_verifier_auditor', eks: ['cva.entry_logged', 'cva.violation_found', 'cva.export_emitted'],
      subjects: ['sven.cva.entry_logged', 'sven.cva.violation_found', 'sven.cva.export_emitted'],
      cases: ['cva_scanner', 'cva_enforcer', 'cva_reporter'],
    },
    {
      name: 'compliance_verifier_reporter', migration: '20260634630000_agent_compliance_verifier_reporter.sql',
      typeFile: 'agent-compliance-verifier-reporter.ts', skillDir: 'compliance-verifier-reporter',
      interfaces: ['ComplianceVerifierReport', 'ComplianceVerifierReportConfig', 'ComplianceVerifierReportResult'],
      bk: 'compliance_verifier_reporter', eks: ['cvr.report_generated', 'cvr.insight_found', 'cvr.export_emitted'],
      subjects: ['sven.cvr.report_generated', 'sven.cvr.insight_found', 'sven.cvr.export_emitted'],
      cases: ['cvr_builder', 'cvr_analyst', 'cvr_reporter'],
    },
    {
      name: 'compliance_verifier_optimizer', migration: '20260634640000_agent_compliance_verifier_optimizer.sql',
      typeFile: 'agent-compliance-verifier-optimizer.ts', skillDir: 'compliance-verifier-optimizer',
      interfaces: ['ComplianceVerifierOptPlan', 'ComplianceVerifierOptConfig', 'ComplianceVerifierOptResult'],
      bk: 'compliance_verifier_optimizer', eks: ['cvo.plan_created', 'cvo.optimization_applied', 'cvo.export_emitted'],
      subjects: ['sven.cvo.plan_created', 'sven.cvo.optimization_applied', 'sven.cvo.export_emitted'],
      cases: ['cvo_planner', 'cvo_executor', 'cvo_reporter'],
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
