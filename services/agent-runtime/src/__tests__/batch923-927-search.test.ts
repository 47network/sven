import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 923-927: Search Infrastructure', () => {
  const verticals = [
    {
      name: 'search_index_writer', migration: '20260625600000_agent_search_index_writer.sql',
      typeFile: 'agent-search-index-writer.ts', skillDir: 'search-index-writer',
      interfaces: ['SearchIndexWriterConfig', 'IndexBatch', 'WriterEvent'],
      bk: 'search_index_writer', eks: ['sxiw.batch_received', 'sxiw.documents_validated', 'sxiw.segment_written', 'sxiw.commit_finalized'],
      subjects: ['sven.sxiw.batch_received', 'sven.sxiw.documents_validated', 'sven.sxiw.segment_written', 'sven.sxiw.commit_finalized'],
      cases: ['sxiw_receive', 'sxiw_validate', 'sxiw_write', 'sxiw_finalize', 'sxiw_report', 'sxiw_monitor'],
    },
    {
      name: 'search_query_planner', migration: '20260625610000_agent_search_query_planner.sql',
      typeFile: 'agent-search-query-planner.ts', skillDir: 'search-query-planner',
      interfaces: ['SearchQueryPlannerConfig', 'QueryPlan', 'PlannerEvent'],
      bk: 'search_query_planner', eks: ['sxqp.query_received', 'sxqp.plan_constructed', 'sxqp.cost_estimated', 'sxqp.plan_returned'],
      subjects: ['sven.sxqp.query_received', 'sven.sxqp.plan_constructed', 'sven.sxqp.cost_estimated', 'sven.sxqp.plan_returned'],
      cases: ['sxqp_receive', 'sxqp_construct', 'sxqp_estimate', 'sxqp_return', 'sxqp_report', 'sxqp_monitor'],
    },
    {
      name: 'search_ranking_calibrator', migration: '20260625620000_agent_search_ranking_calibrator.sql',
      typeFile: 'agent-search-ranking-calibrator.ts', skillDir: 'search-ranking-calibrator',
      interfaces: ['SearchRankingCalibratorConfig', 'CalibrationJob', 'CalibratorEvent'],
      bk: 'search_ranking_calibrator', eks: ['sxrc.job_received', 'sxrc.signals_collected', 'sxrc.weights_calibrated', 'sxrc.profile_published'],
      subjects: ['sven.sxrc.job_received', 'sven.sxrc.signals_collected', 'sven.sxrc.weights_calibrated', 'sven.sxrc.profile_published'],
      cases: ['sxrc_receive', 'sxrc_collect', 'sxrc_calibrate', 'sxrc_publish', 'sxrc_report', 'sxrc_monitor'],
    },
    {
      name: 'search_synonym_manager', migration: '20260625630000_agent_search_synonym_manager.sql',
      typeFile: 'agent-search-synonym-manager.ts', skillDir: 'search-synonym-manager',
      interfaces: ['SearchSynonymManagerConfig', 'SynonymSet', 'ManagerEvent'],
      bk: 'search_synonym_manager', eks: ['sxsm.set_received', 'sxsm.consistency_checked', 'sxsm.set_persisted', 'sxsm.indices_refreshed'],
      subjects: ['sven.sxsm.set_received', 'sven.sxsm.consistency_checked', 'sven.sxsm.set_persisted', 'sven.sxsm.indices_refreshed'],
      cases: ['sxsm_receive', 'sxsm_check', 'sxsm_persist', 'sxsm_refresh', 'sxsm_report', 'sxsm_monitor'],
    },
    {
      name: 'search_aggregation_executor', migration: '20260625640000_agent_search_aggregation_executor.sql',
      typeFile: 'agent-search-aggregation-executor.ts', skillDir: 'search-aggregation-executor',
      interfaces: ['SearchAggregationExecutorConfig', 'AggregationRequest', 'ExecutorEvent'],
      bk: 'search_aggregation_executor', eks: ['sxae.request_received', 'sxae.plan_resolved', 'sxae.aggregation_executed', 'sxae.results_returned'],
      subjects: ['sven.sxae.request_received', 'sven.sxae.plan_resolved', 'sven.sxae.aggregation_executed', 'sven.sxae.results_returned'],
      cases: ['sxae_receive', 'sxae_resolve', 'sxae_execute', 'sxae_return', 'sxae_report', 'sxae_monitor'],
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
