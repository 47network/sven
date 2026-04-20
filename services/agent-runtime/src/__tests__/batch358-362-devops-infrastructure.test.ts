import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ── Batch 358: Session Recorder ──

describe('Batch 358 — Session Recorder migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260619950000_agent_session_recorder.sql');
  it('creates agent_session_recorder_configs table', () => { expect(sql).toContain('agent_session_recorder_configs'); });
  it('creates agent_recorded_sessions table', () => { expect(sql).toContain('agent_recorded_sessions'); });
  it('creates agent_session_events table', () => { expect(sql).toContain('agent_session_events'); });
  it('has recording_mode column', () => { expect(sql).toContain('recording_mode'); });
  it('has retention_days column', () => { expect(sql).toContain('retention_days'); });
  it('has sequence_number column', () => { expect(sql).toContain('sequence_number'); });
});

describe('Batch 358 — Session Recorder types', () => {
  const types = readFile('packages/shared/src/agent-session-recorder.ts');
  it('exports RecordingMode', () => { expect(types).toContain('RecordingMode'); });
  it('exports SessionType', () => { expect(types).toContain('SessionType'); });
  it('exports RecordingStatus', () => { expect(types).toContain('RecordingStatus'); });
  it('exports SessionRecorderConfig', () => { expect(types).toContain('SessionRecorderConfig'); });
  it('exports RecordedSession', () => { expect(types).toContain('RecordedSession'); });
  it('exports SessionEvent', () => { expect(types).toContain('SessionEvent'); });
  it('has passive mode', () => { expect(types).toContain("'passive'"); });
  it('has full_trace mode', () => { expect(types).toContain("'full_trace'"); });
});

describe('Batch 358 — Session Recorder SKILL.md', () => {
  const skill = readFile('skills/autonomous-economy/session-recorder/SKILL.md');
  it('has name', () => { expect(skill).toContain('Session Recorder'); });
  it('has price', () => { expect(skill).toContain('11.99'); });
  it('has archetype', () => { expect(skill).toContain('engineer'); });
  it('has actions heading', () => { expect(skill).toContain('## Actions'); });
  it('has record-session action', () => { expect(skill).toContain('record-session'); });
  it('has replay-session action', () => { expect(skill).toContain('replay-session'); });
});

describe('Batch 358 — Session Recorder barrel export', () => {
  const index = readFile('packages/shared/src/index.ts');
  it('exports agent-session-recorder', () => { expect(index).toContain("'./agent-session-recorder'"); });
});

// ── Batch 359: Artifact Builder ──

describe('Batch 359 — Artifact Builder migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260619960000_agent_artifact_builder.sql');
  it('creates agent_artifact_builder_configs table', () => { expect(sql).toContain('agent_artifact_builder_configs'); });
  it('creates agent_artifacts table', () => { expect(sql).toContain('agent_artifacts'); });
  it('creates agent_build_logs table', () => { expect(sql).toContain('agent_build_logs'); });
  it('has build_system column', () => { expect(sql).toContain('build_system'); });
  it('has versioning_strategy column', () => { expect(sql).toContain('versioning_strategy'); });
  it('has checksum column', () => { expect(sql).toContain('checksum'); });
});

describe('Batch 359 — Artifact Builder types', () => {
  const types = readFile('packages/shared/src/agent-artifact-builder.ts');
  it('exports BuildSystem', () => { expect(types).toContain('BuildSystem'); });
  it('exports ArtifactFormat', () => { expect(types).toContain('ArtifactFormat'); });
  it('exports VersioningStrategy', () => { expect(types).toContain('VersioningStrategy'); });
  it('exports ArtifactBuilderConfig', () => { expect(types).toContain('ArtifactBuilderConfig'); });
  it('exports Artifact', () => { expect(types).toContain('Artifact'); });
  it('exports BuildLog', () => { expect(types).toContain('BuildLog'); });
  it('has semver strategy', () => { expect(types).toContain("'semver'"); });
  it('has docker build system', () => { expect(types).toContain("'docker'"); });
});

describe('Batch 359 — Artifact Builder SKILL.md', () => {
  const skill = readFile('skills/autonomous-economy/artifact-builder/SKILL.md');
  it('has name', () => { expect(skill).toContain('Artifact Builder'); });
  it('has price', () => { expect(skill).toContain('14.99'); });
  it('has archetype', () => { expect(skill).toContain('engineer'); });
  it('has actions heading', () => { expect(skill).toContain('## Actions'); });
  it('has build-artifact action', () => { expect(skill).toContain('build-artifact'); });
  it('has verify-artifact action', () => { expect(skill).toContain('verify-artifact'); });
});

