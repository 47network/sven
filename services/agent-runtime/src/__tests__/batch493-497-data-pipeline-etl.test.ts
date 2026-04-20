import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 493-497: Data Pipeline & ETL', () => {
  const verticals = [
    {
      name: 'data_deduplicator',
      migration: '20260621300000_agent_data_deduplicator.sql',
      typeFile: 'agent-data-deduplicator.ts',
      skillDir: 'data-deduplicator',
      interfaces: ['DataDeduplicatorConfig', 'DeduplicationResult', 'DuplicateRecord'],
      bk: 'data_deduplicator',
      eks: ['ddpl.duplicates_found', 'ddpl.records_merged', 'ddpl.dedup_completed', 'ddpl.conflict_resolved'],
      subjects: ['sven.ddpl.duplicates_found', 'sven.ddpl.records_merged', 'sven.ddpl.dedup_completed', 'sven.ddpl.conflict_resolved'],
      cases: ['ddpl_find', 'ddpl_merge', 'ddpl_resolve', 'ddpl_deduplicate', 'ddpl_report', 'ddpl_monitor'],
    },
    {
      name: 'stream_joiner',
      migration: '20260621310000_agent_stream_joiner.sql',
      typeFile: 'agent-stream-joiner.ts',
      skillDir: 'stream-joiner',
      interfaces: ['StreamJoinerConfig', 'JoinedStream', 'JoinWindow'],
      bk: 'stream_joiner',
      eks: ['stjo.streams_joined', 'stjo.window_closed', 'stjo.late_arrival', 'stjo.join_completed'],
      subjects: ['sven.stjo.streams_joined', 'sven.stjo.window_closed', 'sven.stjo.late_arrival', 'sven.stjo.join_completed'],
      cases: ['stjo_join', 'stjo_window', 'stjo_late', 'stjo_complete', 'stjo_report', 'stjo_monitor'],
    },
    {
      name: 'batch_scheduler',
      migration: '20260621320000_agent_batch_scheduler.sql',
      typeFile: 'agent-batch-scheduler.ts',
      skillDir: 'batch-scheduler',
      interfaces: ['BatchSchedulerConfig', 'ScheduledBatch', 'BatchExecution'],
      bk: 'batch_scheduler',
      eks: ['btsc.batch_queued', 'btsc.batch_started', 'btsc.batch_completed', 'btsc.batch_failed'],
      subjects: ['sven.btsc.batch_queued', 'sven.btsc.batch_started', 'sven.btsc.batch_completed', 'sven.btsc.batch_failed'],
      cases: ['btsc_queue', 'btsc_start', 'btsc_complete', 'btsc_fail', 'btsc_report', 'btsc_monitor'],
    },
    {
      name: 'partition_manager',
      migration: '20260621330000_agent_partition_manager.sql',
      typeFile: 'agent-partition-manager.ts',
      skillDir: 'partition-manager',
      interfaces: ['PartitionManagerConfig', 'ManagedPartition', 'PartitionSplit'],
      bk: 'partition_manager',
      eks: ['ptmg.partition_created', 'ptmg.partition_split', 'ptmg.partition_merged', 'ptmg.rebalance_completed'],
      subjects: ['sven.ptmg.partition_created', 'sven.ptmg.partition_split', 'sven.ptmg.partition_merged', 'sven.ptmg.rebalance_completed'],
      cases: ['ptmg_create', 'ptmg_split', 'ptmg_merge', 'ptmg_rebalance', 'ptmg_report', 'ptmg_monitor'],
    },
    {
      name: 'watermark_tracker',
      migration: '20260621340000_agent_watermark_tracker.sql',
      typeFile: 'agent-watermark-tracker.ts',
      skillDir: 'watermark-tracker',
      interfaces: ['WatermarkTrackerConfig', 'WatermarkState', 'WatermarkAdvance'],
      bk: 'watermark_tracker',
      eks: ['wmtk.watermark_advanced', 'wmtk.lag_detected', 'wmtk.checkpoint_saved', 'wmtk.recovery_completed'],
      subjects: ['sven.wmtk.watermark_advanced', 'sven.wmtk.lag_detected', 'sven.wmtk.checkpoint_saved', 'sven.wmtk.recovery_completed'],
      cases: ['wmtk_advance', 'wmtk_lag', 'wmtk_checkpoint', 'wmtk_recover', 'wmtk_report', 'wmtk_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(migPath)).toBe(true);
      });
      test('migration has correct table', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(migPath, 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(tf)).toBe(true);
      });
      test('type file exports interfaces', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(tf, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`from './${modName}'`);
      });
      test('SKILL.md exists', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(sp)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(sp, 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
