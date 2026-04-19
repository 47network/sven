import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..', '..');

function readFile(rel: string): string {
  return readFileSync(join(root, rel), 'utf-8');
}

// ── Migration SQL ───────────────────────────────────────────────────
describe('Batch 113 — Log Rotation migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617500000_agent_log_rotation.sql');
  test('creates agent_log_rotation_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_rotation_policies'));
  test('creates agent_log_archives table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_archives'));
  test('creates agent_log_retention_jobs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_retention_jobs'));
  test('has indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 114 — IP Allowlisting migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617510000_agent_ip_allowlisting.sql');
  test('creates agent_ip_allowlists table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ip_allowlists'));
  test('creates agent_ip_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ip_rules'));
  test('creates agent_ip_access_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ip_access_logs'));
  test('has indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 115 — Webhook Retry migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617520000_agent_webhook_retry.sql');
  test('creates agent_webhook_endpoints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_webhook_endpoints'));
  test('creates agent_webhook_deliveries table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_webhook_deliveries'));
  test('creates agent_webhook_dead_letters table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_webhook_dead_letters'));
  test('has indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 116 — Storage Tiering migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617530000_agent_storage_tiering.sql');
  test('creates agent_storage_tiers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_storage_tiers'));
  test('creates agent_storage_lifecycle_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_storage_lifecycle_rules'));
  test('creates agent_storage_migrations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_storage_migrations'));
  test('has indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 117 — Network Peering migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617540000_agent_network_peering.sql');
  test('creates agent_peering_connections table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_peering_connections'));
  test('creates agent_peering_routes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_peering_routes'));
  test('creates agent_transit_gateways table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_transit_gateways'));
  test('has indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

// ── Shared Types ────────────────────────────────────────────────────
describe('Batch 113 — Log Rotation types', () => {
  const ts = readFile('packages/shared/src/agent-log-rotation.ts');
  test('exports LogRotationPolicy', () => expect(ts).toContain('export interface LogRotationPolicy'));
  test('exports LogArchive', () => expect(ts).toContain('export interface LogArchive'));
  test('exports LogRetentionJob', () => expect(ts).toContain('export interface LogRetentionJob'));
  test('exports LogRotationStats', () => expect(ts).toContain('export interface LogRotationStats'));
});

describe('Batch 114 — IP Allowlisting types', () => {
  const ts = readFile('packages/shared/src/agent-ip-allowlisting.ts');
  test('exports IpAllowlist', () => expect(ts).toContain('export interface IpAllowlist'));
  test('exports IpRule', () => expect(ts).toContain('export interface IpRule'));
  test('exports IpAccessLog', () => expect(ts).toContain('export interface IpAccessLog'));
});

describe('Batch 115 — Webhook Retry types', () => {
  const ts = readFile('packages/shared/src/agent-webhook-retry.ts');
  test('exports RetryWebhookEndpoint (renamed to avoid conflict)', () => expect(ts).toContain('export interface RetryWebhookEndpoint'));
  test('exports RetryWebhookDelivery (renamed to avoid conflict)', () => expect(ts).toContain('export interface RetryWebhookDelivery'));
  test('exports WebhookDeadLetter', () => expect(ts).toContain('export interface WebhookDeadLetter'));
});

describe('Batch 116 — Storage Tiering types', () => {
  const ts = readFile('packages/shared/src/agent-storage-tiering.ts');
  test('exports StorageTier', () => expect(ts).toContain('export interface StorageTier'));
  test('exports StorageLifecycleRule', () => expect(ts).toContain('export interface StorageLifecycleRule'));
  test('exports StorageTierMigration', () => expect(ts).toContain('export interface StorageTierMigration'));
});

describe('Batch 117 — Network Peering types', () => {
  const ts = readFile('packages/shared/src/agent-network-peering.ts');
  test('exports PeeringConnection', () => expect(ts).toContain('export interface PeeringConnection'));
  test('exports PeeringRoute', () => expect(ts).toContain('export interface PeeringRoute'));
  test('exports TransitGateway', () => expect(ts).toContain('export interface TransitGateway'));
});

// ── Skills ──────────────────────────────────────────────────────────
describe('Skills directories exist', () => {
  const skills = ['agent-log-rotation', 'agent-ip-allowlisting', 'agent-webhook-retry', 'agent-storage-tiering', 'agent-network-peering'];
  skills.forEach(s => {
    test(`${s}/SKILL.md exists`, () => expect(existsSync(join(root, 'skills', s, 'SKILL.md'))).toBe(true));
  });
});

// ── Shared index exports ────────────────────────────────────────────
describe('Shared index.ts barrel exports', () => {
  const idx = readFile('packages/shared/src/index.ts');
  const modules = ['agent-log-rotation', 'agent-ip-allowlisting', 'agent-webhook-retry', 'agent-storage-tiering', 'agent-network-peering'];
  modules.forEach(m => {
    test(`exports ${m}`, () => expect(idx).toContain(`from './${m}.js'`));
  });
});

// ── Eidolon BK / EK / districtFor ──────────────────────────────────
describe('Eidolon types wiring', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  const bk = ['log_rotator', 'ip_gatekeeper', 'webhook_relay', 'storage_tower', 'peering_bridge'];
  bk.forEach(b => {
    test(`BK has ${b}`, () => expect(types).toContain(`'${b}'`));
  });

  const ek = ['logrot.policy_created', 'ipallow.list_created', 'webhook.endpoint_registered', 'storage_tier.tier_created', 'peering.connection_established'];
  ek.forEach(e => {
    test(`EK has ${e}`, () => expect(types).toContain(`'${e}'`));
  });

  bk.forEach(b => {
    test(`districtFor handles ${b}`, () => expect(types).toContain(`case '${b}':`));
  });
});