describe('Batch 359 — Artifact Builder barrel export', () => {
  const index = readFile('packages/shared/src/index.ts');
  it('exports agent-artifact-builder', () => { expect(index).toContain("'./agent-artifact-builder'"); });
});

// ── Batch 360: Tenant Provisioner ──

describe('Batch 360 — Tenant Provisioner migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260619970000_agent_tenant_provisioner.sql');
  it('creates agent_tenant_provisioner_configs table', () => { expect(sql).toContain('agent_tenant_provisioner_configs'); });
  it('creates agent_tenants table', () => { expect(sql).toContain('agent_tenants'); });
  it('creates agent_tenant_operations table', () => { expect(sql).toContain('agent_tenant_operations'); });
  it('has isolation_level column', () => { expect(sql).toContain('isolation_level'); });
  it('has provisioning_strategy column', () => { expect(sql).toContain('provisioning_strategy'); });
  it('has connection_string column', () => { expect(sql).toContain('connection_string'); });
});

describe('Batch 360 — Tenant Provisioner types', () => {
  const types = readFile('packages/shared/src/agent-tenant-provisioner.ts');
  it('exports IsolationLevel', () => { expect(types).toContain('IsolationLevel'); });
  it('exports ProvisioningStrategy', () => { expect(types).toContain('ProvisioningStrategy'); });
  it('exports TenantStatus', () => { expect(types).toContain('TenantStatus'); });
  it('exports TenantProvisionerConfig', () => { expect(types).toContain('TenantProvisionerConfig'); });
  it('exports Tenant interface', () => { expect(types).toContain('export interface Tenant'); });
  it('exports TenantOperation', () => { expect(types).toContain('TenantOperation'); });
  it('has namespace isolation', () => { expect(types).toContain("'namespace'"); });
  it('has vm isolation', () => { expect(types).toContain("'vm'"); });
});

describe('Batch 360 — Tenant Provisioner SKILL.md', () => {
  const skill = readFile('skills/autonomous-economy/tenant-provisioner/SKILL.md');
  it('has name', () => { expect(skill).toContain('Tenant Provisioner'); });
  it('has price', () => { expect(skill).toContain('19.99'); });
  it('has archetype', () => { expect(skill).toContain('engineer'); });
  it('has actions heading', () => { expect(skill).toContain('## Actions'); });
  it('has provision-tenant action', () => { expect(skill).toContain('provision-tenant'); });
  it('has scale-tenant action', () => { expect(skill).toContain('scale-tenant'); });
});

describe('Batch 360 — Tenant Provisioner barrel export', () => {
  const index = readFile('packages/shared/src/index.ts');
  it('exports agent-tenant-provisioner', () => { expect(index).toContain("'./agent-tenant-provisioner'"); });
});

// ── Batch 361: Index Optimizer ──

describe('Batch 361 — Index Optimizer migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260619980000_agent_index_optimizer.sql');
  it('creates agent_index_optimizer_configs table', () => { expect(sql).toContain('agent_index_optimizer_configs'); });
  it('creates agent_index_analyses table', () => { expect(sql).toContain('agent_index_analyses'); });
  it('creates agent_index_operations table', () => { expect(sql).toContain('agent_index_operations'); });
  it('has target_database column', () => { expect(sql).toContain('target_database'); });
  it('has analysis_schedule column', () => { expect(sql).toContain('analysis_schedule'); });
  it('has rollback_sql column', () => { expect(sql).toContain('rollback_sql'); });
});

describe('Batch 361 — Index Optimizer types', () => {
  const types = readFile('packages/shared/src/agent-index-optimizer.ts');
  it('exports TargetDatabase', () => { expect(types).toContain('TargetDatabase'); });
  it('exports AnalysisStatus', () => { expect(types).toContain('AnalysisStatus'); });
  it('exports IndexOptimizerConfig', () => { expect(types).toContain('IndexOptimizerConfig'); });
  it('exports IndexAnalysis', () => { expect(types).toContain('IndexAnalysis'); });
  it('exports IndexOperation', () => { expect(types).toContain('IndexOperation'); });
  it('has postgresql target', () => { expect(types).toContain("'postgresql'"); });
  it('has opensearch target', () => { expect(types).toContain("'opensearch'"); });
});

