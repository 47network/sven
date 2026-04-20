import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 943-947: Data Warehouse', () => {
  const verticals = [
    {
      name: 'warehouse_etl_loader', migration: '20260625800000_agent_warehouse_etl_loader.sql',
      typeFile: 'agent-warehouse-etl-loader.ts', skillDir: 'warehouse-etl-loader',
      interfaces: ['WarehouseEtlLoaderConfig', 'EtlBatch', 'LoaderEvent'],
      bk: 'warehouse_etl_loader', eks: ['wetl.batch_received', 'wetl.staging_loaded', 'wetl.merge_executed', 'wetl.audit_recorded'],
      subjects: ['sven.wetl.batch_received', 'sven.wetl.staging_loaded', 'sven.wetl.merge_executed', 'sven.wetl.audit_recorded'],
      cases: ['wetl_receive', 'wetl_load', 'wetl_merge', 'wetl_audit', 'wetl_report', 'wetl_monitor'],
    },
    {
      name: 'warehouse_partition_pruner', migration: '20260625810000_agent_warehouse_partition_pruner.sql',
      typeFile: 'agent-warehouse-partition-pruner.ts', skillDir: 'warehouse-partition-pruner',
      interfaces: ['WarehousePartitionPrunerConfig', 'PrunePlan', 'PrunerEvent'],
      bk: 'warehouse_partition_pruner', eks: ['wppr.plan_received', 'wppr.partitions_evaluated', 'wppr.partitions_pruned', 'wppr.audit_recorded'],
      subjects: ['sven.wppr.plan_received', 'sven.wppr.partitions_evaluated', 'sven.wppr.partitions_pruned', 'sven.wppr.audit_recorded'],
      cases: ['wppr_receive', 'wppr_evaluate', 'wppr_prune', 'wppr_audit', 'wppr_report', 'wppr_monitor'],
    },
    {
      name: 'warehouse_query_router', migration: '20260625820000_agent_warehouse_query_router.sql',
      typeFile: 'agent-warehouse-query-router.ts', skillDir: 'warehouse-query-router',
      interfaces: ['WarehouseQueryRouterConfig', 'QueryRequest', 'RouterEvent'],
      bk: 'warehouse_query_router', eks: ['wqrr.request_received', 'wqrr.cluster_resolved', 'wqrr.query_dispatched', 'wqrr.result_returned'],
      subjects: ['sven.wqrr.request_received', 'sven.wqrr.cluster_resolved', 'sven.wqrr.query_dispatched', 'sven.wqrr.result_returned'],
      cases: ['wqrr_receive', 'wqrr_resolve', 'wqrr_dispatch', 'wqrr_return', 'wqrr_report', 'wqrr_monitor'],
    },
    {
      name: 'warehouse_materialization_runner', migration: '20260625830000_agent_warehouse_materialization_runner.sql',
      typeFile: 'agent-warehouse-materialization-runner.ts', skillDir: 'warehouse-materialization-runner',
      interfaces: ['WarehouseMaterializationRunnerConfig', 'MaterializationJob', 'RunnerEvent'],
      bk: 'warehouse_materialization_runner', eks: ['wmrn.job_received', 'wmrn.dependencies_resolved', 'wmrn.materialization_built', 'wmrn.audit_recorded'],
      subjects: ['sven.wmrn.job_received', 'sven.wmrn.dependencies_resolved', 'sven.wmrn.materialization_built', 'sven.wmrn.audit_recorded'],
      cases: ['wmrn_receive', 'wmrn_resolve', 'wmrn_build', 'wmrn_audit', 'wmrn_report', 'wmrn_monitor'],
    },
    {
      name: 'warehouse_cost_attributor', migration: '20260625840000_agent_warehouse_cost_attributor.sql',
      typeFile: 'agent-warehouse-cost-attributor.ts', skillDir: 'warehouse-cost-attributor',
      interfaces: ['WarehouseCostAttributorConfig', 'UsageRecord', 'AttributorEvent'],
      bk: 'warehouse_cost_attributor', eks: ['wcat.record_received', 'wcat.usage_normalized', 'wcat.cost_attributed', 'wcat.report_emitted'],
      subjects: ['sven.wcat.record_received', 'sven.wcat.usage_normalized', 'sven.wcat.cost_attributed', 'sven.wcat.report_emitted'],
      cases: ['wcat_receive', 'wcat_normalize', 'wcat_attribute', 'wcat_emit', 'wcat_report', 'wcat_monitor'],
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
