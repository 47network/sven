import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 593-597: Database Operations', () => {
  const verticals = [
    {
      name: 'data_seeder', migration: '20260622300000_agent_data_seeder.sql',
      typeFile: 'agent-data-seeder.ts', skillDir: 'data-seeder',
      interfaces: ['DataSeederConfig', 'SeedJob', 'SeedResult'],
      bk: 'data_seeder', eks: ['dtsd.seed_started', 'dtsd.data_inserted', 'dtsd.seed_completed', 'dtsd.validation_passed'],
      subjects: ['sven.dtsd.seed_started', 'sven.dtsd.data_inserted', 'sven.dtsd.seed_completed', 'sven.dtsd.validation_passed'],
      cases: ['dtsd_seed', 'dtsd_insert', 'dtsd_complete', 'dtsd_validate', 'dtsd_report', 'dtsd_monitor'],
    },
    {
      name: 'query_profiler', migration: '20260622310000_agent_query_profiler.sql',
      typeFile: 'agent-query-profiler.ts', skillDir: 'query-profiler',
      interfaces: ['QueryProfilerConfig', 'ProfileResult', 'SlowQuery'],
      bk: 'query_profiler', eks: ['qypf.profile_started', 'qypf.slow_detected', 'qypf.optimization_suggested', 'qypf.baseline_updated'],
      subjects: ['sven.qypf.profile_started', 'sven.qypf.slow_detected', 'sven.qypf.optimization_suggested', 'sven.qypf.baseline_updated'],
      cases: ['qypf_profile', 'qypf_detect', 'qypf_suggest', 'qypf_baseline', 'qypf_report', 'qypf_monitor'],
    },
    {
      name: 'replication_watcher', migration: '20260622320000_agent_replication_watcher.sql',
      typeFile: 'agent-replication-watcher.ts', skillDir: 'replication-watcher',
      interfaces: ['ReplicationWatcherConfig', 'ReplicaStatus', 'LagAlert'],
      bk: 'replication_watcher', eks: ['rpwt.lag_detected', 'rpwt.replica_synced', 'rpwt.failover_triggered', 'rpwt.consistency_checked'],
      subjects: ['sven.rpwt.lag_detected', 'sven.rpwt.replica_synced', 'sven.rpwt.failover_triggered', 'sven.rpwt.consistency_checked'],
      cases: ['rpwt_lag', 'rpwt_sync', 'rpwt_failover', 'rpwt_consistency', 'rpwt_report', 'rpwt_monitor'],
    },
    {
      name: 'table_partitioner', migration: '20260622330000_agent_table_partitioner.sql',
      typeFile: 'agent-table-partitioner.ts', skillDir: 'table-partitioner',
      interfaces: ['TablePartitionerConfig', 'PartitionPlan', 'PartitionEvent'],
      bk: 'table_partitioner', eks: ['tbpt.partition_planned', 'tbpt.partition_created', 'tbpt.data_migrated', 'tbpt.old_dropped'],
      subjects: ['sven.tbpt.partition_planned', 'sven.tbpt.partition_created', 'sven.tbpt.data_migrated', 'sven.tbpt.old_dropped'],
      cases: ['tbpt_plan', 'tbpt_create', 'tbpt_migrate', 'tbpt_drop', 'tbpt_report', 'tbpt_monitor'],
    },
    {
      name: 'vacuum_scheduler', migration: '20260622340000_agent_vacuum_scheduler.sql',
      typeFile: 'agent-vacuum-scheduler.ts', skillDir: 'vacuum-scheduler',
      interfaces: ['VacuumSchedulerConfig', 'VacuumJob', 'BloatReport'],
      bk: 'vacuum_scheduler', eks: ['vcsc.vacuum_scheduled', 'vcsc.bloat_detected', 'vcsc.vacuum_completed', 'vcsc.stats_updated'],
      subjects: ['sven.vcsc.vacuum_scheduled', 'sven.vcsc.bloat_detected', 'sven.vcsc.vacuum_completed', 'sven.vcsc.stats_updated'],
      cases: ['vcsc_schedule', 'vcsc_detect', 'vcsc_complete', 'vcsc_update', 'vcsc_report', 'vcsc_monitor'],
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
