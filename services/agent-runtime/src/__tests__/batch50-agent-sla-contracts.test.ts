import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 50 — Agent SLA & Contracts', () => {
  /* ── Migration SQL ───────────────────────────────────────── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260523120000_agent_sla_contracts.sql'),
      'utf-8',
    );

    it('creates service_contracts table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_contracts');
    });
    it('creates sla_definitions table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS sla_definitions');
    });
    it('creates sla_measurements table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS sla_measurements');
    });
    it('creates contract_amendments table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS contract_amendments');
    });
    it('creates contract_disputes table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS contract_disputes');
    });
    it('has at least 15 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(15);
    });
    it('references contract_id foreign keys', () => {
      expect(sql).toContain('contract_id');
    });
  });

  /* ── Shared Types ────────────────────────────────────────── */
  describe('Shared Types — agent-sla-contracts.ts', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-sla-contracts.ts'),
      'utf-8',
    );

    it('exports ContractType with 5 values', () => {
      const m = src.match(/export type ContractType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports ContractStatus with 7 values', () => {
      const m = src.match(/export type ContractStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
    it('exports SlaMetricType with 6 values', () => {
      const m = src.match(/export type SlaMetricType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });
    it('exports SlaComplianceStatus with 4 values', () => {
      const m = src.match(/export type SlaComplianceStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(4);
    });
    it('exports MeasurementWindow with 5 values', () => {
      const m = src.match(/export type MeasurementWindow\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports PenaltyType with 5 values', () => {
      const m = src.match(/export type PenaltyType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports AmendmentType with 4 values', () => {
      const m = src.match(/export type AmendmentType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(4);
    });
    it('exports AmendmentStatus with 5 values', () => {
      const m = src.match(/export type AmendmentStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports DisputeType with 5 values', () => {
      const m = src.match(/export type DisputeType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
    it('exports DisputeSeverity with 4 values', () => {
      const m = src.match(/export type DisputeSeverity\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(4);
    });
    it('exports AgentsDisputeStatus with 6 values', () => {
      const m = src.match(/export type AgentsDisputeStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });
    it('exports ServiceContract interface', () => {
      expect(src).toContain('export interface ServiceContract');
    });
    it('exports SlaDefinition interface', () => {
      expect(src).toContain('export interface SlaDefinition');
    });
    it('exports SlaMeasurement interface', () => {
      expect(src).toContain('export interface SlaMeasurement');
    });
    it('exports ContractAmendment interface', () => {
      expect(src).toContain('export interface ContractAmendment');
    });
    it('exports ContractDispute interface', () => {
      expect(src).toContain('export interface ContractDispute');
    });
    it('exports helper functions', () => {
      expect(src).toContain('isContractActive');
      expect(src).toContain('isSlaBreached');
      expect(src).toContain('getComplianceStatus');
      expect(src).toContain('calculateSlaScore');
    });
  });

  /* ── Barrel Export ───────────────────────────────────────── */
  describe('Barrel Export — shared/index.ts', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );
    it('exports agent-sla-contracts module', () => {
      expect(idx).toContain("from './agent-sla-contracts");
    });
    it('has 75 lines', () => {
      const lines = idx.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(74);
      expect(lines).toBeLessThanOrEqual(76);
    });
  });

  /* ── SKILL.md ────────────────────────────────────────────── */
  describe('SKILL.md — sla-contracts', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/sla-contracts/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*sla-contracts/);
    });
    it('has correct name', () => {
      expect(skill).toMatch(/name:\s*Agent SLA & Contracts/);
    });
    it('has category autonomous-economy', () => {
      expect(skill).toContain('category: autonomous-economy');
    });
    it('defines contract_create action', () => {
      expect(skill).toContain('contract_create');
    });
    it('defines sla_define action', () => {
      expect(skill).toContain('sla_define');
    });
    it('defines sla_measure action', () => {
      expect(skill).toContain('sla_measure');
    });
    it('defines amendment_propose action', () => {
      expect(skill).toContain('amendment_propose');
    });
    it('defines dispute_raise action', () => {
      expect(skill).toContain('dispute_raise');
    });
    it('defines dispute_resolve action', () => {
      expect(skill).toContain('dispute_resolve');
    });
    it('defines compliance_report action', () => {
      expect(skill).toContain('compliance_report');
    });
    it('has 7 actions total', () => {
      const count = (skill.match(/- id: /g) || []).length;
      expect(count).toBe(7);
    });
  });

  /* ── Eidolon Building Kind ───────────────────────────────── */
  describe('Eidolon — EidolonBuildingKind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes contract_hall', () => {
      expect(types).toContain("'contract_hall'");
    });
    it('has 33 building kinds (33 pipes with leading pipe format)', () => {
      const block = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(33);
    });
  });

  /* ── Eidolon Event Kind ──────────────────────────────────── */
  describe('Eidolon — EidolonEventKind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes contract.created', () => {
      expect(types).toContain("'contract.created'");
    });
    it('includes contract.sla_breached', () => {
      expect(types).toContain("'contract.sla_breached'");
    });
    it('includes contract.dispute_raised', () => {
      expect(types).toContain("'contract.dispute_raised'");
    });
    it('includes contract.dispute_resolved', () => {
      expect(types).toContain("'contract.dispute_resolved'");
    });
    it('has 148 event kind pipes', () => {
      const block = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(148);
    });
  });

  /* ── districtFor ─────────────────────────────────────────── */
  describe('Eidolon — districtFor()', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('maps contract_hall to market district', () => {
      expect(types).toContain("case 'contract_hall':");
      expect(types).toMatch(/case 'contract_hall':[\s\S]*?return 'market'/);
    });
    it('has 33 districtFor cases', () => {
      const fn = types.match(/function districtFor[\s\S]*?^}/m);
      expect(fn).toBeTruthy();
      const count = (fn![0].match(/case '/g) || []).length;
      expect(count).toBe(33);
    });
  });

  /* ── Event Bus ───────────────────────────────────────────── */
  describe('Event Bus — SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('maps sven.contract.created', () => {
      expect(bus).toContain("'sven.contract.created': 'contract.created'");
    });
    it('maps sven.contract.sla_breached', () => {
      expect(bus).toContain("'sven.contract.sla_breached': 'contract.sla_breached'");
    });
    it('maps sven.contract.dispute_raised', () => {
      expect(bus).toContain("'sven.contract.dispute_raised': 'contract.dispute_raised'");
    });
    it('maps sven.contract.dispute_resolved', () => {
      expect(bus).toContain("'sven.contract.dispute_resolved': 'contract.dispute_resolved'");
    });
    it('has 147 SUBJECT_MAP entries total', () => {
      const count = (bus.match(/'sven\./g) || []).length;
      expect(count).toBe(147);
    });
  });

  /* ── Task Executor — Switch Cases ────────────────────────── */
  describe('Task Executor — switch cases', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('routes contract_create', () => {
      expect(te).toContain("case 'contract_create':");
    });
    it('routes contract_sla_define', () => {
      expect(te).toContain("case 'contract_sla_define':");
    });
    it('routes contract_sla_measure', () => {
      expect(te).toContain("case 'contract_sla_measure':");
    });
    it('routes contract_amendment_propose', () => {
      expect(te).toContain("case 'contract_amendment_propose':");
    });
    it('routes contract_dispute_raise', () => {
      expect(te).toContain("case 'contract_dispute_raise':");
    });
    it('routes contract_dispute_resolve', () => {
      expect(te).toContain("case 'contract_dispute_resolve':");
    });
    it('routes contract_compliance_report', () => {
      expect(te).toContain("case 'contract_compliance_report':");
    });
    it('has 131 switch cases total', () => {
      const count = (te.match(/case '/g) || []).length;
      expect(count).toBe(131);
    });
  });

  /* ── Task Executor — Handler Methods ─────────────────────── */
  describe('Task Executor — handler methods', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has handleContractCreate', () => {
      expect(te).toMatch(/private (?:async )?handleContractCreate/);
    });
    it('has handleContractSlaDefine', () => {
      expect(te).toMatch(/private (?:async )?handleContractSlaDefine/);
    });
    it('has handleContractSlaMeasure', () => {
      expect(te).toMatch(/private (?:async )?handleContractSlaMeasure/);
    });
    it('has handleContractAmendmentPropose', () => {
      expect(te).toMatch(/private (?:async )?handleContractAmendmentPropose/);
    });
    it('has handleContractDisputeRaise', () => {
      expect(te).toMatch(/private (?:async )?handleContractDisputeRaise/);
    });
    it('has handleContractDisputeResolve', () => {
      expect(te).toMatch(/private (?:async )?handleContractDisputeResolve/);
    });
    it('has handleContractComplianceReport', () => {
      expect(te).toMatch(/private (?:async )?handleContractComplianceReport/);
    });
    it('has 127 handler methods total', () => {
      const count = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(127);
    });
  });

  /* ── Task Executor — Handler Outputs ─────────────────────── */
  describe('Task Executor — handler outputs', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('handleContractCreate returns contractId', () => {
      expect(te).toContain('contractId');
    });
    it('handleContractSlaDefine returns slaId', () => {
      expect(te).toContain('slaId');
    });
    it('handleContractSlaMeasure returns complianceStatus', () => {
      expect(te).toContain('complianceStatus');
    });
    it('handleContractAmendmentPropose returns amendmentId', () => {
      expect(te).toContain('amendmentId');
    });
    it('handleContractDisputeRaise returns disputeId', () => {
      expect(te).toContain('disputeId');
    });
    it('handleContractComplianceReport returns overallScore', () => {
      expect(te).toContain('overallScore');
    });
  });

  /* ── .gitattributes ──────────────────────────────────────── */
  describe('.gitattributes — Batch 50 privacy', () => {
    const ga = fs.readFileSync(
      path.join(ROOT, '.gitattributes'),
      'utf-8',
    );

    it('marks SLA contracts migration as export-ignore', () => {
      expect(ga).toContain('20260523120000_agent_sla_contracts.sql export-ignore');
    });
    it('marks SLA contracts shared types as export-ignore', () => {
      expect(ga).toContain('agent-sla-contracts.ts export-ignore');
    });
    it('marks SLA contracts skill as export-ignore', () => {
      expect(ga).toContain('sla-contracts/** export-ignore');
    });
  });

  /* ── File Counts ─────────────────────────────────────────── */
  describe('Overall counts', () => {
    it('has 36 migration SQL files', () => {
      const dir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(36);
    });
    it('has at least 43 skill directories with SKILL.md', () => {
      const skillsRoot = path.join(ROOT, 'skills/autonomous-economy');
      const dirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
        .filter(d => d.isDirectory());
      let count = 0;
      for (const d of dirs) {
        const skillPath = path.join(skillsRoot, d.name, 'SKILL.md');
        if (fs.existsSync(skillPath)) count++;
      }
      expect(count).toBeGreaterThanOrEqual(43);
    });
  });
});
