import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 603-607: Event Messaging', () => {
  const verticals = [
    {
      name: 'webhook_dispatcher', migration: '20260622400000_agent_webhook_dispatcher.sql',
      typeFile: 'agent-webhook-dispatcher.ts', skillDir: 'webhook-dispatcher',
      interfaces: ['WebhookDispatcherConfig', 'WebhookDelivery', 'RetryPolicy'],
      bk: 'webhook_dispatcher', eks: ['whkd.webhook_dispatched', 'whkd.delivery_confirmed', 'whkd.delivery_failed', 'whkd.retry_scheduled'],
      subjects: ['sven.whkd.webhook_dispatched', 'sven.whkd.delivery_confirmed', 'sven.whkd.delivery_failed', 'sven.whkd.retry_scheduled'],
      cases: ['whkd_dispatch', 'whkd_confirm', 'whkd_fail', 'whkd_retry', 'whkd_report', 'whkd_monitor'],
    },
    {
      name: 'stream_replayer', migration: '20260622410000_agent_stream_replayer.sql',
      typeFile: 'agent-stream-replayer.ts', skillDir: 'stream-replayer',
      interfaces: ['StreamReplayerConfig', 'ReplaySession', 'ReplayEvent'],
      bk: 'stream_replayer', eks: ['strp.replay_started', 'strp.events_replayed', 'strp.replay_completed', 'strp.divergence_detected'],
      subjects: ['sven.strp.replay_started', 'sven.strp.events_replayed', 'sven.strp.replay_completed', 'sven.strp.divergence_detected'],
      cases: ['strp_replay', 'strp_events', 'strp_complete', 'strp_diverge', 'strp_report', 'strp_monitor'],
    },
    {
      name: 'dlq_processor', migration: '20260622420000_agent_dlq_processor.sql',
      typeFile: 'agent-dlq-processor.ts', skillDir: 'dlq-processor',
      interfaces: ['DlqProcessorConfig', 'DeadLetter', 'ReprocessResult'],
      bk: 'dlq_processor', eks: ['dlqp.letter_received', 'dlqp.reprocess_attempted', 'dlqp.reprocess_succeeded', 'dlqp.permanently_failed'],
      subjects: ['sven.dlqp.letter_received', 'sven.dlqp.reprocess_attempted', 'sven.dlqp.reprocess_succeeded', 'sven.dlqp.permanently_failed'],
      cases: ['dlqp_receive', 'dlqp_reprocess', 'dlqp_succeed', 'dlqp_fail', 'dlqp_report', 'dlqp_monitor'],
    },
    {
      name: 'message_deduplicator', migration: '20260622430000_agent_message_deduplicator.sql',
      typeFile: 'agent-message-deduplicator.ts', skillDir: 'message-deduplicator',
      interfaces: ['MessageDeduplicatorConfig', 'DuplicateCheck', 'DedupeStats'],
      bk: 'message_deduplicator', eks: ['msgd.duplicate_detected', 'msgd.message_passed', 'msgd.window_expired', 'msgd.stats_updated'],
      subjects: ['sven.msgd.duplicate_detected', 'sven.msgd.message_passed', 'sven.msgd.window_expired', 'sven.msgd.stats_updated'],
      cases: ['msgd_detect', 'msgd_pass', 'msgd_expire', 'msgd_update', 'msgd_report', 'msgd_monitor'],
    },
    {
      name: 'topic_router', migration: '20260622440000_agent_topic_router.sql',
      typeFile: 'agent-topic-router.ts', skillDir: 'topic-router',
      interfaces: ['TopicRouterConfig', 'RoutingRule', 'RouteDecision'],
      bk: 'topic_router', eks: ['tprt.message_routed', 'tprt.rule_matched', 'tprt.fallback_used', 'tprt.route_updated'],
      subjects: ['sven.tprt.message_routed', 'sven.tprt.rule_matched', 'sven.tprt.fallback_used', 'sven.tprt.route_updated'],
      cases: ['tprt_route', 'tprt_match', 'tprt_fallback', 'tprt_update', 'tprt_report', 'tprt_monitor'],
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
