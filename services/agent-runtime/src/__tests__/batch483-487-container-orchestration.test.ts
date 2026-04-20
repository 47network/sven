import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 483-487: Container & Orchestration', () => {
  const verticals = [
    {
      name: 'pod_scheduler',
      migration: '20260621200000_agent_pod_scheduler.sql',
      typeFile: 'agent-pod-scheduler.ts',
      skillDir: 'pod-scheduler',
      interfaces: ['PodSchedulerConfig', 'ScheduledPod', 'SchedulingDecision'],
      bk: 'pod_scheduler',
      eks: ['pdsc.pod_scheduled', 'pdsc.pod_rescheduled', 'pdsc.scheduling_optimized', 'pdsc.pod_preempted'],
      subjects: ['sven.pdsc.pod_scheduled', 'sven.pdsc.pod_rescheduled', 'sven.pdsc.scheduling_optimized', 'sven.pdsc.pod_preempted'],
      cases: ['pdsc_schedule', 'pdsc_reschedule', 'pdsc_optimize', 'pdsc_preempt', 'pdsc_report', 'pdsc_monitor'],
    },
    {
      name: 'volume_manager',
      migration: '20260621210000_agent_volume_manager.sql',
      typeFile: 'agent-volume-manager.ts',
      skillDir: 'volume-manager',
      interfaces: ['VolumeManagerConfig', 'ManagedVolume', 'VolumeSnapshot'],
      bk: 'volume_manager',
      eks: ['vlmg.volume_provisioned', 'vlmg.snapshot_created', 'vlmg.volume_resized', 'vlmg.backup_completed'],
      subjects: ['sven.vlmg.volume_provisioned', 'sven.vlmg.snapshot_created', 'sven.vlmg.volume_resized', 'sven.vlmg.backup_completed'],
      cases: ['vlmg_provision', 'vlmg_snapshot', 'vlmg_resize', 'vlmg_backup', 'vlmg_report', 'vlmg_monitor'],
    },
    {
      name: 'container_profiler',
      migration: '20260621220000_agent_container_profiler.sql',
      typeFile: 'agent-container-profiler.ts',
      skillDir: 'container-profiler',
      interfaces: ['ContainerProfilerConfig', 'ContainerProfile', 'ProfileAlert'],
      bk: 'container_profiler',
      eks: ['cnpr.profile_captured', 'cnpr.analysis_completed', 'cnpr.threshold_triggered', 'cnpr.recommendation_generated'],
      subjects: ['sven.cnpr.profile_captured', 'sven.cnpr.analysis_completed', 'sven.cnpr.threshold_triggered', 'sven.cnpr.recommendation_generated'],
      cases: ['cnpr_profile', 'cnpr_analyze', 'cnpr_alert', 'cnpr_recommend', 'cnpr_report', 'cnpr_monitor'],
    },
    {
      name: 'cluster_balancer',
      migration: '20260621230000_agent_cluster_balancer.sql',
      typeFile: 'agent-cluster-balancer.ts',
      skillDir: 'cluster-balancer',
      interfaces: ['ClusterBalancerConfig', 'BalancerEndpoint', 'BalancerMetrics'],
      bk: 'cluster_balancer',
      eks: ['clbl.traffic_balanced', 'clbl.health_checked', 'clbl.circuit_opened', 'clbl.node_drained'],
      subjects: ['sven.clbl.traffic_balanced', 'sven.clbl.health_checked', 'sven.clbl.circuit_opened', 'sven.clbl.node_drained'],
      cases: ['clbl_balance', 'clbl_health', 'clbl_circuit', 'clbl_drain', 'clbl_report', 'clbl_monitor'],
    },
    {
      name: 'node_drainer',
      migration: '20260621240000_agent_node_drainer.sql',
      typeFile: 'agent-node-drainer.ts',
      skillDir: 'node-drainer',
      interfaces: ['NodeDrainerConfig', 'DrainOperation', 'EvictedPod'],
      bk: 'node_drainer',
      eks: ['nddr.drain_started', 'nddr.drain_completed', 'nddr.node_cordoned', 'nddr.node_uncordoned'],
      subjects: ['sven.nddr.drain_started', 'sven.nddr.drain_completed', 'sven.nddr.node_cordoned', 'sven.nddr.node_uncordoned'],
      cases: ['nddr_drain', 'nddr_cordon', 'nddr_uncordon', 'nddr_status', 'nddr_report', 'nddr_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(migPath)).toBe(true);
      });
      test('migration has correct table', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(migPath, 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(tf)).toBe(true);
      });
      test('type file exports interfaces', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(tf, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`from './${modName}'`);
      });
      test('SKILL.md exists', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(sp)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(sp, 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
