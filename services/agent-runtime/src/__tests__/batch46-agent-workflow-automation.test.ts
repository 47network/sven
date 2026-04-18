import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 46 — Agent Workflow Automation', () => {
  /* ================================================================== */
  /*  Migration SQL                                                      */
  /* ================================================================== */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260519120000_agent_workflow_automation.sql'),
      'utf-8',
    );

    it('creates workflow_definitions table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_definitions');
    });

    it('creates workflow_steps table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_steps');
    });

    it('creates workflow_runs table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_runs');
    });

    it('creates workflow_step_results table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_step_results');
    });

    it('creates workflow_templates table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_templates');
    });

    it('has exactly 5 CREATE TABLE statements', () => {
      const count = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
      expect(count).toBe(5);
    });

    it('has exactly 15 indexes', () => {
      const count = (sql.match(/CREATE INDEX/g) || []).length;
      expect(count).toBe(15);
    });
  });

  /* ================================================================== */
  /*  Shared types                                                       */
  /* ================================================================== */
  describe('Shared types — agent-workflow-automation.ts', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-workflow-automation.ts'),
      'utf-8',
    );

    it('exports WorkflowTriggerType with 5 values', () => {
      expect(types).toContain("export type WorkflowTriggerType");
      for (const v of ['manual', 'scheduled', 'event', 'webhook', 'task_complete']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports WorkflowStatus with 5 values', () => {
      expect(types).toContain("export type WorkflowStatus");
      for (const v of ['draft', 'active', 'paused', 'archived', 'failed']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports StepType with 7 values', () => {
      expect(types).toContain("export type StepType");
      for (const v of ['action', 'condition', 'parallel', 'loop', 'delay', 'sub_workflow', 'approval']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports StepFailurePolicy with 4 values', () => {
      expect(types).toContain("export type StepFailurePolicy");
      for (const v of ['abort', 'skip', 'retry', 'fallback']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports RunStatus with 7 values', () => {
      expect(types).toContain("export type RunStatus");
      for (const v of ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timed_out']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports StepResultStatus with 6 values', () => {
      expect(types).toContain("export type StepResultStatus");
      for (const v of ['pending', 'running', 'completed', 'failed', 'skipped', 'waiting_approval']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports TemplateCategory with 8 values', () => {
      expect(types).toContain("export type TemplateCategory");
      for (const v of ['publishing', 'trading', 'research', 'marketing', 'devops', 'onboarding', 'content', 'custom']) {
        expect(types).toContain(`'${v}'`);
      }
    });

    it('exports WorkflowDefinition interface', () => {
      expect(types).toContain('export interface WorkflowDefinition');
    });

    it('exports WorkflowStep interface', () => {
      expect(types).toContain('export interface WorkflowStep');
    });

    it('exports WorkflowRun interface', () => {
      expect(types).toContain('export interface WorkflowRun');
    });

    it('exports WorkflowStepResult interface', () => {
      expect(types).toContain('export interface WorkflowStepResult');
    });

    it('exports WorkflowTemplate interface', () => {
      expect(types).toContain('export interface WorkflowTemplate');
    });

    it('exports isTerminalRunStatus helper', () => {
      expect(types).toContain('export function isTerminalRunStatus');
    });

    it('exports canResumeRun helper', () => {
      expect(types).toContain('export function canResumeRun');
    });

    it('exports shouldRetryStep helper', () => {
      expect(types).toContain('export function shouldRetryStep');
    });

    it('exports getNextStepOrder helper', () => {
      expect(types).toContain('export function getNextStepOrder');
    });
  });

  /* ================================================================== */
  /*  shared/index.ts barrel export                                      */
  /* ================================================================== */
  describe('shared/index.ts barrel', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('exports agent-workflow-automation module', () => {
      expect(idx).toContain("export * from './agent-workflow-automation.js'");
    });

    it('has 71 lines (wc -l)', () => {
      const lines = idx.split('\n');
      // wc -l counts newline-terminated lines; split gives length-1 if trailing newline
      expect(lines.length - 1).toBe(71);
    });
  });

  /* ================================================================== */
  /*  SKILL.md                                                           */
  /* ================================================================== */
  describe('SKILL.md — workflow-automation', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/workflow-automation/SKILL.md'),
      'utf-8',
    );

    it('has YAML frontmatter', () => {
      expect(skill).toMatch(/^---\n/);
    });

    it('declares skill name', () => {
      expect(skill).toMatch(/skill:\s*workflow-automation/);
    });

    const actions = [
      'workflow_create',
      'workflow_execute',
      'workflow_pause_resume',
      'step_approve',
      'template_publish',
      'template_instantiate',
      'workflow_history',
    ];

    for (const action of actions) {
      it(`documents ${action} action`, () => {
        expect(skill).toContain(`### ${action}`);
      });
    }

    it('has exactly 7 action headings', () => {
      const count = (skill.match(/^### /gm) || []).length;
      expect(count).toBe(7);
    });
  });

  /* ================================================================== */
  /*  Eidolon types.ts                                                   */
  /* ================================================================== */
  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes automation_factory in EidolonBuildingKind', () => {
      expect(types).toContain("'automation_factory'");
    });

    it('EidolonBuildingKind has 29 pipe values', () => {
      const block = types.split('export type EidolonBuildingKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(29);
    });

    it('includes workflow.created event kind', () => {
      expect(types).toContain("'workflow.created'");
    });

    it('includes workflow.run_started event kind', () => {
      expect(types).toContain("'workflow.run_started'");
    });

    it('includes workflow.run_completed event kind', () => {
      expect(types).toContain("'workflow.run_completed'");
    });

    it('includes workflow.step_failed event kind', () => {
      expect(types).toContain("'workflow.step_failed'");
    });

    it('EidolonEventKind has 132 pipe values', () => {
      const block = types.split('export type EidolonEventKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(132);
    });

    it('districtFor maps automation_factory to industrial', () => {
      expect(types).toContain("case 'automation_factory':");
      expect(types).toContain("return 'industrial'");
    });

    it('districtFor has 29 case statements', () => {
      const fn = types.split('export function districtFor')[1];
      const cases = (fn.match(/case '/g) || []).length;
      expect(cases).toBe(29);
    });
  });

  /* ================================================================== */
  /*  Event bus                                                          */
  /* ================================================================== */
  describe('Event bus — SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    const subjects = [
      ['sven.workflow.created', 'workflow.created'],
      ['sven.workflow.run_started', 'workflow.run_started'],
      ['sven.workflow.run_completed', 'workflow.run_completed'],
      ['sven.workflow.step_failed', 'workflow.step_failed'],
    ];

    for (const [nats, kind] of subjects) {
      it(`maps ${nats} → ${kind}`, () => {
        expect(bus).toContain(`'${nats}': '${kind}'`);
      });
    }

    it('SUBJECT_MAP has 131 entries', () => {
      const map = bus.split('SUBJECT_MAP')[1].split('}')[0];
      const entries = (map.match(/'[^']+'\s*:\s*'[^']+'/g) || []).length;
      expect(entries).toBe(131);
    });
  });

  /* ================================================================== */
  /*  Task executor                                                      */
  /* ================================================================== */
  describe('Task executor', () => {
    const executor = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    const taskTypes = [
      'workflow_create',
      'workflow_execute',
      'workflow_pause_resume',
      'step_approve',
      'template_publish',
      'template_instantiate',
      'workflow_history',
    ];

    for (const t of taskTypes) {
      it(`routes ${t} in switch`, () => {
        expect(executor).toContain(`case '${t}':`);
      });
    }

    const handlers = [
      'handleWorkflowCreate',
      'handleWorkflowExecute',
      'handleWorkflowPauseResume',
      'handleStepApprove',
      'handleTemplatePublish',
      'handleTemplateInstantiate',
      'handleWorkflowHistory',
    ];

    for (const h of handlers) {
      it(`implements ${h} method`, () => {
        expect(executor).toMatch(new RegExp(`private (?:async )?${h}`));
      });
    }

    it('has 103 total switch cases', () => {
      const cases = (executor.match(/case '/g) || []).length;
      expect(cases).toBe(103);
    });

    it('has 99 total handler methods', () => {
      const methods = (executor.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(methods).toBe(99);
    });
  });

  /* ================================================================== */
  /*  .gitattributes                                                     */
  /* ================================================================== */
  describe('.gitattributes', () => {
    const attrs = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks migration SQL as export-ignore', () => {
      expect(attrs).toContain('20260519120000_agent_workflow_automation.sql export-ignore');
    });

    it('marks shared types as export-ignore', () => {
      expect(attrs).toContain('agent-workflow-automation.ts export-ignore');
    });

    it('marks skill directory as export-ignore', () => {
      expect(attrs).toContain('skills/autonomous-economy/workflow-automation/** export-ignore');
    });

    it('marks test file as export-ignore', () => {
      expect(attrs).toContain('batch46-agent-workflow-automation.test.ts export-ignore');
    });
  });

  /* ================================================================== */
  /*  CHANGELOG                                                          */
  /* ================================================================== */
  describe('CHANGELOG.md', () => {
    const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('has Batch 46 entry', () => {
      expect(log).toContain('Batch 46');
    });

    it('mentions Agent Workflow Automation', () => {
      expect(log).toContain('Agent Workflow Automation');
    });

    it('Batch 46 appears before Batch 45', () => {
      const b46 = log.indexOf('Batch 46');
      const b45 = log.indexOf('Batch 45');
      expect(b46).toBeLessThan(b45);
    });
  });

  /* ================================================================== */
  /*  Global counts                                                      */
  /* ================================================================== */
  describe('Global counts', () => {
    it('has 32 migration SQL files', () => {
      const dir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(32);
    });

    it('has 39 autonomous-economy skill directories', () => {
      const dir = path.join(ROOT, 'skills/autonomous-economy');
      const dirs = fs.readdirSync(dir).filter(d =>
        fs.statSync(path.join(dir, d)).isDirectory(),
      );
      expect(dirs.length).toBe(39);
    });
  });
});
