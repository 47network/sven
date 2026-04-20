import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1033-1037: Compliance', () => {
  const verticals = [
    {
      name: 'compliance_policy_loader', migration: '20260626700000_agent_compliance_policy_loader.sql',
      typeFile: 'agent-compliance-policy-loader.ts', skillDir: 'compliance-policy-loader',
      interfaces: ['CompliancePolicyLoaderConfig', 'PolicyBundle', 'LoaderEvent'],
      bk: 'compliance_policy_loader', eks: ['cppl.bundle_received', 'cppl.policies_validated', 'cppl.bundle_published', 'cppl.audit_recorded'],
      subjects: ['sven.cppl.bundle_received', 'sven.cppl.policies_validated', 'sven.cppl.bundle_published', 'sven.cppl.audit_recorded'],
      cases: ['cppl_receive', 'cppl_validate', 'cppl_publish', 'cppl_audit', 'cppl_report', 'cppl_monitor'],
    },
    {
      name: 'compliance_control_evaluator', migration: '20260626710000_agent_compliance_control_evaluator.sql',
      typeFile: 'agent-compliance-control-evaluator.ts', skillDir: 'compliance-control-evaluator',
      interfaces: ['ComplianceControlEvaluatorConfig', 'ControlCheck', 'EvaluatorEvent'],
      bk: 'compliance_control_evaluator', eks: ['ccev.check_received', 'ccev.controls_evaluated', 'ccev.results_emitted', 'ccev.audit_recorded'],
      subjects: ['sven.ccev.check_received', 'sven.ccev.controls_evaluated', 'sven.ccev.results_emitted', 'sven.ccev.audit_recorded'],
      cases: ['ccev_receive', 'ccev_evaluate', 'ccev_emit', 'ccev_audit', 'ccev_report', 'ccev_monitor'],
    },
    {
      name: 'compliance_evidence_collector', migration: '20260626720000_agent_compliance_evidence_collector.sql',
      typeFile: 'agent-compliance-evidence-collector.ts', skillDir: 'compliance-evidence-collector',
      interfaces: ['ComplianceEvidenceCollectorConfig', 'EvidenceItem', 'CollectorEvent'],
      bk: 'compliance_evidence_collector', eks: ['cecl.item_received', 'cecl.fields_validated', 'cecl.evidence_persisted', 'cecl.audit_recorded'],
      subjects: ['sven.cecl.item_received', 'sven.cecl.fields_validated', 'sven.cecl.evidence_persisted', 'sven.cecl.audit_recorded'],
      cases: ['cecl_receive', 'cecl_validate', 'cecl_persist', 'cecl_audit', 'cecl_report', 'cecl_monitor'],
    },
    {
      name: 'compliance_report_generator', migration: '20260626730000_agent_compliance_report_generator.sql',
      typeFile: 'agent-compliance-report-generator.ts', skillDir: 'compliance-report-generator',
      interfaces: ['ComplianceReportGeneratorConfig', 'ReportRequest', 'GeneratorEvent'],
      bk: 'compliance_report_generator', eks: ['crpg.request_received', 'crpg.evidence_loaded', 'crpg.report_generated', 'crpg.audit_recorded'],
      subjects: ['sven.crpg.request_received', 'sven.crpg.evidence_loaded', 'sven.crpg.report_generated', 'sven.crpg.audit_recorded'],
      cases: ['crpg_receive', 'crpg_load', 'crpg_generate', 'crpg_audit', 'crpg_report', 'crpg_monitor'],
    },
    {
      name: 'compliance_audit_logger', migration: '20260626740000_agent_compliance_audit_logger.sql',
      typeFile: 'agent-compliance-audit-logger.ts', skillDir: 'compliance-audit-logger',
      interfaces: ['ComplianceAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'compliance_audit_logger', eks: ['caud.record_received', 'caud.fields_validated', 'caud.record_persisted', 'caud.export_emitted'],
      subjects: ['sven.caud.record_received', 'sven.caud.fields_validated', 'sven.caud.record_persisted', 'sven.caud.export_emitted'],
      cases: ['caud_receive', 'caud_validate', 'caud_persist', 'caud_emit', 'caud_report', 'caud_monitor'],
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
