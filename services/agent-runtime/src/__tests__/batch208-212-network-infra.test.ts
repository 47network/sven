import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─────────────── Batch 208: Message Broker ─────────────────

describe('Batch 208 — Message Broker migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260618450000_agent_message_broker.sql');

  it('creates agent_message_brokers table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_message_brokers'); });
  it('creates agent_message_topics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_message_topics'); });
  it('creates agent_message_subscriptions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_message_subscriptions'); });
  it('has broker_type CHECK constraint', () => { expect(sql).toMatch(/broker_type.*CHECK/s); });
  it('has delivery_mode CHECK constraint', () => { expect(sql).toMatch(/delivery_mode.*CHECK/s); });
  it('creates indexes', () => { expect(sql).toContain('idx_message_brokers_agent'); });
});

describe('Batch 208 — Message Broker shared types', () => {
  const ts = readFile('packages/shared/src/agent-message-broker.ts');

  it('exports MessageBroker interface', () => { expect(ts).toContain('export interface MessageBroker'); });
  it('exports MessageTopic interface', () => { expect(ts).toContain('export interface MessageTopic'); });
  it('exports MessageSubscription interface', () => { expect(ts).toContain('export interface MessageSubscription'); });
  it('exports MessageBrokerType type', () => { expect(ts).toContain('export type MessageBrokerType'); });
  it('exports MessageBrokerStatus type', () => { expect(ts).toContain('export type MessageBrokerStatus'); });
  it('exports MessageDeliveryMode type', () => { expect(ts).toContain('export type MessageDeliveryMode'); });
  it('includes kafka in broker types', () => { expect(ts).toContain("'kafka'"); });
  it('includes exactly_once in delivery modes', () => { expect(ts).toContain("'exactly_once'"); });
});

describe('Batch 208 — Message Broker barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-message-broker', () => { expect(idx).toContain("from './agent-message-broker.js'"); });
});

describe('Batch 208 — Message Broker SKILL.md', () => {
  it('file exists', () => { expect(fileExists('skills/autonomous-economy/message-broker/SKILL.md')).toBe(true); });
  const md = readFile('skills/autonomous-economy/message-broker/SKILL.md');
  it('has name field', () => { expect(md).toContain('name: message-broker'); });
  it('has Actions heading', () => { expect(md).toContain('## Actions'); });
  it('has broker-connect action', () => { expect(md).toContain('broker-connect'); });
  it('has subscribe action', () => { expect(md).toContain('subscribe'); });
  it('has publish-message action', () => { expect(md).toContain('publish-message'); });
});

// ─────────────── Batch 209: Cache Manager ──────────────────

describe('Batch 209 — Cache Manager migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260618460000_agent_cache_manager.sql');

  it('creates agent_cache_stores table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_cache_stores'); });
  it('creates agent_cache_policies table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_cache_policies'); });
  it('creates agent_cache_metrics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_cache_metrics'); });
  it('has eviction_policy CHECK constraint', () => { expect(sql).toMatch(/eviction_policy.*CHECK/s); });
  it('has invalidation_strategy CHECK constraint', () => { expect(sql).toMatch(/invalidation_strategy.*CHECK/s); });
  it('creates indexes', () => { expect(sql).toContain('idx_cache_stores_agent'); });
});

describe('Batch 209 — Cache Manager shared types', () => {
  const ts = readFile('packages/shared/src/agent-cache-manager.ts');

  it('exports CacheStore interface', () => { expect(ts).toContain('export interface CacheStore'); });
  it('exports CachePolicy interface', () => { expect(ts).toContain('export interface CachePolicy'); });
  it('exports CacheMetrics interface', () => { expect(ts).toContain('export interface CacheMetrics'); });
  it('exports CacheStoreType type', () => { expect(ts).toContain('export type CacheStoreType'); });
  it('exports CacheEvictionPolicy type', () => { expect(ts).toContain('export type CacheEvictionPolicy'); });
  it('exports CacheInvalidationStrategy type', () => { expect(ts).toContain('export type CacheInvalidationStrategy'); });
  it('includes redis in store types', () => { expect(ts).toContain("'redis'"); });
  it('includes write_through in invalidation strategies', () => { expect(ts).toContain("'write_through'"); });
});

