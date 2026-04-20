import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 978-982: ML Inference', () => {
  const verticals = [
    {
      name: 'ml_inference_request_router', migration: '20260626150000_agent_ml_inference_request_router.sql',
      typeFile: 'agent-ml-inference-request-router.ts', skillDir: 'ml-inference-request-router',
      interfaces: ['MlInferenceRequestRouterConfig', 'InferenceRequest', 'RouterEvent'],
      bk: 'ml_inference_request_router', eks: ['mirr.request_received', 'mirr.model_resolved', 'mirr.request_dispatched', 'mirr.result_returned'],
      subjects: ['sven.mirr.request_received', 'sven.mirr.model_resolved', 'sven.mirr.request_dispatched', 'sven.mirr.result_returned'],
      cases: ['mirr_receive', 'mirr_resolve', 'mirr_dispatch', 'mirr_return', 'mirr_report', 'mirr_monitor'],
    },
    {
      name: 'ml_inference_batch_packer', migration: '20260626160000_agent_ml_inference_batch_packer.sql',
      typeFile: 'agent-ml-inference-batch-packer.ts', skillDir: 'ml-inference-batch-packer',
      interfaces: ['MlInferenceBatchPackerConfig', 'InferenceQueue', 'PackerEvent'],
      bk: 'ml_inference_batch_packer', eks: ['mibp.queue_received', 'mibp.batch_assembled', 'mibp.batch_dispatched', 'mibp.audit_recorded'],
      subjects: ['sven.mibp.queue_received', 'sven.mibp.batch_assembled', 'sven.mibp.batch_dispatched', 'sven.mibp.audit_recorded'],
      cases: ['mibp_receive', 'mibp_assemble', 'mibp_dispatch', 'mibp_audit', 'mibp_report', 'mibp_monitor'],
    },
    {
      name: 'ml_inference_result_validator', migration: '20260626170000_agent_ml_inference_result_validator.sql',
      typeFile: 'agent-ml-inference-result-validator.ts', skillDir: 'ml-inference-result-validator',
      interfaces: ['MlInferenceResultValidatorConfig', 'InferenceResult', 'ValidatorEvent'],
      bk: 'ml_inference_result_validator', eks: ['mirv.result_received', 'mirv.shape_checked', 'mirv.safety_validated', 'mirv.report_emitted'],
      subjects: ['sven.mirv.result_received', 'sven.mirv.shape_checked', 'sven.mirv.safety_validated', 'sven.mirv.report_emitted'],
      cases: ['mirv_receive', 'mirv_check', 'mirv_validate', 'mirv_emit', 'mirv_report', 'mirv_monitor'],
    },
    {
      name: 'ml_inference_drift_monitor', migration: '20260626180000_agent_ml_inference_drift_monitor.sql',
      typeFile: 'agent-ml-inference-drift-monitor.ts', skillDir: 'ml-inference-drift-monitor',
      interfaces: ['MlInferenceDriftMonitorConfig', 'DriftScan', 'MonitorEvent'],
      bk: 'ml_inference_drift_monitor', eks: ['midm.scan_scheduled', 'midm.distributions_compared', 'midm.drift_flagged', 'midm.report_emitted'],
      subjects: ['sven.midm.scan_scheduled', 'sven.midm.distributions_compared', 'sven.midm.drift_flagged', 'sven.midm.report_emitted'],
      cases: ['midm_schedule', 'midm_compare', 'midm_flag', 'midm_emit', 'midm_report', 'midm_monitor'],
    },
    {
      name: 'ml_inference_explainability_logger', migration: '20260626190000_agent_ml_inference_explainability_logger.sql',
      typeFile: 'agent-ml-inference-explainability-logger.ts', skillDir: 'ml-inference-explainability-logger',
      interfaces: ['MlInferenceExplainabilityLoggerConfig', 'ExplainRecord', 'LoggerEvent'],
      bk: 'ml_inference_explainability_logger', eks: ['miel.record_received', 'miel.features_attributed', 'miel.record_persisted', 'miel.audit_recorded'],
      subjects: ['sven.miel.record_received', 'sven.miel.features_attributed', 'sven.miel.record_persisted', 'sven.miel.audit_recorded'],
      cases: ['miel_receive', 'miel_attribute', 'miel_persist', 'miel_audit', 'miel_report', 'miel_monitor'],
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
