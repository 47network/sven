import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 48 — Agent Deployment Pipelines', () => {
  // ── Migration SQL ───────────────────────────────────────────────
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260521120000_agent_deployment_pipelines.sql'),
      'utf-8',
    );

    it('creates deployment_pipelines table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS deployment_pipelines');
    });

    it('creates deployment_stages table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS deployment_stages');
    });

    it('creates deployment_artifacts table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS deployment_artifacts');
    });

    it('creates deployment_rollbacks table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS deployment_rollbacks');
    });

    it('creates deployment_environments table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS deployment_environments');
    });

    it('has 15 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(idxCount).toBe(15);
    });

    it('references pipeline_id foreign key', () => {
      expect(sql).toContain('pipeline_id');
    });

    it('has JSONB columns for metadata', () => {
      expect(sql.toLowerCase()).toContain('jsonb');
    });
  });

  // ── Shared Types ────────────────────────────────────────────────
  describe('Shared Types', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-deployment-pipelines.ts'),
      'utf-8',
    );

    it('exports DeploymentPipelineStatus with 8 values', () => {
      const match = types.split('DeploymentPipelineStatus')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(8);
    });

    it('exports DeploymentTriggerType with 5 values', () => {
      const match = types.split('DeploymentTriggerType')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(5);
    });

    it('exports DeploymentEnvironment with 4 values', () => {
      const match = types.split("export type DeploymentEnvironment ")[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(4);
    });

    it('exports DeploymentStageName with 9 values', () => {
      const match = types.split('DeploymentStageName')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(9);
    });

    it('exports DeploymentStageStatus with 6 values', () => {
      const match = types.split('DeploymentStageStatus')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(6);
    });

    it('exports DeploymentArtifactType with 6 values', () => {
      const match = types.split('DeploymentArtifactType')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(6);
    });

    it('exports RollbackType with 3 values', () => {
      const match = types.split('export type RollbackType')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(3);
    });

    it('exports RollbackStatus with 4 values', () => {
      const match = types.split('export type RollbackStatus')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(4);
    });

    it('exports EnvironmentHealthStatus with 4 values', () => {
      const match = types.split('EnvironmentHealthStatus')[1].split(';')[0];
      const values = match.match(/'/g) || [];
      expect(values.length / 2).toBe(4);
    });

    it('exports DeploymentPipeline interface', () => {
      expect(types).toContain('export interface DeploymentPipeline');
    });

    it('exports DeploymentStage interface', () => {
      expect(types).toContain('export interface DeploymentStage');
    });

    it('exports DeploymentArtifact interface', () => {
      expect(types).toContain('export interface DeploymentArtifact');
    });

    it('exports DeploymentRollback interface', () => {
      expect(types).toContain('export interface DeploymentRollback');
    });

    it('exports DeploymentEnv interface', () => {
      expect(types).toContain('export interface DeploymentEnv');
    });

    it('exports canPromoteEnvironment helper', () => {
      expect(types).toContain('export function canPromoteEnvironment');
    });

    it('exports isTerminalStatus helper', () => {
      expect(types).toContain('export function isTerminalStatus');
    });

    it('exports getNextStage helper', () => {
      expect(types).toContain('export function getNextStage');
    });

    it('exports estimateDeploymentRisk helper', () => {
      expect(types).toContain('export function estimateDeploymentRisk');
    });

    it('has 6 constants', () => {
      const consts = (types.match(/export const /g) || []).length;
      expect(consts).toBe(6);
    });
  });

  // ── Shared Index Barrel ──────────────────────────────────────────
  describe('Shared Index Barrel', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('exports agent-deployment-pipelines', () => {
      expect(idx).toContain("export * from './agent-deployment-pipelines.js'");
    });

    it('has 73 lines (wc -l)', () => {
      const lines = idx.split('\n');
      // wc -l counts newline-terminated lines; split gives length-1 when trailing newline
      expect(lines.length - 1).toBe(73);
    });
  });

  // ── SKILL.md ────────────────────────────────────────────────────
  describe('SKILL.md — deployment-pipelines', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/deployment-pipelines/SKILL.md'),
      'utf-8',
    );

    it('has skill identifier deployment-pipelines', () => {
      expect(skill).toMatch(/skill:\s*deployment-pipelines/);
    });

    it('defines pipeline_create action', () => {
      expect(skill).toContain('pipeline_create');
    });

    it('defines pipeline_execute action', () => {
      expect(skill).toContain('pipeline_execute');
    });

    it('defines stage_advance action', () => {
      expect(skill).toContain('stage_advance');
    });

    it('defines artifact_publish action', () => {
      expect(skill).toContain('artifact_publish');
    });

    it('defines rollback_initiate action', () => {
      expect(skill).toContain('rollback_initiate');
    });

    it('defines environment_health action', () => {
      expect(skill).toContain('environment_health');
    });

    it('defines promote_environment action', () => {
      expect(skill).toContain('promote_environment');
    });
  });

  // ── Eidolon Types ──────────────────────────────────────────────
  describe('Eidolon Types', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('has deployment_center building kind', () => {
      expect(types).toContain("'deployment_center'");
    });

    it('has 31 building kinds', () => {
      const block = types.split('export type EidolonBuildingKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(31);
    });

    it('has deployment.pipeline_started event kind', () => {
      expect(types).toContain("'deployment.pipeline_started'");
    });

    it('has deployment.stage_completed event kind', () => {
      expect(types).toContain("'deployment.stage_completed'");
    });

    it('has deployment.deployed event kind', () => {
      expect(types).toContain("'deployment.deployed'");
    });

    it('has deployment.rollback_initiated event kind', () => {
      expect(types).toContain("'deployment.rollback_initiated'");
    });

    it('has 140 event kinds', () => {
      const block = types.split('export type EidolonEventKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(140);
    });

    it('districtFor maps deployment_center to market', () => {
      expect(types).toContain("case 'deployment_center':");
      expect(types).toMatch(/case 'deployment_center':[\s\S]*?return 'market'/);
    });

    it('has 31 districtFor cases', () => {
      const districtBlock = types.split('districtFor')[1];
      const cases = (districtBlock.match(/case '/g) || []).length;
      expect(cases).toBe(31);
    });
  });

  // ── Event Bus ──────────────────────────────────────────────────
  describe('Event Bus — SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('maps deployment.pipeline_started', () => {
      expect(bus).toContain("'sven.deployment.pipeline_started'");
    });

    it('maps deployment.stage_completed', () => {
      expect(bus).toContain("'sven.deployment.stage_completed'");
    });

    it('maps deployment.deployed', () => {
      expect(bus).toContain("'sven.deployment.deployed'");
    });

    it('maps deployment.rollback_initiated', () => {
      expect(bus).toContain("'sven.deployment.rollback_initiated'");
    });

    it('has 139 SUBJECT_MAP entries', () => {
      const entries = (bus.match(/'sven\./g) || []).length;
      expect(entries).toBe(139);
    });
  });

  // ── Task Executor ──────────────────────────────────────────────
  describe('Task Executor', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has deploy_pipeline_create switch case', () => {
      expect(exec).toContain("case 'deploy_pipeline_create':");
    });

    it('has deploy_pipeline_execute switch case', () => {
      expect(exec).toContain("case 'deploy_pipeline_execute':");
    });

    it('has deploy_stage_advance switch case', () => {
      expect(exec).toContain("case 'deploy_stage_advance':");
    });

    it('has deploy_artifact_publish switch case', () => {
      expect(exec).toContain("case 'deploy_artifact_publish':");
    });

    it('has deploy_rollback switch case', () => {
      expect(exec).toContain("case 'deploy_rollback':");
    });

    it('has deploy_env_health switch case', () => {
      expect(exec).toContain("case 'deploy_env_health':");
    });

    it('has deploy_promote switch case', () => {
      expect(exec).toContain("case 'deploy_promote':");
    });

    it('has 117 switch cases total', () => {
      const cases = (exec.match(/case '/g) || []).length;
      expect(cases).toBe(117);
    });

    it('has handleDeployPipelineCreate method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployPipelineCreate/);
    });

    it('has handleDeployPipelineExecute method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployPipelineExecute/);
    });

    it('has handleDeployStageAdvance method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployStageAdvance/);
    });

    it('has handleDeployArtifactPublish method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployArtifactPublish/);
    });

    it('has handleDeployRollback method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployRollback/);
    });

    it('has handleDeployEnvHealth method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployEnvHealth/);
    });

    it('has handleDeployPromote method', () => {
      expect(exec).toMatch(/private (?:async )?handleDeployPromote/);
    });

    it('has 113 handler methods total', () => {
      const handlers = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(113);
    });
  });

  // ── Cross-Batch Integrity ──────────────────────────────────────
  describe('Cross-Batch Integrity', () => {
    it('has 34 migration files', () => {
      const dir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
      expect(files.length).toBe(34);
    });

    it('has 41 autonomous-economy skill directories', () => {
      const dir = path.join(ROOT, 'skills/autonomous-economy');
      const dirs = fs.readdirSync(dir).filter((f: string) =>
        fs.statSync(path.join(dir, f)).isDirectory(),
      );
      expect(dirs.length).toBe(41);
    });

    it('.gitattributes has deployment-pipelines entries', () => {
      const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
      expect(ga).toContain('deployment_pipelines.sql export-ignore');
      expect(ga).toContain('agent-deployment-pipelines.ts export-ignore');
      expect(ga).toContain('deployment-pipelines/** export-ignore');
    });

    it('CHANGELOG has Batch 48 entry', () => {
      const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
      expect(cl).toContain('Batch 48');
      expect(cl).toContain('Agent Deployment Pipelines');
    });
  });
});
