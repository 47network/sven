import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1018-1022: Trust & Safety', () => {
  const verticals = [
    {
      name: 'trust_safety_signal_collector', migration: '20260626550000_agent_trust_safety_signal_collector.sql',
      typeFile: 'agent-trust-safety-signal-collector.ts', skillDir: 'trust-safety-signal-collector',
      interfaces: ['TrustSafetySignalCollectorConfig', 'SignalEvent', 'CollectorEvent'],
      bk: 'trust_safety_signal_collector', eks: ['tssc.event_received', 'tssc.fields_validated', 'tssc.signal_persisted', 'tssc.audit_recorded'],
      subjects: ['sven.tssc.event_received', 'sven.tssc.fields_validated', 'sven.tssc.signal_persisted', 'sven.tssc.audit_recorded'],
      cases: ['tssc_receive', 'tssc_validate', 'tssc_persist', 'tssc_audit', 'tssc_report', 'tssc_monitor'],
    },
    {
      name: 'trust_safety_score_aggregator', migration: '20260626560000_agent_trust_safety_score_aggregator.sql',
      typeFile: 'agent-trust-safety-score-aggregator.ts', skillDir: 'trust-safety-score-aggregator',
      interfaces: ['TrustSafetyScoreAggregatorConfig', 'ScoreBatch', 'AggregatorEvent'],
      bk: 'trust_safety_score_aggregator', eks: ['tssa.batch_received', 'tssa.scores_aggregated', 'tssa.summary_persisted', 'tssa.audit_recorded'],
      subjects: ['sven.tssa.batch_received', 'sven.tssa.scores_aggregated', 'sven.tssa.summary_persisted', 'sven.tssa.audit_recorded'],
      cases: ['tssa_receive', 'tssa_aggregate', 'tssa_persist', 'tssa_audit', 'tssa_report', 'tssa_monitor'],
    },
    {
      name: 'trust_safety_action_dispatcher', migration: '20260626570000_agent_trust_safety_action_dispatcher.sql',
      typeFile: 'agent-trust-safety-action-dispatcher.ts', skillDir: 'trust-safety-action-dispatcher',
      interfaces: ['TrustSafetyActionDispatcherConfig', 'ActionRequest', 'DispatcherEvent'],
      bk: 'trust_safety_action_dispatcher', eks: ['tsad.request_received', 'tsad.policy_evaluated', 'tsad.action_dispatched', 'tsad.audit_recorded'],
      subjects: ['sven.tsad.request_received', 'sven.tsad.policy_evaluated', 'sven.tsad.action_dispatched', 'sven.tsad.audit_recorded'],
      cases: ['tsad_receive', 'tsad_evaluate', 'tsad_dispatch', 'tsad_audit', 'tsad_report', 'tsad_monitor'],
    },
    {
      name: 'trust_safety_review_queue_writer', migration: '20260626580000_agent_trust_safety_review_queue_writer.sql',
      typeFile: 'agent-trust-safety-review-queue-writer.ts', skillDir: 'trust-safety-review-queue-writer',
      interfaces: ['TrustSafetyReviewQueueWriterConfig', 'ReviewItem', 'WriterEvent'],
      bk: 'trust_safety_review_queue_writer', eks: ['tsrq.item_received', 'tsrq.fields_validated', 'tsrq.item_persisted', 'tsrq.audit_recorded'],
      subjects: ['sven.tsrq.item_received', 'sven.tsrq.fields_validated', 'sven.tsrq.item_persisted', 'sven.tsrq.audit_recorded'],
      cases: ['tsrq_receive', 'tsrq_validate', 'tsrq_persist', 'tsrq_audit', 'tsrq_report', 'tsrq_monitor'],
    },
    {
      name: 'trust_safety_audit_logger', migration: '20260626590000_agent_trust_safety_audit_logger.sql',
      typeFile: 'agent-trust-safety-audit-logger.ts', skillDir: 'trust-safety-audit-logger',
      interfaces: ['TrustSafetyAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'trust_safety_audit_logger', eks: ['tsau.record_received', 'tsau.fields_validated', 'tsau.record_persisted', 'tsau.export_emitted'],
      subjects: ['sven.tsau.record_received', 'sven.tsau.fields_validated', 'sven.tsau.record_persisted', 'sven.tsau.export_emitted'],
      cases: ['tsau_receive', 'tsau_validate', 'tsau_persist', 'tsau_emit', 'tsau_report', 'tsau_monitor'],
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