describe('Batch 209 — Cache Manager barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-cache-manager', () => { expect(idx).toContain("from './agent-cache-manager.js'"); });
});

describe('Batch 209 — Cache Manager SKILL.md', () => {
  it('file exists', () => { expect(fileExists('skills/autonomous-economy/cache-manager/SKILL.md')).toBe(true); });
  const md = readFile('skills/autonomous-economy/cache-manager/SKILL.md');
  it('has name field', () => { expect(md).toContain('name: cache-manager'); });
  it('has Actions heading', () => { expect(md).toContain('## Actions'); });
  it('has store-provision action', () => { expect(md).toContain('store-provision'); });
  it('has cache-warm action', () => { expect(md).toContain('cache-warm'); });
});

// ─────────────── Batch 210: Traffic Router ─────────────────

describe('Batch 210 — Traffic Router migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260618470000_agent_traffic_router.sql');

  it('creates agent_traffic_routes table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_traffic_routes'); });
  it('creates agent_traffic_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_traffic_rules'); });
  it('creates agent_traffic_analytics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_traffic_analytics'); });
  it('has rule_type CHECK constraint', () => { expect(sql).toMatch(/rule_type.*CHECK/s); });
  it('creates indexes', () => { expect(sql).toContain('idx_traffic_routes_agent'); });
});

describe('Batch 210 — Traffic Router shared types', () => {
  const ts = readFile('packages/shared/src/agent-traffic-router.ts');

  it('exports TrafficRoute interface', () => { expect(ts).toContain('export interface TrafficRoute'); });
  it('exports TrafficRule interface', () => { expect(ts).toContain('export interface TrafficRule'); });
  it('exports TrafficAnalytics interface', () => { expect(ts).toContain('export interface TrafficAnalytics'); });
  it('exports TrafficRouteStatus type', () => { expect(ts).toContain('export type TrafficRouteStatus'); });
  it('exports TrafficRuleType type', () => { expect(ts).toContain('export type TrafficRuleType'); });
  it('includes canary in route statuses', () => { expect(ts).toContain("'canary'"); });
  it('includes ab_test in rule types', () => { expect(ts).toContain("'ab_test'"); });
});

describe('Batch 210 — Traffic Router barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-traffic-router', () => { expect(idx).toContain("from './agent-traffic-router.js'"); });
});

describe('Batch 210 — Traffic Router SKILL.md', () => {
  it('file exists', () => { expect(fileExists('skills/autonomous-economy/traffic-router/SKILL.md')).toBe(true); });
  const md = readFile('skills/autonomous-economy/traffic-router/SKILL.md');
  it('has name field', () => { expect(md).toContain('name: traffic-router'); });
  it('has Actions heading', () => { expect(md).toContain('## Actions'); });
  it('has canary-deploy action', () => { expect(md).toContain('canary-deploy'); });
  it('has ab-test action', () => { expect(md).toContain('ab-test'); });
});

// ─────────────── Batch 211: DNS Resolver ───────────────────

describe('Batch 211 — DNS Resolver migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260618480000_agent_dns_resolver.sql');

  it('creates agent_dns_zones table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dns_zones'); });
  it('creates agent_dns_records table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dns_records'); });
  it('creates agent_dns_query_logs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dns_query_logs'); });
  it('has zone_type CHECK constraint', () => { expect(sql).toMatch(/zone_type.*CHECK/s); });
  it('has record_type CHECK constraint', () => { expect(sql).toMatch(/record_type.*CHECK/s); });
  it('creates indexes', () => { expect(sql).toContain('idx_dns_zones_agent'); });
});

describe('Batch 211 — DNS Resolver shared types', () => {
  const ts = readFile('packages/shared/src/agent-dns-resolver.ts');

  it('exports DnsZone interface', () => { expect(ts).toContain('export interface DnsZone'); });
  it('exports DnsRecord interface', () => { expect(ts).toContain('export interface DnsRecord'); });
  it('exports DnsQueryLog interface', () => { expect(ts).toContain('export interface DnsQueryLog'); });
  it('exports DnsZoneType type', () => { expect(ts).toContain('export type DnsZoneType'); });
  it('exports DnsRecordType type', () => { expect(ts).toContain('export type DnsRecordType'); });
  it('exports DnsZoneStatus type', () => { expect(ts).toContain('export type DnsZoneStatus'); });
  it('includes primary in zone types', () => { expect(ts).toContain("'primary'"); });
  it('includes CNAME in record types', () => { expect(ts).toContain("'CNAME'"); });
});