describe('Batch 361 — Index Optimizer SKILL.md', () => {
  const skill = readFile('skills/autonomous-economy/index-optimizer/SKILL.md');
  it('has name', () => { expect(skill).toContain('Index Optimizer'); });
  it('has price', () => { expect(skill).toContain('16.99'); });
  it('has archetype', () => { expect(skill).toContain('analyst'); });
  it('has actions heading', () => { expect(skill).toContain('## Actions'); });
  it('has analyze-table action', () => { expect(skill).toContain('analyze-table'); });
  it('has benchmark-impact action', () => { expect(skill).toContain('benchmark-impact'); });
});

describe('Batch 361 — Index Optimizer barrel export', () => {
  const index = readFile('packages/shared/src/index.ts');
  it('exports agent-index-optimizer', () => { expect(index).toContain("'./agent-index-optimizer'"); });
});

// ── Batch 362: Dependency Scanner ──

describe('Batch 362 — Dependency Scanner migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260619990000_agent_dependency_scanner.sql');
  it('creates agent_dependency_scanner_configs table', () => { expect(sql).toContain('agent_dependency_scanner_configs'); });
  it('creates agent_dependency_scans table', () => { expect(sql).toContain('agent_dependency_scans'); });
  it('creates agent_vulnerability_findings table', () => { expect(sql).toContain('agent_vulnerability_findings'); });
  it('has severity_threshold column', () => { expect(sql).toContain('severity_threshold'); });
  it('has auto_update_patch column', () => { expect(sql).toContain('auto_update_patch'); });
  it('has cve_id column', () => { expect(sql).toContain('cve_id'); });
});

describe('Batch 362 — Dependency Scanner types', () => {
  const types = readFile('packages/shared/src/agent-dependency-scanner.ts');
  it('exports SeverityThreshold', () => { expect(types).toContain('SeverityThreshold'); });
  it('exports ScanType', () => { expect(types).toContain('ScanType'); });
  it('exports ScanStatus', () => { expect(types).toContain('ScanStatus'); });
  it('exports DependencyScannerConfig', () => { expect(types).toContain('DependencyScannerConfig'); });
  it('exports DependencyScan', () => { expect(types).toContain('DependencyScan'); });
  it('exports VulnerabilityFinding', () => { expect(types).toContain('VulnerabilityFinding'); });
  it('has critical severity', () => { expect(types).toContain("'critical'"); });
  it('has false_positive status', () => { expect(types).toContain("'false_positive'"); });
});

describe('Batch 362 — Dependency Scanner SKILL.md', () => {
  const skill = readFile('skills/autonomous-economy/dependency-scanner/SKILL.md');
  it('has name', () => { expect(skill).toContain('Dependency Scanner'); });
  it('has price', () => { expect(skill).toContain('13.99'); });
  it('has archetype', () => { expect(skill).toContain('analyst'); });
  it('has actions heading', () => { expect(skill).toContain('## Actions'); });
  it('has full-scan action', () => { expect(skill).toContain('full-scan'); });
  it('has generate-sbom action', () => { expect(skill).toContain('generate-sbom'); });
});

describe('Batch 362 — Dependency Scanner barrel export', () => {
  const index = readFile('packages/shared/src/index.ts');
  it('exports agent-dependency-scanner', () => { expect(index).toContain("'./agent-dependency-scanner'"); });
});

// ── Cross-batch: Eidolon wiring ──

describe('Batches 358-362 — Eidolon BK values', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it('has session_recorder BK', () => { expect(types).toContain("'session_recorder'"); });
  it('has artifact_builder BK', () => { expect(types).toContain("'artifact_builder'"); });
  it('has tenant_provisioner BK', () => { expect(types).toContain("'tenant_provisioner'"); });
  it('has index_optimizer BK', () => { expect(types).toContain("'index_optimizer'"); });
  it('has dependency_scanner BK', () => { expect(types).toContain("'dependency_scanner'"); });
});

