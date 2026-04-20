import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 683-687: Message Queue Operations', () => {
  const verticals = [
    {
      name: 'queue_drainer', migration: '20260623200000_agent_queue_drainer.sql',
      typeFile: 'agent-queue-drainer.ts', skillDir: 'queue-drainer',
      interfaces: ['QueueDrainerConfig', 'DrainTask', 'DrainerEvent'],
      bk: 'queue_drainer', eks: ['qudr.drain_started', 'qudr.batch_processed', 'qudr.queue_emptied', 'qudr.backpressure_applied'],
      subjects: ['sven.qudr.drain_started', 'sven.qudr.batch_processed', 'sven.qudr.queue_emptied', 'sven.qudr.backpressure_applied'],
      cases: ['qudr_drain', 'qudr_batch', 'qudr_empty', 'qudr_backpressure', 'qudr_report', 'qudr_monitor'],
    },
    {
      name: 'message_dedupe', migration: '20260623210000_agent_message_dedupe.sql',
      typeFile: 'agent-message-dedupe.ts', skillDir: 'message-dedupe',
      interfaces: ['MessageDedupeConfig', 'DedupeWindow', 'DedupeEvent'],
      bk: 'message_dedupe', eks: ['mdpd.duplicate_detected', 'mdpd.window_rotated', 'mdpd.cache_evicted', 'mdpd.bloom_rebuilt'],
      subjects: ['sven.mdpd.duplicate_detected', 'sven.mdpd.window_rotated', 'sven.mdpd.cache_evicted', 'sven.mdpd.bloom_rebuilt'],
      cases: ['mdpd_detect', 'mdpd_rotate', 'mdpd_evict', 'mdpd_rebuild', 'mdpd_report', 'mdpd_monitor'],
    },
    {
      name: 'dlq_replayer', migration: '20260623220000_agent_dlq_replayer.sql',
      typeFile: 'agent-dlq-replayer.ts', skillDir: 'dlq-replayer',
      interfaces: ['DlqReplayerConfig', 'ReplayBatch', 'ReplayerEvent'],
      bk: 'dlq_replayer', eks: ['dlqr.replay_initiated', 'dlqr.message_redelivered', 'dlqr.poison_isolated', 'dlqr.replay_completed'],
      subjects: ['sven.dlqr.replay_initiated', 'sven.dlqr.message_redelivered', 'sven.dlqr.poison_isolated', 'sven.dlqr.replay_completed'],
      cases: ['dlqr_initiate', 'dlqr_redeliver', 'dlqr_isolate', 'dlqr_complete', 'dlqr_report', 'dlqr_monitor'],
    },
    {
      name: 'broker_balancer', migration: '20260623230000_agent_broker_balancer.sql',
      typeFile: 'agent-broker-balancer.ts', skillDir: 'broker-balancer',
      interfaces: ['BrokerBalancerConfig', 'BrokerLoad', 'BalancerEvent'],
      bk: 'broker_balancer', eks: ['brbl.load_measured', 'brbl.partition_reassigned', 'brbl.broker_added', 'brbl.rebalance_completed'],
      subjects: ['sven.brbl.load_measured', 'sven.brbl.partition_reassigned', 'sven.brbl.broker_added', 'sven.brbl.rebalance_completed'],
      cases: ['brbl_measure', 'brbl_reassign', 'brbl_add', 'brbl_rebalance', 'brbl_report', 'brbl_monitor'],
    },
    {
      name: 'topic_partitioner', migration: '20260623240000_agent_topic_partitioner.sql',
      typeFile: 'agent-topic-partitioner.ts', skillDir: 'topic-partitioner',
      interfaces: ['TopicPartitionerConfig', 'PartitionStrategy', 'PartitionerEvent'],
      bk: 'topic_partitioner', eks: ['tppt.partition_created', 'tppt.key_routed', 'tppt.skew_detected', 'tppt.split_triggered'],
      subjects: ['sven.tppt.partition_created', 'sven.tppt.key_routed', 'sven.tppt.skew_detected', 'sven.tppt.split_triggered'],
      cases: ['tppt_create', 'tppt_route', 'tppt_skew', 'tppt_split', 'tppt_report', 'tppt_monitor'],
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
