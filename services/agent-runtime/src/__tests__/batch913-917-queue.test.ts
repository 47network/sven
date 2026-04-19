import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 913-917: Message Queue Operations', () => {
  const verticals = [
    {
      name: 'queue_message_publisher', migration: '20260625500000_agent_queue_message_publisher.sql',
      typeFile: 'agent-queue-message-publisher.ts', skillDir: 'queue-message-publisher',
      interfaces: ['QueueMessagePublisherConfig', 'MessageEnvelope', 'PublisherEvent'],
      bk: 'queue_message_publisher', eks: ['qmpb.message_received', 'qmpb.envelope_validated', 'qmpb.message_published', 'qmpb.ack_recorded'],
      subjects: ['sven.qmpb.message_received', 'sven.qmpb.envelope_validated', 'sven.qmpb.message_published', 'sven.qmpb.ack_recorded'],
      cases: ['qmpb_receive', 'qmpb_validate', 'qmpb_publish', 'qmpb_ack', 'qmpb_report', 'qmpb_monitor'],
    },
    {
      name: 'queue_message_consumer', migration: '20260625510000_agent_queue_message_consumer.sql',
      typeFile: 'agent-queue-message-consumer.ts', skillDir: 'queue-message-consumer',
      interfaces: ['QueueMessageConsumerConfig', 'ConsumerLease', 'ConsumerEvent'],
      bk: 'queue_message_consumer', eks: ['qmcs.lease_acquired', 'qmcs.message_processed', 'qmcs.outcome_recorded', 'qmcs.lease_released'],
      subjects: ['sven.qmcs.lease_acquired', 'sven.qmcs.message_processed', 'sven.qmcs.outcome_recorded', 'sven.qmcs.lease_released'],
      cases: ['qmcs_acquire', 'qmcs_process', 'qmcs_record', 'qmcs_release', 'qmcs_report', 'qmcs_monitor'],
    },
    {
      name: 'queue_dead_letter_router', migration: '20260625520000_agent_queue_dead_letter_router.sql',
      typeFile: 'agent-queue-dead-letter-router.ts', skillDir: 'queue-dead-letter-router',
      interfaces: ['QueueDeadLetterRouterConfig', 'DeadLetterEnvelope', 'RouterEvent'],
      bk: 'queue_dead_letter_router', eks: ['qdlr.failure_observed', 'qdlr.policy_evaluated', 'qdlr.message_routed', 'qdlr.audit_recorded'],
      subjects: ['sven.qdlr.failure_observed', 'sven.qdlr.policy_evaluated', 'sven.qdlr.message_routed', 'sven.qdlr.audit_recorded'],
      cases: ['qdlr_observe', 'qdlr_evaluate', 'qdlr_route', 'qdlr_audit', 'qdlr_report', 'qdlr_monitor'],
    },
    {
      name: 'queue_visibility_manager', migration: '20260625530000_agent_queue_visibility_manager.sql',
      typeFile: 'agent-queue-visibility-manager.ts', skillDir: 'queue-visibility-manager',
      interfaces: ['QueueVisibilityManagerConfig', 'VisibilityRequest', 'ManagerEvent'],
      bk: 'queue_visibility_manager', eks: ['qvmg.request_received', 'qvmg.timeout_evaluated', 'qvmg.visibility_extended', 'qvmg.outcome_recorded'],
      subjects: ['sven.qvmg.request_received', 'sven.qvmg.timeout_evaluated', 'sven.qvmg.visibility_extended', 'sven.qvmg.outcome_recorded'],
      cases: ['qvmg_receive', 'qvmg_evaluate', 'qvmg_extend', 'qvmg_record', 'qvmg_report', 'qvmg_monitor'],
    },
    {
      name: 'queue_throughput_scaler', migration: '20260625540000_agent_queue_throughput_scaler.sql',
      typeFile: 'agent-queue-throughput-scaler.ts', skillDir: 'queue-throughput-scaler',
      interfaces: ['QueueThroughputScalerConfig', 'ThroughputSignal', 'ScalerEvent'],
      bk: 'queue_throughput_scaler', eks: ['qtps.signal_received', 'qtps.policy_evaluated', 'qtps.consumers_scaled', 'qtps.outcome_recorded'],
      subjects: ['sven.qtps.signal_received', 'sven.qtps.policy_evaluated', 'sven.qtps.consumers_scaled', 'sven.qtps.outcome_recorded'],
      cases: ['qtps_receive', 'qtps_evaluate', 'qtps_scale', 'qtps_record', 'qtps_report', 'qtps_monitor'],
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
