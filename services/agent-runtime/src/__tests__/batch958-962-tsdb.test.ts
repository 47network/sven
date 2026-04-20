import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 958-962: Time Series DB', () => {
  const verticals = [
    {
      name: 'tsdb_ingest_writer', migration: '20260625950000_agent_tsdb_ingest_writer.sql',
      typeFile: 'agent-tsdb-ingest-writer.ts', skillDir: 'tsdb-ingest-writer',
      interfaces: ['TsdbIngestWriterConfig', 'MetricBatch', 'WriterEvent'],
      bk: 'tsdb_ingest_writer', eks: ['tsiw.batch_received', 'tsiw.points_validated', 'tsiw.points_persisted', 'tsiw.audit_recorded'],
      subjects: ['sven.tsiw.batch_received', 'sven.tsiw.points_validated', 'sven.tsiw.points_persisted', 'sven.tsiw.audit_recorded'],
      cases: ['tsiw_receive', 'tsiw_validate', 'tsiw_persist', 'tsiw_audit', 'tsiw_report', 'tsiw_monitor'],
    },
    {
      name: 'tsdb_downsampler', migration: '20260625960000_agent_tsdb_downsampler.sql',
      typeFile: 'agent-tsdb-downsampler.ts', skillDir: 'tsdb-downsampler',
      interfaces: ['TsdbDownsamplerConfig', 'DownsamplePlan', 'DownsamplerEvent'],
      bk: 'tsdb_downsampler', eks: ['tsds.plan_received', 'tsds.windows_aggregated', 'tsds.rollups_persisted', 'tsds.audit_recorded'],
      subjects: ['sven.tsds.plan_received', 'sven.tsds.windows_aggregated', 'sven.tsds.rollups_persisted', 'sven.tsds.audit_recorded'],
      cases: ['tsds_receive', 'tsds_aggregate', 'tsds_persist', 'tsds_audit', 'tsds_report', 'tsds_monitor'],
    },
    {
      name: 'tsdb_retention_pruner', migration: '20260625970000_agent_tsdb_retention_pruner.sql',
      typeFile: 'agent-tsdb-retention-pruner.ts', skillDir: 'tsdb-retention-pruner',
      interfaces: ['TsdbRetentionPrunerConfig', 'RetentionPolicy', 'PrunerEvent'],
      bk: 'tsdb_retention_pruner', eks: ['tsrp.policy_received', 'tsrp.candidates_evaluated', 'tsrp.points_pruned', 'tsrp.audit_recorded'],
      subjects: ['sven.tsrp.policy_received', 'sven.tsrp.candidates_evaluated', 'sven.tsrp.points_pruned', 'sven.tsrp.audit_recorded'],
      cases: ['tsrp_receive', 'tsrp_evaluate', 'tsrp_prune', 'tsrp_audit', 'tsrp_report', 'tsrp_monitor'],
    },
    {
      name: 'tsdb_query_planner', migration: '20260625980000_agent_tsdb_query_planner.sql',
      typeFile: 'agent-tsdb-query-planner.ts', skillDir: 'tsdb-query-planner',
      interfaces: ['TsdbQueryPlannerConfig', 'QueryRequest', 'PlannerEvent'],
      bk: 'tsdb_query_planner', eks: ['tsqp.request_received', 'tsqp.plan_constructed', 'tsqp.execution_dispatched', 'tsqp.results_returned'],
      subjects: ['sven.tsqp.request_received', 'sven.tsqp.plan_constructed', 'sven.tsqp.execution_dispatched', 'sven.tsqp.results_returned'],
      cases: ['tsqp_receive', 'tsqp_construct', 'tsqp_dispatch', 'tsqp_return', 'tsqp_report', 'tsqp_monitor'],
    },
    {
      name: 'tsdb_anomaly_detector', migration: '20260625990000_agent_tsdb_anomaly_detector.sql',
      typeFile: 'agent-tsdb-anomaly-detector.ts', skillDir: 'tsdb-anomaly-detector',
      interfaces: ['TsdbAnomalyDetectorConfig', 'AnomalyScan', 'DetectorEvent'],
      bk: 'tsdb_anomaly_detector', eks: ['tsad.scan_scheduled', 'tsad.windows_evaluated', 'tsad.anomalies_flagged', 'tsad.report_emitted'],
      subjects: ['sven.tsad.scan_scheduled', 'sven.tsad.windows_evaluated', 'sven.tsad.anomalies_flagged', 'sven.tsad.report_emitted'],
      cases: ['tsad_schedule', 'tsad_evaluate', 'tsad_flag', 'tsad_emit', 'tsad_report', 'tsad_monitor'],
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
