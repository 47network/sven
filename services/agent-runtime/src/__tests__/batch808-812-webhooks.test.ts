import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 808-812: Webhooks Subsystem', () => {
  const verticals = [
    {
      name: 'outbound_webhook_dispatcher', migration: '20260624450000_agent_outbound_webhook_dispatcher.sql',
      typeFile: 'agent-outbound-webhook-dispatcher.ts', skillDir: 'outbound-webhook-dispatcher',
      interfaces: ['OutboundWebhookDispatcherConfig', 'WebhookDelivery', 'DispatcherEvent'],
      bk: 'outbound_webhook_dispatcher', eks: ['owhd.delivery_queued', 'owhd.endpoint_called', 'owhd.response_received', 'owhd.delivery_recorded'],
      subjects: ['sven.owhd.delivery_queued', 'sven.owhd.endpoint_called', 'sven.owhd.response_received', 'sven.owhd.delivery_recorded'],
      cases: ['owhd_queue', 'owhd_call', 'owhd_receive', 'owhd_record', 'owhd_report', 'owhd_monitor'],
    },
    {
      name: 'webhook_signature_verifier', migration: '20260624460000_agent_webhook_signature_verifier.sql',
      typeFile: 'agent-webhook-signature-verifier.ts', skillDir: 'webhook-signature-verifier',
      interfaces: ['WebhookSignatureVerifierConfig', 'SignatureCheck', 'VerifierEvent'],
      bk: 'webhook_signature_verifier', eks: ['whsv.signature_extracted', 'whsv.payload_canonicalized', 'whsv.hmac_computed', 'whsv.match_decided'],
      subjects: ['sven.whsv.signature_extracted', 'sven.whsv.payload_canonicalized', 'sven.whsv.hmac_computed', 'sven.whsv.match_decided'],
      cases: ['whsv_extract', 'whsv_canonicalize', 'whsv_compute', 'whsv_decide', 'whsv_report', 'whsv_monitor'],
    },
    {
      name: 'webhook_retry_manager', migration: '20260624470000_agent_webhook_retry_manager.sql',
      typeFile: 'agent-webhook-retry-manager.ts', skillDir: 'webhook-retry-manager',
      interfaces: ['WebhookRetryManagerConfig', 'RetryAttempt', 'ManagerEvent'],
      bk: 'webhook_retry_manager', eks: ['whrm.failure_observed', 'whrm.backoff_computed', 'whrm.retry_scheduled', 'whrm.exhaustion_handled'],
      subjects: ['sven.whrm.failure_observed', 'sven.whrm.backoff_computed', 'sven.whrm.retry_scheduled', 'sven.whrm.exhaustion_handled'],
      cases: ['whrm_observe', 'whrm_compute', 'whrm_schedule', 'whrm_handle', 'whrm_report', 'whrm_monitor'],
    },
    {
      name: 'webhook_event_logger', migration: '20260624480000_agent_webhook_event_logger.sql',
      typeFile: 'agent-webhook-event-logger.ts', skillDir: 'webhook-event-logger',
      interfaces: ['WebhookEventLoggerConfig', 'WebhookEvent', 'LoggerEvent'],
      bk: 'webhook_event_logger', eks: ['whel.event_received', 'whel.payload_sanitized', 'whel.entry_persisted', 'whel.query_served'],
      subjects: ['sven.whel.event_received', 'sven.whel.payload_sanitized', 'sven.whel.entry_persisted', 'sven.whel.query_served'],
      cases: ['whel_receive', 'whel_sanitize', 'whel_persist', 'whel_serve', 'whel_report', 'whel_monitor'],
    },
    {
      name: 'webhook_subscription_registry', migration: '20260624490000_agent_webhook_subscription_registry.sql',
      typeFile: 'agent-webhook-subscription-registry.ts', skillDir: 'webhook-subscription-registry',
      interfaces: ['WebhookSubscriptionRegistryConfig', 'WebhookSubscription', 'RegistryEvent'],
      bk: 'webhook_subscription_registry', eks: ['whsr.subscription_created', 'whsr.endpoint_validated', 'whsr.subscription_updated', 'whsr.subscription_revoked'],
      subjects: ['sven.whsr.subscription_created', 'sven.whsr.endpoint_validated', 'sven.whsr.subscription_updated', 'sven.whsr.subscription_revoked'],
      cases: ['whsr_create', 'whsr_validate', 'whsr_update', 'whsr_revoke', 'whsr_report', 'whsr_monitor'],
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
