import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1023-1027: Fraud Detection', () => {
  const verticals = [
    {
      name: 'fraud_signal_collector', migration: '20260626600000_agent_fraud_signal_collector.sql',
      typeFile: 'agent-fraud-signal-collector.ts', skillDir: 'fraud-signal-collector',
      interfaces: ['FraudSignalCollectorConfig', 'SignalEvent', 'CollectorEvent'],
      bk: 'fraud_signal_collector', eks: ['frsc.event_received', 'frsc.fields_validated', 'frsc.signal_persisted', 'frsc.audit_recorded'],
      subjects: ['sven.frsc.event_received', 'sven.frsc.fields_validated', 'sven.frsc.signal_persisted', 'sven.frsc.audit_recorded'],
      cases: ['frsc_receive', 'frsc_validate', 'frsc_persist', 'frsc_audit', 'frsc_report', 'frsc_monitor'],
    },
    {
      name: 'fraud_score_evaluator', migration: '20260626610000_agent_fraud_score_evaluator.sql',
      typeFile: 'agent-fraud-score-evaluator.ts', skillDir: 'fraud-score-evaluator',
      interfaces: ['FraudScoreEvaluatorConfig', 'ScoreRequest', 'EvaluatorEvent'],
      bk: 'fraud_score_evaluator', eks: ['frse.request_received', 'frse.signals_loaded', 'frse.score_computed', 'frse.audit_recorded'],
      subjects: ['sven.frse.request_received', 'sven.frse.signals_loaded', 'sven.frse.score_computed', 'sven.frse.audit_recorded'],
      cases: ['frse_receive', 'frse_load', 'frse_compute', 'frse_audit', 'frse_report', 'frse_monitor'],
    },
    {
      name: 'fraud_decision_dispatcher', migration: '20260626620000_agent_fraud_decision_dispatcher.sql',
      typeFile: 'agent-fraud-decision-dispatcher.ts', skillDir: 'fraud-decision-dispatcher',
      interfaces: ['FraudDecisionDispatcherConfig', 'DecisionRequest', 'DispatcherEvent'],
      bk: 'fraud_decision_dispatcher', eks: ['frdd.request_received', 'frdd.policy_evaluated', 'frdd.action_dispatched', 'frdd.audit_recorded'],
      subjects: ['sven.frdd.request_received', 'sven.frdd.policy_evaluated', 'sven.frdd.action_dispatched', 'sven.frdd.audit_recorded'],
      cases: ['frdd_receive', 'frdd_evaluate', 'frdd_dispatch', 'frdd_audit', 'frdd_report', 'frdd_monitor'],
    },
    {
      name: 'fraud_case_writer', migration: '20260626630000_agent_fraud_case_writer.sql',
      typeFile: 'agent-fraud-case-writer.ts', skillDir: 'fraud-case-writer',
      interfaces: ['FraudCaseWriterConfig', 'CaseRecord', 'WriterEvent'],
      bk: 'fraud_case_writer', eks: ['frcw.record_received', 'frcw.fields_validated', 'frcw.case_persisted', 'frcw.audit_recorded'],
      subjects: ['sven.frcw.record_received', 'sven.frcw.fields_validated', 'sven.frcw.case_persisted', 'sven.frcw.audit_recorded'],
      cases: ['frcw_receive', 'frcw_validate', 'frcw_persist', 'frcw_audit', 'frcw_report', 'frcw_monitor'],
    },
    {
      name: 'fraud_audit_logger', migration: '20260626640000_agent_fraud_audit_logger.sql',
      typeFile: 'agent-fraud-audit-logger.ts', skillDir: 'fraud-audit-logger',
      interfaces: ['FraudAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'fraud_audit_logger', eks: ['frau.record_received', 'frau.fields_validated', 'frau.record_persisted', 'frau.export_emitted'],
      subjects: ['sven.frau.record_received', 'sven.frau.fields_validated', 'sven.frau.record_persisted', 'sven.frau.export_emitted'],
      cases: ['frau_receive', 'frau_validate', 'frau_persist', 'frau_emit', 'frau_report', 'frau_monitor'],
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
