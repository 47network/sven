import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 93 — Agent Load Balancing', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617300000_agent_load_balancing.sql'), 'utf-8');
    it('creates lb_instances table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS lb_instances'); });
    it('creates lb_backends table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS lb_backends'); });
    it('creates lb_routing_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS lb_routing_rules'); });
    it('creates lb_health_probes table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS lb_health_probes'); });
    it('creates lb_traffic_metrics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS lb_traffic_metrics'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-load-balancing.ts'), 'utf-8');
    it('exports LBAlgorithm', () => { expect(src).toContain("export type LBAlgorithm"); });
    it('exports LBStatus', () => { expect(src).toContain("export type LBStatus"); });
    it('exports BackendStatus', () => { expect(src).toContain("export type BackendStatus"); });
    it('exports MatchType', () => { expect(src).toContain("export type MatchType"); });
    it('exports ProbeType', () => { expect(src).toContain("export type ProbeType"); });
    it('exports LBInstance interface', () => { expect(src).toContain("export interface LBInstance"); });
    it('exports LBBackend interface', () => { expect(src).toContain("export interface LBBackend"); });
    it('exports isLBActive helper', () => { expect(src).toContain("export function isLBActive"); });
    it('exports backendErrorRate helper', () => { expect(src).toContain("export function backendErrorRate"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has load_balancer building kind', () => { expect(types).toContain("'load_balancer'"); });
    it('has 76 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(76);
    });
    it('has 320 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(320);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has lb subjects', () => {
      expect(bus).toContain("'sven.lb.instance_created'");
      expect(bus).toContain("'sven.lb.backend_drained'");
    });
    it('has 319 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(319);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['lb_create','lb_add_backend','lb_add_rule','lb_configure_probe','lb_drain_backend','lb_traffic_stats','lb_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 432 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(432); });
    it('has 428 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(428); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-load-balancing/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-load-balancing/); });
    it('has 7 actions', () => { expect((skill.match(/  - lb_/g) || []).length).toBe(7); });
  });
});
