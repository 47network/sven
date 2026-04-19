import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1043-1047: AML', () => {
  const verticals = [
    {
      name: 'aml_transaction_monitor', migration: '20260626800000_agent_aml_transaction_monitor.sql',
      typeFile: 'agent-aml-transaction-monitor.ts', skillDir: 'aml-transaction-monitor',
      interfaces: ['AmlTransactionMonitorConfig', 'TransactionEvent', 'MonitorEvent'],
      bk: 'aml_transaction_monitor', eks: ['amtm.event_received', 'amtm.fields_validated', 'amtm.transaction_evaluated', 'amtm.audit_recorded'],
      subjects: ['sven.amtm.event_received', 'sven.amtm.fields_validated', 'sven.amtm.transaction_evaluated', 'sven.amtm.audit_recorded'],
      cases: ['amtm_receive', 'amtm_validate', 'amtm_evaluate', 'amtm_audit', 'amtm_report', 'amtm_monitor'],
    },
    {
      name: 'aml_pattern_detector', migration: '20260626810000_agent_aml_pattern_detector.sql',
      typeFile: 'agent-aml-pattern-detector.ts', skillDir: 'aml-pattern-detector',
      interfaces: ['AmlPatternDetectorConfig', 'PatternRequest', 'DetectorEvent'],
      bk: 'aml_pattern_detector', eks: ['ampd.request_received', 'ampd.events_loaded', 'ampd.patterns_detected', 'ampd.audit_recorded'],
      subjects: ['sven.ampd.request_received', 'sven.ampd.events_loaded', 'sven.ampd.patterns_detected', 'sven.ampd.audit_recorded'],
      cases: ['ampd_receive', 'ampd_load', 'ampd_detect', 'ampd_audit', 'ampd_report', 'ampd_monitor'],
    },
    {
      name: 'aml_alert_generator', migration: '20260626820000_agent_aml_alert_generator.sql',
      typeFile: 'agent-aml-alert-generator.ts', skillDir: 'aml-alert-generator',
      interfaces: ['AmlAlertGeneratorConfig', 'AlertRequest', 'GeneratorEvent'],
      bk: 'aml_alert_generator', eks: ['amag.request_received', 'amag.alert_generated', 'amag.alert_dispatched', 'amag.audit_recorded'],
      subjects: ['sven.amag.request_received', 'sven.amag.alert_generated', 'sven.amag.alert_dispatched', 'sven.amag.audit_recorded'],
      cases: ['amag_receive', 'amag_generate', 'amag_dispatch', 'amag_audit', 'amag_report', 'amag_monitor'],
    },
    {
      name: 'aml_case_writer', migration: '20260626830000_agent_aml_case_writer.sql',
      typeFile: 'agent-aml-case-writer.ts', skillDir: 'aml-case-writer',
      interfaces: ['AmlCaseWriterConfig', 'CaseRecord', 'WriterEvent'],
      bk: 'aml_case_writer', eks: ['amcw.record_received', 'amcw.fields_validated', 'amcw.case_persisted', 'amcw.audit_recorded'],
      subjects: ['sven.amcw.record_received', 'sven.amcw.fields_validated', 'sven.amcw.case_persisted', 'sven.amcw.audit_recorded'],
      cases: ['amcw_receive', 'amcw_validate', 'amcw_persist', 'amcw_audit', 'amcw_report', 'amcw_monitor'],
    },
    {
      name: 'aml_audit_logger', migration: '20260626840000_agent_aml_audit_logger.sql',
      typeFile: 'agent-aml-audit-logger.ts', skillDir: 'aml-audit-logger',
      interfaces: ['AmlAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'aml_audit_logger', eks: ['amau.record_received', 'amau.fields_validated', 'amau.record_persisted', 'amau.export_emitted'],
      subjects: ['sven.amau.record_received', 'sven.amau.fields_validated', 'sven.amau.record_persisted', 'sven.amau.export_emitted'],
      cases: ['amau_receive', 'amau_validate', 'amau_persist', 'amau_emit', 'amau_report', 'amau_monitor'],
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
