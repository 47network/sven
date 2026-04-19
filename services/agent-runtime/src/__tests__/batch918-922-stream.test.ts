import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 918-922: Stream Processing', () => {
  const verticals = [
    {
      name: 'stream_partition_assigner', migration: '20260625550000_agent_stream_partition_assigner.sql',
      typeFile: 'agent-stream-partition-assigner.ts', skillDir: 'stream-partition-assigner',
      interfaces: ['StreamPartitionAssignerConfig', 'AssignmentRound', 'AssignerEvent'],
      bk: 'stream_partition_assigner', eks: ['sppa.round_started', 'sppa.consumers_inventoried', 'sppa.assignments_computed', 'sppa.assignments_committed'],
      subjects: ['sven.sppa.round_started', 'sven.sppa.consumers_inventoried', 'sven.sppa.assignments_computed', 'sven.sppa.assignments_committed'],
      cases: ['sppa_start', 'sppa_inventory', 'sppa_compute', 'sppa_commit', 'sppa_report', 'sppa_monitor'],
    },
    {
      name: 'stream_offset_committer', migration: '20260625560000_agent_stream_offset_committer.sql',
      typeFile: 'agent-stream-offset-committer.ts', skillDir: 'stream-offset-committer',
      interfaces: ['StreamOffsetCommitterConfig', 'OffsetCommit', 'CommitterEvent'],
      bk: 'stream_offset_committer', eks: ['sofc.commit_received', 'sofc.lag_validated', 'sofc.offset_persisted', 'sofc.ack_returned'],
      subjects: ['sven.sofc.commit_received', 'sven.sofc.lag_validated', 'sven.sofc.offset_persisted', 'sven.sofc.ack_returned'],
      cases: ['sofc_receive', 'sofc_validate', 'sofc_persist', 'sofc_ack', 'sofc_report', 'sofc_monitor'],
    },
    {
      name: 'stream_compactor', migration: '20260625570000_agent_stream_compactor.sql',
      typeFile: 'agent-stream-compactor.ts', skillDir: 'stream-compactor',
      interfaces: ['StreamCompactorConfig', 'CompactionJob', 'CompactorEvent'],
      bk: 'stream_compactor', eks: ['stcm.job_received', 'stcm.segments_scanned', 'stcm.tombstones_collapsed', 'stcm.compacted_persisted'],
      subjects: ['sven.stcm.job_received', 'sven.stcm.segments_scanned', 'sven.stcm.tombstones_collapsed', 'sven.stcm.compacted_persisted'],
      cases: ['stcm_receive', 'stcm_scan', 'stcm_collapse', 'stcm_persist', 'stcm_report', 'stcm_monitor'],
    },
    {
      name: 'stream_consumer_lag_monitor', migration: '20260625580000_agent_stream_consumer_lag_monitor.sql',
      typeFile: 'agent-stream-consumer-lag-monitor.ts', skillDir: 'stream-consumer-lag-monitor',
      interfaces: ['StreamConsumerLagMonitorConfig', 'LagSnapshot', 'MonitorEvent'],
      bk: 'stream_consumer_lag_monitor', eks: ['sclm.snapshot_taken', 'sclm.lag_computed', 'sclm.thresholds_evaluated', 'sclm.alerts_emitted'],
      subjects: ['sven.sclm.snapshot_taken', 'sven.sclm.lag_computed', 'sven.sclm.thresholds_evaluated', 'sven.sclm.alerts_emitted'],
      cases: ['sclm_take', 'sclm_compute', 'sclm_evaluate', 'sclm_emit', 'sclm_report', 'sclm_monitor'],
    },
    {
      name: 'stream_replay_coordinator', migration: '20260625590000_agent_stream_replay_coordinator.sql',
      typeFile: 'agent-stream-replay-coordinator.ts', skillDir: 'stream-replay-coordinator',
      interfaces: ['StreamReplayCoordinatorConfig', 'ReplayPlan', 'CoordinatorEvent'],
      bk: 'stream_replay_coordinator', eks: ['srpc.plan_received', 'srpc.range_validated', 'srpc.replay_executed', 'srpc.outcome_recorded'],
      subjects: ['sven.srpc.plan_received', 'sven.srpc.range_validated', 'sven.srpc.replay_executed', 'sven.srpc.outcome_recorded'],
      cases: ['srpc_receive', 'srpc_validate', 'srpc_execute', 'srpc_record', 'srpc_report', 'srpc_monitor'],
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
