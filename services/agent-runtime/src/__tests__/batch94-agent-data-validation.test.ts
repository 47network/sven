import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 94 — Agent Data Validation', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617310000_agent_data_validation.sql'), 'utf-8');
    it('creates validation_schemas table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS validation_schemas'); });
    it('creates validation_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS validation_rules'); });
    it('creates validation_results table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS validation_results'); });
    it('creates validation_pipelines table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS validation_pipelines'); });
    it('creates validation_audit_log table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS validation_audit_log'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-data-validation.ts'), 'utf-8');
    it('exports SchemaType', () => { expect(src).toContain("export type SchemaType"); });
    it('exports RuleType', () => { expect(src).toContain("export type RuleType"); });
    it('exports ValidationSeverity', () => { expect(src).toContain("export type ValidationSeverity"); });
    it('exports AuditAction', () => { expect(src).toContain("export type AuditAction"); });
    it('exports ValidationSchema interface', () => { expect(src).toContain("export interface ValidationSchema"); });
    it('exports ValidationRule interface', () => { expect(src).toContain("export interface ValidationRule"); });
    it('exports DataValidationResult interface', () => { expect(src).toContain("export interface DataValidationResult"); });
    it('exports isSchemaActive helper', () => { expect(src).toContain("export function isSchemaActive"); });
    it('exports validationPassRate helper', () => { expect(src).toContain("export function validationPassRate"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has validation_hub building kind', () => { expect(types).toContain("'validation_hub'"); });
    it('has 77 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(77);
    });
    it('has 324 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(324);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has validation subjects', () => {
      expect(bus).toContain("'sven.validation.schema_created'");
      expect(bus).toContain("'sven.validation.audit_logged'");
    });
    it('has 323 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(323);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['validation_create_schema','validation_add_rule','validation_validate','validation_create_pipeline','validation_run_pipeline','validation_audit','validation_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 439 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(439); });
    it('has 435 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(435); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-data-validation/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-data-validation/); });
    it('has 7 actions', () => { expect((skill.match(/  - validation_/g) || []).length).toBe(7); });
  });
});
