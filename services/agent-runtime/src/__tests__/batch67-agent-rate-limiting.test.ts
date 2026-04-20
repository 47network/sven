import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 67 — Agent Rate Limiting & Throttling', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260609120000_agent_rate_limiting.sql'), 'utf-8');

    it('creates 5 tables', () => {
      for (const t of ['rate_limit_policies','rate_limit_counters','rate_limit_overrides','throttle_events','quota_allocations']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => {
      expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19);
    });
    it('has Batch 67 header', () => { expect(sql).toContain('Batch 67'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-rate-limiting.ts'), 'utf-8');

    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('exports 4 helper constants', () => { expect((src.match(/export const \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('exports 4 helper functions', () => { expect((src.match(/export function \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('ResourceType has 6 values', () => {
      const m = src.match(/export type ResourceType\s*=\s*([^;]+);/);
      expect(m).not.toBeNull();
      expect((m![1].match(/'/g) || []).length / 2).toBe(6);
    });
    it('RateLimitAction has 7 values', () => {
      const m = src.match(/export type RateLimitAction\s*=\s*([^;]+);/);
      expect(m).not.toBeNull();
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('re-exports agent-rate-limiting', () => { expect(idx).toContain('./agent-rate-limiting'); });
    it('has at least 92 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(92); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-rate-limiting/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-rate-limiting/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
    it('includes all expected actions', () => {
      for (const a of ['policy_create','policy_update','override_grant','quota_allocate','counter_check','throttle_status','quota_report']) {
        expect(md).toContain(a);
      }
    });
  });

  describe('Eidolon types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('EidolonBuildingKind has 50 values', () => {
      const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(50);
    });
    it('includes rate_limiter building kind', () => { expect(src).toContain("'rate_limiter'"); });
    it('EidolonEventKind has 216 values', () => {
      const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(216);
    });
    it('includes 4 rate_limit event kinds', () => {
      for (const e of ['rate_limit.policy_created','rate_limit.agent_throttled','rate_limit.quota_exceeded','rate_limit.override_granted']) {
        expect(src).toContain(`'${e}'`);
      }
    });
    it('districtFor has 50 cases', () => {
      const dfBlock = src.split('districtFor')[1].split('function ')[0];
      expect((dfBlock.match(/case '\w+':/g) || []).length).toBe(50);
    });
  });

  describe('Event bus', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('SUBJECT_MAP has 215 entries', () => {
      const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(215);
    });
    it('has 4 rate_limit subjects', () => {
      for (const s of ['sven.rate_limit.policy_created','sven.rate_limit.agent_throttled','sven.rate_limit.quota_exceeded','sven.rate_limit.override_granted']) {
        expect(src).toContain(`'${s}'`);
      }
    });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 250 switch cases', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(250); });
    it('has 246 handler methods', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(246); });
    it('includes 7 batch 67 cases', () => {
      for (const c of ['policy_create','policy_update','override_grant','quota_allocate','counter_check','throttle_status','quota_report']) {
        expect(src).toContain(`case '${c}':`);
      }
    });
    it('includes 7 batch 67 handlers', () => {
      for (const h of ['handlePolicyCreate','handlePolicyUpdate','handleOverrideGrant','handleQuotaAllocate','handleCounterCheck','handleThrottleStatus','handleQuotaReport']) {
        expect(src).toContain(h);
      }
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks migration private', () => { expect(ga).toContain('20260609120000_agent_rate_limiting.sql'); });
    it('marks shared types private', () => { expect(ga).toContain('agent-rate-limiting.ts'); });
    it('marks skill private', () => { expect(ga).toContain('agent-rate-limiting/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 67', () => { expect(cl).toContain('Batch 67'); });
    it('mentions rate limiting', () => { expect(cl).toMatch(/Rate Limiting/i); });
  });

  describe('Migration count', () => {
    it('has 53 migration files', () => {
      const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(53);
    });
  });
});
