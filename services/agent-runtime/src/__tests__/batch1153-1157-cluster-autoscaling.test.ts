import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Cluster Autoscaling management verticals', () => {
  const verticals = [
    {
      name: 'cluster_autoscaler_manager', migration: '20260627900000_agent_cluster_autoscaler_manager.sql',
      typeFile: 'agent-cluster-autoscaler-manager.ts', skillDir: 'cluster-autoscaler-manager',
      interfaces: ['AutoscalerConfig', 'ScalingDecision', 'NodeGroupPolicy'],
      bk: 'cluster_autoscaler_manager', eks: ['cam.scaling_initiated', 'cam.nodes_adjusted', 'cam.export_emitted'],
      subjects: ['sven.cam.scaling_initiated', 'sven.cam.nodes_adjusted', 'sven.cam.export_emitted'],
      cases: ['cam_reporter'],
    },
    {
      name: 'cluster_node_provisioner', migration: '20260627910000_agent_cluster_node_provisioner.sql',
      typeFile: 'agent-cluster-node-provisioner.ts', skillDir: 'cluster-node-provisioner',
      interfaces: ['ProvisionerConfig', 'ProvisionResult', 'NodeLifecycle'],
      bk: 'cluster_node_provisioner', eks: ['cnp.provisioning_started', 'cnp.node_ready', 'cnp.export_emitted'],
      subjects: ['sven.cnp.provisioning_started', 'sven.cnp.node_ready', 'sven.cnp.export_emitted'],
      cases: ['cnp_reporter'],
    },
    {
      name: 'cluster_capacity_planner', migration: '20260627920000_agent_cluster_capacity_planner.sql',
      typeFile: 'agent-cluster-capacity-planner.ts', skillDir: 'cluster-capacity-planner',
      interfaces: ['CapacityConfig', 'CapacityForecast', 'ResourcePlan'],
      bk: 'cluster_capacity_planner', eks: ['ccp.planning_started', 'ccp.forecast_generated', 'ccp.export_emitted'],
      subjects: ['sven.ccp.planning_started', 'sven.ccp.forecast_generated', 'sven.ccp.export_emitted'],
      cases: ['ccp_reporter'],
    },
    {
      name: 'cluster_scaling_policy_enforcer', migration: '20260627930000_agent_cluster_scaling_policy_enforcer.sql',
      typeFile: 'agent-cluster-scaling-policy-enforcer.ts', skillDir: 'cluster-scaling-policy-enforcer',
      interfaces: ['ScalingPolicyConfig', 'PolicyEnforcementResult', 'CostBudget'],
      bk: 'cluster_scaling_policy_enforcer', eks: ['cspe.policy_applied', 'cspe.limit_enforced', 'cspe.export_emitted'],
      subjects: ['sven.cspe.policy_applied', 'sven.cspe.limit_enforced', 'sven.cspe.export_emitted'],
      cases: ['cspe_reporter'],
    },
    {
      name: 'cluster_autoscaling_auditor', migration: '20260627940000_agent_cluster_autoscaling_auditor.sql',
      typeFile: 'agent-cluster-autoscaling-auditor.ts', skillDir: 'cluster-autoscaling-auditor',
      interfaces: ['AutoscalingAuditConfig', 'AutoscalingAuditResult', 'CostOptReport'],
      bk: 'cluster_autoscaling_auditor', eks: ['caa.audit_started', 'caa.findings_reported', 'caa.export_emitted'],
      subjects: ['sven.caa.audit_started', 'sven.caa.findings_reported', 'sven.caa.export_emitted'],
      cases: ['caa_reporter'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
