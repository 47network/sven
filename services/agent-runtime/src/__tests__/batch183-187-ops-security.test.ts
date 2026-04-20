import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 183-187: Operations & Security', () => {

  // ─── Batch 183: Patch Manager ───
  describe('Patch Manager Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618200000_agent_patch_manager.sql'), 'utf-8');
    it('creates agent_patch_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_patch_policies'));
    it('creates agent_patch_releases table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_patch_releases'));
    it('creates agent_patch_compliance table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_patch_compliance'));
    it('has policy status check constraint', () => expect(sql).toContain("('active','paused','disabled','archived')"));
    it('has release status check constraint', () => expect(sql).toContain("('pending','approved','rolling_out','completed','failed','rolled_back')"));
    it('has severity check constraint', () => expect(sql).toContain("('critical','high','medium','low','info')"));
    it('has compliance status check constraint', () => expect(sql).toContain("('compliant','non_compliant','pending','exempt','unknown')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_patch_policies_agent');
      expect(sql).toContain('idx_agent_patch_releases_policy');
      expect(sql).toContain('idx_agent_patch_compliance_policy');
    });
  });

  describe('Patch Manager Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-patch-manager.ts'), 'utf-8');
    it('exports PatchSeverity', () => expect(ts).toContain('export type PatchSeverity'));
    it('exports PatchPolicyStatus', () => expect(ts).toContain('export type PatchPolicyStatus'));
    it('exports PatchReleaseStatus', () => expect(ts).toContain('export type PatchReleaseStatus'));
    it('exports PatchComplianceStatus', () => expect(ts).toContain('export type PatchComplianceStatus'));
    it('exports PatchPolicy interface', () => expect(ts).toContain('export interface PatchPolicy'));
    it('exports PatchRelease interface', () => expect(ts).toContain('export interface PatchRelease'));
    it('exports PatchCompliance interface', () => expect(ts).toContain('export interface PatchCompliance'));
  });

  // ─── Batch 184: Firewall Controller ───
  describe('Firewall Controller Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618210000_agent_firewall_controller.sql'), 'utf-8');
    it('creates agent_firewall_rulesets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_firewall_rulesets'));
    it('creates agent_firewall_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_firewall_rules'));
    it('creates agent_firewall_threats table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_firewall_threats'));
    it('has direction check constraint', () => expect(sql).toContain("('inbound','outbound','both')"));
    it('has protocol check constraint', () => expect(sql).toContain("('tcp','udp','icmp','any')"));
    it('has threat type check constraint', () => expect(sql).toContain("('brute_force','port_scan','ddos','intrusion','malware','unknown')"));
    it('has action taken check constraint', () => expect(sql).toContain("('blocked','allowed','rate_limited','logged','quarantined')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_firewall_rulesets_agent');
      expect(sql).toContain('idx_agent_firewall_rules_ruleset');
      expect(sql).toContain('idx_agent_firewall_threats_type');
    });
  });

  describe('Firewall Controller Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-firewall-controller.ts'), 'utf-8');
    it('exports FirewallRulesetStatus', () => expect(ts).toContain('export type FirewallRulesetStatus'));
    it('exports FirewallDirection', () => expect(ts).toContain('export type FirewallDirection'));
    it('exports FirewallProtocol', () => expect(ts).toContain('export type FirewallProtocol'));
    it('exports FirewallThreatType', () => expect(ts).toContain('export type FirewallThreatType'));
    it('exports FirewallRuleset interface', () => expect(ts).toContain('export interface FirewallRuleset'));
    it('exports FirewallRule interface', () => expect(ts).toContain('export interface FirewallRule'));
    it('exports FirewallThreat interface', () => expect(ts).toContain('export interface FirewallThreat'));
  });

  // ─── Batch 185: Backup Orchestrator ───
  describe('Backup Orchestrator Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618220000_agent_backup_orchestrator.sql'), 'utf-8');
    it('creates agent_backup_plans table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_backup_plans'));
    it('creates agent_backup_jobs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_backup_jobs'));
    it('creates agent_backup_restores table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_backup_restores'));
    it('has source type check constraint', () => expect(sql).toContain("('database','filesystem','volume','snapshot','application','full_system')"));
    it('has compression check constraint', () => expect(sql).toContain("('none','gzip','zstd','lz4','snappy')"));
    it('has restore type check constraint', () => expect(sql).toContain("('full','partial','point_in_time','selective')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_backup_plans_agent');
      expect(sql).toContain('idx_agent_backup_jobs_plan');
      expect(sql).toContain('idx_agent_backup_restores_job');
    });
  });

  describe('Backup Orchestrator Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-backup-orchestrator.ts'), 'utf-8');
    it('exports BackupSourceType', () => expect(ts).toContain('export type BackupSourceType'));
    it('exports BackupCompression', () => expect(ts).toContain('export type BackupCompression'));
    it('exports BackupJobStatus', () => expect(ts).toContain('export type BackupJobStatus'));
    it('exports RestoreType', () => expect(ts).toContain('export type RestoreType'));
    it('exports BackupPlan interface', () => expect(ts).toContain('export interface BackupPlan'));
    it('exports BackupJob interface', () => expect(ts).toContain('export interface BackupJob'));
    it('exports BackupRestore interface', () => expect(ts).toContain('export interface BackupRestore'));
  });

  // ─── Batch 186: Storage Optimizer ───
  describe('Storage Optimizer Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618230000_agent_storage_optimizer.sql'), 'utf-8');
    it('creates agent_storage_volumes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_storage_volumes'));
    it('creates agent_storage_analyses table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_storage_analyses'));
    it('creates agent_storage_actions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_storage_actions'));
    it('has volume type check constraint', () => expect(sql).toContain("('block','object','file','archive','cache')"));
    it('has tier check constraint', () => expect(sql).toContain("('hot','warm','cold','archive','standard')"));
    it('has analysis type check constraint', () => expect(sql).toContain("('usage','dedup','tiering','lifecycle','cost','performance')"));
    it('has action type check constraint', () => expect(sql).toContain("('archive','delete','deduplicate','compress','tier_move','resize')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_storage_volumes_agent');
      expect(sql).toContain('idx_agent_storage_analyses_volume');
      expect(sql).toContain('idx_agent_storage_actions_analysis');
    });
  });

  describe('Storage Optimizer Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-storage-optimizer.ts'), 'utf-8');
    it('exports StorageVolumeType', () => expect(ts).toContain('export type StorageVolumeType'));
    it('exports StorageTier', () => expect(ts).toContain('export type StorageTier'));
    it('exports StorageAnalysisType', () => expect(ts).toContain('export type StorageAnalysisType'));
    it('exports StorageActionType', () => expect(ts).toContain('export type StorageActionType'));
    it('exports StorageVolume interface', () => expect(ts).toContain('export interface StorageVolume'));
    it('exports StorageAnalysis interface', () => expect(ts).toContain('export interface StorageAnalysis'));
    it('exports StorageAction interface', () => expect(ts).toContain('export interface StorageAction'));
  });

  // ─── Batch 187: Health Monitor ───
  describe('Health Monitor Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618240000_agent_health_monitor.sql'), 'utf-8');
    it('creates agent_health_endpoints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_endpoints'));
    it('creates agent_health_checks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_checks'));
    it('creates agent_health_incidents table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_incidents'));
    it('has check type constraint', () => expect(sql).toContain("('http','tcp','dns','icmp','grpc','websocket','custom')"));
    it('has endpoint status constraint', () => expect(sql).toContain("('healthy','degraded','unhealthy','unknown','maintenance')"));
    it('has incident type constraint', () => expect(sql).toContain("('outage','degradation','latency_spike','error_rate','certificate','dns_failure')"));
    it('has incident status constraint', () => expect(sql).toContain("('open','investigating','identified','monitoring','resolved')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_health_endpoints_agent');
      expect(sql).toContain('idx_agent_health_checks_endpoint');
      expect(sql).toContain('idx_agent_health_incidents_endpoint');
    });
  });

  describe('Health Monitor Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-health-monitor.ts'), 'utf-8');
    it('exports HealthCheckType', () => expect(ts).toContain('export type HealthCheckType'));
    it('exports HealthEndpointStatus', () => expect(ts).toContain('export type HealthEndpointStatus'));
    it('exports HealthCheckResult', () => expect(ts).toContain('export type HealthCheckResult'));
    it('exports HealthIncidentType', () => expect(ts).toContain('export type HealthIncidentType'));
    it('exports HealthIncidentStatus', () => expect(ts).toContain('export type HealthIncidentStatus'));
    it('exports HealthEndpoint interface', () => expect(ts).toContain('export interface HealthEndpoint'));
    it('exports HealthCheck interface', () => expect(ts).toContain('export interface HealthCheck'));
    it('exports HealthIncident interface', () => expect(ts).toContain('export interface HealthIncident'));
  });

  // ─── Barrel Exports ───
  describe('Barrel Exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-patch-manager', () => expect(idx).toContain("from './agent-patch-manager.js'"));
    it('exports agent-firewall-controller', () => expect(idx).toContain("from './agent-firewall-controller.js'"));
    it('exports agent-backup-orchestrator', () => expect(idx).toContain("from './agent-backup-orchestrator.js'"));
    it('exports agent-storage-optimizer', () => expect(idx).toContain("from './agent-storage-optimizer.js'"));
    it('exports agent-health-monitor', () => expect(idx).toContain("from './agent-health-monitor.js'"));
  });

  // ─── SKILL.md Files ───
  describe('SKILL.md Files', () => {
    const skills = ['agent-patch-manager', 'agent-firewall-controller', 'agent-backup-orchestrator', 'agent-storage-optimizer', 'agent-health-monitor'];
    for (const skill of skills) {
      it(`${skill}/SKILL.md exists`, () => {
        expect(fs.existsSync(path.join(ROOT, `skills/${skill}/SKILL.md`))).toBe(true);
      });
      it(`${skill}/SKILL.md has YAML frontmatter`, () => {
        const md = fs.readFileSync(path.join(ROOT, `skills/${skill}/SKILL.md`), 'utf-8');
        expect(md).toMatch(/^---\n/);
        expect(md).toContain('name:');
        expect(md).toContain('pricing:');
      });
    }
  });

  // ─── Eidolon Wiring ───
  describe('Eidolon Types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has patch_manager BK', () => expect(types).toContain("'patch_manager'"));
    it('has firewall_controller BK', () => expect(types).toContain("'firewall_controller'"));
    it('has backup_orchestrator BK', () => expect(types).toContain("'backup_orchestrator'"));
    it('has storage_optimizer BK', () => expect(types).toContain("'storage_optimizer'"));
    it('has health_monitor BK', () => expect(types).toContain("'health_monitor'"));
    it('has patch EK values', () => {
      expect(types).toContain("'patch.policy_created'");
      expect(types).toContain("'patch.rollout_completed'");
      expect(types).toContain("'patch.compliance_failed'");
    });
    it('has firewall EK values', () => {
      expect(types).toContain("'firewall.ruleset_created'");
      expect(types).toContain("'firewall.threat_blocked'");
    });
    it('has backup EK values', () => {
      expect(types).toContain("'backup.plan_created'");
      expect(types).toContain("'backup.restore_verified'");
    });
    it('has storage EK values', () => {
      expect(types).toContain("'storage.analysis_completed'");
      expect(types).toContain("'storage.savings_realized'");
    });
    it('has health EK values', () => {
      expect(types).toContain("'health.endpoint_added'");
      expect(types).toContain("'health.incident_resolved'");
    });
    it('has districtFor patch_manager', () => expect(types).toContain("case 'patch_manager'"));
    it('has districtFor firewall_controller', () => expect(types).toContain("case 'firewall_controller'"));
    it('has districtFor backup_orchestrator', () => expect(types).toContain("case 'backup_orchestrator'"));
    it('has districtFor storage_optimizer', () => expect(types).toContain("case 'storage_optimizer'"));
    it('has districtFor health_monitor', () => expect(types).toContain("case 'health_monitor'"));
  });

  // ─── Event Bus ───
  describe('Event Bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.patch.policy_created', 'sven.patch.release_approved', 'sven.patch.rollout_completed', 'sven.patch.compliance_failed',
      'sven.firewall.ruleset_created', 'sven.firewall.rule_added', 'sven.firewall.threat_blocked', 'sven.firewall.audit_completed',
      'sven.backup.plan_created', 'sven.backup.job_completed', 'sven.backup.restore_verified', 'sven.backup.retention_cleaned',
      'sven.storage.analysis_completed', 'sven.storage.dedup_finished', 'sven.storage.tier_moved', 'sven.storage.savings_realized',
      'sven.health.endpoint_added', 'sven.health.check_failed', 'sven.health.incident_opened', 'sven.health.incident_resolved',
    ];
    for (const s of subjects) {
      it(`has ${s}`, () => expect(eb).toContain(`'${s}'`));
    }
  });

  // ─── Task Executor ───
  describe('Task Executor Switch Cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'patch_create_policy', 'patch_approve_release', 'patch_rollout_patch', 'patch_check_compliance', 'patch_rollback_release', 'patch_scan_vulnerabilities',
      'firewall_create_ruleset', 'firewall_add_rule', 'firewall_remove_rule', 'firewall_block_threat', 'firewall_audit_rules', 'firewall_test_ruleset',
      'backup_create_plan', 'backup_execute_backup', 'backup_restore_backup', 'backup_verify_restore', 'backup_test_recovery', 'backup_cleanup_expired',
      'storage_analyze_usage', 'storage_find_duplicates', 'storage_recommend_tiering', 'storage_execute_cleanup', 'storage_resize_volume', 'storage_calculate_savings',
      'health_add_endpoint', 'health_run_check', 'health_create_incident', 'health_resolve_incident', 'health_generate_report', 'health_configure_alerts',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task Executor Handler Methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handlePatchCreatePolicy', 'handlePatchApproveRelease', 'handlePatchRolloutPatch', 'handlePatchCheckCompliance', 'handlePatchRollbackRelease', 'handlePatchScanVulnerabilities',
      'handleFirewallCreateRuleset', 'handleFirewallAddRule', 'handleFirewallRemoveRule', 'handleFirewallBlockThreat', 'handleFirewallAuditRules', 'handleFirewallTestRuleset',
      'handleBackupCreatePlan', 'handleBackupExecuteBackup', 'handleBackupRestoreBackup', 'handleBackupVerifyRestore', 'handleBackupTestRecovery', 'handleBackupCleanupExpired',
      'handleStorageAnalyzeUsage', 'handleStorageFindDuplicates', 'handleStorageRecommendTiering', 'handleStorageExecuteCleanup', 'handleStorageResizeVolume', 'handleStorageCalculateSavings',
      'handleHealthAddEndpoint', 'handleHealthRunCheck', 'handleHealthCreateIncident', 'handleHealthResolveIncident', 'handleHealthGenerateReport', 'handleHealthConfigureAlerts',
    ];
    for (const h of handlers) {
      it(`has ${h} method`, () => expect(te).toContain(`${h}(task`));
    }
  });

  // ─── .gitattributes ───
  describe('.gitattributes Privacy Filters', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const entries = [
      'agent_patch_manager.sql', 'agent-patch-manager.ts',
      'agent_firewall_controller.sql', 'agent-firewall-controller.ts',
      'agent_backup_orchestrator.sql', 'agent-backup-orchestrator.ts',
      'agent_storage_optimizer.sql', 'agent-storage-optimizer.ts',
      'agent_health_monitor.sql', 'agent-health-monitor.ts',
    ];
    for (const e of entries) {
      it(`has ${e} filter`, () => expect(ga).toContain(e));
    }
  });
});
