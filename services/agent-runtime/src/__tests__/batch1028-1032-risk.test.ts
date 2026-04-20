import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1028-1032: Risk Scoring', () => {
  const verticals = [
    {
      name: 'risk_composite_scorer', migration: '20260626650000_agent_risk_composite_scorer.sql',
      typeFile: 'agent-risk-composite-scorer.ts', skillDir: 'risk-composite-scorer',
      interfaces: ['RiskCompositeScorerConfig', 'ScoreRequest', 'ScorerEvent'],
      bk: 'risk_composite_scorer', eks: ['rcsc.request_received', 'rcsc.factors_loaded', 'rcsc.score_computed', 'rcsc.audit_recorded'],
      subjects: ['sven.rcsc.request_received', 'sven.rcsc.factors_loaded', 'sven.rcsc.score_computed', 'sven.rcsc.audit_recorded'],
      cases: ['rcsc_receive', 'rcsc_load', 'rcsc_compute', 'rcsc_audit', 'rcsc_report', 'rcsc_monitor'],
    },
    {
      name: 'risk_threshold_evaluator', migration: '20260626660000_agent_risk_threshold_evaluator.sql',
      typeFile: 'agent-risk-threshold-evaluator.ts', skillDir: 'risk-threshold-evaluator',
      interfaces: ['RiskThresholdEvaluatorConfig', 'ThresholdCheck', 'EvaluatorEvent'],
      bk: 'risk_threshold_evaluator', eks: ['rtev.check_received', 'rtev.thresholds_evaluated', 'rtev.decision_emitted', 'rtev.audit_recorded'],
      subjects: ['sven.rtev.check_received', 'sven.rtev.thresholds_evaluated', 'sven.rtev.decision_emitted', 'sven.rtev.audit_recorded'],
      cases: ['rtev_receive', 'rtev_evaluate', 'rtev_emit', 'rtev_audit', 'rtev_report', 'rtev_monitor'],
    },
    {
      name: 'risk_decision_dispatcher', migration: '20260626670000_agent_risk_decision_dispatcher.sql',
      typeFile: 'agent-risk-decision-dispatcher.ts', skillDir: 'risk-decision-dispatcher',
      interfaces: ['RiskDecisionDispatcherConfig', 'DecisionRequest', 'DispatcherEvent'],
      bk: 'risk_decision_dispatcher', eks: ['rdds.request_received', 'rdds.policy_evaluated', 'rdds.action_dispatched', 'rdds.audit_recorded'],
      subjects: ['sven.rdds.request_received', 'sven.rdds.policy_evaluated', 'sven.rdds.action_dispatched', 'sven.rdds.audit_recorded'],
      cases: ['rdds_receive', 'rdds_evaluate', 'rdds_dispatch', 'rdds_audit', 'rdds_report', 'rdds_monitor'],
    },
    {
      name: 'risk_appeal_handler', migration: '20260626680000_agent_risk_appeal_handler.sql',
      typeFile: 'agent-risk-appeal-handler.ts', skillDir: 'risk-appeal-handler',
      interfaces: ['RiskAppealHandlerConfig', 'AppealRequest', 'HandlerEvent'],
      bk: 'risk_appeal_handler', eks: ['rkah.request_received', 'rkah.case_loaded', 'rkah.appeal_processed', 'rkah.audit_recorded'],
      subjects: ['sven.rkah.request_received', 'sven.rkah.case_loaded', 'sven.rkah.appeal_processed', 'sven.rkah.audit_recorded'],
      cases: ['rkah_receive', 'rkah_load', 'rkah_process', 'rkah_audit', 'rkah_report', 'rkah_monitor'],
    },
    {
      name: 'risk_audit_logger', migration: '20260626690000_agent_risk_audit_logger.sql',
      typeFile: 'agent-risk-audit-logger.ts', skillDir: 'risk-audit-logger',
      interfaces: ['RiskAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'risk_audit_logger', eks: ['rkau.record_received', 'rkau.fields_validated', 'rkau.record_persisted', 'rkau.export_emitted'],
      subjects: ['sven.rkau.record_received', 'sven.rkau.fields_validated', 'sven.rkau.record_persisted', 'sven.rkau.export_emitted'],
      cases: ['rkau_receive', 'rkau_validate', 'rkau_persist', 'rkau_emit', 'rkau_report', 'rkau_monitor'],
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
