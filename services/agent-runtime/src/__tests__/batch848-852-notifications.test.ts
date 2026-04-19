import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 848-852: Notification Orchestration', () => {
  const verticals = [
    {
      name: 'notification_preference_engine', migration: '20260624850000_agent_notification_preference_engine.sql',
      typeFile: 'agent-notification-preference-engine.ts', skillDir: 'notification-preference-engine',
      interfaces: ['NotificationPreferenceEngineConfig', 'PreferenceQuery', 'EngineEvent'],
      bk: 'notification_preference_engine', eks: ['nfpe.query_received', 'nfpe.preferences_loaded', 'nfpe.channels_filtered', 'nfpe.decision_returned'],
      subjects: ['sven.nfpe.query_received', 'sven.nfpe.preferences_loaded', 'sven.nfpe.channels_filtered', 'sven.nfpe.decision_returned'],
      cases: ['nfpe_receive', 'nfpe_load', 'nfpe_filter', 'nfpe_return', 'nfpe_report', 'nfpe_monitor'],
    },
    {
      name: 'push_token_registry', migration: '20260624860000_agent_push_token_registry.sql',
      typeFile: 'agent-push-token-registry.ts', skillDir: 'push-token-registry',
      interfaces: ['PushTokenRegistryConfig', 'PushToken', 'RegistryEvent'],
      bk: 'push_token_registry', eks: ['ptkr.registration_received', 'ptkr.token_validated', 'ptkr.entry_persisted', 'ptkr.stale_pruned'],
      subjects: ['sven.ptkr.registration_received', 'sven.ptkr.token_validated', 'sven.ptkr.entry_persisted', 'sven.ptkr.stale_pruned'],
      cases: ['ptkr_receive', 'ptkr_validate', 'ptkr_persist', 'ptkr_prune', 'ptkr_report', 'ptkr_monitor'],
    },
    {
      name: 'inapp_notification_router', migration: '20260624870000_agent_inapp_notification_router.sql',
      typeFile: 'agent-inapp-notification-router.ts', skillDir: 'inapp-notification-router',
      interfaces: ['InappNotificationRouterConfig', 'InappNotification', 'RouterEvent'],
      bk: 'inapp_notification_router', eks: ['ianr.notification_received', 'ianr.recipient_resolved', 'ianr.delivery_pushed', 'ianr.read_recorded'],
      subjects: ['sven.ianr.notification_received', 'sven.ianr.recipient_resolved', 'sven.ianr.delivery_pushed', 'sven.ianr.read_recorded'],
      cases: ['ianr_receive', 'ianr_resolve', 'ianr_push', 'ianr_record', 'ianr_report', 'ianr_monitor'],
    },
    {
      name: 'digest_summarizer', migration: '20260624880000_agent_digest_summarizer.sql',
      typeFile: 'agent-digest-summarizer.ts', skillDir: 'digest-summarizer',
      interfaces: ['DigestSummarizerConfig', 'DigestJob', 'SummarizerEvent'],
      bk: 'digest_summarizer', eks: ['dgsm.job_received', 'dgsm.events_aggregated', 'dgsm.summary_composed', 'dgsm.digest_emitted'],
      subjects: ['sven.dgsm.job_received', 'sven.dgsm.events_aggregated', 'sven.dgsm.summary_composed', 'sven.dgsm.digest_emitted'],
      cases: ['dgsm_receive', 'dgsm_aggregate', 'dgsm_compose', 'dgsm_emit', 'dgsm_report', 'dgsm_monitor'],
    },
    {
      name: 'notification_throttler', migration: '20260624890000_agent_notification_throttler.sql',
      typeFile: 'agent-notification-throttler.ts', skillDir: 'notification-throttler',
      interfaces: ['NotificationThrottlerConfig', 'ThrottleDecision', 'ThrottlerEvent'],
      bk: 'notification_throttler', eks: ['nfth.request_received', 'nfth.window_evaluated', 'nfth.decision_made', 'nfth.action_recorded'],
      subjects: ['sven.nfth.request_received', 'sven.nfth.window_evaluated', 'sven.nfth.decision_made', 'sven.nfth.action_recorded'],
      cases: ['nfth_receive', 'nfth_evaluate', 'nfth_decide', 'nfth_record', 'nfth_report', 'nfth_monitor'],
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
