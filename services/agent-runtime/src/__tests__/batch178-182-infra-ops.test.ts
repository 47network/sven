/**
 * Batch 178-182: Infrastructure Operations Tests
 * Verticals: Quota Enforcement, Runbook Automation, Network Scanner, DNS Manager, Inventory Sync
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'services', 'gateway-api', 'migrations');
const SHARED = path.join(ROOT, 'packages', 'shared', 'src');
const SKILLS = path.join(ROOT, 'skills');
const EIDOLON_TYPES = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
const EVENT_BUS = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts');
const TASK_EXECUTOR = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
const INDEX = path.join(SHARED, 'index.ts');

// ─── Migration SQL Tests ────────────────────────────────────────────────────

describe('Batch 178: Quota Enforcement Migration', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '20260618150000_agent_quota_enforcement.sql'), 'utf-8');

  test('creates agent_quota_policies table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_quota_policies'); });
  test('creates agent_quota_usage table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_quota_usage'); });
  test('creates agent_quota_alerts table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_quota_alerts'); });
  test('has resource_type column', () => { expect(sql).toContain('resource_type'); });
  test('has enforcement_action column', () => { expect(sql).toContain('enforcement_action'); });
  test('has period column', () => { expect(sql).toContain('period'); });
  test('has overage_amount column', () => { expect(sql).toContain('overage_amount'); });
  test('has threshold_percent column', () => { expect(sql).toContain('threshold_percent'); });
  test('has indexes', () => { expect(sql).toContain('CREATE INDEX'); });
});

describe('Batch 179: Runbook Automation Migration', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '20260618160000_agent_runbook_automation.sql'), 'utf-8');

  test('creates agent_runbooks table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_runbooks'); });
  test('creates agent_runbook_executions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_runbook_executions'); });
  test('creates agent_runbook_approvals table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_runbook_approvals'); });
  test('has trigger_type column', () => { expect(sql).toContain('trigger_type'); });
  test('has steps column', () => { expect(sql).toContain('steps'); });
  test('has required_approvals column', () => { expect(sql).toContain('required_approvals'); });
  test('has rollback_steps column', () => { expect(sql).toContain('rollback_steps'); });
  test('has step_results column', () => { expect(sql).toContain('step_results'); });
  test('has indexes', () => { expect(sql).toContain('CREATE INDEX'); });
});

describe('Batch 180: Network Scanner Migration', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '20260618170000_agent_network_scanner.sql'), 'utf-8');

  test('creates agent_network_scans table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_network_scans'); });
  test('creates agent_network_hosts table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_network_hosts'); });
  test('creates agent_network_vulnerabilities table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_network_vulnerabilities'); });
  test('has scan_type column', () => { expect(sql).toContain('scan_type'); });
  test('has target_range column', () => { expect(sql).toContain('target_range'); });
  test('has ip_address column', () => { expect(sql).toContain('ip_address'); });
  test('has cve_id column', () => { expect(sql).toContain('cve_id'); });
  test('has severity column', () => { expect(sql).toContain('severity'); });
  test('has indexes', () => { expect(sql).toContain('CREATE INDEX'); });
});

describe('Batch 181: DNS Manager Migration', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '20260618180000_agent_dns_manager.sql'), 'utf-8');

  test('creates agent_dns_zones table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dns_zones'); });
  test('creates agent_dns_records table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dns_records'); });
  test('creates agent_dns_health_checks table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dns_health_checks'); });
  test('has domain column', () => { expect(sql).toContain('domain'); });
  test('has record_type column', () => { expect(sql).toContain('record_type'); });
  test('has nameservers column', () => { expect(sql).toContain('nameservers'); });
  test('has ttl column', () => { expect(sql).toContain('ttl'); });
  test('has health_check columns', () => { expect(sql).toContain('healthy_threshold'); });
  test('has indexes', () => { expect(sql).toContain('CREATE INDEX'); });
});

describe('Batch 182: Inventory Sync Migration', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '20260618190000_agent_inventory_sync.sql'), 'utf-8');

  test('creates agent_inventory_assets table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_inventory_assets'); });
  test('creates agent_inventory_sync_jobs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_inventory_sync_jobs'); });
  test('creates agent_inventory_changes table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_inventory_changes'); });
  test('has asset_type column', () => { expect(sql).toContain('asset_type'); });
  test('has environment column', () => { expect(sql).toContain('environment'); });
  test('has sync_type column', () => { expect(sql).toContain('sync_type'); });
  test('has change_type column', () => { expect(sql).toContain('change_type'); });
  test('has cost_per_month column', () => { expect(sql).toContain('cost_per_month'); });
  test('has indexes', () => { expect(sql).toContain('CREATE INDEX'); });
});

// ─── Shared Type Module Tests ────────────────────────────────────────────────

describe('Batch 178: Quota Enforcement Types', () => {
  const src = fs.readFileSync(path.join(SHARED, 'agent-quota-enforcement.ts'), 'utf-8');

  test('exports QuotaResourceType', () => { expect(src).toContain('QuotaResourceType'); });
  test('exports QuotaEnforcementAction', () => { expect(src).toContain('QuotaEnforcementAction'); });
  test('exports QuotaPeriod', () => { expect(src).toContain('QuotaPeriod'); });
  test('exports QuotaUsageStatus', () => { expect(src).toContain('QuotaUsageStatus'); });
  test('exports QuotaAlertType', () => { expect(src).toContain('QuotaAlertType'); });
  test('exports QuotaPolicy interface', () => { expect(src).toContain('interface QuotaPolicy'); });
  test('exports QuotaUsage interface', () => { expect(src).toContain('interface QuotaUsage'); });
  test('exports QuotaAlert interface', () => { expect(src).toContain('interface QuotaAlert'); });
});

describe('Batch 179: Runbook Automation Types', () => {
  const src = fs.readFileSync(path.join(SHARED, 'agent-runbook-automation.ts'), 'utf-8');

  test('exports RunbookCategory', () => { expect(src).toContain('RunbookCategory'); });
  test('exports RunbookTriggerType', () => { expect(src).toContain('RunbookTriggerType'); });
  test('exports RunbookExecutionStatus', () => { expect(src).toContain('RunbookExecutionStatus'); });
  test('exports RunbookApprovalStatus', () => { expect(src).toContain('RunbookApprovalStatus'); });
  test('exports Runbook interface', () => { expect(src).toContain('interface Runbook'); });
  test('exports RunbookExecution interface', () => { expect(src).toContain('interface RunbookExecution'); });
  test('exports RunbookApproval interface', () => { expect(src).toContain('interface RunbookApproval'); });
  test('exports RunbookStep interface', () => { expect(src).toContain('interface RunbookStep'); });
});

describe('Batch 180: Network Scanner Types', () => {
  const src = fs.readFileSync(path.join(SHARED, 'agent-network-scanner.ts'), 'utf-8');

  test('exports NetworkScanType', () => { expect(src).toContain('NetworkScanType'); });
  test('exports NetworkProtocol', () => { expect(src).toContain('NetworkProtocol'); });
  test('exports NetworkScanStatus', () => { expect(src).toContain('NetworkScanStatus'); });
  test('exports NetworkHostStatus', () => { expect(src).toContain('NetworkHostStatus'); });
  test('exports NetworkVulnSeverity', () => { expect(src).toContain('NetworkVulnSeverity'); });
  test('exports NetworkScan interface', () => { expect(src).toContain('interface NetworkScan'); });
  test('exports NetworkHost interface', () => { expect(src).toContain('interface NetworkHost'); });
  test('exports NetworkVulnerability interface', () => { expect(src).toContain('interface NetworkVulnerability'); });
});

describe('Batch 181: DNS Manager Types', () => {
  const src = fs.readFileSync(path.join(SHARED, 'agent-dns-manager.ts'), 'utf-8');

  test('exports DnsZoneType', () => { expect(src).toContain('DnsZoneType'); });
  test('exports DnsRecordType', () => { expect(src).toContain('DnsRecordType'); });
  test('exports DnsZoneStatus', () => { expect(src).toContain('DnsZoneStatus'); });
  test('exports DnsRecordStatus', () => { expect(src).toContain('DnsRecordStatus'); });
  test('exports DnsHealthCheckType', () => { expect(src).toContain('DnsHealthCheckType'); });
  test('exports DnsHealthStatus', () => { expect(src).toContain('DnsHealthStatus'); });
  test('exports DnsZone interface', () => { expect(src).toContain('interface DnsZone'); });
  test('exports DnsRecord interface', () => { expect(src).toContain('interface DnsRecord'); });
  test('exports DnsHealthCheck interface', () => { expect(src).toContain('interface DnsHealthCheck'); });
});

describe('Batch 182: Inventory Sync Types', () => {
  const src = fs.readFileSync(path.join(SHARED, 'agent-inventory-sync.ts'), 'utf-8');

  test('exports InventoryAssetType', () => { expect(src).toContain('InventoryAssetType'); });
  test('exports InventoryEnvironment', () => { expect(src).toContain('InventoryEnvironment'); });
  test('exports InventoryAssetStatus', () => { expect(src).toContain('InventoryAssetStatus'); });
  test('exports InventorySyncType', () => { expect(src).toContain('InventorySyncType'); });
  test('exports InventorySyncStatus', () => { expect(src).toContain('InventorySyncStatus'); });
  test('exports InventoryChangeType', () => { expect(src).toContain('InventoryChangeType'); });
  test('exports InventoryAsset interface', () => { expect(src).toContain('interface InventoryAsset'); });
  test('exports InventorySyncJob interface', () => { expect(src).toContain('interface InventorySyncJob'); });
  test('exports InventoryChange interface', () => { expect(src).toContain('interface InventoryChange'); });
});

// ─── Barrel Export Tests ─────────────────────────────────────────────────────

describe('Barrel Exports (index.ts)', () => {
  const idx = fs.readFileSync(INDEX, 'utf-8');

  test('exports agent-quota-enforcement', () => { expect(idx).toContain("from './agent-quota-enforcement.js'"); });
  test('exports agent-runbook-automation', () => { expect(idx).toContain("from './agent-runbook-automation.js'"); });
  test('exports agent-network-scanner', () => { expect(idx).toContain("from './agent-network-scanner.js'"); });
  test('exports agent-dns-manager', () => { expect(idx).toContain("from './agent-dns-manager.js'"); });
  test('exports agent-inventory-sync', () => { expect(idx).toContain("from './agent-inventory-sync.js'"); });
});

// ─── SKILL.md Tests ──────────────────────────────────────────────────────────

describe('SKILL.md Files', () => {
  const skills = [
    'agent-quota-enforcement',
    'agent-runbook-automation',
    'agent-network-scanner',
    'agent-dns-manager',
    'agent-inventory-sync',
  ];

  skills.forEach(s => {
    test(`${s}/SKILL.md exists`, () => {
      expect(fs.existsSync(path.join(SKILLS, s, 'SKILL.md'))).toBe(true);
    });
    test(`${s}/SKILL.md has YAML frontmatter`, () => {
      const md = fs.readFileSync(path.join(SKILLS, s, 'SKILL.md'), 'utf-8');
      expect(md).toMatch(/^---\n/);
      expect(md).toContain('name:');
      expect(md).toContain('description:');
      expect(md).toContain('pricing:');
      expect(md).toContain('actions:');
    });
  });
});

// ─── Eidolon Types Tests ─────────────────────────────────────────────────────

describe('Eidolon BK/EK/districtFor', () => {
  const types = fs.readFileSync(EIDOLON_TYPES, 'utf-8');

  // BK
  test('has quota_gate BK', () => { expect(types).toContain("'quota_gate'"); });
  test('has runbook_forge BK', () => { expect(types).toContain("'runbook_forge'"); });
  test('has network_scanner BK', () => { expect(types).toContain("'network_scanner'"); });
  test('has dns_tower BK', () => { expect(types).toContain("'dns_tower'"); });
  test('has inventory_depot BK', () => { expect(types).toContain("'inventory_depot'"); });

  // EK
  test('has quota.policy_created EK', () => { expect(types).toContain("'quota.policy_created'"); });
  test('has quota.limit_reached EK', () => { expect(types).toContain("'quota.limit_reached'"); });
  test('has quota.overage_detected EK', () => { expect(types).toContain("'quota.overage_detected'"); });
  test('has quota.enforcement_applied EK', () => { expect(types).toContain("'quota.enforcement_applied'"); });
  test('has runbook.runbook_triggered EK', () => { expect(types).toContain("'runbook.runbook_triggered'"); });
  test('has runbook.step_completed EK', () => { expect(types).toContain("'runbook.step_completed'"); });
  test('has runbook.execution_finished EK', () => { expect(types).toContain("'runbook.execution_finished'"); });
  test('has runbook.approval_required EK', () => { expect(types).toContain("'runbook.approval_required'"); });
  test('has netscan.scan_started EK', () => { expect(types).toContain("'netscan.scan_started'"); });
  test('has netscan.host_discovered EK', () => { expect(types).toContain("'netscan.host_discovered'"); });
  test('has netscan.vulnerability_found EK', () => { expect(types).toContain("'netscan.vulnerability_found'"); });
  test('has netscan.scan_completed EK', () => { expect(types).toContain("'netscan.scan_completed'"); });
  test('has dns.zone_created EK', () => { expect(types).toContain("'dns.zone_created'"); });
  test('has dns.record_updated EK', () => { expect(types).toContain("'dns.record_updated'"); });
  test('has dns.health_check_failed EK', () => { expect(types).toContain("'dns.health_check_failed'"); });
  test('has dns.failover_triggered EK', () => { expect(types).toContain("'dns.failover_triggered'"); });
  test('has inventory.asset_discovered EK', () => { expect(types).toContain("'inventory.asset_discovered'"); });
  test('has inventory.sync_completed EK', () => { expect(types).toContain("'inventory.sync_completed'"); });
  test('has inventory.conflict_detected EK', () => { expect(types).toContain("'inventory.conflict_detected'"); });
  test('has inventory.asset_decommissioned EK', () => { expect(types).toContain("'inventory.asset_decommissioned'"); });

  // districtFor
  test('districtFor has quota_gate case', () => { expect(types).toContain("case 'quota_gate':"); });
  test('districtFor has runbook_forge case', () => { expect(types).toContain("case 'runbook_forge':"); });
  test('districtFor has network_scanner case', () => { expect(types).toContain("case 'network_scanner':"); });
  test('districtFor has dns_tower case', () => { expect(types).toContain("case 'dns_tower':"); });
  test('districtFor has inventory_depot case', () => { expect(types).toContain("case 'inventory_depot':"); });
});

// ─── Event Bus SUBJECT_MAP Tests ─────────────────────────────────────────────

describe('Event Bus SUBJECT_MAP', () => {
  const bus = fs.readFileSync(EVENT_BUS, 'utf-8');

  const subjects = [
    'sven.quota.policy_created', 'sven.quota.limit_reached', 'sven.quota.overage_detected', 'sven.quota.enforcement_applied',
    'sven.runbook.runbook_triggered', 'sven.runbook.step_completed', 'sven.runbook.execution_finished', 'sven.runbook.approval_required',
    'sven.netscan.scan_started', 'sven.netscan.host_discovered', 'sven.netscan.vulnerability_found', 'sven.netscan.scan_completed',
    'sven.dns.zone_created', 'sven.dns.record_updated', 'sven.dns.health_check_failed', 'sven.dns.failover_triggered',
    'sven.inventory.asset_discovered', 'sven.inventory.sync_completed', 'sven.inventory.conflict_detected', 'sven.inventory.asset_decommissioned',
  ];

  subjects.forEach(s => {
    test(`has ${s}`, () => { expect(bus).toContain(`'${s}'`); });
  });
});

// ─── Task Executor Tests ─────────────────────────────────────────────────────

describe('Task Executor Switch Cases', () => {
  const te = fs.readFileSync(TASK_EXECUTOR, 'utf-8');

  const cases = [
    'quota_create_policy', 'quota_check_usage', 'quota_enforce_limit', 'quota_handle_overage', 'quota_update_quota', 'quota_generate_report',
    'runbook_create_runbook', 'runbook_trigger_execution', 'runbook_approve_step', 'runbook_rollback_execution', 'runbook_list_executions', 'runbook_update_runbook',
    'netscan_start_scan', 'netscan_discover_hosts', 'netscan_scan_vulnerabilities', 'netscan_generate_topology', 'netscan_export_results', 'netscan_schedule_scan',
    'dns_create_zone', 'dns_manage_record', 'dns_check_health', 'dns_configure_failover', 'dns_sync_dns', 'dns_audit_records',
    'inventory_discover_assets', 'inventory_run_sync', 'inventory_resolve_conflicts', 'inventory_decommission_asset', 'inventory_generate_report', 'inventory_compare_environments',
  ];

  cases.forEach(c => {
    test(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); });
  });
});

describe('Task Executor Handlers', () => {
  const te = fs.readFileSync(TASK_EXECUTOR, 'utf-8');

  const handlers = [
    'handleQuotaCreatePolicy', 'handleQuotaCheckUsage', 'handleQuotaEnforceLimit', 'handleQuotaHandleOverage', 'handleQuotaUpdateQuota', 'handleQuotaGenerateReport',
    'handleRunbookCreateRunbook', 'handleRunbookTriggerExecution', 'handleRunbookApproveStep', 'handleRunbookRollbackExecution', 'handleRunbookListExecutions', 'handleRunbookUpdateRunbook',
    'handleNetscanStartScan', 'handleNetscanDiscoverHosts', 'handleNetscanScanVulnerabilities', 'handleNetscanGenerateTopology', 'handleNetscanExportResults', 'handleNetscanScheduleScan',
    'handleDnsCreateZone', 'handleDnsManageRecord', 'handleDnsCheckHealth', 'handleDnsConfigureFailover', 'handleDnsSyncDns', 'handleDnsAuditRecords',
    'handleInventoryDiscoverAssets', 'handleInventoryRunSync', 'handleInventoryResolveConflicts', 'handleInventoryDecommissionAsset', 'handleInventoryGenerateReport', 'handleInventoryCompareEnvironments',
  ];

  handlers.forEach(h => {
    test(`has ${h} method`, () => { expect(te).toContain(`${h}(task`); });
  });
});

// ─── .gitattributes Tests ────────────────────────────────────────────────────

describe('.gitattributes Privacy Filters', () => {
  const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

  const entries = [
    'agent_quota_enforcement.sql',
    'agent-quota-enforcement.ts',
    'agent_runbook_automation.sql',
    'agent-runbook-automation.ts',
    'agent_network_scanner.sql',
    'agent-network-scanner.ts',
    'agent_dns_manager.sql',
    'agent-dns-manager.ts',
    'agent_inventory_sync.sql',
    'agent-inventory-sync.ts',
  ];

  entries.forEach(e => {
    test(`has ${e} filter`, () => { expect(ga).toContain(e); });
  });
});
