import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 303-307 — Message Queue & Streaming', () => {
  // ── Migrations ──
  const migrationFiles = [
    '20260619400000_agent_msg_relay.sql',
    '20260619410000_agent_stream_ingester.sql',
    '20260619420000_agent_event_router.sql',
    '20260619430000_agent_queue_manager.sql',
    '20260619440000_agent_pubsub_gateway.sql',
  ];
  describe('Migration files', () => {
    migrationFiles.forEach((file) => {
      it(`should have migration ${file}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', file);
        expect(fs.existsSync(p)).toBe(true);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE TABLE');
        expect(sql.length).toBeGreaterThan(200);
      });
    });
  });

  // ── Shared types ──
  const typeFiles = [
    'agent-msg-relay',
    'agent-stream-ingester',
    'agent-event-router',
    'agent-queue-manager',
    'agent-pubsub-gateway',
  ];
  describe('Shared type files', () => {
    typeFiles.forEach((file) => {
      it(`should have type file ${file}.ts`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${file}.ts`);
        expect(fs.existsSync(p)).toBe(true);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('export');
        expect(content).toContain('interface');
      });
    });
  });

  describe('Barrel exports', () => {
    it('should export all 5 type modules from index.ts', () => {
      const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
      typeFiles.forEach((file) => {
        expect(idx).toContain(file);
      });
    });
  });

  // ── SKILL.md ──
  const skills = ['msg-relay', 'stream-ingester', 'event-router', 'queue-manager', 'pubsub-gateway'];
  describe('SKILL.md files', () => {
    skills.forEach((skill) => {
      it(`should have SKILL.md for ${skill}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', skill, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
        expect(content).toContain('price');
      });
    });
  });

  // ── Eidolon types ──
  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['msg_relay', 'stream_ingester', 'event_router', 'queue_manager', 'pubsub_gateway'];
    bks.forEach((bk) => {
      it(`should include BK '${bk}'`, () => {
        expect(types).toContain(`'${bk}'`);
      });
    });
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eks = [
      'mrel.channel_created', 'mrel.message_relayed', 'mrel.dlq_processed', 'mrel.batch_flushed',
      'sing.partition_assigned', 'sing.checkpoint_saved', 'sing.lag_detected', 'sing.rebalanced',
      'ertr.rule_created', 'ertr.event_routed', 'ertr.fanout_completed', 'ertr.dead_lettered',
      'qmgr.queue_created', 'qmgr.message_dequeued', 'qmgr.depth_exceeded', 'qmgr.metrics_recorded',
      'psgw.topic_created', 'psgw.subscription_added', 'psgw.message_published', 'psgw.ack_timeout',
    ];
    eks.forEach((ek) => {
      it(`should include EK '${ek}'`, () => {
        expect(types).toContain(`'${ek}'`);
      });
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    ['msg_relay', 'stream_ingester', 'event_router', 'queue_manager', 'pubsub_gateway'].forEach((bk) => {
      it(`should have districtFor case for '${bk}'`, () => {
        expect(types).toContain(`case '${bk}':`);
      });
    });
  });

  // ── SUBJECT_MAP ──
  describe('SUBJECT_MAP entries', () => {
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.mrel.channel_created', 'sven.mrel.message_relayed', 'sven.mrel.dlq_processed', 'sven.mrel.batch_flushed',
      'sven.sing.partition_assigned', 'sven.sing.checkpoint_saved', 'sven.sing.lag_detected', 'sven.sing.rebalanced',
      'sven.ertr.rule_created', 'sven.ertr.event_routed', 'sven.ertr.fanout_completed', 'sven.ertr.dead_lettered',
      'sven.qmgr.queue_created', 'sven.qmgr.message_dequeued', 'sven.qmgr.depth_exceeded', 'sven.qmgr.metrics_recorded',
      'sven.psgw.topic_created', 'sven.psgw.subscription_added', 'sven.psgw.message_published', 'sven.psgw.ack_timeout',
    ];
    subjects.forEach((subj) => {
      it(`should have SUBJECT_MAP entry '${subj}'`, () => {
        expect(eventBus).toContain(`'${subj}'`);
      });
    });
  });

  // ── Task executor ──
  describe('Task executor switch cases', () => {
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'mrel_create_channel', 'mrel_relay_message', 'mrel_process_dlq', 'mrel_flush_batch', 'mrel_list_channels', 'mrel_export_config',
      'sing_assign_partition', 'sing_save_checkpoint', 'sing_detect_lag', 'sing_rebalance', 'sing_list_partitions', 'sing_export_config',
      'ertr_create_rule', 'ertr_route_event', 'ertr_fanout', 'ertr_dead_letter', 'ertr_list_rules', 'ertr_export_config',
      'qmgr_create_queue', 'qmgr_dequeue_message', 'qmgr_check_depth', 'qmgr_record_metrics', 'qmgr_list_queues', 'qmgr_export_config',
      'psgw_create_topic', 'psgw_add_subscription', 'psgw_publish_message', 'psgw_handle_ack_timeout', 'psgw_list_topics', 'psgw_export_config',
    ];
    cases.forEach((c) => {
      it(`should have switch case '${c}'`, () => {
        expect(executor).toContain(`case '${c}'`);
      });
    });
  });

  describe('Task executor handler methods', () => {
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleMrelCreateChannel', 'handleMrelRelayMessage', 'handleMrelProcessDlq', 'handleMrelFlushBatch', 'handleMrelListChannels', 'handleMrelExportConfig',
      'handleSingAssignPartition', 'handleSingSaveCheckpoint', 'handleSingDetectLag', 'handleSingRebalance', 'handleSingListPartitions', 'handleSingExportConfig',
      'handleErtrCreateRule', 'handleErtrRouteEvent', 'handleErtrFanout', 'handleErtrDeadLetter', 'handleErtrListRules', 'handleErtrExportConfig',
      'handleQmgrCreateQueue', 'handleQmgrDequeueMessage', 'handleQmgrCheckDepth', 'handleQmgrRecordMetrics', 'handleQmgrListQueues', 'handleQmgrExportConfig',
      'handlePsgwCreateTopic', 'handlePsgwAddSubscription', 'handlePsgwPublishMessage', 'handlePsgwHandleAckTimeout', 'handlePsgwListTopics', 'handlePsgwExportConfig',
    ];
    handlers.forEach((h) => {
      it(`should have handler method ${h}`, () => {
        expect(executor).toContain(`${h}(task`);
      });
    });
  });

  // ── .gitattributes ──
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const entries = [
      'agent_msg_relay.sql', 'agent_stream_ingester.sql', 'agent_event_router.sql',
      'agent_queue_manager.sql', 'agent_pubsub_gateway.sql',
      'agent-msg-relay.ts', 'agent-stream-ingester.ts', 'agent-event-router.ts',
      'agent-queue-manager.ts', 'agent-pubsub-gateway.ts',
      'msg-relay/**', 'stream-ingester/**', 'event-router/**',
      'queue-manager/**', 'pubsub-gateway/**',
    ];
    entries.forEach((entry) => {
      it(`should have .gitattributes entry for ${entry}`, () => {
        expect(ga).toContain(entry);
      });
    });
  });
});
