import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 698-702: Container Orchestration', () => {
  const verticals = [
    {
      name: 'hpa_tuner', migration: '20260623350000_agent_hpa_tuner.sql',
      typeFile: 'agent-hpa-tuner.ts', skillDir: 'hpa-tuner',
      interfaces: ['HpaTunerConfig', 'ScalingPolicy', 'TunerEvent'],
      bk: 'hpa_tuner', eks: ['hpat.policy_applied', 'hpat.scale_up_triggered', 'hpat.scale_down_triggered', 'hpat.threshold_adjusted'],
      subjects: ['sven.hpat.policy_applied', 'sven.hpat.scale_up_triggered', 'sven.hpat.scale_down_triggered', 'sven.hpat.threshold_adjusted'],
      cases: ['hpat_apply', 'hpat_scaleup', 'hpat_scaledown', 'hpat_adjust', 'hpat_report', 'hpat_monitor'],
    },
    {
      name: 'ingress_router', migration: '20260623360000_agent_ingress_router.sql',
      typeFile: 'agent-ingress-router.ts', skillDir: 'ingress-router',
      interfaces: ['IngressRouterConfig', 'RoutingRule', 'RouterEvent'],
      bk: 'ingress_router', eks: ['igrt.rule_added', 'igrt.tls_renewed', 'igrt.canary_promoted', 'igrt.traffic_shifted'],
      subjects: ['sven.igrt.rule_added', 'sven.igrt.tls_renewed', 'sven.igrt.canary_promoted', 'sven.igrt.traffic_shifted'],
      cases: ['igrt_add', 'igrt_renew', 'igrt_promote', 'igrt_shift', 'igrt_report', 'igrt_monitor'],
    },
    {
      name: 'namespace_isolator', migration: '20260623370000_agent_namespace_isolator.sql',
      typeFile: 'agent-namespace-isolator.ts', skillDir: 'namespace-isolator',
      interfaces: ['NamespaceIsolatorConfig', 'IsolationPolicy', 'IsolatorEvent'],
      bk: 'namespace_isolator', eks: ['nsis.namespace_created', 'nsis.network_policy_applied', 'nsis.quota_enforced', 'nsis.violation_detected'],
      subjects: ['sven.nsis.namespace_created', 'sven.nsis.network_policy_applied', 'sven.nsis.quota_enforced', 'sven.nsis.violation_detected'],
      cases: ['nsis_create', 'nsis_apply', 'nsis_enforce', 'nsis_detect', 'nsis_report', 'nsis_monitor'],
    },
    {
      name: 'daemon_dispatcher', migration: '20260623380000_agent_daemon_dispatcher.sql',
      typeFile: 'agent-daemon-dispatcher.ts', skillDir: 'daemon-dispatcher',
      interfaces: ['DaemonDispatcherConfig', 'DaemonSet', 'DispatcherEvent'],
      bk: 'daemon_dispatcher', eks: ['dmds.daemonset_deployed', 'dmds.node_targeted', 'dmds.update_rolled', 'dmds.pod_terminated'],
      subjects: ['sven.dmds.daemonset_deployed', 'sven.dmds.node_targeted', 'sven.dmds.update_rolled', 'sven.dmds.pod_terminated'],
      cases: ['dmds_deploy', 'dmds_target', 'dmds_roll', 'dmds_terminate', 'dmds_report', 'dmds_monitor'],
    },
    {
      name: 'statefulset_orchestrator', migration: '20260623390000_agent_statefulset_orchestrator.sql',
      typeFile: 'agent-statefulset-orchestrator.ts', skillDir: 'statefulset-orchestrator',
      interfaces: ['StatefulSetOrchestratorConfig', 'StatefulSet', 'OrchestratorEvent'],
      bk: 'statefulset_orchestrator', eks: ['sfso.replica_added', 'sfso.volume_attached', 'sfso.ordering_enforced', 'sfso.upgrade_completed'],
      subjects: ['sven.sfso.replica_added', 'sven.sfso.volume_attached', 'sven.sfso.ordering_enforced', 'sven.sfso.upgrade_completed'],
      cases: ['sfso_add', 'sfso_attach', 'sfso_enforce', 'sfso_upgrade', 'sfso_report', 'sfso_monitor'],
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
