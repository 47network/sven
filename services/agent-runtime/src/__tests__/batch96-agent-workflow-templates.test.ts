import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 96 — Agent Workflow Templates', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617330000_agent_workflow_templates.sql'), 'utf-8');
    it('creates workflow_templates table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_templates'); });
    it('creates workflow_steps table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_steps'); });
    it('creates workflow_triggers table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_triggers'); });
    it('creates workflow_executions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_executions'); });
    it('creates workflow_step_results table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS workflow_step_results'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-workflow-templates.ts'), 'utf-8');
    it('exports WorkflowCategory', () => { expect(src).toContain("export type WorkflowCategory"); });
    it('exports TriggerType', () => { expect(src).toContain("export type TriggerType"); });
    it('exports ExecutionStatus', () => { expect(src).toContain("export type ExecutionStatus"); });
    it('exports WorkflowTemplate interface', () => { expect(src).toContain("export interface WorkflowTemplate"); });
    it('exports WorkflowExecution interface', () => { expect(src).toContain("export interface WorkflowExecution"); });
    it('exports isWorkflowRunning helper', () => { expect(src).toContain("export function isWorkflowRunning"); });
    it('exports workflowProgress helper', () => { expect(src).toContain("export function workflowProgress"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has workflow_factory building kind', () => { expect(types).toContain("'workflow_factory'"); });
    it('has 79 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(79);
    });
    it('has 332 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(332);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has workflow subjects', () => {
      expect(bus).toContain("'sven.workflow.template_created'");
      expect(bus).toContain("'sven.workflow.trigger_fired'");
    });
    it('has 331 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(331);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['workflow_create_template','workflow_add_step','workflow_add_trigger','workflow_execute','workflow_pause_resume','workflow_get_status','workflow_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 453 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(453); });
    it('has 449 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(449); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-workflow-templates/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-workflow-templates/); });
    it('has 7 actions', () => { expect((skill.match(/  - workflow_/g) || []).length).toBe(7); });
  });
});