describe('Batches 358-362 — Eidolon EK values', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it('has ssrc.session_started EK', () => { expect(types).toContain("'ssrc.session_started'"); });
  it('has ssrc.session_exported EK', () => { expect(types).toContain("'ssrc.session_exported'"); });
  it('has artb.build_started EK', () => { expect(types).toContain("'artb.build_started'"); });
  it('has artb.artifact_published EK', () => { expect(types).toContain("'artb.artifact_published'"); });
  it('has tnpr.tenant_provisioned EK', () => { expect(types).toContain("'tnpr.tenant_provisioned'"); });
  it('has tnpr.tenant_migrated EK', () => { expect(types).toContain("'tnpr.tenant_migrated'"); });
  it('has ixop.analysis_completed EK', () => { expect(types).toContain("'ixop.analysis_completed'"); });
  it('has ixop.benchmark_run EK', () => { expect(types).toContain("'ixop.benchmark_run'"); });
  it('has dpsc.scan_completed EK', () => { expect(types).toContain("'dpsc.scan_completed'"); });
  it('has dpsc.sbom_generated EK', () => { expect(types).toContain("'dpsc.sbom_generated'"); });
});

describe('Batches 358-362 — Eidolon districtFor', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  it('has session_recorder districtFor', () => { expect(types).toContain("case 'session_recorder':"); });
  it('has artifact_builder districtFor', () => { expect(types).toContain("case 'artifact_builder':"); });
  it('has tenant_provisioner districtFor', () => { expect(types).toContain("case 'tenant_provisioner':"); });
  it('has index_optimizer districtFor', () => { expect(types).toContain("case 'index_optimizer':"); });
  it('has dependency_scanner districtFor', () => { expect(types).toContain("case 'dependency_scanner':"); });
});

// ── Cross-batch: SUBJECT_MAP ──

describe('Batches 358-362 — SUBJECT_MAP entries', () => {
  const bus = readFile('services/sven-eidolon/src/event-bus.ts');
  it('has sven.ssrc.session_started', () => { expect(bus).toContain("'sven.ssrc.session_started'"); });
  it('has sven.ssrc.session_completed', () => { expect(bus).toContain("'sven.ssrc.session_completed'"); });
  it('has sven.ssrc.events_captured', () => { expect(bus).toContain("'sven.ssrc.events_captured'"); });
  it('has sven.ssrc.session_exported', () => { expect(bus).toContain("'sven.ssrc.session_exported'"); });
  it('has sven.artb.build_started', () => { expect(bus).toContain("'sven.artb.build_started'"); });
  it('has sven.artb.build_completed', () => { expect(bus).toContain("'sven.artb.build_completed'"); });
  it('has sven.artb.artifact_published', () => { expect(bus).toContain("'sven.artb.artifact_published'"); });
  it('has sven.artb.version_tagged', () => { expect(bus).toContain("'sven.artb.version_tagged'"); });
  it('has sven.tnpr.tenant_provisioned', () => { expect(bus).toContain("'sven.tnpr.tenant_provisioned'"); });
  it('has sven.tnpr.tenant_deprovisioned', () => { expect(bus).toContain("'sven.tnpr.tenant_deprovisioned'"); });
  it('has sven.tnpr.tenant_scaled', () => { expect(bus).toContain("'sven.tnpr.tenant_scaled'"); });
  it('has sven.tnpr.tenant_migrated', () => { expect(bus).toContain("'sven.tnpr.tenant_migrated'"); });
  it('has sven.ixop.analysis_completed', () => { expect(bus).toContain("'sven.ixop.analysis_completed'"); });
  it('has sven.ixop.index_applied', () => { expect(bus).toContain("'sven.ixop.index_applied'"); });
  it('has sven.ixop.redundant_found', () => { expect(bus).toContain("'sven.ixop.redundant_found'"); });
  it('has sven.ixop.benchmark_run', () => { expect(bus).toContain("'sven.ixop.benchmark_run'"); });
  it('has sven.dpsc.scan_completed', () => { expect(bus).toContain("'sven.dpsc.scan_completed'"); });
  it('has sven.dpsc.vulnerability_found', () => { expect(bus).toContain("'sven.dpsc.vulnerability_found'"); });
  it('has sven.dpsc.auto_fix_applied', () => { expect(bus).toContain("'sven.dpsc.auto_fix_applied'"); });
  it('has sven.dpsc.sbom_generated', () => { expect(bus).toContain("'sven.dpsc.sbom_generated'"); });
});

// ── Cross-batch: Task executor ──

