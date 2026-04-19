import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 998-1002: A/B Testing', () => {
  const verticals = [
    {
      name: 'ab_test_assignment_router', migration: '20260626350000_agent_ab_test_assignment_router.sql',
      typeFile: 'agent-ab-test-assignment-router.ts', skillDir: 'ab-test-assignment-router',
      interfaces: ['AbTestAssignmentRouterConfig', 'AssignmentRequest', 'RouterEvent'],
      bk: 'ab_test_assignment_router', eks: ['abar.request_received', 'abar.bucket_computed', 'abar.variant_returned', 'abar.audit_recorded'],
      subjects: ['sven.abar.request_received', 'sven.abar.bucket_computed', 'sven.abar.variant_returned', 'sven.abar.audit_recorded'],
      cases: ['abar_receive', 'abar_compute', 'abar_return', 'abar_audit', 'abar_report', 'abar_monitor'],
    },
    {
      name: 'ab_test_exposure_logger', migration: '20260626360000_agent_ab_test_exposure_logger.sql',
      typeFile: 'agent-ab-test-exposure-logger.ts', skillDir: 'ab-test-exposure-logger',
      interfaces: ['AbTestExposureLoggerConfig', 'ExposureEvent', 'LoggerEvent'],
      bk: 'ab_test_exposure_logger', eks: ['abel.event_received', 'abel.fields_validated', 'abel.exposure_persisted', 'abel.audit_recorded'],
      subjects: ['sven.abel.event_received', 'sven.abel.fields_validated', 'sven.abel.exposure_persisted', 'sven.abel.audit_recorded'],
      cases: ['abel_receive', 'abel_validate', 'abel_persist', 'abel_audit', 'abel_report', 'abel_monitor'],
    },
    {
      name: 'ab_test_metrics_aggregator', migration: '20260626370000_agent_ab_test_metrics_aggregator.sql',
      typeFile: 'agent-ab-test-metrics-aggregator.ts', skillDir: 'ab-test-metrics-aggregator',
      interfaces: ['AbTestMetricsAggregatorConfig', 'MetricsBatch', 'AggregatorEvent'],
      bk: 'ab_test_metrics_aggregator', eks: ['abma.batch_received', 'abma.metrics_aggregated', 'abma.summary_persisted', 'abma.audit_recorded'],
      subjects: ['sven.abma.batch_received', 'sven.abma.metrics_aggregated', 'sven.abma.summary_persisted', 'sven.abma.audit_recorded'],
      cases: ['abma_receive', 'abma_aggregate', 'abma_persist', 'abma_audit', 'abma_report', 'abma_monitor'],
    },
    {
      name: 'ab_test_significance_evaluator', migration: '20260626380000_agent_ab_test_significance_evaluator.sql',
      typeFile: 'agent-ab-test-significance-evaluator.ts', skillDir: 'ab-test-significance-evaluator',
      interfaces: ['AbTestSignificanceEvaluatorConfig', 'SignificanceCheck', 'EvaluatorEvent'],
      bk: 'ab_test_significance_evaluator', eks: ['abse.check_received', 'abse.statistics_computed', 'abse.decision_emitted', 'abse.audit_recorded'],
      subjects: ['sven.abse.check_received', 'sven.abse.statistics_computed', 'sven.abse.decision_emitted', 'sven.abse.audit_recorded'],
      cases: ['abse_receive', 'abse_compute', 'abse_emit', 'abse_audit', 'abse_report', 'abse_monitor'],
    },
    {
      name: 'ab_test_rollback_arbiter', migration: '20260626390000_agent_ab_test_rollback_arbiter.sql',
      typeFile: 'agent-ab-test-rollback-arbiter.ts', skillDir: 'ab-test-rollback-arbiter',
      interfaces: ['AbTestRollbackArbiterConfig', 'RollbackDecision', 'ArbiterEvent'],
      bk: 'ab_test_rollback_arbiter', eks: ['abra.signal_received', 'abra.thresholds_evaluated', 'abra.rollback_executed', 'abra.audit_recorded'],
      subjects: ['sven.abra.signal_received', 'sven.abra.thresholds_evaluated', 'sven.abra.rollback_executed', 'sven.abra.audit_recorded'],
      cases: ['abra_receive', 'abra_evaluate', 'abra_execute', 'abra_audit', 'abra_report', 'abra_monitor'],
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
