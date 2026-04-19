import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 708-712: CI/CD Pipeline', () => {
  const verticals = [
    {
      name: 'build_pipeline_runner', migration: '20260623450000_agent_build_pipeline_runner.sql',
      typeFile: 'agent-build-pipeline-runner.ts', skillDir: 'build-pipeline-runner',
      interfaces: ['BuildPipelineRunnerConfig', 'PipelineRun', 'RunnerEvent'],
      bk: 'build_pipeline_runner', eks: ['bplr.run_started', 'bplr.stage_completed', 'bplr.artifact_published', 'bplr.run_failed'],
      subjects: ['sven.bplr.run_started', 'sven.bplr.stage_completed', 'sven.bplr.artifact_published', 'sven.bplr.run_failed'],
      cases: ['bplr_start', 'bplr_complete', 'bplr_publish', 'bplr_fail', 'bplr_report', 'bplr_monitor'],
    },
    {
      name: 'artifact_promoter', migration: '20260623460000_agent_artifact_promoter.sql',
      typeFile: 'agent-artifact-promoter.ts', skillDir: 'artifact-promoter',
      interfaces: ['ArtifactPromoterConfig', 'Artifact', 'PromoterEvent'],
      bk: 'artifact_promoter', eks: ['apmt.artifact_promoted', 'apmt.signature_verified', 'apmt.environment_targeted', 'apmt.rollback_prepared'],
      subjects: ['sven.apmt.artifact_promoted', 'sven.apmt.signature_verified', 'sven.apmt.environment_targeted', 'sven.apmt.rollback_prepared'],
      cases: ['apmt_promote', 'apmt_verify', 'apmt_target', 'apmt_prepare', 'apmt_report', 'apmt_monitor'],
    },
    {
      name: 'release_orchestrator', migration: '20260623470000_agent_release_orchestrator.sql',
      typeFile: 'agent-release-orchestrator.ts', skillDir: 'release-orchestrator',
      interfaces: ['ReleaseOrchestratorConfig', 'Release', 'OrchestratorEvent'],
      bk: 'release_orchestrator', eks: ['rlor.release_planned', 'rlor.gate_approved', 'rlor.deployment_triggered', 'rlor.changelog_published'],
      subjects: ['sven.rlor.release_planned', 'sven.rlor.gate_approved', 'sven.rlor.deployment_triggered', 'sven.rlor.changelog_published'],
      cases: ['rlor_plan', 'rlor_approve', 'rlor_trigger', 'rlor_publish', 'rlor_report', 'rlor_monitor'],
    },
    {
      name: 'rollback_coordinator', migration: '20260623480000_agent_rollback_coordinator.sql',
      typeFile: 'agent-rollback-coordinator.ts', skillDir: 'rollback-coordinator',
      interfaces: ['RollbackCoordinatorConfig', 'RollbackPlan', 'CoordinatorEvent'],
      bk: 'rollback_coordinator', eks: ['rbck.rollback_initiated', 'rbck.checkpoint_restored', 'rbck.traffic_redirected', 'rbck.completion_verified'],
      subjects: ['sven.rbck.rollback_initiated', 'sven.rbck.checkpoint_restored', 'sven.rbck.traffic_redirected', 'sven.rbck.completion_verified'],
      cases: ['rbck_initiate', 'rbck_restore', 'rbck_redirect', 'rbck_verify', 'rbck_report', 'rbck_monitor'],
    },
    {
      name: 'deployment_canary_steerer', migration: '20260623490000_agent_deployment_canary_steerer.sql',
      typeFile: 'agent-deployment-canary-steerer.ts', skillDir: 'deployment-canary-steerer',
      interfaces: ['DeploymentCanarySteererConfig', 'CanaryDeployment', 'SteererEvent'],
      bk: 'deployment_canary_steerer', eks: ['dcst.canary_launched', 'dcst.metrics_evaluated', 'dcst.traffic_increased', 'dcst.canary_aborted'],
      subjects: ['sven.dcst.canary_launched', 'sven.dcst.metrics_evaluated', 'sven.dcst.traffic_increased', 'sven.dcst.canary_aborted'],
      cases: ['dcst_launch', 'dcst_evaluate', 'dcst_increase', 'dcst_abort', 'dcst_report', 'dcst_monitor'],
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
