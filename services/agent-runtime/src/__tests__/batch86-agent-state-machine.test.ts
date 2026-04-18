import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 86 — Agent State Machine', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617230000_agent_state_machine.sql'), 'utf-8');
    it('creates state_machines table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS state_machines'));
    it('creates state_definitions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS state_definitions'));
    it('creates state_transitions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS state_transitions'));
    it('creates state_history table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS state_history'));
    it('creates state_machine_templates table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS state_machine_templates'));
    it('has at least 20 indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(20));
    it('has status CHECK', () => expect(sql).toContain("'running','paused','completed','failed','cancelled'"));
    it('has state_type CHECK', () => expect(sql).toContain("'initial','normal','final','parallel','history','error'"));
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-state-machine.ts'), 'utf-8');
    it('exports MachineStatus', () => expect(src).toContain('export type MachineStatus'));
    it('exports StateType', () => expect(src).toContain('export type StateType'));
    it('exports TransitionResult', () => expect(src).toContain('export type TransitionResult'));
    it('exports MachineAction', () => expect(src).toContain('export type MachineAction'));
    it('exports HistoryType', () => expect(src).toContain('export type HistoryType'));
    it('exports StateMachine interface', () => expect(src).toContain('export interface StateMachine'));
    it('exports StateDefinition interface', () => expect(src).toContain('export interface StateDefinition'));
    it('exports StateTransition interface', () => expect(src).toContain('export interface StateTransition'));
    it('exports StateHistory interface', () => expect(src).toContain('export interface StateHistory'));
    it('exports StateMachineTemplate interface', () => expect(src).toContain('export interface StateMachineTemplate'));
    it('exports isMachineTerminal helper', () => expect(src).toContain('export function isMachineTerminal'));
    it('exports canTransition helper', () => expect(src).toContain('export function canTransition'));
    it('exports transitionCount helper', () => expect(src).toContain('export function transitionCount'));
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-state-machine/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => expect(skill).toMatch(/skill:\s*agent-state-machine/));
    it('has architect archetype', () => expect(skill).toMatch(/archetype:\s*architect/));
    it('has sm_create action', () => expect(skill).toContain('sm_create'));
    it('has sm_transition action', () => expect(skill).toContain('sm_transition'));
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has state_engine building kind', () => expect(types).toContain("'state_engine'"));
    it('has 69 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(69);
    });
    it('has 292 event kinds', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(292);
    });
    it('has statemachine.created event', () => expect(types).toContain("'statemachine.created'"));
    it('has statemachine.transitioned event', () => expect(types).toContain("'statemachine.transitioned'"));
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.statemachine.created', () => expect(bus).toContain("'sven.statemachine.created'"));
    it('has sven.statemachine.failed', () => expect(bus).toContain("'sven.statemachine.failed'"));
    it('has 291 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(291);
    });
  });

  describe('Task executor', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has sm_create switch case', () => expect(tex).toContain("case 'sm_create'"));
    it('has sm_transition switch case', () => expect(tex).toContain("case 'sm_transition'"));
    it('has 383 switch cases', () => expect((tex.match(/case '/g) || []).length).toBe(383));
    it('has 379 handler methods', () => expect((tex.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(379));
    it('handleSmCreate returns machineId', () => expect(tex).toContain("handler: 'sm_create'"));
    it('handleSmReport returns breakdown', () => expect(tex).toContain("handler: 'sm_report'"));
  });

  describe('Privacy + CHANGELOG', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('filters migration', () => expect(ga).toContain('20260617230000_agent_state_machine.sql'));
    it('mentions Batch 86', () => expect(cl).toContain('Batch 86'));
    it('mentions State Machine', () => expect(cl).toContain('State Machine'));
  });

  describe('Migration count', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 72 migrations', () => expect(files.length).toBe(72));
  });
});
