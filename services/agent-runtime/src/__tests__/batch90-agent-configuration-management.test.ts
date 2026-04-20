import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 90 — Agent Configuration Management', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617270000_agent_configuration_management.sql'), 'utf-8');
    it('creates config_namespaces table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS config_namespaces'); });
    it('creates config_entries table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS config_entries'); });
    it('creates config_versions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS config_versions'); });
    it('creates config_schemas table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS config_schemas'); });
    it('creates config_audit_log table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS config_audit_log'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
    it('has value_type CHECK', () => { expect(sql).toContain("'string','number','boolean','json','secret','list','map'"); });
    it('has action CHECK', () => { expect(sql).toContain("'create','update','delete','read','rollback','seal','unseal'"); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-configuration-management.ts'), 'utf-8');
    it('exports ConfigValueType', () => { expect(src).toContain("export type ConfigValueType"); });
    it('exports ConfigAction', () => { expect(src).toContain("export type ConfigAction"); });
    it('exports ConfigMergeStrategy', () => { expect(src).toContain("export type ConfigMergeStrategy"); });
    it('exports ConfigEnvironment', () => { expect(src).toContain("export type ConfigEnvironment"); });
    it('exports ConfigNamespace interface', () => { expect(src).toContain("export interface ConfigNamespace"); });
    it('exports ConfigEntry interface', () => { expect(src).toContain("export interface ConfigEntry"); });
    it('exports ConfigVersion interface', () => { expect(src).toContain("export interface ConfigVersion"); });
    it('exports ConfigSchema interface', () => { expect(src).toContain("export interface ConfigSchema"); });
    it('exports AgentcConfigAuditEntry interface', () => { expect(src).toContain("export interface AgentcConfigAuditEntry"); });
    it('exports isConfigSealed helper', () => { expect(src).toContain("export function isConfigSealed"); });
    it('exports isSecretConfig helper', () => { expect(src).toContain("export function isSecretConfig"); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-configuration-management', () => { expect(idx).toContain("export * from './agent-configuration-management.js'"); });
    it('has 115 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(115); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-configuration-management/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-configuration-management/); });
    it('has 7 actions', () => { expect((skill.match(/  - config_/g) || []).length).toBe(7); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has config_vault building kind', () => { expect(types).toContain("'config_vault'"); });
    it('has 73 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(73);
    });
    it('has 4 config event kinds', () => {
      expect(types).toContain("'config.entry_updated'");
      expect(types).toContain("'config.namespace_created'");
      expect(types).toContain("'config.rollback_applied'");
      expect(types).toContain("'config.schema_validated'");
    });
    it('has 308 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(308);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 config subjects', () => {
      expect(bus).toContain("'sven.config.entry_updated'");
      expect(bus).toContain("'sven.config.namespace_created'");
      expect(bus).toContain("'sven.config.rollback_applied'");
      expect(bus).toContain("'sven.config.schema_validated'");
    });
    it('has 307 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(307);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['config_create_namespace','config_set_entry','config_get_entry','config_rollback','config_validate','config_audit','config_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    const handlers = ['handleConfigCreateNamespace','handleConfigSetEntry','handleConfigGetEntry','handleConfigRollback','handleConfigValidate','handleConfigAudit','handleConfigReport'];
    for (const h of handlers) { it(`has ${h} method`, () => { expect(te).toMatch(new RegExp(`private (?:async )?${h}`)); }); }
    it('has 411 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(411); });
    it('has 407 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(407); });
  });
});
