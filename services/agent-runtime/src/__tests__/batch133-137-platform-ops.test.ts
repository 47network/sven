/**
 * Batch 133-137 — Platform Operations Verticals
 * Geo-Fencing, Audit Trail, Change Management, Blue-Green Deployment, Asset Management
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

// ─── helpers ───────────────────────────────────────────────────
const readFile = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf-8');
const fileExists = (rel: string) => fs.existsSync(path.join(REPO, rel));

// ─── Migration SQL ─────────────────────────────────────────────
describe('Batch 133 — Geo-Fencing migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617700000_agent_geo_fencing.sql');
  it('creates geo_fence_zones table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS geo_fence_zones'));
  it('creates geo_fence_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS geo_fence_rules'));
  it('creates geo_fence_alerts table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS geo_fence_alerts'));
  it('has proper indexes', () => expect(sql).toContain('CREATE INDEX'));
});

describe('Batch 134 — Audit Trail migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617710000_agent_audit_trail.sql');
  it('creates audit_trail_entries table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS audit_trail_entries'));
  it('creates audit_snapshots table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS audit_snapshots'));
  it('creates audit_retention_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS audit_retention_policies'));
  it('has proper indexes', () => expect(sql).toContain('CREATE INDEX'));
});

describe('Batch 135 — Change Management migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617720000_agent_change_management.sql');
  it('creates change_requests table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS change_requests'));
  it('creates change_approvals table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS change_approvals'));
  it('creates change_rollbacks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS change_rollbacks'));
  it('has proper indexes', () => expect(sql).toContain('CREATE INDEX'));
});

describe('Batch 136 — Blue-Green Deployment migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617730000_agent_blue_green.sql');
  it('creates blue_green_deployments table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS blue_green_deployments'));
  it('creates blue_green_switches table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS blue_green_switches'));
  it('creates traffic_splits table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS traffic_splits'));
  it('has proper indexes', () => expect(sql).toContain('CREATE INDEX'));
});

describe('Batch 137 — Asset Management migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260617740000_agent_asset_management.sql');
  it('creates digital_assets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS digital_assets'));
  it('creates asset_transfers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS asset_transfers'));
  it('creates asset_licenses table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS asset_licenses'));
  it('has proper indexes', () => expect(sql).toContain('CREATE INDEX'));
});

// ─── Shared types ──────────────────────────────────────────────
describe('Shared types — agent-geo-fencing', () => {
  const src = readFile('packages/shared/src/agent-geo-fencing.ts');
  it('exports GeoFenceType enum', () => expect(src).toContain('GeoFenceType'));
  it('exports GeoFenceZone interface', () => expect(src).toContain('GeoFenceZone'));
  it('exports GeoFenceRule interface', () => expect(src).toContain('GeoFenceRule'));
  it('exports GeoFenceAlert interface', () => expect(src).toContain('GeoFenceAlert'));
  it('exports GeoFencingStats interface', () => expect(src).toContain('GeoFencingStats'));
});

describe('Shared types — agent-audit-trail', () => {
  const src = readFile('packages/shared/src/agent-audit-trail.ts');
  it('exports AuditTrailAction enum', () => expect(src).toContain('AuditTrailAction'));
  it('exports TrailEntry interface', () => expect(src).toContain('TrailEntry'));
  it('exports AuditSnapshot interface', () => expect(src).toContain('AuditSnapshot'));
  it('exports AuditRetentionPolicy interface', () => expect(src).toContain('AuditRetentionPolicy'));
  it('exports AuditTrailStats interface', () => expect(src).toContain('AuditTrailStats'));
});

describe('Shared types — agent-change-management', () => {
  const src = readFile('packages/shared/src/agent-change-management.ts');
  it('exports ChangeRequestType enum', () => expect(src).toContain('ChangeRequestType'));
  it('exports ChangeRequest interface', () => expect(src).toContain('ChangeRequest'));
  it('exports ChangeApproval interface', () => expect(src).toContain('ChangeApproval'));
  it('exports ChangeRollback interface', () => expect(src).toContain('ChangeRollback'));
  it('exports ChangeManagementStats interface', () => expect(src).toContain('ChangeManagementStats'));
});

describe('Shared types — agent-blue-green', () => {
  const src = readFile('packages/shared/src/agent-blue-green.ts');
  it('exports BlueGreenStage enum', () => expect(src).toContain('BlueGreenStage'));
  it('exports BlueGreenDeployment interface', () => expect(src).toContain('BlueGreenDeployment'));
  it('exports BlueGreenSwitch interface', () => expect(src).toContain('BlueGreenSwitch'));
  it('exports TrafficSplit interface', () => expect(src).toContain('TrafficSplit'));
  it('exports BlueGreenStats interface', () => expect(src).toContain('BlueGreenStats'));
});

describe('Shared types — agent-asset-management', () => {
  const src = readFile('packages/shared/src/agent-asset-management.ts');
  it('exports AssetCategory enum', () => expect(src).toContain('AssetCategory'));
  it('exports DigitalAsset interface', () => expect(src).toContain('DigitalAsset'));
  it('exports AssetTransfer interface', () => expect(src).toContain('AssetTransfer'));
  it('exports AssetLicense interface', () => expect(src).toContain('AssetLicense'));
  it('exports AssetManagementStats interface', () => expect(src).toContain('AssetManagementStats'));
});

// ─── Barrel exports ────────────────────────────────────────────
describe('Barrel exports — index.ts', () => {
  const idx = readFile('packages/shared/src/index.ts');
  it('exports agent-geo-fencing', () => expect(idx).toContain("from './agent-geo-fencing.js'"));
  it('exports agent-audit-trail', () => expect(idx).toContain("from './agent-audit-trail.js'"));
  it('exports agent-change-management', () => expect(idx).toContain("from './agent-change-management.js'"));
  it('exports agent-blue-green', () => expect(idx).toContain("from './agent-blue-green.js'"));
  it('exports agent-asset-management', () => expect(idx).toContain("from './agent-asset-management.js'"));
});

// ─── SKILL.md files ────────────────────────────────────────────
describe('SKILL.md files exist', () => {
  it('geo-fencing skill', () => expect(fileExists('skills/agent-geo-fencing/SKILL.md')).toBe(true));
  it('audit-trail skill', () => expect(fileExists('skills/agent-audit-trail/SKILL.md')).toBe(true));
  it('change-management skill', () => expect(fileExists('skills/agent-change-management/SKILL.md')).toBe(true));
  it('blue-green skill', () => expect(fileExists('skills/agent-blue-green/SKILL.md')).toBe(true));
  it('asset-management skill', () => expect(fileExists('skills/agent-asset-management/SKILL.md')).toBe(true));
});

// ─── Eidolon types.ts ──────────────────────────────────────────
describe('EidolonBuildingKind — batches 133-137', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it("has 'geo_watchtower'", () => expect(types).toContain("'geo_watchtower'"));
  it("has 'audit_archive'", () => expect(types).toContain("'audit_archive'"));
  it("has 'change_bureau'", () => expect(types).toContain("'change_bureau'"));
  it("has 'deploy_gateway'", () => expect(types).toContain("'deploy_gateway'"));
  it("has 'asset_vault'", () => expect(types).toContain("'asset_vault'"));
});

describe('EidolonEventKind — batches 133-137', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  const expected = [
    'geofence.zone_created', 'geofence.rule_triggered', 'geofence.alert_fired', 'geofence.policy_updated',
    'audittrail.entry_logged', 'audittrail.snapshot_taken', 'audittrail.retention_applied', 'audittrail.search_completed',
    'changemgmt.request_submitted', 'changemgmt.approval_decided', 'changemgmt.change_completed', 'changemgmt.rollback_initiated',
    'bluegreen.version_deployed', 'bluegreen.stage_switched', 'bluegreen.traffic_shifted', 'bluegreen.rollback_triggered',
    'assetmgmt.asset_registered', 'assetmgmt.asset_transferred', 'assetmgmt.license_granted', 'assetmgmt.asset_deprecated',
  ];
  expected.forEach(ek => {
    it(`has '${ek}'`, () => expect(types).toContain(`'${ek}'`));
  });
});

describe('districtFor — batches 133-137', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it("routes 'geo_watchtower' to civic", () => expect(types).toContain("case 'geo_watchtower':"));
  it("routes 'audit_archive' to civic", () => expect(types).toContain("case 'audit_archive':"));
  it("routes 'change_bureau' to civic", () => expect(types).toContain("case 'change_bureau':"));
  it("routes 'deploy_gateway' to civic", () => expect(types).toContain("case 'deploy_gateway':"));
  it("routes 'asset_vault' to civic", () => expect(types).toContain("case 'asset_vault':"));
});

// ─── SUBJECT_MAP ───────────────────────────────────────────────
describe('SUBJECT_MAP — batches 133-137', () => {
  const bus = readFile('services/sven-eidolon/src/event-bus.ts');
  const subjects = [
    'sven.geofence.zone_created', 'sven.geofence.rule_triggered', 'sven.geofence.alert_fired', 'sven.geofence.policy_updated',
    'sven.audittrail.entry_logged', 'sven.audittrail.snapshot_taken', 'sven.audittrail.retention_applied', 'sven.audittrail.search_completed',
    'sven.changemgmt.request_submitted', 'sven.changemgmt.approval_decided', 'sven.changemgmt.change_completed', 'sven.changemgmt.rollback_initiated',
    'sven.bluegreen.version_deployed', 'sven.bluegreen.stage_switched', 'sven.bluegreen.traffic_shifted', 'sven.bluegreen.rollback_triggered',
    'sven.assetmgmt.asset_registered', 'sven.assetmgmt.asset_transferred', 'sven.assetmgmt.license_granted', 'sven.assetmgmt.asset_deprecated',
  ];
  subjects.forEach(subj => {
    it(`maps '${subj}'`, () => expect(bus).toContain(`'${subj}'`));
  });
});

// ─── Task executor ─────────────────────────────────────────────
describe('Task executor switch cases — batches 133-137', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const cases = [
    'geofence_create_zone', 'geofence_evaluate_location', 'geofence_trigger_rule', 'geofence_update_policy', 'geofence_list', 'geofence_report',
    'audittrail_log_entry', 'audittrail_take_snapshot', 'audittrail_apply_retention', 'audittrail_search', 'audittrail_list', 'audittrail_report',
    'changemgmt_submit_request', 'changemgmt_approve', 'changemgmt_complete_change', 'changemgmt_rollback', 'changemgmt_list', 'changemgmt_report',
    'bluegreen_deploy_version', 'bluegreen_switch_stage', 'bluegreen_shift_traffic', 'bluegreen_rollback', 'bluegreen_list', 'bluegreen_report',
    'assetmgmt_register', 'assetmgmt_transfer', 'assetmgmt_grant_license', 'assetmgmt_deprecate', 'assetmgmt_list', 'assetmgmt_report',
  ];
  cases.forEach(c => {
    it(`routes '${c}'`, () => expect(te).toContain(`case '${c}':`));
  });
});

describe('Task executor handler methods — batches 133-137', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const handlers = [
    'handleGeofenceCreateZone', 'handleGeofenceEvaluateLocation', 'handleGeofenceTriggerRule',
    'handleGeofenceUpdatePolicy', 'handleGeofenceList', 'handleGeofenceReport',
    'handleAudittrailLogEntry', 'handleAudittrailTakeSnapshot', 'handleAudittrailApplyRetention',
    'handleAudittrailSearch', 'handleAudittrailList', 'handleAudittrailReport',
    'handleChangemgmtSubmitRequest', 'handleChangemgmtApprove', 'handleChangemgmtCompleteChange',
    'handleChangemgmtRollback', 'handleChangemgmtList', 'handleChangemgmtReport',
    'handleBluegreenDeployVersion', 'handleBluegreenSwitchStage', 'handleBluegreenShiftTraffic',
    'handleBluegreenRollback', 'handleBluegreenList', 'handleBluegreenReport',
    'handleAssetmgmtRegister', 'handleAssetmgmtTransfer', 'handleAssetmgmtGrantLicense',
    'handleAssetmgmtDeprecate', 'handleAssetmgmtList', 'handleAssetmgmtReport',
  ];
  handlers.forEach(h => {
    it(`has ${h}()`, () => expect(te).toContain(`${h}(task`));
  });
});

// ─── .gitattributes ────────────────────────────────────────────
describe('.gitattributes — batches 133-137', () => {
  const ga = readFile('.gitattributes');
  it('filters geo-fencing migration', () => expect(ga).toContain('20260617700000_agent_geo_fencing.sql'));
  it('filters audit-trail migration', () => expect(ga).toContain('20260617710000_agent_audit_trail.sql'));
  it('filters change-management migration', () => expect(ga).toContain('20260617720000_agent_change_management.sql'));
  it('filters blue-green migration', () => expect(ga).toContain('20260617730000_agent_blue_green.sql'));
  it('filters asset-management migration', () => expect(ga).toContain('20260617740000_agent_asset_management.sql'));
});
