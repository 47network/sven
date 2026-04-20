import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 633-637: Container & Orchestration', () => {
  const verticals = [
    {
      name: 'pod_scaler', migration: '20260622700000_agent_pod_scaler.sql',
      typeFile: 'agent-pod-scaler.ts', skillDir: 'pod-scaler',
      interfaces: ['PodScalerConfig', 'ScaleDecision', 'ScalerEvent'],
      bk: 'pod_scaler', eks: ['pdsc.scale_up', 'pdsc.scale_down', 'pdsc.threshold_breached', 'pdsc.cooldown_started'],
      subjects: ['sven.pdsc.scale_up', 'sven.pdsc.scale_down', 'sven.pdsc.threshold_breached', 'sven.pdsc.cooldown_started'],
      cases: ['pdsc_up', 'pdsc_down', 'pdsc_breach', 'pdsc_cooldown', 'pdsc_report', 'pdsc_monitor'],
    },
    {
      name: 'container_debugger', migration: '20260622710000_agent_container_debugger.sql',
      typeFile: 'agent-container-debugger.ts', skillDir: 'container-debugger',
      interfaces: ['ContainerDebuggerConfig', 'DebugSession', 'DebugEvent'],
      bk: 'container_debugger', eks: ['ctdb.session_started', 'ctdb.breakpoint_hit', 'ctdb.log_captured', 'ctdb.session_ended'],
      subjects: ['sven.ctdb.session_started', 'sven.ctdb.breakpoint_hit', 'sven.ctdb.log_captured', 'sven.ctdb.session_ended'],
      cases: ['ctdb_start', 'ctdb_breakpoint', 'ctdb_capture', 'ctdb_end', 'ctdb_report', 'ctdb_monitor'],
    },
    {
      name: 'image_pruner', migration: '20260622720000_agent_image_pruner.sql',
      typeFile: 'agent-image-pruner.ts', skillDir: 'image-pruner',
      interfaces: ['ImagePrunerConfig', 'PruneResult', 'PrunerEvent'],
      bk: 'image_pruner', eks: ['impr.image_pruned', 'impr.scan_completed', 'impr.space_reclaimed', 'impr.policy_applied'],
      subjects: ['sven.impr.image_pruned', 'sven.impr.scan_completed', 'sven.impr.space_reclaimed', 'sven.impr.policy_applied'],
      cases: ['impr_prune', 'impr_scan', 'impr_reclaim', 'impr_policy', 'impr_report', 'impr_monitor'],
    },
    {
      name: 'namespace_watcher', migration: '20260622730000_agent_namespace_watcher.sql',
      typeFile: 'agent-namespace-watcher.ts', skillDir: 'namespace-watcher',
      interfaces: ['NamespaceWatcherConfig', 'NamespaceEvent', 'WatcherAlert'],
      bk: 'namespace_watcher', eks: ['nswa.resource_created', 'nswa.quota_exceeded', 'nswa.drift_detected', 'nswa.namespace_idle'],
      subjects: ['sven.nswa.resource_created', 'sven.nswa.quota_exceeded', 'sven.nswa.drift_detected', 'sven.nswa.namespace_idle'],
      cases: ['nswa_create', 'nswa_quota', 'nswa_drift', 'nswa_idle', 'nswa_report', 'nswa_monitor'],
    },
    {
      name: 'helm_releaser', migration: '20260622740000_agent_helm_releaser.sql',
      typeFile: 'agent-helm-releaser.ts', skillDir: 'helm-releaser',
      interfaces: ['HelmReleaserConfig', 'ReleaseRecord', 'ReleaserEvent'],
      bk: 'helm_releaser', eks: ['hlrl.release_deployed', 'hlrl.rollback_executed', 'hlrl.values_updated', 'hlrl.chart_validated'],
      subjects: ['sven.hlrl.release_deployed', 'sven.hlrl.rollback_executed', 'sven.hlrl.values_updated', 'sven.hlrl.chart_validated'],
      cases: ['hlrl_deploy', 'hlrl_rollback', 'hlrl_values', 'hlrl_validate', 'hlrl_report', 'hlrl_monitor'],
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