describe('Batch 211 — DNS Resolver barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-dns-resolver', () => { expect(idx).toContain("from './agent-dns-resolver.js'"); });
});

describe('Batch 211 — DNS Resolver SKILL.md', () => {
  it('file exists', () => { expect(fileExists('skills/autonomous-economy/dns-resolver/SKILL.md')).toBe(true); });
  const md = readFile('skills/autonomous-economy/dns-resolver/SKILL.md');
  it('has name field', () => { expect(md).toContain('name: dns-resolver'); });
  it('has Actions heading', () => { expect(md).toContain('## Actions'); });
  it('has zone-create action', () => { expect(md).toContain('zone-create'); });
  it('has dnssec-enable action', () => { expect(md).toContain('dnssec-enable'); });
});

// ─────────────── Batch 212: Config Server ──────────────────

describe('Batch 212 — Config Server migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260618490000_agent_config_server.sql');

  it('creates agent_config_namespaces table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_config_namespaces'); });
  it('creates agent_config_entries table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_config_entries'); });
  it('creates agent_config_change_log table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_config_change_log'); });
  it('has environment CHECK constraint', () => { expect(sql).toMatch(/environment.*CHECK/s); });
  it('has value_type CHECK constraint', () => { expect(sql).toMatch(/value_type.*CHECK/s); });
  it('creates indexes', () => { expect(sql).toContain('idx_config_namespaces_agent'); });
});

describe('Batch 212 — Config Server shared types', () => {
  const ts = readFile('packages/shared/src/agent-config-server.ts');

  it('exports ConfigNamespace interface', () => { expect(ts).toContain('export interface ConfigNamespace'); });
  it('exports ConfigEntry interface', () => { expect(ts).toContain('export interface ConfigEntry'); });
  it('exports ConfigChangeLog interface', () => { expect(ts).toContain('export interface ConfigChangeLog'); });
  it('exports ConfigEnvironment type', () => { expect(ts).toContain('export type ConfigEnvironment'); });
  it('exports ConfigValueType type', () => { expect(ts).toContain('export type ConfigValueType'); });
  it('exports ConfigNamespaceStatus type', () => { expect(ts).toContain('export type ConfigNamespaceStatus'); });
  it('includes production in environments', () => { expect(ts).toContain("'production'"); });
  it('includes secret in value types', () => { expect(ts).toContain("'secret'"); });
});

describe('Batch 212 — Config Server barrel export', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-config-server', () => { expect(idx).toContain("from './agent-config-server.js'"); });
});

describe('Batch 212 — Config Server SKILL.md', () => {
  it('file exists', () => { expect(fileExists('skills/autonomous-economy/config-server/SKILL.md')).toBe(true); });
  const md = readFile('skills/autonomous-economy/config-server/SKILL.md');
  it('has name field', () => { expect(md).toContain('name: config-server'); });
  it('has Actions heading', () => { expect(md).toContain('## Actions'); });
  it('has namespace-create action', () => { expect(md).toContain('namespace-create'); });
  it('has config-diff action', () => { expect(md).toContain('config-diff'); });
  it('has rollback action', () => { expect(md).toContain('rollback'); });
});

// ─────────────── Cross-batch: Eidolon types.ts ─────────────

describe('Batches 208-212 — Eidolon BK values', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');

  it('has message_broker BK', () => { expect(types).toContain("'message_broker'"); });
  it('has cache_manager BK', () => { expect(types).toContain("'cache_manager'"); });
  it('has traffic_router BK', () => { expect(types).toContain("'traffic_router'"); });
  it('has dns_resolver BK', () => { expect(types).toContain("'dns_resolver'"); });
  it('has config_server BK', () => { expect(types).toContain("'config_server'"); });
});

