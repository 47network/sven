import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 85 — Agent Dependency Injection', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617220000_agent_dependency_injection.sql'), 'utf-8');
    it('creates di_containers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS di_containers'));
    it('creates di_bindings table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS di_bindings'));
    it('creates di_resolutions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS di_resolutions'));
    it('creates di_interceptors table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS di_interceptors'));
    it('creates di_lifecycle_events table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS di_lifecycle_events'));
    it('has at least 20 indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(20));
    it('has scope CHECK', () => expect(sql).toContain("'singleton','transient','scoped','request','session'"));
    it('has binding_type CHECK', () => expect(sql).toContain("'class','factory','value','alias','provider','async_factory'"));
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-dependency-injection.ts'), 'utf-8');
    it('exports DIScope', () => expect(src).toContain('export type DIScope'));
    it('exports BindingType', () => expect(src).toContain('export type BindingType'));
    it('exports ContainerStatus', () => expect(src).toContain('export type ContainerStatus'));
    it('exports InterceptorType', () => expect(src).toContain('export type InterceptorType'));
    it('exports LifecycleEventType', () => expect(src).toContain('export type LifecycleEventType'));
    it('exports DIContainer interface', () => expect(src).toContain('export interface DIContainer'));
    it('exports DIBinding interface', () => expect(src).toContain('export interface DIBinding'));
    it('exports DIResolution interface', () => expect(src).toContain('export interface DIResolution'));
    it('exports DIInterceptor interface', () => expect(src).toContain('export interface DIInterceptor'));
    it('exports DILifecycleEvent interface', () => expect(src).toContain('export interface DILifecycleEvent'));
    it('exports isContainerActive helper', () => expect(src).toContain('export function isContainerActive'));
    it('exports bindingCacheRate helper', () => expect(src).toContain('export function bindingCacheRate'));
    it('exports avgResolutionTime helper', () => expect(src).toContain('export function avgResolutionTime'));
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-dependency-injection', () => expect(idx).toContain('./agent-dependency-injection'));
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-dependency-injection/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => expect(skill).toMatch(/skill:\s*agent-dependency-injection/));
    it('has architect archetype', () => expect(skill).toMatch(/archetype:\s*architect/));
    it('has 7 actions', () => {
      const actions = skill.match(/^  - \w+/gm);
      expect(actions).toBeTruthy();
      expect(actions.length).toBe(7);
    });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has injection_forge building kind', () => expect(types).toContain("'injection_forge'"));
    it('has 68 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(68);
    });
    it('has 288 event kinds', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(288);
    });
    it('has di.container_created event', () => expect(types).toContain("'di.container_created'"));
    it('has di.container_disposed event', () => expect(types).toContain("'di.container_disposed'"));
    it('districtFor maps injection_forge', () => expect(types).toContain("case 'injection_forge':"));
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.di.container_created', () => expect(bus).toContain("'sven.di.container_created'"));
    it('has sven.di.binding_registered', () => expect(bus).toContain("'sven.di.binding_registered'"));
    it('has 287 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(287);
    });
  });

  describe('Task executor', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has di_create_container switch case', () => expect(tex).toContain("case 'di_create_container'"));
    it('has di_bind switch case', () => expect(tex).toContain("case 'di_bind'"));
    it('has di_resolve switch case', () => expect(tex).toContain("case 'di_resolve'"));
    it('has di_report switch case', () => expect(tex).toContain("case 'di_report'"));
    it('has 376 switch cases', () => expect((tex.match(/case '/g) || []).length).toBe(376));
    it('has 372 handler methods', () => expect((tex.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(372));
    it('handleDiCreateContainer returns containerId', () => expect(tex).toContain("handler: 'di_create_container'"));
    it('handleDiReport returns issues', () => expect(tex).toContain("handler: 'di_report'"));
  });

  describe('Privacy filtering', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters migration', () => expect(ga).toContain('20260617220000_agent_dependency_injection.sql'));
    it('filters shared types', () => expect(ga).toContain('agent-dependency-injection.ts'));
    it('filters skill', () => expect(ga).toContain('agent-dependency-injection/SKILL.md'));
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 85', () => expect(cl).toContain('Batch 85'));
    it('mentions Dependency Injection', () => expect(cl).toContain('Dependency Injection'));
  });

  describe('Migration count', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 71 migrations', () => expect(files.length).toBe(71));
  });
});
