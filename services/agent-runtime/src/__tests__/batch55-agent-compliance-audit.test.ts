/**
 * Batch 55 — Agent Compliance & Audit
 *
 * Validates migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, task-executor handlers, .gitattributes, and barrel export.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('Batch 55 — Agent Compliance & Audit', () => {
  const sql = read('services/gateway-api/migrations/20260528120000_agent_compliance_audit.sql');

  /* ------------------------------------------------------------------ */
  /*  Migration SQL                                                      */
  /* ------------------------------------------------------------------ */
  describe('Migration SQL', () => {
    it('creates 5 tables', () => {
      const tables = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
      expect(tables).toBe(5);
    });

    it('includes compliance_policies table', () => {
      expect(sql).toContain('compliance_policies');
    });

    it('includes audit_trail table', () => {
      expect(sql).toContain('audit_trail');
    });

    it('includes compliance_checks table', () => {
      expect(sql).toContain('compliance_checks');
    });

    it('includes risk_assessments table', () => {
      expect(sql).toContain('risk_assessments');
    });

    it('includes compliance_reports table', () => {
      expect(sql).toContain('compliance_reports');
    });

    it('creates 17 indexes', () => {
      const indexes = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
      expect(indexes).toBe(17);
    });

    it('compliance_checks references compliance_policies', () => {
      expect(sql).toContain('REFERENCES compliance_policies(id)');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Shared types                                                       */
  /* ------------------------------------------------------------------ */
  const types = read('packages/shared/src/agent-compliance-audit.ts');

  describe('Shared types file', () => {
    it('exports PolicyType with 5 values', () => {
      const m = types.match(/export type PolicyType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports PolicyStatus with 5 values', () => {
      const m = types.match(/export type PolicyStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports AuditActionType with 8 values', () => {
      const m = types.match(/export type AuditActionType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(8);
    });

    it('exports AuditOutcome with 4 values', () => {
      const m = types.match(/export type AuditOutcome\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(4);
    });

    it('exports CheckType with 5 values', () => {
      const m = types.match(/export type CheckType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports CheckStatus with 6 values', () => {
      const m = types.match(/export type CheckStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });

    it('exports ComplianceAction with 7 values', () => {
      const m = types.match(/export type ComplianceAction\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
  });

  describe('Shared interfaces', () => {
    it('exports CompliancePolicy interface', () => {
      expect(types).toContain('export interface CompliancePolicy');
    });

    it('exports AuditTrailEntry interface', () => {
      expect(types).toContain('export interface AuditTrailEntry');
    });

    it('exports ComplianceCheck interface', () => {
      expect(types).toContain('export interface ComplianceCheck');
    });

    it('exports RiskAssessment interface', () => {
      expect(types).toContain('export interface RiskAssessment');
    });

    it('exports ComplianceReport interface', () => {
      expect(types).toContain('export interface ComplianceReport');
    });
  });

  describe('Shared constants and helpers', () => {
    it('exports 6 constant arrays', () => {
      const constants = (types.match(/export const [A-Z_]+:\s*readonly/g) || []).length;
      expect(constants).toBe(6);
    });

    it('exports isPolicyActive helper', () => {
      expect(types).toContain('export function isPolicyActive');
    });

    it('exports isCheckPassing helper', () => {
      expect(types).toContain('export function isCheckPassing');
    });

    it('exports isHighRisk helper', () => {
      expect(types).toContain('export function isHighRisk');
    });

    it('exports calculatePassRate helper', () => {
      expect(types).toContain('export function calculatePassRate');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Barrel export                                                      */
  /* ------------------------------------------------------------------ */
  describe('Barrel export', () => {
    const barrel = read('packages/shared/src/index.ts');

    it('re-exports agent-compliance-audit', () => {
      expect(barrel).toContain('agent-compliance-audit');
    });

    it('has at least 80 lines', () => {
      const lines = barrel.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(80);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  SKILL.md                                                           */
  /* ------------------------------------------------------------------ */
  describe('SKILL.md', () => {
    const skill = read('skills/autonomous-economy/compliance-audit/SKILL.md');

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-compliance-audit/);
    });

    it('declares 7 actions', () => {
      const actions = (skill.match(/^\s+-\s+(policy_create|audit_log|check_run|risk_assess|report_generate|policy_enforce|violation_resolve)/gm) || []).length;
      expect(actions).toBe(7);
    });

    it('includes policy_create action', () => {
      expect(skill).toContain('policy_create');
    });

    it('includes check_run action', () => {
      expect(skill).toContain('check_run');
    });

    it('includes violation_resolve action', () => {
      expect(skill).toContain('violation_resolve');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Eidolon building kind                                              */
  /* ------------------------------------------------------------------ */
  describe('Eidolon building kind', () => {
    const eidolon = read('services/sven-eidolon/src/types.ts');

    it('includes compliance_courthouse building kind', () => {
      expect(eidolon).toContain("'compliance_courthouse'");
    });

    it('has 38 building kinds total', () => {
      const block = eidolon.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(38);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Eidolon event kinds                                                */
  /* ------------------------------------------------------------------ */
  describe('Eidolon event kinds', () => {
    const eidolon = read('services/sven-eidolon/src/types.ts');

    it('includes 4 compliance event kinds', () => {
      expect(eidolon).toContain("'compliance.policy_created'");
      expect(eidolon).toContain("'compliance.check_completed'");
      expect(eidolon).toContain("'compliance.violation_detected'");
      expect(eidolon).toContain("'compliance.report_generated'");
    });

    it('has 168 event kinds total', () => {
      const block = eidolon.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(168);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  districtFor                                                        */
  /* ------------------------------------------------------------------ */
  describe('districtFor', () => {
    const eidolon = read('services/sven-eidolon/src/types.ts');

    it('maps compliance_courthouse to civic', () => {
      expect(eidolon).toContain("case 'compliance_courthouse'");
      expect(eidolon).toContain("return 'civic'");
    });

    it('has 38 cases total', () => {
      const cases = (eidolon.match(/case '/g) || []).length;
      expect(cases).toBe(38);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Event bus SUBJECT_MAP                                              */
  /* ------------------------------------------------------------------ */
  describe('Event bus SUBJECT_MAP', () => {
    const bus = read('services/sven-eidolon/src/event-bus.ts');

    it('includes 4 compliance subjects', () => {
      expect(bus).toContain("'sven.compliance.policy_created'");
      expect(bus).toContain("'sven.compliance.check_completed'");
      expect(bus).toContain("'sven.compliance.violation_detected'");
      expect(bus).toContain("'sven.compliance.report_generated'");
    });

    it('has 167 entries total', () => {
      const match = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(match).toBeTruthy();
      const entries = (match![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(167);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Task executor switch cases                                         */
  /* ------------------------------------------------------------------ */
  describe('Task executor switch cases', () => {
    const exec = read('services/sven-marketplace/src/task-executor.ts');

    it('includes 7 compliance switch cases', () => {
      expect(exec).toContain("case 'policy_create'");
      expect(exec).toContain("case 'audit_log'");
      expect(exec).toContain("case 'check_run'");
      expect(exec).toContain("case 'risk_assess'");
      expect(exec).toContain("case 'report_generate'");
      expect(exec).toContain("case 'policy_enforce'");
      expect(exec).toContain("case 'violation_resolve'");
    });

    it('has 166 switch cases total', () => {
      const cases = (exec.match(/case '/g) || []).length;
      expect(cases).toBe(166);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Task executor handler methods                                      */
  /* ------------------------------------------------------------------ */
  describe('Task executor handler methods', () => {
    const exec = read('services/sven-marketplace/src/task-executor.ts');

    it('includes 7 compliance handler methods', () => {
      expect(exec).toContain('handlePolicyCreate');
      expect(exec).toContain('handleAuditLog');
      expect(exec).toContain('handleCheckRun');
      expect(exec).toContain('handleRiskAssess');
      expect(exec).toContain('handleReportGenerate');
      expect(exec).toContain('handlePolicyEnforce');
      expect(exec).toContain('handleViolationResolve');
    });

    it('has 162 handler methods total', () => {
      const handlers = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(162);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  .gitattributes                                                     */
  /* ------------------------------------------------------------------ */
  describe('.gitattributes', () => {
    const attrs = read('.gitattributes');

    it('includes compliance audit migration filter', () => {
      expect(attrs).toContain('20260528120000_agent_compliance_audit.sql export-ignore');
    });

    it('includes compliance audit types filter', () => {
      expect(attrs).toContain('agent-compliance-audit.ts export-ignore');
    });

    it('includes compliance audit skill filter', () => {
      expect(attrs).toContain('compliance-audit/** export-ignore');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Migration file count                                               */
  /* ------------------------------------------------------------------ */
  describe('Migration file count', () => {
    it('has 41 migration files total', () => {
      const migDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(41);
    });
  });
});