describe('Batches 358-362 — Task executor switch cases', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const cases = [
    'ssrc_start_recording', 'ssrc_stop_recording', 'ssrc_replay_session',
    'ssrc_export_session', 'ssrc_list_events', 'ssrc_analyze_session',
    'atfb_start_build', 'atfb_version_artifact', 'atfb_sign_artifact',
    'atfb_list_artifacts', 'atfb_get_build_log', 'atfb_cleanup_old',
    'tnpr_provision_tenant', 'tnpr_deprovision_tenant', 'tnpr_update_quota',
    'tnpr_list_tenants', 'tnpr_check_health', 'tnpr_migrate_tenant',
    'ixop_analyze_indexes', 'ixop_recommend_indexes', 'ixop_apply_index',
    'ixop_rollback_index', 'ixop_compare_performance', 'ixop_generate_report',
    'dpsc_start_scan', 'dpsc_list_vulnerabilities', 'dpsc_apply_patch',
    'dpsc_ignore_finding', 'dpsc_schedule_scan', 'dpsc_export_report',
  ];
  cases.forEach(c => {
    it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}':`); });
  });
});

describe('Batches 358-362 — Task executor handler methods', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const handlers = [
    'handleSsrcStartRecording', 'handleSsrcStopRecording', 'handleSsrcReplaySession',
    'handleSsrcExportSession', 'handleSsrcListEvents', 'handleSsrcAnalyzeSession',
    'handleAtfbStartBuild', 'handleAtfbVersionArtifact', 'handleAtfbSignArtifact',
    'handleAtfbListArtifacts', 'handleAtfbGetBuildLog', 'handleAtfbCleanupOld',
    'handleTnprProvisionTenant', 'handleTnprDeprovisionTenant', 'handleTnprUpdateQuota',
    'handleTnprListTenants', 'handleTnprCheckHealth', 'handleTnprMigrateTenant',
    'handleIxopAnalyzeIndexes', 'handleIxopRecommendIndexes', 'handleIxopApplyIndex',
    'handleIxopRollbackIndex', 'handleIxopComparePerformance', 'handleIxopGenerateReport',
    'handleDpscStartScan', 'handleDpscListVulnerabilities', 'handleDpscApplyPatch',
    'handleDpscIgnoreFinding', 'handleDpscScheduleScan', 'handleDpscExportReport',
  ];
  handlers.forEach(h => {
    it(`has handler ${h}`, () => { expect(te).toContain(h); });
  });
});

// ── .gitattributes ──

describe('Batches 358-362 — .gitattributes privacy', () => {
  const ga = readFile('.gitattributes');
  it('has session_recorder migration', () => { expect(ga).toContain('20260619950000_agent_session_recorder.sql'); });
  it('has artifact_builder migration', () => { expect(ga).toContain('20260619960000_agent_artifact_builder.sql'); });
  it('has tenant_provisioner migration', () => { expect(ga).toContain('20260619970000_agent_tenant_provisioner.sql'); });
  it('has index_optimizer migration', () => { expect(ga).toContain('20260619980000_agent_index_optimizer.sql'); });
  it('has dependency_scanner migration', () => { expect(ga).toContain('20260619990000_agent_dependency_scanner.sql'); });
  it('has session_recorder types', () => { expect(ga).toContain('agent-session-recorder.ts'); });
  it('has artifact_builder types', () => { expect(ga).toContain('agent-artifact-builder.ts'); });
  it('has tenant_provisioner types', () => { expect(ga).toContain('agent-tenant-provisioner.ts'); });
  it('has index_optimizer types', () => { expect(ga).toContain('agent-index-optimizer.ts'); });
  it('has dependency_scanner types', () => { expect(ga).toContain('agent-dependency-scanner.ts'); });
  it('has session_recorder SKILL.md', () => { expect(ga).toContain('session-recorder/SKILL.md'); });
  it('has artifact_builder SKILL.md', () => { expect(ga).toContain('artifact-builder/SKILL.md'); });
  it('has tenant_provisioner SKILL.md', () => { expect(ga).toContain('tenant-provisioner/SKILL.md'); });
  it('has index_optimizer SKILL.md', () => { expect(ga).toContain('index-optimizer/SKILL.md'); });
  it('has dependency_scanner SKILL.md', () => { expect(ga).toContain('dependency-scanner/SKILL.md'); });
});
