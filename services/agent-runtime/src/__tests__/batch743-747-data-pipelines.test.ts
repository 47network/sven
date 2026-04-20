import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 743-747: Data Pipelines', () => {
  const verticals = [
    {
      name: 'data_lake_ingestor', migration: '20260623800000_agent_data_lake_ingestor.sql',
      typeFile: 'agent-data-lake-ingestor.ts', skillDir: 'data-lake-ingestor',
      interfaces: ['DataLakeIngestorConfig', 'IngestionJob', 'IngestorEvent'],
      bk: 'data_lake_ingestor', eks: ['dlin.source_connected', 'dlin.batch_ingested', 'dlin.partition_written', 'dlin.checkpoint_committed'],
      subjects: ['sven.dlin.source_connected', 'sven.dlin.batch_ingested', 'sven.dlin.partition_written', 'sven.dlin.checkpoint_committed'],
      cases: ['dlin_connect', 'dlin_ingest', 'dlin_write', 'dlin_commit', 'dlin_report', 'dlin_monitor'],
    },
    {
      name: 'kafka_stream_processor', migration: '20260623810000_agent_kafka_stream_processor.sql',
      typeFile: 'agent-kafka-stream-processor.ts', skillDir: 'kafka-stream-processor',
      interfaces: ['KafkaStreamProcessorConfig', 'StreamPipeline', 'ProcessorEvent'],
      bk: 'kafka_stream_processor', eks: ['ksprc.topic_subscribed', 'ksprc.message_processed', 'ksprc.offset_committed', 'ksprc.dlq_dispatched'],
      subjects: ['sven.ksprc.topic_subscribed', 'sven.ksprc.message_processed', 'sven.ksprc.offset_committed', 'sven.ksprc.dlq_dispatched'],
      cases: ['ksprc_subscribe', 'ksprc_process', 'ksprc_commit', 'ksprc_dispatch', 'ksprc_report', 'ksprc_monitor'],
    },
    {
      name: 'batch_etl_runner', migration: '20260623820000_agent_batch_etl_runner.sql',
      typeFile: 'agent-batch-etl-runner.ts', skillDir: 'batch-etl-runner',
      interfaces: ['BatchEtlRunnerConfig', 'EtlJob', 'RunnerEvent'],
      bk: 'batch_etl_runner', eks: ['betl.job_scheduled', 'betl.transform_executed', 'betl.records_loaded', 'betl.lineage_recorded'],
      subjects: ['sven.betl.job_scheduled', 'sven.betl.transform_executed', 'sven.betl.records_loaded', 'sven.betl.lineage_recorded'],
      cases: ['betl_schedule', 'betl_execute', 'betl_load', 'betl_record', 'betl_report', 'betl_monitor'],
    },
    {
      name: 'data_warehouse_loader', migration: '20260623830000_agent_data_warehouse_loader.sql',
      typeFile: 'agent-data-warehouse-loader.ts', skillDir: 'data-warehouse-loader',
      interfaces: ['DataWarehouseLoaderConfig', 'WarehouseLoad', 'LoaderEvent'],
      bk: 'data_warehouse_loader', eks: ['dwhl.staging_loaded', 'dwhl.merge_executed', 'dwhl.partition_swapped', 'dwhl.statistics_refreshed'],
      subjects: ['sven.dwhl.staging_loaded', 'sven.dwhl.merge_executed', 'sven.dwhl.partition_swapped', 'sven.dwhl.statistics_refreshed'],
      cases: ['dwhl_load', 'dwhl_merge', 'dwhl_swap', 'dwhl_refresh', 'dwhl_report', 'dwhl_monitor'],
    },
    {
      name: 'olap_cube_builder', migration: '20260623840000_agent_olap_cube_builder.sql',
      typeFile: 'agent-olap-cube-builder.ts', skillDir: 'olap-cube-builder',
      interfaces: ['OlapCubeBuilderConfig', 'OlapCube', 'BuilderEvent'],
      bk: 'olap_cube_builder', eks: ['olcb.cube_defined', 'olcb.aggregation_computed', 'olcb.dimension_indexed', 'olcb.cube_published'],
      subjects: ['sven.olcb.cube_defined', 'sven.olcb.aggregation_computed', 'sven.olcb.dimension_indexed', 'sven.olcb.cube_published'],
      cases: ['olcb_define', 'olcb_compute', 'olcb_index', 'olcb_publish', 'olcb_report', 'olcb_monitor'],
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
