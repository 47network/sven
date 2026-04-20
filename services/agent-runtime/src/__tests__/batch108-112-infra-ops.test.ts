/**
 * Batch 108-112 — Infrastructure Ops Test Suite
 * Edge Computing, API Versioning, Compliance Scanner, Backup Scheduling, Traffic Shaping
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 108 — Edge Computing', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617450000_agent_edge_computing.sql'), 'utf-8');

  test('migration creates agent_edge_nodes table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_edge_nodes');
  });
  test('migration creates agent_edge_functions table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_edge_functions');
  });
  test('migration creates agent_edge_latency_metrics table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_edge_latency_metrics');
  });
  test('migration has 6 indexes', () => {
    const idxCount = (mig.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
    expect(idxCount).toBe(6);
  });
  test('shared types export EdgeNode interface', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-edge-computing.ts'), 'utf-8');
    expect(src).toContain('export interface EdgeNode');
    expect(src).toContain('export interface EdgeFunction');
    expect(src).toContain('export interface EdgeLatencyMetric');
    expect(src).toContain('export interface EdgeComputingStats');
  });
  test('SKILL.md has correct triggers', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-edge-computing/SKILL.md'), 'utf-8');
    expect(skill).toContain('edge_deploy_node');
    expect(skill).toContain('edge_deploy_function');
    expect(skill).toContain('edge_measure_latency');
    expect(skill).toContain('edge_drain_node');
    expect(skill).toContain('edge_report');
  });
});

describe('Batch 109 — API Versioning', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617460000_agent_api_versioning.sql'), 'utf-8');

  test('migration creates agent_api_versions table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_api_versions');
  });
  test('migration creates agent_api_deprecations table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_api_deprecations');
  });
  test('migration creates agent_api_compat_checks table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_api_compat_checks');
  });
  test('migration has 5 indexes', () => {
    const idxCount = (mig.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
    expect(idxCount).toBe(5);
  });
  test('shared types export ApiVersion interface', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-api-versioning.ts'), 'utf-8');
    expect(src).toContain('export interface ApiVersion');
    expect(src).toContain('export interface ApiDeprecation');
    expect(src).toContain('export interface ApiCompatCheck');
    expect(src).toContain('export interface ApiVersioningStats');
  });
  test('SKILL.md has correct triggers', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-api-versioning/SKILL.md'), 'utf-8');
    expect(skill).toContain('apiver_publish_version');
    expect(skill).toContain('apiver_deprecate_endpoint');
    expect(skill).toContain('apiver_check_compat');
    expect(skill).toContain('apiver_report');
  });
});

describe('Batch 110 — Compliance Scanner', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617470000_agent_compliance_scanner.sql'), 'utf-8');

  test('migration creates agent_compliance_policies table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_compliance_policies');
  });
  test('migration creates agent_compliance_scan_results table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_compliance_scan_results');
  });
  test('migration creates agent_compliance_remediations table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_compliance_remediations');
  });
  test('migration has 6 indexes', () => {
    const idxCount = (mig.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
    expect(idxCount).toBe(6);
  });
  test('shared types export CompliancePolicy interface', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-compliance-scanner.ts'), 'utf-8');
    expect(src).toContain('export interface CompliancePolicy');
    expect(src).toContain('export interface ComplianceScanResult');
    expect(src).toContain('export interface ComplianceRemediation');
    expect(src).toContain('export interface ComplianceScannerStats');
  });
  test('SKILL.md has correct triggers', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-compliance-scanner/SKILL.md'), 'utf-8');
    expect(skill).toContain('compliance_create_policy');
    expect(skill).toContain('compliance_run_scan');
    expect(skill).toContain('compliance_export_report');
  });
});

describe('Batch 111 — Backup Scheduling', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617480000_agent_backup_scheduling.sql'), 'utf-8');

  test('migration creates agent_backup_schedules table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_backup_schedules');
  });
  test('migration creates agent_backup_snapshots table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_backup_snapshots');
  });
  test('migration creates agent_backup_restore_jobs table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_backup_restore_jobs');
  });
  test('migration has 6 indexes', () => {
    const idxCount = (mig.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
    expect(idxCount).toBe(6);
  });
  test('shared types export BackupSchedule interface', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-backup-scheduling.ts'), 'utf-8');
    expect(src).toContain('export interface BackupSchedule');
    expect(src).toContain('export interface BackupSnapshot');
    expect(src).toContain('export interface BackupRestoreJob');
    expect(src).toContain('export interface BackupSchedulingStats');
  });
  test('SKILL.md has correct triggers', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-backup-scheduling/SKILL.md'), 'utf-8');
    expect(skill).toContain('backup_create_schedule');
    expect(skill).toContain('backup_trigger_snapshot');
    expect(skill).toContain('backup_restore');
  });
});

describe('Batch 112 — Traffic Shaping', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617490000_agent_traffic_shaping.sql'), 'utf-8');

  test('migration creates agent_traffic_rules table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_traffic_rules');
  });
  test('migration creates agent_bandwidth_limits table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_bandwidth_limits');
  });
  test('migration creates agent_qos_policies table', () => {
    expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_qos_policies');
  });
  test('migration has 6 indexes', () => {
    const idxCount = (mig.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
    expect(idxCount).toBe(6);
  });
  test('shared types export TrafficRule interface', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-traffic-shaping.ts'), 'utf-8');
    expect(src).toContain('export interface TrafficRule');
    expect(src).toContain('export interface BandwidthLimit');
    expect(src).toContain('export interface QosPolicy');
    expect(src).toContain('export interface TrafficShapingStats');
  });
  test('SKILL.md has correct triggers', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-traffic-shaping/SKILL.md'), 'utf-8');
    expect(skill).toContain('traffic_create_rule');
    expect(skill).toContain('traffic_set_bandwidth');
    expect(skill).toContain('traffic_set_qos');
  });
});

describe('Eidolon wiring — Batches 108-112', () => {
  const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
  const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');

  test('BK has all 5 new building kinds', () => {
    expect(types).toContain("'edge_node'");
    expect(types).toContain("'api_version_tower'");
    expect(types).toContain("'compliance_scanner'");
    expect(types).toContain("'backup_vault'");
    expect(types).toContain("'traffic_shaper'");
  });

  test('EK has all 20 new event kinds', () => {
    expect(types).toContain("'edge.node_provisioned'");
    expect(types).toContain("'apiver.version_published'");
    expect(types).toContain("'compliance.scan_completed'");
    expect(types).toContain("'backup.snapshot_completed'");
    expect(types).toContain("'traffic.qos_applied'");
  });

  test('districtFor maps all 5 new buildings', () => {
    const districtMatches = types.match(/case 'edge_node':/g) || [];
    expect(districtMatches.length).toBeGreaterThanOrEqual(3);
  });

  test('SUBJECT_MAP has 20 new entries', () => {
    expect(eventBus).toContain("'sven.edge.node_provisioned'");
    expect(eventBus).toContain("'sven.apiver.version_published'");
    expect(eventBus).toContain("'sven.compliance.scan_completed'");
    expect(eventBus).toContain("'sven.backup.snapshot_completed'");
    expect(eventBus).toContain("'sven.traffic.usage_report'");
  });
});

describe('Task executor wiring — Batches 108-112', () => {
  const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

  test('has 30 new switch cases', () => {
    expect(te).toContain("case 'edge_deploy_node':");
    expect(te).toContain("case 'apiver_publish_version':");
    expect(te).toContain("case 'compliance_create_policy':");
    expect(te).toContain("case 'backup_create_schedule':");
    expect(te).toContain("case 'traffic_create_rule':");
  });

  test('has 30 new handler methods', () => {
    expect(te).toContain('handleEdgeDeployNode');
    expect(te).toContain('handleApiverPublishVersion');
    expect(te).toContain('handleComplianceCreatePolicy');
    expect(te).toContain('handleBackupCreateSchedule');
    expect(te).toContain('handleTrafficCreateRule');
  });
});

describe('Shared index exports', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
  test('exports all 5 new modules', () => {
    expect(idx).toContain("from './agent-edge-computing.js'");
    expect(idx).toContain("from './agent-api-versioning.js'");
    expect(idx).toContain("from './agent-compliance-scanner.js'");
    expect(idx).toContain("from './agent-backup-scheduling.js'");
    expect(idx).toContain("from './agent-traffic-shaping.js'");
  });
});
