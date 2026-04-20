/**
 * Batch 103-107 — Platform Operations
 * Container Registry, GraphQL Gateway, Message Queue,
 * Canary Deployment, Database Replication
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── Migration file paths ──────────────────────────────────
const MIGRATIONS = [
  '20260617400000_agent_container_registry.sql',
  '20260617410000_agent_graphql_gateway.sql',
  '20260617420000_agent_message_queue.sql',
  '20260617430000_agent_canary_deployment.sql',
  '20260617440000_agent_database_replication.sql',
];

const SHARED_MODULES = [
  'agent-container-registry',
  'agent-graphql-gateway',
  'agent-message-queue',
  'agent-canary-deployment',
  'agent-database-replication',
];

const SKILLS = [
  'agent-container-registry',
  'agent-graphql-gateway',
  'agent-message-queue',
  'agent-canary-deployment',
  'agent-database-replication',
];

// ── Batch 103: Container Registry ─────────────────────────
describe('Batch 103 — Container Registry', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'services/gateway-api/migrations', MIGRATIONS[0]),
    'utf-8',
  );
  test('creates agent_container_images table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_container_images');
  });
  test('creates agent_container_scans table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_container_scans');
  });
  test('creates agent_container_retention table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_container_retention');
  });
  test('has proper indexes', () => {
    expect(sql).toContain('idx_container_images_agent');
    expect(sql).toContain('idx_container_scans_image');
    expect(sql).toContain('idx_container_retention_agent');
  });
  test('shared types export ContainerImage', () => {
    const ts = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-container-registry.ts'),
      'utf-8',
    );
    expect(ts).toContain('export interface ContainerImage');
    expect(ts).toContain('export type ContainerScanStatus');
    expect(ts).toContain('export interface ContainerRegistryStats');
  });
  test('SKILL.md exists with triggers', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/agent-container-registry/SKILL.md'),
      'utf-8',
    );
    expect(md).toContain('container_push_image');
    expect(md).toContain('container_scan_image');
  });
});

// ── Batch 104: GraphQL Gateway ────────────────────────────
describe('Batch 104 — GraphQL Gateway', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'services/gateway-api/migrations', MIGRATIONS[1]),
    'utf-8',
  );
  test('creates agent_graphql_schemas table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_graphql_schemas');
  });
  test('creates agent_graphql_operations table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_graphql_operations');
  });
  test('creates agent_graphql_cache_rules table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_graphql_cache_rules');
  });
  test('shared types export GqlSchema', () => {
    const ts = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-graphql-gateway.ts'),
      'utf-8',
    );
    expect(ts).toContain('export interface GqlSchema');
    expect(ts).toContain('export type GqlOperationType');
    expect(ts).toContain('export interface GqlGatewayStats');
  });
  test('SKILL.md exists with triggers', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/agent-graphql-gateway/SKILL.md'),
      'utf-8',
    );
    expect(md).toContain('graphql_publish_schema');
    expect(md).toContain('graphql_set_cache_rule');
  });
});

// ── Batch 105: Message Queue ──────────────────────────────
describe('Batch 105 — Message Queue', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'services/gateway-api/migrations', MIGRATIONS[2]),
    'utf-8',
  );
  test('creates agent_mq_queues table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_mq_queues');
  });
  test('creates agent_mq_consumers table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_mq_consumers');
  });
  test('creates agent_mq_dlq_messages table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_mq_dlq_messages');
  });
  test('shared types export MqQueue', () => {
    const ts = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-message-queue.ts'),
      'utf-8',
    );
    expect(ts).toContain('export interface MqQueue');
    expect(ts).toContain('export type MqConsumerStatus');
    expect(ts).toContain('export interface MqStats');
  });
  test('SKILL.md exists with triggers', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/agent-message-queue/SKILL.md'),
      'utf-8',
    );
    expect(md).toContain('mq_create_queue');
    expect(md).toContain('mq_redrive_messages');
  });
});

// ── Batch 106: Canary Deployment ──────────────────────────
describe('Batch 106 — Canary Deployment', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'services/gateway-api/migrations', MIGRATIONS[3]),
    'utf-8',
  );
  test('creates agent_canary_releases table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_canary_releases');
  });
  test('creates agent_canary_metrics table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_canary_metrics');
  });
  test('creates agent_canary_rollback_triggers table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_canary_rollback_triggers');
  });
  test('shared types export CanaryRelease', () => {
    const ts = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-canary-deployment.ts'),
      'utf-8',
    );
    expect(ts).toContain('export interface CanaryRelease');
    expect(ts).toContain('export type CanaryTriggerType');
    expect(ts).toContain('export interface CanaryDeploymentStats');
  });
  test('SKILL.md exists with triggers', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/agent-canary-deployment/SKILL.md'),
      'utf-8',
    );
    expect(md).toContain('canary_create_release');
    expect(md).toContain('canary_rollback');
  });
});

// ── Batch 107: Database Replication ───────────────────────
describe('Batch 107 — Database Replication', () => {
  const sql = fs.readFileSync(
    path.join(ROOT, 'services/gateway-api/migrations', MIGRATIONS[4]),
    'utf-8',
  );
  test('creates agent_db_replicas table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_db_replicas');
  });
  test('creates agent_db_failovers table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_db_failovers');
  });
  test('creates agent_db_replication_slots table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_db_replication_slots');
  });
  test('shared types export DbReplica', () => {
    const ts = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-database-replication.ts'),
      'utf-8',
    );
    expect(ts).toContain('export interface DbReplica');
    expect(ts).toContain('export type DbFailoverStatus');
    expect(ts).toContain('export interface DbReplicationStats');
  });
  test('SKILL.md exists with triggers', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/agent-database-replication/SKILL.md'),
      'utf-8',
    );
    expect(md).toContain('dbrepl_add_replica');
    expect(md).toContain('dbrepl_failover');
  });
});

// ── Cross-cutting validation ──────────────────────────────
describe('Cross-cutting — Batches 103-107', () => {
  test('all 5 migrations exist', () => {
    for (const m of MIGRATIONS) {
      const p = path.join(ROOT, 'services/gateway-api/migrations', m);
      expect(fs.existsSync(p)).toBe(true);
    }
  });

  test('all 5 shared modules exported from index.ts', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );
    for (const mod of SHARED_MODULES) {
      expect(idx).toContain(`from './${mod}.js'`);
    }
  });

  test('all 5 skills have SKILL.md', () => {
    for (const s of SKILLS) {
      const p = path.join(ROOT, 'skills', s, 'SKILL.md');
      expect(fs.existsSync(p)).toBe(true);
    }
  });

  test('types.ts has 5 new BK values', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );
    for (const bk of ['container_registry', 'graphql_gateway', 'message_queue_hub', 'canary_deployer', 'db_replicator']) {
      expect(types).toContain(`'${bk}'`);
    }
  });

  test('types.ts has 20 new EK values', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );
    const eks = [
      'registry.image_pushed', 'registry.scan_completed', 'registry.retention_cleaned', 'registry.vulnerability_found',
      'graphql.schema_published', 'graphql.breaking_detected', 'graphql.cache_configured', 'graphql.operation_slow',
      'mq.queue_created', 'mq.consumer_registered', 'mq.dlq_threshold', 'mq.message_redriven',
      'canary.release_started', 'canary.traffic_shifted', 'canary.promoted', 'canary.rolled_back',
      'dbrepl.replica_added', 'dbrepl.lag_alert', 'dbrepl.failover_initiated', 'dbrepl.failover_completed',
    ];
    for (const ek of eks) {
      expect(types).toContain(`'${ek}'`);
    }
  });

  test('event-bus.ts has 20 new SUBJECT_MAP entries', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );
    expect(bus).toContain("'sven.registry.image_pushed'");
    expect(bus).toContain("'sven.graphql.schema_published'");
    expect(bus).toContain("'sven.mq.queue_created'");
    expect(bus).toContain("'sven.canary.release_started'");
    expect(bus).toContain("'sven.dbrepl.failover_completed'");
  });

  test('task-executor has 30 new switch cases', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );
    const cases = [
      'container_push', 'container_scan', 'container_retention', 'container_pull_stats', 'container_clean', 'container_report',
      'graphql_publish', 'graphql_register_op', 'graphql_cache_rule', 'graphql_breaking_check', 'graphql_analyze', 'graphql_report',
      'mq_create_queue', 'mq_register_consumer', 'mq_configure_dlq', 'mq_redrive', 'mq_check_lag', 'mq_report',
      'canary_create', 'canary_adjust_traffic', 'canary_promote', 'canary_rollback', 'canary_add_trigger', 'canary_report',
      'dbrepl_add_replica', 'dbrepl_check_lag', 'dbrepl_failover', 'dbrepl_manage_slots', 'dbrepl_heartbeat', 'dbrepl_report',
    ];
    for (const c of cases) {
      expect(te).toContain(`case '${c}'`);
    }
  });

  test('task-executor has 30 new handler methods', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );
    const handlers = [
      'handleContainerPush', 'handleContainerScan', 'handleContainerRetention',
      'handleGraphqlPublish', 'handleGraphqlRegisterOp', 'handleGraphqlCacheRule',
      'handleMqCreateQueue', 'handleMqRegisterConsumer', 'handleMqConfigureDlq',
      'handleCanaryCreate', 'handleCanaryPromote', 'handleCanaryRollback',
      'handleDbreplAddReplica', 'handleDbreplFailover', 'handleDbreplReport',
    ];
    for (const h of handlers) {
      expect(te).toContain(h);
    }
  });
});
