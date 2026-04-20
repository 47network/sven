import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 788-792: Event Routing & Replay', () => {
  const verticals = [
    {
      name: 'kafka_event_replayer', migration: '20260624250000_agent_kafka_event_replayer.sql',
      typeFile: 'agent-kafka-event-replayer.ts', skillDir: 'kafka-event-replayer',
      interfaces: ['KafkaEventReplayerConfig', 'ReplayJob', 'ReplayerEvent'],
      bk: 'kafka_event_replayer', eks: ['kerp.replay_planned', 'kerp.offset_seeked', 'kerp.events_replayed', 'kerp.completion_verified'],
      subjects: ['sven.kerp.replay_planned', 'sven.kerp.offset_seeked', 'sven.kerp.events_replayed', 'sven.kerp.completion_verified'],
      cases: ['kerp_plan', 'kerp_seek', 'kerp_replay', 'kerp_verify', 'kerp_report', 'kerp_monitor'],
    },
    {
      name: 'dead_letter_processor', migration: '20260624260000_agent_dead_letter_processor.sql',
      typeFile: 'agent-dead-letter-processor.ts', skillDir: 'dead-letter-processor',
      interfaces: ['DeadLetterProcessorConfig', 'DeadLetterEntry', 'ProcessorEvent'],
      bk: 'dead_letter_processor', eks: ['dlpr.entry_received', 'dlpr.cause_analyzed', 'dlpr.retry_scheduled', 'dlpr.archive_written'],
      subjects: ['sven.dlpr.entry_received', 'sven.dlpr.cause_analyzed', 'sven.dlpr.retry_scheduled', 'sven.dlpr.archive_written'],
      cases: ['dlpr_receive', 'dlpr_analyze', 'dlpr_schedule', 'dlpr_write', 'dlpr_report', 'dlpr_monitor'],
    },
    {
      name: 'message_router', migration: '20260624270000_agent_message_router.sql',
      typeFile: 'agent-message-router.ts', skillDir: 'message-router',
      interfaces: ['MessageRouterConfig', 'RoutingRule', 'RouterEvent'],
      bk: 'message_router', eks: ['msgr.message_received', 'msgr.rule_matched', 'msgr.destination_selected', 'msgr.delivery_confirmed'],
      subjects: ['sven.msgr.message_received', 'sven.msgr.rule_matched', 'sven.msgr.destination_selected', 'sven.msgr.delivery_confirmed'],
      cases: ['msgr_receive', 'msgr_match', 'msgr_select', 'msgr_confirm', 'msgr_report', 'msgr_monitor'],
    },
    {
      name: 'protocol_translator', migration: '20260624280000_agent_protocol_translator.sql',
      typeFile: 'agent-protocol-translator.ts', skillDir: 'protocol-translator',
      interfaces: ['ProtocolTranslatorConfig', 'TranslationJob', 'TranslatorEvent'],
      bk: 'protocol_translator', eks: ['ptrl.input_parsed', 'ptrl.protocol_mapped', 'ptrl.payload_emitted', 'ptrl.error_handled'],
      subjects: ['sven.ptrl.input_parsed', 'sven.ptrl.protocol_mapped', 'sven.ptrl.payload_emitted', 'sven.ptrl.error_handled'],
      cases: ['ptrl_parse', 'ptrl_map', 'ptrl_emit', 'ptrl_handle', 'ptrl_report', 'ptrl_monitor'],
    },
    {
      name: 'kafka_topic_partitioner', migration: '20260624290000_agent_kafka_topic_partitioner.sql',
      typeFile: 'agent-kafka-topic-partitioner.ts', skillDir: 'kafka-topic-partitioner',
      interfaces: ['KafkaTopicPartitionerConfig', 'PartitionAssignment', 'PartitionerEvent'],
      bk: 'kafka_topic_partitioner', eks: ['ktpa.key_hashed', 'ktpa.partition_assigned', 'ktpa.skew_detected', 'ktpa.rebalance_triggered'],
      subjects: ['sven.ktpa.key_hashed', 'sven.ktpa.partition_assigned', 'sven.ktpa.skew_detected', 'sven.ktpa.rebalance_triggered'],
      cases: ['ktpa_hash', 'ktpa_assign', 'ktpa_detect', 'ktpa_trigger', 'ktpa_report', 'ktpa_monitor'],
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
