import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 70 — Agent Environment Configuration', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260612120000_agent_environment_config.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['env_profiles','env_variables','config_templates','config_snapshots','config_audit_log']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => { expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
    it('has Batch 70 header', () => { expect(sql).toContain('Batch 70'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-environment-config.ts'), 'utf-8');
    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('exports 4 helper constants', () => { expect((src.match(/export const \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('exports 4 helper functions', () => { expect((src.match(/export function \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('EnvironmentConfigAction has 7 values', () => {
      const m = src.match(/export type EnvironmentConfigAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('re-exports agent-environment-config', () => { expect(idx).toContain('./agent-environment-config'); });
    it('has at least 95 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(95); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-environment-config/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-environment-config/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
  });

  describe('Eidolon types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('EidolonBuildingKind has 53 values', () => {
      const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(53);
    });
    it('includes config_vault building kind', () => { expect(src).toContain("'config_vault'"); });
    it('EidolonEventKind has 228 values', () => {
      const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(228);
    });
    it('districtFor has 53 cases', () => {
      const dfBlock = src.split('districtFor')[1].split('function ')[0];
      expect((dfBlock.match(/case '\w+':/g) || []).length).toBe(53);
    });
  });

  describe('Event bus', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('SUBJECT_MAP has 227 entries', () => {
      const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(227);
    });
    it('has 4 config subjects', () => {
      for (const s of ['sven.config.profile_created','sven.config.variable_updated','sven.config.snapshot_taken','sven.config.template_applied']) {
        expect(src).toContain(`'${s}'`);
      }
    });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 271 switch cases', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(271); });
    it('has 267 handler methods', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(267); });
    it('includes 7 batch 70 handlers', () => {
      for (const h of ['handleProfileCreate','handleVariableSet','handleVariableDelete','handleTemplateApply','handleSnapshotCreate','handleConfigExport','handleConfigReport']) {
        expect(src).toContain(h);
      }
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks migration private', () => { expect(ga).toContain('20260612120000_agent_environment_config.sql'); });
    it('marks shared types private', () => { expect(ga).toContain('agent-environment-config.ts'); });
    it('marks skill private', () => { expect(ga).toContain('agent-environment-config/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 70', () => { expect(cl).toContain('Batch 70'); });
  });

  describe('Migration count', () => {
    it('has 56 migration files', () => {
      expect(fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql')).length).toBe(56);
    });
  });
});
