import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 69 — Agent Webhooks & External Integrations', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260611120000_agent_webhooks.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['webhook_endpoints','webhook_subscriptions','webhook_deliveries','webhook_logs','external_integrations']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => { expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
    it('has Batch 69 header', () => { expect(sql).toContain('Batch 69'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-webhooks.ts'), 'utf-8');
    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('exports 4 helper constants', () => { expect((src.match(/export const \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('exports 4 helper functions', () => { expect((src.match(/export function \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('WebhookAction has 7 values', () => {
      const m = src.match(/export type WebhookAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('re-exports agent-webhooks', () => { expect(idx).toContain('./agent-webhooks'); });
    it('has at least 94 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(94); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-webhooks/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-webhooks/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
  });

  describe('Eidolon types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('EidolonBuildingKind has 52 values', () => {
      const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(52);
    });
    it('includes webhook_relay building kind', () => { expect(src).toContain("'webhook_relay'"); });
    it('EidolonEventKind has 224 values', () => {
      const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(224);
    });
    it('includes 4 webhook event kinds', () => {
      for (const e of ['webhook.endpoint_registered','webhook.delivery_completed','webhook.integration_connected','webhook.delivery_failed']) {
        expect(src).toContain(`'${e}'`);
      }
    });
    it('districtFor has 52 cases', () => {
      const dfBlock = src.split('districtFor')[1].split('function ')[0];
      expect((dfBlock.match(/case '\w+':/g) || []).length).toBe(52);
    });
  });

  describe('Event bus', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('SUBJECT_MAP has 223 entries', () => {
      const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(223);
    });
    it('has 4 webhook subjects', () => {
      for (const s of ['sven.webhook.endpoint_registered','sven.webhook.delivery_completed','sven.webhook.integration_connected','sven.webhook.delivery_failed']) {
        expect(src).toContain(`'${s}'`);
      }
    });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 264 switch cases', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(264); });
    it('has 260 handler methods', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(260); });
    it('includes 7 batch 69 cases', () => {
      for (const c of ['endpoint_create','subscription_add','delivery_send','delivery_retry','integration_connect','integration_revoke','webhook_report']) {
        expect(src).toContain(`case '${c}':`);
      }
    });
    it('includes 7 batch 69 handlers', () => {
      for (const h of ['handleEndpointCreate','handleSubscriptionAdd','handleDeliverySend','handleDeliveryRetry','handleIntegrationConnect','handleIntegrationRevoke','handleWebhookReport']) {
        expect(src).toContain(h);
      }
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks migration private', () => { expect(ga).toContain('20260611120000_agent_webhooks.sql'); });
    it('marks shared types private', () => { expect(ga).toContain('agent-webhooks.ts'); });
    it('marks skill private', () => { expect(ga).toContain('agent-webhooks/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 69', () => { expect(cl).toContain('Batch 69'); });
    it('mentions webhook', () => { expect(cl).toMatch(/[Ww]ebhook/); });
  });

  describe('Migration count', () => {
    it('has 55 migration files', () => {
      expect(fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql')).length).toBe(55);
    });
  });
});
