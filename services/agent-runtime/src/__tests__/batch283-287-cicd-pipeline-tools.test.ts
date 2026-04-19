import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'services', 'gateway-api', 'migrations');
const SHARED = path.join(ROOT, 'packages', 'shared', 'src');
const SKILLS = path.join(ROOT, 'skills', 'autonomous-economy');
const TYPES = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
const EVBUS = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts');
const TASK_EXEC = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
const GITATTR = path.join(ROOT, '.gitattributes');

describe('Batches 283-287: CI/CD Pipeline Tools', () => {
  describe('Migrations', () => {
    const migs = [
      { file: '20260619200000_agent_pipeline_runner.sql', tables: ['agent_pipeline_configs', 'agent_pipeline_runs', 'agent_pipeline_stages'] },
      { file: '20260619210000_agent_test_orchestrator.sql', tables: ['agent_test_orch_configs', 'agent_test_runs', 'agent_test_failures'] },
      { file: '20260619220000_agent_deploy_manager.sql', tables: ['agent_deploy_configs', 'agent_deployments', 'agent_deploy_health_checks'] },
      { file: '20260619230000_agent_rollback_controller.sql', tables: ['agent_rollback_configs', 'agent_rollback_events', 'agent_rollback_snapshots'] },
      { file: '20260619240000_agent_release_gatekeeper.sql', tables: ['agent_release_gate_configs', 'agent_release_candidates', 'agent_release_gate_results'] },
    ];
    for (const m of migs) {
      it(`creates ${m.file}`, () => {
        const sql = fs.readFileSync(path.join(MIGRATIONS, m.file), 'utf-8');
        for (const t of m.tables) expect(sql).toContain(t);
      });
    }
  });

  describe('Shared types', () => {
    const types = [
      { file: 'agent-pipeline-runner.ts', exports: ['PipelineType', 'PipelineState', 'AgentPipelineConfig'] },
      { file: 'agent-test-orchestrator.ts', exports: ['TestFramework', 'TestRunState', 'AgentTestOrchConfig'] },
      { file: 'agent-deploy-manager.ts', exports: ['DeployStrategy', 'DeployState', 'AgentDeployConfig'] },
      { file: 'agent-rollback-controller.ts', exports: ['RollbackTrigger', 'RollbackState', 'AgentRollbackConfig'] },
      { file: 'agent-release-gatekeeper.ts', exports: ['GateType', 'CandidateState', 'AgentReleaseGateConfig'] },
    ];
    for (const t of types) {
      it(`exports from ${t.file}`, () => {
        const src = fs.readFileSync(path.join(SHARED, t.file), 'utf-8');
        for (const e of t.exports) expect(src).toContain(e);
      });
    }
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(SHARED, 'index.ts'), 'utf-8');
    for (const m of ['agent-pipeline-runner', 'agent-test-orchestrator', 'agent-deploy-manager', 'agent-rollback-controller', 'agent-release-gatekeeper']) {
      it(`re-exports ${m}`, () => expect(idx).toContain(m));
    }
  });

  describe('SKILL.md files', () => {
    const skills = [
      { dir: 'pipeline-runner', name: 'pipeline-runner', price: '16.99' },
      { dir: 'test-orchestrator', name: 'test-orchestrator', price: '13.99' },
      { dir: 'deploy-manager', name: 'deploy-manager', price: '18.99' },
      { dir: 'rollback-controller', name: 'rollback-controller', price: '15.99' },
      { dir: 'release-gatekeeper', name: 'release-gatekeeper', price: '14.99' },
    ];
    for (const s of skills) {
      it(`has ${s.dir}/SKILL.md with correct metadata`, () => {
        const md = fs.readFileSync(path.join(SKILLS, s.dir, 'SKILL.md'), 'utf-8');
        expect(md).toContain(`name: ${s.name}`);
        expect(md).toContain(`price: ${s.price}`);
        expect(md).toContain('## Actions');
      });
    }
  });

  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const bk of ['pipeline_runner', 'test_orchestrator', 'deploy_manager', 'rollback_controller', 'release_gatekeeper']) {
      it(`has '${bk}'`, () => expect(types).toContain(`'${bk}'`));
    }
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const ek of ['plrun.pipeline_triggered', 'torch.suite_executed', 'dpmgr.deploy_initiated', 'rbctl.rollback_initiated', 'relgk.candidate_evaluated']) {
      it(`has '${ek}'`, () => expect(types).toContain(`'${ek}'`));
    }
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(EVBUS, 'utf-8');
    for (const s of ['sven.plrun.pipeline_triggered', 'sven.torch.suite_executed', 'sven.dpmgr.deploy_initiated', 'sven.rbctl.rollback_initiated', 'sven.relgk.candidate_evaluated']) {
      it(`maps '${s}'`, () => expect(bus).toContain(`'${s}'`));
    }
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const c of ['plrun_trigger_pipeline', 'torch_run_suite', 'dpmgr_deploy', 'rbctl_initiate_rollback', 'relgk_evaluate_candidate', 'relgk_export_report']) {
      it(`routes '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task executor handlers', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const h of ['handlePlrunTriggerPipeline', 'handleTorchRunSuite', 'handleDpmgrDeploy', 'handleRbctlInitiateRollback', 'handleRelgkEvaluateCandidate']) {
      it(`has handler ${h}`, () => expect(te).toContain(`${h}(`));
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(GITATTR, 'utf-8');
    for (const f of ['agent-pipeline-runner', 'agent-test-orchestrator', 'agent-deploy-manager', 'agent-rollback-controller', 'agent-release-gatekeeper']) {
      it(`filters ${f}`, () => expect(ga).toContain(f));
    }
  });
});