describe('Batches 208-212 — Eidolon EK values', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');

  it('has broker.connection_established EK', () => { expect(types).toContain("'broker.connection_established'"); });
  it('has broker.topic_created EK', () => { expect(types).toContain("'broker.topic_created'"); });
  it('has cache.store_provisioned EK', () => { expect(types).toContain("'cache.store_provisioned'"); });
  it('has cache.invalidation_triggered EK', () => { expect(types).toContain("'cache.invalidation_triggered'"); });
  it('has traffic.route_created EK', () => { expect(types).toContain("'traffic.route_created'"); });
  it('has traffic.canary_deployed EK', () => { expect(types).toContain("'traffic.canary_deployed'"); });
  it('has dns.zone_created EK', () => { expect(types).toContain("'dns.zone_created'"); });
  it('has dns.propagation_verified EK', () => { expect(types).toContain("'dns.propagation_verified'"); });
  it('has config.namespace_created EK', () => { expect(types).toContain("'config.namespace_created'"); });
  it('has config.rollback_executed EK', () => { expect(types).toContain("'config.rollback_executed'"); });
});

describe('Batches 208-212 — districtFor mapping', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');

  it('maps message_broker to industrial', () => { expect(types).toMatch(/case 'message_broker':\s*return 'industrial'/); });
  it('maps cache_manager to industrial', () => { expect(types).toMatch(/case 'cache_manager':\s*return 'industrial'/); });
  it('maps traffic_router to industrial', () => { expect(types).toMatch(/case 'traffic_router':\s*return 'industrial'/); });
  it('maps dns_resolver to civic', () => { expect(types).toMatch(/case 'dns_resolver':\s*return 'civic'/); });
  it('maps config_server to civic', () => { expect(types).toMatch(/case 'config_server':\s*return 'civic'/); });
});

// ─────────────── Cross-batch: Event bus ────────────────────

describe('Batches 208-212 — SUBJECT_MAP entries', () => {
  const eb = readFile('services/sven-eidolon/src/event-bus.ts');

  it('has sven.broker.connection_established', () => { expect(eb).toContain("'sven.broker.connection_established'"); });
  it('has sven.broker.topic_created', () => { expect(eb).toContain("'sven.broker.topic_created'"); });
  it('has sven.cache.store_provisioned', () => { expect(eb).toContain("'sven.cache.store_provisioned'"); });
  it('has sven.cache.invalidation_triggered', () => { expect(eb).toContain("'sven.cache.invalidation_triggered'"); });
  it('has sven.traffic.route_created', () => { expect(eb).toContain("'sven.traffic.route_created'"); });
  it('has sven.traffic.canary_deployed', () => { expect(eb).toContain("'sven.traffic.canary_deployed'"); });
  it('has sven.dns.zone_created', () => { expect(eb).toContain("'sven.dns.zone_created'"); });
  it('has sven.dns.propagation_verified', () => { expect(eb).toContain("'sven.dns.propagation_verified'"); });
  it('has sven.config.namespace_created', () => { expect(eb).toContain("'sven.config.namespace_created'"); });
  it('has sven.config.rollback_executed', () => { expect(eb).toContain("'sven.config.rollback_executed'"); });
});

// ─────────────── Cross-batch: Task executor ────────────────

