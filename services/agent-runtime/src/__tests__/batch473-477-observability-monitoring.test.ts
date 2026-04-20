import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

const VERTICALS = [
  {
    name: 'incident_tracker',
    migration: '20260621100000_agent_incident_tracker.sql',
    table: 'agent_incident_tracker_configs',
    typeFile: 'agent-incident-tracker.ts',
    interfaces: ['IncidentTrackerConfig', 'IncidentRecord', 'EscalationEvent'],
    skillDir: 'incident-tracker',
    bk: 'incident_tracker',
    ekPrefix: 'intr',
    eks: ['intr.incident_created', 'intr.incident_escalated', 'intr.incident_resolved', 'intr.responder_assigned'],
    subjects: ['sven.intr.incident_created', 'sven.intr.incident_escalated', 'sven.intr.incident_resolved', 'sven.intr.responder_assigned'],
    cases: ['intr_create', 'intr_escalate', 'intr_assign', 'intr_resolve', 'intr_timeline', 'intr_status'],
  },
  {
    name: 'sla_reporter',
    migration: '20260621110000_agent_sla_reporter.sql',
    table: 'agent_sla_reporter_configs',
    typeFile: 'agent-sla-reporter.ts',
    interfaces: ['SlaReporterConfig', 'SlaReport', 'SlaBreach'],
    skillDir: 'sla-reporter',
    bk: 'sla_reporter',
    ekPrefix: 'slar',
    eks: ['slar.report_generated', 'slar.breach_detected', 'slar.compliance_checked', 'slar.trend_analyzed'],
    subjects: ['sven.slar.report_generated', 'sven.slar.breach_detected', 'sven.slar.compliance_checked', 'sven.slar.trend_analyzed'],
    cases: ['slar_generate', 'slar_breach', 'slar_trend', 'slar_forecast', 'slar_status', 'slar_export'],
  },
  {
    name: 'anomaly_detector',
    migration: '20260621120000_agent_anomaly_detector.sql',
    table: 'agent_anomaly_detector_configs',
    typeFile: 'agent-anomaly-detector.ts',
    interfaces: ['AnomalyDetectorConfig', 'DetectedAnomaly', 'AnomalyBaseline'],
    skillDir: 'anomaly-detector',
    bk: 'anomaly_detector',
    ekPrefix: 'andt',
    eks: ['andt.anomaly_detected', 'andt.baseline_updated', 'andt.sensitivity_adjusted', 'andt.investigation_complete'],
    subjects: ['sven.andt.anomaly_detected', 'sven.andt.baseline_updated', 'sven.andt.sensitivity_adjusted', 'sven.andt.investigation_complete'],
    cases: ['andt_detect', 'andt_baseline', 'andt_sensitivity', 'andt_investigate', 'andt_status', 'andt_report'],
  },
  {
    name: 'resource_scaler',
    migration: '20260621130000_agent_resource_scaler.sql',
    table: 'agent_resource_scaler_configs',
    typeFile: 'agent-resource-scaler.ts',
    interfaces: ['ResourceScalerConfig', 'ScalingEvent', 'ResourceSnapshot'],
    skillDir: 'resource-scaler',
    bk: 'resource_scaler',
    ekPrefix: 'rscl',
    eks: ['rscl.scaled_up', 'rscl.scaled_down', 'rscl.threshold_breached', 'rscl.forecast_generated'],
    subjects: ['sven.rscl.scaled_up', 'sven.rscl.scaled_down', 'sven.rscl.threshold_breached', 'sven.rscl.forecast_generated'],
    cases: ['rscl_evaluate', 'rscl_up', 'rscl_down', 'rscl_forecast', 'rscl_status', 'rscl_history'],
  },
  {
    name: 'outage_predictor',
    migration: '20260621140000_agent_outage_predictor.sql',
    table: 'agent_outage_predictor_configs',
    typeFile: 'agent-outage-predictor.ts',
    interfaces: ['OutagePredictorConfig', 'OutagePrediction', 'PredictionAccuracy'],
    skillDir: 'outage-predictor',
    bk: 'outage_predictor',
    ekPrefix: 'outp',
    eks: ['outp.outage_predicted', 'outp.correlation_found', 'outp.model_retrained', 'outp.accuracy_evaluated'],
    subjects: ['sven.outp.outage_predicted', 'sven.outp.correlation_found', 'sven.outp.model_retrained', 'sven.outp.accuracy_evaluated'],
    cases: ['outp_predict', 'outp_correlate', 'outp_train', 'outp_evaluate', 'outp_status', 'outp_report'],
  },
];

describe('Batches 473-477 — Observability & Monitoring', () => {
  VERTICALS.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });

      test('migration creates correct table', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(v.table);
        expect(sql).toContain('agent_id');
        expect(sql).toContain('enabled');
      });

      test('migration has indexes', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE INDEX');
      });

      test('type file exists', () => {
        const p = path.join(REPO, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(p)).toBe(true);
      });

      test('type file exports all interfaces', () => {
        const p = path.join(REPO, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(p, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });

      test('barrel export exists', () => {
        const barrel = fs.readFileSync(path.join(REPO, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(barrel).toContain(`export * from './${modName}'`);
      });

      test('SKILL.md exists', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });

      test('SKILL.md has actions section', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });

      test('SKILL.md has price', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('price:');
      });

      test('BK registered', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });

      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });

      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });

      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((sub) => {
          expect(eb).toContain(`'${sub}'`);
        });
      });

      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(REPO, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => {
          expect(te).toContain(`case '${c}'`);
        });
      });
    });
  });
});
