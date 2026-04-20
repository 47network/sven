import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 84 — Agent Circuit Breaker', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617210000_agent_circuit_breaker.sql'), 'utf-8');
    it('creates circuit_breakers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breakers'));
    it('creates circuit_breaker_events table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breaker_events'));
    it('creates circuit_breaker_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breaker_policies'));
    it('creates circuit_breaker_fallbacks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breaker_fallbacks'));
    it('creates circuit_breaker_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS circuit_breaker_metrics'));
    it('has at least 19 indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(19));
    it('has state CHECK', () => expect(sql).toContain("'closed','open','half_open'"));
    it('has event_type CHECK', () => expect(sql).toContain("'state_change','failure','success','timeout','reset','trip','probe'"));
    it('has fallback_type CHECK', () => expect(sql).toContain("'cache','default_value','alternate_service','queue','reject','custom'"));
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-circuit-breaker.ts'), 'utf-8');
    it('exports CircuitBreakerState', () => expect(src).toContain('export type CircuitBreakerState'));
    it('exports CircuitBreakerEventType', () => expect(src).toContain('export type CircuitBreakerEventType'));
    it('exports FallbackType', () => expect(src).toContain('export type FallbackType'));
    it('exports SlidingWindowType', () => expect(src).toContain('export type SlidingWindowType'));
    it('exports MetricsPeriod', () => expect(src).toContain('export type MetricsPeriod'));
    it('exports CircuitBreaker interface', () => expect(src).toContain('export interface CircuitBreaker'));
    it('exports CircuitBreakerEvent interface', () => expect(src).toContain('export interface CircuitBreakerEvent'));
    it('exports CircuitBreakerPolicy interface', () => expect(src).toContain('export interface CircuitBreakerPolicy'));
    it('exports CircuitBreakerFallback interface', () => expect(src).toContain('export interface CircuitBreakerFallback'));
    it('exports CircuitBreakerMetrics interface', () => expect(src).toContain('export interface CircuitBreakerMetrics'));
    it('exports shouldTrip helper', () => expect(src).toContain('export function shouldTrip'));
    it('exports canProbe helper', () => expect(src).toContain('export function canProbe'));
    it('exports calculateErrorRate helper', () => expect(src).toContain('export function calculateErrorRate'));
    it('CircuitBreakerState has 3 values', () => {
      const m = src.match(/export type CircuitBreakerState = ([^;]+);/);
      expect(m).toBeTruthy();
      expect((m[1].match(/'/g) || []).length / 2).toBe(3);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-circuit-breaker', () => expect(idx).toContain('./agent-circuit-breaker'));
    it('has at least 109 lines', () => expect(idx.split('\n').length).toBeGreaterThanOrEqual(109));
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-circuit-breaker/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => expect(skill).toMatch(/skill:\s*agent-circuit-breaker/));
    it('has architect archetype', () => expect(skill).toMatch(/archetype:\s*architect/));
    it('has cb_create action', () => expect(skill).toContain('cb_create'));
    it('has cb_trip action', () => expect(skill).toContain('cb_trip'));
    it('has cb_probe action', () => expect(skill).toContain('cb_probe'));
    it('has cb_reset action', () => expect(skill).toContain('cb_reset'));
    it('has cb_fallback action', () => expect(skill).toContain('cb_fallback'));
    it('has cb_metrics action', () => expect(skill).toContain('cb_metrics'));
    it('has cb_report action', () => expect(skill).toContain('cb_report'));
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has circuit_tower building kind', () => expect(types).toContain("'circuit_tower'"));
    it('has 67 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      expect((block[0].match(/\|/g) || []).length).toBe(67);
    });
    it('has 284 event kinds', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      expect((block[0].match(/\|/g) || []).length).toBe(284);
    });
    it('has circuit.breaker_tripped event', () => expect(types).toContain("'circuit.breaker_tripped'"));
    it('has circuit.breaker_reset event', () => expect(types).toContain("'circuit.breaker_reset'"));
    it('has circuit.fallback_invoked event', () => expect(types).toContain("'circuit.fallback_invoked'"));
    it('has circuit.metrics_collected event', () => expect(types).toContain("'circuit.metrics_collected'"));
    it('districtFor maps circuit_tower', () => expect(types).toContain("case 'circuit_tower':"));
    it('has 67 districtFor cases', () => {
      const fn = types.match(/function districtFor[\s\S]*?^}/m);
      expect(fn).toBeTruthy();
      expect((fn[0].match(/case '/g) || []).length).toBe(67);
    });
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.circuit.breaker_tripped', () => expect(bus).toContain("'sven.circuit.breaker_tripped'"));
    it('has sven.circuit.breaker_reset', () => expect(bus).toContain("'sven.circuit.breaker_reset'"));
    it('has sven.circuit.fallback_invoked', () => expect(bus).toContain("'sven.circuit.fallback_invoked'"));
    it('has sven.circuit.metrics_collected', () => expect(bus).toContain("'sven.circuit.metrics_collected'"));
    it('has 283 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(283);
    });
  });

  describe('Task executor', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has cb_create switch case', () => expect(tex).toContain("case 'cb_create'"));
    it('has cb_trip switch case', () => expect(tex).toContain("case 'cb_trip'"));
    it('has cb_probe switch case', () => expect(tex).toContain("case 'cb_probe'"));
    it('has cb_reset switch case', () => expect(tex).toContain("case 'cb_reset'"));
    it('has cb_fallback switch case', () => expect(tex).toContain("case 'cb_fallback'"));
    it('has cb_metrics switch case', () => expect(tex).toContain("case 'cb_metrics'"));
    it('has cb_report switch case', () => expect(tex).toContain("case 'cb_report'"));
    it('has 369 switch cases', () => expect((tex.match(/case '/g) || []).length).toBe(369));
    it('has 365 handler methods', () => expect((tex.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(365));
    it('handleCbTrip returns state change', () => expect(tex).toContain("handler: 'cb_trip'"));
    it('handleCbFallback returns type', () => expect(tex).toContain("handler: 'cb_fallback'"));
    it('handleCbReport returns recommendations', () => expect(tex).toContain("handler: 'cb_report'"));
  });

  describe('Privacy filtering', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters migration', () => expect(ga).toContain('20260617210000_agent_circuit_breaker.sql'));
    it('filters shared types', () => expect(ga).toContain('agent-circuit-breaker.ts'));
    it('filters skill', () => expect(ga).toContain('agent-circuit-breaker/SKILL.md'));
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 84', () => expect(cl).toContain('Batch 84'));
    it('mentions Circuit Breaker', () => expect(cl).toContain('Circuit Breaker'));
  });

  describe('Migration count', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 70 migrations', () => expect(files.length).toBe(70));
  });
});
