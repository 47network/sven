import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 753-757: Notifications & Delivery', () => {
  const verticals = [
    {
      name: 'email_campaign_dispatcher', migration: '20260623900000_agent_email_campaign_dispatcher.sql',
      typeFile: 'agent-email-campaign-dispatcher.ts', skillDir: 'email-campaign-dispatcher',
      interfaces: ['EmailCampaignDispatcherConfig', 'Campaign', 'DispatcherEvent'],
      bk: 'email_campaign_dispatcher', eks: ['emcd.campaign_scheduled', 'emcd.message_sent', 'emcd.bounce_handled', 'emcd.unsubscribe_processed'],
      subjects: ['sven.emcd.campaign_scheduled', 'sven.emcd.message_sent', 'sven.emcd.bounce_handled', 'sven.emcd.unsubscribe_processed'],
      cases: ['emcd_schedule', 'emcd_send', 'emcd_handle', 'emcd_process', 'emcd_report', 'emcd_monitor'],
    },
    {
      name: 'sms_blast_engine', migration: '20260623910000_agent_sms_blast_engine.sql',
      typeFile: 'agent-sms-blast-engine.ts', skillDir: 'sms-blast-engine',
      interfaces: ['SmsBlastEngineConfig', 'SmsBlast', 'EngineEvent'],
      bk: 'sms_blast_engine', eks: ['smsb.blast_queued', 'smsb.message_delivered', 'smsb.opt_out_recorded', 'smsb.deliverability_tracked'],
      subjects: ['sven.smsb.blast_queued', 'sven.smsb.message_delivered', 'sven.smsb.opt_out_recorded', 'sven.smsb.deliverability_tracked'],
      cases: ['smsb_queue', 'smsb_deliver', 'smsb_record', 'smsb_track', 'smsb_report', 'smsb_monitor'],
    },
    {
      name: 'push_notification_router', migration: '20260623920000_agent_push_notification_router.sql',
      typeFile: 'agent-push-notification-router.ts', skillDir: 'push-notification-router',
      interfaces: ['PushNotificationRouterConfig', 'PushMessage', 'RouterEvent'],
      bk: 'push_notification_router', eks: ['pnrt.message_routed', 'pnrt.token_validated', 'pnrt.delivery_confirmed', 'pnrt.silent_dispatched'],
      subjects: ['sven.pnrt.message_routed', 'sven.pnrt.token_validated', 'sven.pnrt.delivery_confirmed', 'sven.pnrt.silent_dispatched'],
      cases: ['pnrt_route', 'pnrt_validate', 'pnrt_confirm', 'pnrt_dispatch', 'pnrt_report', 'pnrt_monitor'],
    },
    {
      name: 'webhook_delivery_engine', migration: '20260623930000_agent_webhook_delivery_engine.sql',
      typeFile: 'agent-webhook-delivery-engine.ts', skillDir: 'webhook-delivery-engine',
      interfaces: ['WebhookDeliveryEngineConfig', 'WebhookDelivery', 'EngineEvent'],
      bk: 'webhook_delivery_engine', eks: ['wbde.webhook_queued', 'wbde.delivery_attempted', 'wbde.signature_signed', 'wbde.retry_scheduled'],
      subjects: ['sven.wbde.webhook_queued', 'sven.wbde.delivery_attempted', 'sven.wbde.signature_signed', 'sven.wbde.retry_scheduled'],
      cases: ['wbde_queue', 'wbde_attempt', 'wbde_sign', 'wbde_schedule', 'wbde_report', 'wbde_monitor'],
    },
    {
      name: 'event_replay_processor', migration: '20260623940000_agent_event_replay_processor.sql',
      typeFile: 'agent-event-replay-processor.ts', skillDir: 'event-replay-processor',
      interfaces: ['EventReplayProcessorConfig', 'ReplayJob', 'ProcessorEvent'],
      bk: 'event_replay_processor', eks: ['evrp.replay_requested', 'evrp.window_selected', 'evrp.events_redelivered', 'evrp.completion_verified'],
      subjects: ['sven.evrp.replay_requested', 'sven.evrp.window_selected', 'sven.evrp.events_redelivered', 'sven.evrp.completion_verified'],
      cases: ['evrp_request', 'evrp_select', 'evrp_redeliver', 'evrp_verify', 'evrp_report', 'evrp_monitor'],
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
