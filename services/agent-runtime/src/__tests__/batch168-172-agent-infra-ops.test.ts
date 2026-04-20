/**
 * Batch 168-172 — Agent Infrastructure Operations
 * 168: Topology Map, 169: Forensic Analysis, 170: Patch Management,
 * 171: Access Review, 172: Release Train
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── helpers ──
const readMigration = (ts: string, name: string) =>
  fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', `${ts}_${name}.sql`), 'utf-8');
const readType = (name: string) =>
  fs.readFileSync(path.join(ROOT, 'packages/shared/src', `${name}.ts`), 'utf-8');
const readSkill = (name: string) =>
  fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf-8');
const eidolonTypes = () =>
  fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
const eventBus = () =>
  fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
const taskExec = () =>
  fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
const gitattr = () =>
  fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
const barrel = () =>
  fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');

// ═══════════════════════════════════════════════════
// Batch 168 — Agent Topology Map
// ═══════════════════════════════════════════════════
describe('Batch 168 — Agent Topology Map', () => {
  const mig = readMigration('20260618050000', 'agent_topology_map');
  const typ = readType('agent-topology-map');
  const skill = readSkill('agent-topology-map');

  describe('migration', () => {
    it('creates agent_topology_nodes table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_topology_nodes'));
    it('creates agent_topology_edges table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_topology_edges'));
    it('creates agent_topology_snapshots table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_topology_snapshots'));
    it('has node_type check constraint', () => expect(mig).toMatch(/node_type.*CHECK/));
    it('has edge_type check constraint', () => expect(mig).toMatch(/edge_type.*CHECK/));
    it('creates indexes', () => {
      expect(mig).toContain('idx_topology_nodes_agent');
      expect(mig).toContain('idx_topology_edges_source');
    });
  });

  describe('types', () => {
    it('exports TopologyNodeType', () => expect(typ).toContain('TopologyNodeType'));
    it('exports TopologyEdge interface', () => expect(typ).toContain('interface TopologyEdge'));
    it('exports TopologySnapshot interface', () => expect(typ).toContain('interface TopologySnapshot'));
    it('exports TopologyHealthStatus', () => expect(typ).toContain('TopologyHealthStatus'));
    it('has all node types', () => {
      for (const t of ['service','database','cache','queue','gateway','external','storage','compute'])
        expect(typ).toContain(`'${t}'`);
    });
  });

  describe('skill', () => {
    it('has correct name', () => expect(skill).toContain('name: agent-topology-map'));
    it('has infrastructure category', () => expect(skill).toContain('category: infrastructure'));
    it('prices at 0.79 47T', () => expect(skill).toContain('base: 0.79'));
    it('lists discover_nodes action', () => expect(skill).toContain('discover_nodes'));
  });
});

// ═══════════════════════════════════════════════════
// Batch 169 — Agent Forensic Analysis
// ═══════════════════════════════════════════════════
describe('Batch 169 — Agent Forensic Analysis', () => {
  const mig = readMigration('20260618060000', 'agent_forensic_analysis');
  const typ = readType('agent-forensic-analysis');
  const skill = readSkill('agent-forensic-analysis');

  describe('migration', () => {
    it('creates agent_forensic_cases table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_forensic_cases'));
    it('creates agent_forensic_evidence table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_forensic_evidence'));
    it('creates agent_forensic_timelines table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_forensic_timelines'));
    it('has severity check constraint', () => expect(mig).toMatch(/severity.*CHECK/));
    it('has evidence_type check constraint', () => expect(mig).toMatch(/evidence_type.*CHECK/));
    it('creates indexes', () => {
      expect(mig).toContain('idx_forensic_cases_status');
      expect(mig).toContain('idx_forensic_evidence_case');
    });
  });

  describe('types', () => {
    it('exports ForensicCaseSeverity', () => expect(typ).toContain('ForensicCaseSeverity'));
    it('exports ForensicEvidence interface', () => expect(typ).toContain('interface ForensicEvidence'));
    it('exports ForensicTimeline interface', () => expect(typ).toContain('interface ForensicTimeline'));
    it('has chain_of_custody field', () => expect(typ).toContain('chainOfCustody'));
    it('has all evidence types', () => {
      for (const t of ['log','metric','trace','screenshot','config_snapshot','memory_dump'])
        expect(typ).toContain(`'${t}'`);
    });
  });

  describe('skill', () => {
    it('has correct name', () => expect(skill).toContain('name: agent-forensic-analysis'));
    it('has analyst archetype', () => expect(skill).toContain('archetype: analyst'));
    it('prices at 2.49 47T', () => expect(skill).toContain('base: 2.49'));
    it('lists collect_evidence action', () => expect(skill).toContain('collect_evidence'));
  });
});

// ═══════════════════════════════════════════════════
// Batch 170 — Agent Patch Management
// ═══════════════════════════════════════════════════
describe('Batch 170 — Agent Patch Management', () => {
  const mig = readMigration('20260618070000', 'agent_patch_management');
  const typ = readType('agent-patch-management');
  const skill = readSkill('agent-patch-management');

  describe('migration', () => {
    it('creates agent_patch_advisories table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_patch_advisories'));
    it('creates agent_patch_deployments table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_patch_deployments'));
    it('creates agent_patch_compliance table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_patch_compliance'));
    it('has source check constraint', () => expect(mig).toMatch(/source.*CHECK/));
    it('creates indexes', () => {
      expect(mig).toContain('idx_patch_advisories_severity');
      expect(mig).toContain('idx_patch_deployments_status');
    });
  });

  describe('types', () => {
    it('exports PatchAdvisorySource', () => expect(typ).toContain('PatchAdvisorySource'));
    it('exports PatchDeployment interface', () => expect(typ).toContain('interface PatchDeployment'));
    it('exports PatchCompliance interface', () => expect(typ).toContain('interface PatchCompliance'));
    it('has all advisory sources', () => {
      for (const s of ['cve','npm','github','os_vendor','internal','custom'])
        expect(typ).toContain(`'${s}'`);
    });
  });

  describe('skill', () => {
    it('has correct name', () => expect(skill).toContain('name: agent-patch-management'));
    it('has operations archetype', () => expect(skill).toContain('archetype: operations'));
    it('prices at 0.49 47T', () => expect(skill).toContain('base: 0.49'));
    it('lists rollback_patch action', () => expect(skill).toContain('rollback_patch'));
  });
});

// ═══════════════════════════════════════════════════
// Batch 171 — Agent Access Review
// ═══════════════════════════════════════════════════
describe('Batch 171 — Agent Access Review', () => {
  const mig = readMigration('20260618080000', 'agent_access_review');
  const typ = readType('agent-access-review');
  const skill = readSkill('agent-access-review');

  describe('migration', () => {
    it('creates agent_access_campaigns table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_access_campaigns'));
    it('creates agent_access_entries table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_access_entries'));
    it('creates agent_access_policies table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_access_policies'));
    it('has campaign_type check constraint', () => expect(mig).toMatch(/campaign_type.*CHECK/));
    it('has permission_level check constraint', () => expect(mig).toMatch(/permission_level.*CHECK/));
    it('creates indexes', () => {
      expect(mig).toContain('idx_access_campaigns_status');
      expect(mig).toContain('idx_access_entries_subject');
    });
  });

  describe('types', () => {
    it('exports AccessCampaignType', () => expect(typ).toContain('AccessCampaignType'));
    it('exports AccessEntry interface', () => expect(typ).toContain('interface AccessEntry'));
    it('exports AccessPolicy interface', () => expect(typ).toContain('interface AccessPolicy'));
    it('has enforcement modes', () => {
      for (const m of ['enforce','audit','disabled'])
        expect(typ).toContain(`'${m}'`);
    });
  });

  describe('skill', () => {
    it('has correct name', () => expect(skill).toContain('name: agent-access-review'));
    it('has security category', () => expect(skill).toContain('category: security'));
    it('prices at 1.29 47T', () => expect(skill).toContain('base: 1.29'));
    it('lists revoke_access action', () => expect(skill).toContain('revoke_access'));
  });
});

// ═══════════════════════════════════════════════════
// Batch 172 — Agent Release Train
// ═══════════════════════════════════════════════════
describe('Batch 172 — Agent Release Train', () => {
  const mig = readMigration('20260618090000', 'agent_release_train');
  const typ = readType('agent-release-train');
  const skill = readSkill('agent-release-train');

  describe('migration', () => {
    it('creates agent_release_trains table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_release_trains'));
    it('creates agent_release_cars table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_release_cars'));
    it('creates agent_release_gates table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_release_gates'));
    it('has schedule_type check constraint', () => expect(mig).toMatch(/schedule_type.*CHECK/));
    it('has gate_type check constraint', () => expect(mig).toMatch(/gate_type.*CHECK/));
    it('creates indexes', () => {
      expect(mig).toContain('idx_release_trains_status');
      expect(mig).toContain('idx_release_gates_train');
    });
  });

  describe('types', () => {
    it('exports ReleaseTrainStatus', () => expect(typ).toContain('ReleaseTrainStatus'));
    it('exports ReleaseCar interface', () => expect(typ).toContain('interface ReleaseCar'));
    it('exports ReleaseGate interface', () => expect(typ).toContain('interface ReleaseGate'));
    it('has all gate types', () => {
      for (const g of ['automated_test','manual_approval','security_scan','performance_check','compliance_review','rollback_plan'])
        expect(typ).toContain(`'${g}'`);
    });
  });

  describe('skill', () => {
    it('has correct name', () => expect(skill).toContain('name: agent-release-train'));
    it('has operations category', () => expect(skill).toContain('category: operations'));
    it('prices at 1.99 47T', () => expect(skill).toContain('base: 1.99'));
    it('lists deploy_train action', () => expect(skill).toContain('deploy_train'));
  });
});

// ═══════════════════════════════════════════════════
// Cross-cutting wiring checks
// ═══════════════════════════════════════════════════
describe('Barrel exports', () => {
  const b = barrel();
  it('exports agent-topology-map', () => expect(b).toContain("from './agent-topology-map.js'"));
  it('exports agent-forensic-analysis', () => expect(b).toContain("from './agent-forensic-analysis.js'"));
  it('exports agent-patch-management', () => expect(b).toContain("from './agent-patch-management.js'"));
  it('exports agent-access-review', () => expect(b).toContain("from './agent-access-review.js'"));
  it('exports agent-release-train', () => expect(b).toContain("from './agent-release-train.js'"));
});

describe('Eidolon BK + EK + districtFor', () => {
  const t = eidolonTypes();
  const bks = ['topology_grid','forensic_lab','patch_depot','access_court','release_station'];
  const eks = [
    'topology.scan_started','topology.scan_completed','topology.drift_detected','topology.snapshot_created',
    'forensic.case_opened','forensic.evidence_collected','forensic.analysis_completed','forensic.case_concluded',
    'patch.advisory_found','patch.test_passed','patch.deployed','patch.rolled_back',
    'access.campaign_started','access.review_completed','access.permission_revoked','access.compliance_reported',
    'release.train_planned','release.gates_passed','release.train_deployed','release.train_rolled_back'
  ];

  bks.forEach(bk => it(`has BK ${bk}`, () => expect(t).toContain(`'${bk}'`)));
  eks.forEach(ek => it(`has EK ${ek}`, () => expect(t).toContain(`'${ek}'`)));
  bks.forEach(bk => it(`districtFor handles ${bk}`, () => expect(t).toContain(`case '${bk}':`)));
});

describe('Event-bus SUBJECT_MAP', () => {
  const eb = eventBus();
  const subjects = [
    'sven.topology.scan_started','sven.topology.scan_completed','sven.topology.drift_detected','sven.topology.snapshot_created',
    'sven.forensic.case_opened','sven.forensic.evidence_collected','sven.forensic.analysis_completed','sven.forensic.case_concluded',
    'sven.patch.advisory_found','sven.patch.test_passed','sven.patch.deployed','sven.patch.rolled_back',
    'sven.access.campaign_started','sven.access.review_completed','sven.access.permission_revoked','sven.access.compliance_reported',
    'sven.release.train_planned','sven.release.gates_passed','sven.release.train_deployed','sven.release.train_rolled_back'
  ];
  subjects.forEach(s => it(`maps ${s}`, () => expect(eb).toContain(`'${s}'`)));
});

describe('Task executor', () => {
  const te = taskExec();
  const cases = [
    'topology_discover_nodes','topology_map_edges','topology_take_snapshot','topology_compare_snapshots','topology_health_check','topology_export_graph',
    'forensic_open_case','forensic_collect_evidence','forensic_build_timeline','forensic_analyze_root_cause','forensic_generate_report','forensic_archive_case',
    'patch_scan_advisories','patch_assess_risk','patch_test_patch','patch_deploy_patch','patch_verify_deployment','patch_rollback',
    'access_create_campaign','access_scan_permissions','access_review_entry','access_certify','access_revoke','access_compliance_report',
    'release_plan_train','release_board_changes','release_lock_train','release_run_gates','release_deploy_train','release_rollback_train'
  ];
  cases.forEach(c => it(`has case ${c}`, () => expect(te).toContain(`case '${c}'`)));

  const handlers = [
    'handleTopologyDiscoverNodes','handleTopologyMapEdges','handleTopologyTakeSnapshot',
    'handleForensicOpenCase','handleForensicCollectEvidence','handleForensicBuildTimeline',
    'handlePatchScanAdvisories','handlePatchAssessRisk','handlePatchTestPatch',
    'handleAccessCreateCampaign','handleAccessScanPermissions','handleAccessReviewEntry',
    'handleReleasePlanTrain','handleReleaseBoardChanges','handleReleaseLockTrain'
  ];
  handlers.forEach(h => it(`has handler ${h}`, () => expect(te).toContain(`${h}(`)));
});

describe('.gitattributes', () => {
  const ga = gitattr();
  it('has topology map entries', () => expect(ga).toContain('agent_topology_map.sql filter=sven-private'));
  it('has forensic analysis entries', () => expect(ga).toContain('agent-forensic-analysis.ts filter=sven-private'));
  it('has patch management entries', () => expect(ga).toContain('agent_patch_management.sql filter=sven-private'));
  it('has access review entries', () => expect(ga).toContain('agent-access-review.ts filter=sven-private'));
  it('has release train entries', () => expect(ga).toContain('agent_release_train.sql filter=sven-private'));
});
