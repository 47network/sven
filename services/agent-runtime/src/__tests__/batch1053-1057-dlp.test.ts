import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1053-1057: Data Loss Prevention', () => {
  const verticals = [
    {
      name: 'dlp_content_classifier', migration: '20260626900000_agent_dlp_content_classifier.sql',
      typeFile: 'agent-dlp-content-classifier.ts', skillDir: 'dlp-content-classifier',
      interfaces: ['DlpContentClassifierConfig', 'ContentItem', 'ClassifierEvent'],
      bk: 'dlp_content_classifier', eks: ['dpcc.item_received', 'dpcc.classified', 'dpcc.classification_emitted', 'dpcc.audit_recorded'],
      subjects: ['sven.dpcc.item_received', 'sven.dpcc.classified', 'sven.dpcc.classification_emitted', 'sven.dpcc.audit_recorded'],
      cases: ['dpcc_receive', 'dpcc_classify', 'dpcc_emit', 'dpcc_audit', 'dpcc_report', 'dpcc_monitor'],
    },
    {
      name: 'dlp_policy_evaluator', migration: '20260626910000_agent_dlp_policy_evaluator.sql',
      typeFile: 'agent-dlp-policy-evaluator.ts', skillDir: 'dlp-policy-evaluator',
      interfaces: ['DlpPolicyEvaluatorConfig', 'PolicyCheck', 'EvaluatorEvent'],
      bk: 'dlp_policy_evaluator', eks: ['dppe.check_received', 'dppe.policy_evaluated', 'dppe.decision_emitted', 'dppe.audit_recorded'],
      subjects: ['sven.dppe.check_received', 'sven.dppe.policy_evaluated', 'sven.dppe.decision_emitted', 'sven.dppe.audit_recorded'],
      cases: ['dppe_receive', 'dppe_evaluate', 'dppe_emit', 'dppe_audit', 'dppe_report', 'dppe_monitor'],
    },
    {
      name: 'dlp_action_dispatcher', migration: '20260626920000_agent_dlp_action_dispatcher.sql',
      typeFile: 'agent-dlp-action-dispatcher.ts', skillDir: 'dlp-action-dispatcher',
      interfaces: ['DlpActionDispatcherConfig', 'ActionRequest', 'DispatcherEvent'],
      bk: 'dlp_action_dispatcher', eks: ['dpad.request_received', 'dpad.policy_evaluated', 'dpad.action_dispatched', 'dpad.audit_recorded'],
      subjects: ['sven.dpad.request_received', 'sven.dpad.policy_evaluated', 'sven.dpad.action_dispatched', 'sven.dpad.audit_recorded'],
      cases: ['dpad_receive', 'dpad_evaluate', 'dpad_dispatch', 'dpad_audit', 'dpad_report', 'dpad_monitor'],
    },
    {
      name: 'dlp_incident_writer', migration: '20260626930000_agent_dlp_incident_writer.sql',
      typeFile: 'agent-dlp-incident-writer.ts', skillDir: 'dlp-incident-writer',
      interfaces: ['DlpIncidentWriterConfig', 'IncidentRecord', 'WriterEvent'],
      bk: 'dlp_incident_writer', eks: ['dpiw.record_received', 'dpiw.fields_validated', 'dpiw.incident_persisted', 'dpiw.audit_recorded'],
      subjects: ['sven.dpiw.record_received', 'sven.dpiw.fields_validated', 'sven.dpiw.incident_persisted', 'sven.dpiw.audit_recorded'],
      cases: ['dpiw_receive', 'dpiw_validate', 'dpiw_persist', 'dpiw_audit', 'dpiw_report', 'dpiw_monitor'],
    },
    {
      name: 'dlp_audit_logger', migration: '20260626940000_agent_dlp_audit_logger.sql',
      typeFile: 'agent-dlp-audit-logger.ts', skillDir: 'dlp-audit-logger',
      interfaces: ['DlpAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'dlp_audit_logger', eks: ['dpau.record_received', 'dpau.fields_validated', 'dpau.record_persisted', 'dpau.export_emitted'],
      subjects: ['sven.dpau.record_received', 'sven.dpau.fields_validated', 'sven.dpau.record_persisted', 'sven.dpau.export_emitted'],
      cases: ['dpau_receive', 'dpau_validate', 'dpau_persist', 'dpau_emit', 'dpau_report', 'dpau_monitor'],
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