describe('Batches 208-212 — Task executor switch cases', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');

  // Batch 208
  it('has broker_connect case', () => { expect(te).toContain("case 'broker_connect'"); });
  it('has broker_topic_create case', () => { expect(te).toContain("case 'broker_topic_create'"); });
  it('has broker_subscribe case', () => { expect(te).toContain("case 'broker_subscribe'"); });
  it('has broker_publish case', () => { expect(te).toContain("case 'broker_publish'"); });
  it('has broker_monitor_lag case', () => { expect(te).toContain("case 'broker_monitor_lag'"); });
  it('has broker_rebalance case', () => { expect(te).toContain("case 'broker_rebalance'"); });

  // Batch 209
  it('has cache_provision case', () => { expect(te).toContain("case 'cache_provision'"); });
  it('has cache_policy_set case', () => { expect(te).toContain("case 'cache_policy_set'"); });
  it('has cache_warm case', () => { expect(te).toContain("case 'cache_warm'"); });
  it('has cache_metrics case', () => { expect(te).toContain("case 'cache_metrics'"); });
  it('has cache_invalidate case', () => { expect(te).toContain("case 'cache_invalidate'"); });
  it('has cache_tier_configure case', () => { expect(te).toContain("case 'cache_tier_configure'"); });

  // Batch 210
  it('has traffic_route_create case', () => { expect(te).toContain("case 'traffic_route_create'"); });
  it('has traffic_rule_add case', () => { expect(te).toContain("case 'traffic_rule_add'"); });
  it('has traffic_canary case', () => { expect(te).toContain("case 'traffic_canary'"); });
  it('has traffic_ab_test case', () => { expect(te).toContain("case 'traffic_ab_test'"); });
  it('has traffic_analytics case', () => { expect(te).toContain("case 'traffic_analytics'"); });
  it('has traffic_circuit case', () => { expect(te).toContain("case 'traffic_circuit'"); });

  // Batch 211
  it('has dns_zone_create case', () => { expect(te).toContain("case 'dns_zone_create'"); });
  it('has dns_record_set case', () => { expect(te).toContain("case 'dns_record_set'"); });
  it('has dns_dnssec_enable case', () => { expect(te).toContain("case 'dns_dnssec_enable'"); });
  it('has dns_query_resolve case', () => { expect(te).toContain("case 'dns_query_resolve'"); });
  it('has dns_analytics case', () => { expect(te).toContain("case 'dns_analytics'"); });
  it('has dns_propagation_check case', () => { expect(te).toContain("case 'dns_propagation_check'"); });

  // Batch 212
  it('has config_namespace_create case', () => { expect(te).toContain("case 'config_namespace_create'"); });
  it('has config_set case', () => { expect(te).toContain("case 'config_set'"); });
  it('has config_get case', () => { expect(te).toContain("case 'config_get'"); });
  it('has config_diff case', () => { expect(te).toContain("case 'config_diff'"); });
  it('has config_rollback case', () => { expect(te).toContain("case 'config_rollback'"); });
  it('has config_audit case', () => { expect(te).toContain("case 'config_audit'"); });
});

describe('Batches 208-212 — Task executor handler methods', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');

  it('has handleBrokerConnect method', () => { expect(te).toContain('handleBrokerConnect'); });
  it('has handleBrokerTopicCreate method', () => { expect(te).toContain('handleBrokerTopicCreate'); });
  it('has handleCacheProvision method', () => { expect(te).toContain('handleCacheProvision'); });
  it('has handleCachePolicySet method', () => { expect(te).toContain('handleCachePolicySet'); });
  it('has handleTrafficRouteCreate method', () => { expect(te).toContain('handleTrafficRouteCreate'); });
  it('has handleTrafficCanary method', () => { expect(te).toContain('handleTrafficCanary'); });
  it('has handleDnsZoneCreate method', () => { expect(te).toContain('handleDnsZoneCreate'); });
  it('has handleDnsPropagationCheck method', () => { expect(te).toContain('handleDnsPropagationCheck'); });
  it('has handleConfigNamespaceCreate method', () => { expect(te).toContain('handleConfigNamespaceCreate'); });
  it('has handleConfigRollback method', () => { expect(te).toContain('handleConfigRollback'); });
});

// ─────────────── Cross-batch: .gitattributes ───────────────

describe('Batches 208-212 — .gitattributes entries', () => {
  const ga = readFile('.gitattributes');

  it('has message-broker migration entry', () => { expect(ga).toContain('20260618450000_agent_message_broker.sql'); });
  it('has message-broker types entry', () => { expect(ga).toContain('agent-message-broker.ts'); });
  it('has message-broker SKILL entry', () => { expect(ga).toContain('message-broker/SKILL.md'); });
  it('has cache-manager migration entry', () => { expect(ga).toContain('20260618460000_agent_cache_manager.sql'); });
  it('has traffic-router migration entry', () => { expect(ga).toContain('20260618470000_agent_traffic_router.sql'); });
  it('has dns-resolver migration entry', () => { expect(ga).toContain('20260618480000_agent_dns_resolver.sql'); });
  it('has config-server migration entry', () => { expect(ga).toContain('20260618490000_agent_config_server.sql'); });
  it('has config-server SKILL entry', () => { expect(ga).toContain('config-server/SKILL.md'); });
});
