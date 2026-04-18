import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 78 — Agent Incident Management', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617150000_agent_incident_management.sql'), 'utf-8');
    it('creates incidents table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS incidents'); });
    it('creates incident_timeline table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS incident_timeline'); });
    it('creates incident_escalations table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS incident_escalations'); });
    it('creates incident_runbooks table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS incident_runbooks'); });
    it('creates incident_postmortems table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS incident_postmortems'); });
    it('has at least 20 indexes', () => { expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-incident-management.ts'), 'utf-8');
    it('exports IncidentSeverity type', () => { expect(src).toContain('export type IncidentSeverity'); });
    it('exports IncidentStatus type', () => { expect(src).toContain('export type IncidentStatus'); });
    it('exports IncidentSource type', () => { expect(src).toContain('export type IncidentSource'); });
    it('exports IncidentImpactScope type', () => { expect(src).toContain('export type IncidentImpactScope'); });
    it('exports IncidentTimelineEventType type', () => { expect(src).toContain('export type IncidentTimelineEventType'); });
    it('exports Incident interface', () => { expect(src).toContain('export interface Incident'); });
    it('exports IncidentTimelineEntry interface', () => { expect(src).toContain('export interface IncidentTimelineEntry'); });
    it('exports IncidentEscalation interface', () => { expect(src).toContain('export interface IncidentEscalation'); });
    it('exports IncidentRunbook interface', () => { expect(src).toContain('export interface IncidentRunbook'); });
    it('exports IncidentPostmortem interface', () => { expect(src).toContain('export interface IncidentPostmortem'); });
    it('exports shouldAutoEscalate helper', () => { expect(src).toContain('export function shouldAutoEscalate'); });
    it('exports meanTimeToResolve helper', () => { expect(src).toContain('export function meanTimeToResolve'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-incident-management module', () => { expect(idx).toContain("export * from './agent-incident-management.js'"); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-incident-management/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-incident-management/); });
    it('has architect archetype', () => { expect(md).toMatch(/archetype:\s*architect/); });
    it('has 7 actions', () => { expect((md.match(/^### /gm) || []).length).toBe(7); });
  });

  describe('Eidolon Building Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes incident_center building kind', () => { expect(types).toContain("'incident_center'"); });
    it('has 61 building kind values', () => {
      const m = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(61);
    });
  });

  describe('Eidolon Event Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes incident event kinds', () => {
      expect(types).toContain("'incident.created'");
      expect(types).toContain("'incident.escalated'");
      expect(types).toContain("'incident.resolved'");
      expect(types).toContain("'incident.postmortem_published'");
    });
    it('has 260 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(260);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps incident_center to civic', () => { expect(types).toContain("case 'incident_center':"); });
    it('has 61 cases', () => {
      const m = types.match(/export function districtFor[\s\S]*?^}/m);
      expect((m![0].match(/case '/g) || []).length).toBe(61);
    });
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 incident subject entries', () => {
      expect(bus).toContain("'sven.incident.created'");
      expect(bus).toContain("'sven.incident.escalated'");
      expect(bus).toContain("'sven.incident.resolved'");
      expect(bus).toContain("'sven.incident.postmortem_published'");
    });
    it('has 259 total entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(259);
    });
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 incident switch cases', () => {
      expect(te).toContain("case 'incident_create':");
      expect(te).toContain("case 'incident_triage':");
      expect(te).toContain("case 'incident_escalate':");
      expect(te).toContain("case 'incident_run_runbook':");
      expect(te).toContain("case 'incident_resolve':");
      expect(te).toContain("case 'incident_postmortem':");
      expect(te).toContain("case 'incident_report':");
    });
    it('has 327 total switch cases', () => { expect((te.match(/case '/g) || []).length).toBe(327); });
  });

  describe('Task executor handler methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 incident handler methods', () => {
      expect(te).toMatch(/private (?:async )?handleIncidentCreate/);
      expect(te).toMatch(/private (?:async )?handleIncidentTriage/);
      expect(te).toMatch(/private (?:async )?handleIncidentEscalate/);
      expect(te).toMatch(/private (?:async )?handleIncidentRunRunbook/);
      expect(te).toMatch(/private (?:async )?handleIncidentResolve/);
      expect(te).toMatch(/private (?:async )?handleIncidentPostmortem/);
      expect(te).toMatch(/private (?:async )?handleIncidentReport/);
    });
    it('has 323 total handler methods', () => {
      expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(323);
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks incident migration as private', () => { expect(ga).toContain('20260617150000_agent_incident_management.sql'); });
    it('marks incident shared types as private', () => { expect(ga).toContain('agent-incident-management.ts'); });
    it('marks incident skill as private', () => { expect(ga).toContain('agent-incident-management/SKILL.md'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 78', () => { expect(cl).toContain('Batch 78'); });
    it('mentions Agent Incident Management', () => { expect(cl).toContain('Agent Incident Management'); });
  });

  describe('Migrations', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 64 migration files', () => { expect(files.length).toBe(64); });
  });
});