// ── Event Bus ───────────────────────────────────────────────────────
describe('Event bus SUBJECT_MAP', () => {
  const eb = readFile('services/sven-eidolon/src/event-bus.ts');
  const subjects = [
    'sven.logrot.policy_created', 'sven.ipallow.list_created',
    'sven.webhook.endpoint_registered', 'sven.storage_tier.tier_created',
    'sven.peering.connection_established'
  ];
  subjects.forEach(s => {
    test(`has ${s}`, () => expect(eb).toContain(`'${s}'`));
  });
});

// ── Task Executor ───────────────────────────────────────────────────
describe('Task executor switch cases', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const cases = [
    'logrot_create_policy', 'logrot_report',
    'ipallow_create_list', 'ipallow_report',
    'webhook_register_endpoint', 'webhook_report',
    'storage_create_tier', 'storage_report',
    'peering_create_connection', 'peering_report'
  ];
  cases.forEach(c => {
    test(`routes ${c}`, () => expect(te).toContain(`case '${c}':`));
  });
});

describe('Task executor handler methods', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const handlers = [
    'handleLogrotCreatePolicy', 'handleLogrotReport',
    'handleIpallowCreateList', 'handleIpallowReport',
    'handleWebhookRegisterEndpoint', 'handleWebhookReport',
    'handleStorageCreateTier', 'handleStorageReport',
    'handlePeeringCreateConnection', 'handlePeeringReport'
  ];
  handlers.forEach(h => {
    test(`has ${h}`, () => expect(te).toContain(`private async ${h}`));
  });
});

// ── .gitattributes ──────────────────────────────────────────────────
describe('.gitattributes privacy guards', () => {
  const ga = readFile('.gitattributes');
  const files = [
    '20260617500000_agent_log_rotation.sql',
    '20260617510000_agent_ip_allowlisting.sql',
    '20260617520000_agent_webhook_retry.sql',
    '20260617530000_agent_storage_tiering.sql',
    '20260617540000_agent_network_peering.sql'
  ];
  files.forEach(f => {
    test(`guards ${f}`, () => expect(ga).toContain(f));
  });
});
