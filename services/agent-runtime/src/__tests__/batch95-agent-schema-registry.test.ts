import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 95 — Agent Schema Registry', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617320000_agent_schema_registry.sql'), 'utf-8');
    it('creates schema_registry table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_registry'); });
    it('creates schema_versions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_versions'); });
    it('creates schema_dependencies table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_dependencies'); });
    it('creates schema_consumers table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_consumers'); });
    it('creates schema_evolution_log table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_evolution_log'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-schema-registry.ts'), 'utf-8');
    it('exports SchemaFormat', () => { expect(src).toContain("export type SchemaFormat"); });
    it('exports CompatibilityMode', () => { expect(src).toContain("export type CompatibilityMode"); });
    it('exports SchemaEvolutionType', () => { expect(src).toContain("export type SchemaEvolutionType"); });
    it('exports SchemaRegistryEntry interface', () => { expect(src).toContain("export interface SchemaRegistryEntry"); });
    it('exports SchemaVersion interface', () => { expect(src).toContain("export interface SchemaVersion"); });
    it('exports isSchemaBreaking helper', () => { expect(src).toContain("export function isSchemaBreaking"); });
    it('exports schemaFullName helper', () => { expect(src).toContain("export function schemaFullName"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has schema_registry building kind', () => { expect(types).toContain("'schema_registry'"); });
    it('has 78 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(78);
    });
    it('has 328 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(328);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has registry subjects', () => {
      expect(bus).toContain("'sven.registry.schema_registered'");
      expect(bus).toContain("'sven.registry.schema_evolved'");
    });
    it('has 327 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(327);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['registry_register_schema','registry_publish_version','registry_add_dependency','registry_subscribe','registry_check_compatibility','registry_evolve','registry_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 446 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(446); });
    it('has 442 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(442); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-schema-registry/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-schema-registry/); });
    it('has 7 actions', () => { expect((skill.match(/  - registry_/g) || []).length).toBe(7); });
  });
});
