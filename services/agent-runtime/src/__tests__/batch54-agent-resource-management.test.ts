/**
 * Batch 54 — Agent Resource Management
 *
 * Validates migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, task-executor handlers, .gitattributes, and barrel export.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ------------------------------------------------------------------ */
/*  Migration SQL                                                      */
/* ------------------------------------------------------------------ */
describe('Batch 54 — Agent Resource Management', () => {
  const sql = read('services/gateway-api/migrations/20260527120000_agent_resource_management.sql');

  describe('Migration SQL', () => {
    it('creates 5 tables', () => {
      const tables = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
      expect(tables).toBe(5);
    });

    it('includes agent_resource_pools table', () => {
      expect(sql).toContain('agent_resource_pools');
    });

    it('includes agent_resource_allocations table', () => {
      expect(sql).toContain('agent_resource_allocations');
    });

    it('includes agent_resource_quotas table', () => {
      expect(sql).toContain('agent_resource_quotas');
    });

    it('includes agent_resource_usage_logs table', () => {
      expect(sql).toContain('agent_resource_usage_logs');
    });

    it('includes agent_resource_scaling_rules table', () => {
      expect(sql).toContain('agent_resource_scaling_rules');
    });

    it('creates 17 indexes', () => {
      const indexes = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
      expect(indexes).toBe(17);
    });

    it('scaling_rules references resource_pools', () => {
      expect(sql).toContain('REFERENCES agent_resource_pools(id)');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Shared types                                                       */
  /* ------------------------------------------------------------------ */
  const types = read('packages/shared/src/agent-resource-management.ts');

  describe('Shared types file', () => {
    it('exports ResourceType with 5 values', () => {
      const m = types.match(/export type ResourceType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports ResourcePoolStatus with 5 values', () => {
      const m = types.match(/export type ResourcePoolStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports AllocationStatus with 6 values', () => {
      const m = types.match(/export type AllocationStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });

    it('exports QuotaPeriod with 5 values', () => {
      const m = types.match(/export type QuotaPeriod\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports ResourceOperation with 6 values', () => {
      const m = types.match(/export type ResourceOperation\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });

    it('exports ScalingMetric with 5 values', () => {
      const m = types.match(/export type ScalingMetric\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('exports ResourceAction with 7 values', () => {
      const m = types.match(/export type ResourceAction\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
  });

  describe('Shared interfaces', () => {
    it('exports ResourcePool interface', () => {
      expect(types).toContain('export interface ResourcePool');
    });

    it('exports ResourceAllocation interface', () => {
      expect(types).toContain('export interface ResourceAllocation');
    });

    it('exports ResourceQuota interface', () => {
      expect(types).toContain('export interface ResourceQuota');
    });

    it('exports ResourceUsageLog interface', () => {
      expect(types).toContain('export interface ResourceUsageLog');
    });

    it('exports ResourceScalingRule interface', () => {
      expect(types).toContain('export interface ResourceScalingRule');
    });
  });

  describe('Shared constants and helpers', () => {
    it('exports 6 constant arrays', () => {
      const constants = (types.match(/export const [A-Z_]+:\s*readonly/g) || []).length;
      expect(constants).toBe(6);
    });

    it('exports isPoolAvailable helper', () => {
      expect(types).toContain('export function isPoolAvailable');
    });

    it('exports isAllocationActive helper', () => {
      expect(types).toContain('export function isAllocationActive');
    });

    it('exports isQuotaExceeded helper', () => {
      expect(types).toContain('export function isQuotaExceeded');
    });

    it('exports calculateUtilization helper', () => {
      expect(types).toContain('export function calculateUtilization');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Barrel export                                                      */
  /* ------------------------------------------------------------------ */
  describe('Barrel export', () => {
    const barrel = read('packages/shared/src/index.ts');

    it('re-exports agent-resource-management', () => {
      expect(barrel).toContain('agent-resource-management');
    });

    it('has at least 79 lines', () => {
      const lines = barrel.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(79);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  SKILL.md                                                           */
  /* ------------------------------------------------------------------ */
  describe('SKILL.md', () => {
    const skill = read('skills/autonomous-economy/resource-management/SKILL.md');

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-resource-management/);
    });

    it('declares 7 actions', () => {
      const actions = (skill.match(/^\s+-\s+(pool_create|pool_resize|allocation_request|allocation_release|quota_set|scaling_rule_add|usage_report)/gm) || []).length;
      expect(actions).toBe(7);
    });

    it('includes pool_create action', () => {
      expect(skill).toContain('pool_create');
    });

    it('includes allocation_request action', () => {
      expect(skill).toContain('allocation_request');
    });

    it('includes scaling_rule_add action', () => {
      expect(skill).toContain('scaling_rule_add');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Eidolon building kind                                              */
  /* ------------------------------------------------------------------ */
  describe('Eidolon building kind', () => {
    const eidolon = read('services/sven-eidolon/src/types.ts');

    it('includes resource_depot building kind', () => {
      expect(eidolon).toContain("'resource_depot'");
    });

    it('has 37 building kinds total', () => {
      const block = eidolon.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(37);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Eidolon event kinds                                                */
  /* ------------------------------------------------------------------ */
  describe('Eidolon event kinds', () => {
    const eidolon = read('services/sven-eidolon/src/types.ts');

    it('includes 4 resources event kinds', () => {
      expect(eidolon).toContain("'resources.pool_created'");
      expect(eidolon).toContain("'resources.allocation_granted'");
      expect(eidolon).toContain("'resources.quota_exceeded'");
      expect(eidolon).toContain("'resources.scaling_triggered'");
    });

    it('has 164 event kinds total', () => {
      const block = eidolon.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(164);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  districtFor                                                        */
  /* ------------------------------------------------------------------ */
  describe('districtFor', () => {
    const eidolon = read('services/sven-eidolon/src/types.ts');

    it('maps resource_depot to industrial', () => {
      expect(eidolon).toContain("case 'resource_depot'");
      expect(eidolon).toContain("return 'industrial'");
    });

    it('has 37 cases total', () => {
      const cases = (eidolon.match(/case '/g) || []).length;
      expect(cases).toBe(37);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Event bus SUBJECT_MAP                                              */
  /* ------------------------------------------------------------------ */
  describe('Event bus SUBJECT_MAP', () => {
    const bus = read('services/sven-eidolon/src/event-bus.ts');

    it('includes 4 resources subjects', () => {
      expect(bus).toContain("'sven.resources.pool_created'");
      expect(bus).toContain("'sven.resources.allocation_granted'");
      expect(bus).toContain("'sven.resources.quota_exceeded'");
      expect(bus).toContain("'sven.resources.scaling_triggered'");
    });

    it('has 163 entries total', () => {
      const match = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(match).toBeTruthy();
      const entries = (match![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(163);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Task executor switch cases                                         */
  /* ------------------------------------------------------------------ */
  describe('Task executor switch cases', () => {
    const exec = read('services/sven-marketplace/src/task-executor.ts');

    it('includes 7 resource management switch cases', () => {
      expect(exec).toContain("case 'pool_create'");
      expect(exec).toContain("case 'pool_resize'");
      expect(exec).toContain("case 'allocation_request'");
      expect(exec).toContain("case 'allocation_release'");
      expect(exec).toContain("case 'quota_set'");
      expect(exec).toContain("case 'scaling_rule_add'");
      expect(exec).toContain("case 'usage_report'");
    });

    it('has 159 switch cases total', () => {
      const cases = (exec.match(/case '/g) || []).length;
      expect(cases).toBe(159);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Task executor handler methods                                      */
  /* ------------------------------------------------------------------ */
  describe('Task executor handler methods', () => {
    const exec = read('services/sven-marketplace/src/task-executor.ts');

    it('includes 7 resource management handler methods', () => {
      expect(exec).toContain('handlePoolCreate');
      expect(exec).toContain('handlePoolResize');
      expect(exec).toContain('handleAllocationRequest');
      expect(exec).toContain('handleAllocationRelease');
      expect(exec).toContain('handleQuotaSet');
      expect(exec).toContain('handleScalingRuleAdd');
      expect(exec).toContain('handleUsageReport');
    });

    it('has 155 handler methods total', () => {
      const handlers = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(155);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  .gitattributes                                                     */
  /* ------------------------------------------------------------------ */
  describe('.gitattributes', () => {
    const attrs = read('.gitattributes');

    it('includes resource management migration filter', () => {
      expect(attrs).toContain('20260527120000_agent_resource_management.sql export-ignore');
    });

    it('includes resource management types filter', () => {
      expect(attrs).toContain('agent-resource-management.ts export-ignore');
    });

    it('includes resource management skill filter', () => {
      expect(attrs).toContain('resource-management/** export-ignore');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Migration file count                                               */
  /* ------------------------------------------------------------------ */
  describe('Migration file count', () => {
    it('has 40 migration files total', () => {
      const migDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(40);
    });
  });
});
