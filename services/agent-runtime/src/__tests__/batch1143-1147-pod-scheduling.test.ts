import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Pod Scheduling management verticals', () => {
  const verticals = [
    {
      name: 'pod_scheduler_optimizer', migration: '20260627800000_agent_pod_scheduler_optimizer.sql',
      typeFile: 'agent-pod-scheduler-optimizer.ts', skillDir: 'pod-scheduler-optimizer',
      interfaces: ['SchedulerConfig', 'SchedulerOptResult', 'PlacementStrategy'],
      bk: 'pod_scheduler_optimizer', eks: ['pso.optimization_started', 'pso.placement_decided', 'pso.export_emitted'],
      subjects: ['sven.pso.optimization_started', 'sven.pso.placement_decided', 'sven.pso.export_emitted'],
      cases: ['pso_reporter'],
    },
    {
      name: 'pod_affinity_manager', migration: '20260627810000_agent_pod_affinity_manager.sql',
      typeFile: 'agent-pod-affinity-manager.ts', skillDir: 'pod-affinity-manager',
      interfaces: ['AffinityConfig', 'AffinityResult', 'TopologySpread'],
      bk: 'pod_affinity_manager', eks: ['pam.rules_applied', 'pam.topology_balanced', 'pam.export_emitted'],
      subjects: ['sven.pam.rules_applied', 'sven.pam.topology_balanced', 'sven.pam.export_emitted'],
      cases: ['pam_reporter'],
    },
    {
      name: 'pod_priority_controller', migration: '20260627820000_agent_pod_priority_controller.sql',
      typeFile: 'agent-pod-priority-controller.ts', skillDir: 'pod-priority-controller',
      interfaces: ['PriorityConfig', 'PriorityResult', 'PreemptionPolicy'],
      bk: 'pod_priority_controller', eks: ['ppc.priority_assigned', 'ppc.preemption_executed', 'ppc.export_emitted'],
      subjects: ['sven.ppc.priority_assigned', 'sven.ppc.preemption_executed', 'sven.ppc.export_emitted'],
      cases: ['ppc_reporter'],
    },
    {
      name: 'pod_disruption_handler', migration: '20260627830000_agent_pod_disruption_handler.sql',
      typeFile: 'agent-pod-disruption-handler.ts', skillDir: 'pod-disruption-handler',
      interfaces: ['DisruptionConfig', 'DisruptionResult', 'EvictionWorkflow'],
      bk: 'pod_disruption_handler', eks: ['pdh.budget_enforced', 'pdh.eviction_completed', 'pdh.export_emitted'],
      subjects: ['sven.pdh.budget_enforced', 'sven.pdh.eviction_completed', 'sven.pdh.export_emitted'],
      cases: ['pdh_reporter'],
    },
    {
      name: 'pod_scheduling_auditor', migration: '20260627840000_agent_pod_scheduling_auditor.sql',
      typeFile: 'agent-pod-scheduling-auditor.ts', skillDir: 'pod-scheduling-auditor',
      interfaces: ['SchedulingAuditConfig', 'SchedulingAuditResult', 'UtilizationReport'],
      bk: 'pod_scheduling_auditor', eks: ['psa.audit_started', 'psa.findings_reported', 'psa.export_emitted'],
      subjects: ['sven.psa.audit_started', 'sven.psa.findings_reported', 'sven.psa.export_emitted'],
      cases: ['psa_reporter'],
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
