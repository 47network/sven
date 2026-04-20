import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 983-987: Feature Store', () => {
  const verticals = [
    {
      name: 'feature_store_value_writer', migration: '20260626200000_agent_feature_store_value_writer.sql',
      typeFile: 'agent-feature-store-value-writer.ts', skillDir: 'feature-store-value-writer',
      interfaces: ['FeatureStoreValueWriterConfig', 'FeatureBatch', 'WriterEvent'],
      bk: 'feature_store_value_writer', eks: ['fsvw.batch_received', 'fsvw.values_validated', 'fsvw.values_persisted', 'fsvw.audit_recorded'],
      subjects: ['sven.fsvw.batch_received', 'sven.fsvw.values_validated', 'sven.fsvw.values_persisted', 'sven.fsvw.audit_recorded'],
      cases: ['fsvw_receive', 'fsvw_validate', 'fsvw_persist', 'fsvw_audit', 'fsvw_report', 'fsvw_monitor'],
    },
    {
      name: 'feature_store_server', migration: '20260626210000_agent_feature_store_server.sql',
      typeFile: 'agent-feature-store-server.ts', skillDir: 'feature-store-server',
      interfaces: ['FeatureStoreServerConfig', 'FeatureRequest', 'ServerEvent'],
      bk: 'feature_store_server', eks: ['fsvr.request_received', 'fsvr.features_resolved', 'fsvr.values_returned', 'fsvr.audit_recorded'],
      subjects: ['sven.fsvr.request_received', 'sven.fsvr.features_resolved', 'sven.fsvr.values_returned', 'sven.fsvr.audit_recorded'],
      cases: ['fsvr_receive', 'fsvr_resolve', 'fsvr_return', 'fsvr_audit', 'fsvr_report', 'fsvr_monitor'],
    },
    {
      name: 'feature_store_freshness_monitor', migration: '20260626220000_agent_feature_store_freshness_monitor.sql',
      typeFile: 'agent-feature-store-freshness-monitor.ts', skillDir: 'feature-store-freshness-monitor',
      interfaces: ['FeatureStoreFreshnessMonitorConfig', 'FreshnessScan', 'MonitorEvent'],
      bk: 'feature_store_freshness_monitor', eks: ['fsfm.scan_scheduled', 'fsfm.staleness_evaluated', 'fsfm.alerts_emitted', 'fsfm.report_emitted'],
      subjects: ['sven.fsfm.scan_scheduled', 'sven.fsfm.staleness_evaluated', 'sven.fsfm.alerts_emitted', 'sven.fsfm.report_emitted'],
      cases: ['fsfm_schedule', 'fsfm_evaluate', 'fsfm_emit', 'fsfm_record', 'fsfm_report', 'fsfm_monitor'],
    },
    {
      name: 'feature_store_lineage_tracker', migration: '20260626230000_agent_feature_store_lineage_tracker.sql',
      typeFile: 'agent-feature-store-lineage-tracker.ts', skillDir: 'feature-store-lineage-tracker',
      interfaces: ['FeatureStoreLineageTrackerConfig', 'LineageEvent', 'TrackerEvent'],
      bk: 'feature_store_lineage_tracker', eks: ['fslt.event_received', 'fslt.lineage_recorded', 'fslt.queries_served', 'fslt.audit_recorded'],
      subjects: ['sven.fslt.event_received', 'sven.fslt.lineage_recorded', 'sven.fslt.queries_served', 'sven.fslt.audit_recorded'],
      cases: ['fslt_receive', 'fslt_record', 'fslt_serve', 'fslt_audit', 'fslt_report', 'fslt_monitor'],
    },
    {
      name: 'feature_store_backfill_runner', migration: '20260626240000_agent_feature_store_backfill_runner.sql',
      typeFile: 'agent-feature-store-backfill-runner.ts', skillDir: 'feature-store-backfill-runner',
      interfaces: ['FeatureStoreBackfillRunnerConfig', 'BackfillJob', 'RunnerEvent'],
      bk: 'feature_store_backfill_runner', eks: ['fsbr.job_received', 'fsbr.window_resolved', 'fsbr.values_backfilled', 'fsbr.audit_recorded'],
      subjects: ['sven.fsbr.job_received', 'sven.fsbr.window_resolved', 'sven.fsbr.values_backfilled', 'sven.fsbr.audit_recorded'],
      cases: ['fsbr_receive', 'fsbr_resolve', 'fsbr_backfill', 'fsbr_audit', 'fsbr_report', 'fsbr_monitor'],
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
