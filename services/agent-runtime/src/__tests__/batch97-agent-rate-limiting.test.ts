import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 97 — Agent Rate Limiting', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617340000_agent_rate_limiting.sql'), 'utf-8');
    it('creates rate_limit_policies table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_limit_policies'); });
    it('creates rate_limit_quotas table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_limit_quotas'); });
    it('creates throttle_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS throttle_rules'); });
    it('creates rate_usage_tracking table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_usage_tracking'); });
    it('creates rate_violations table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS rate_violations'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-rate-limiting.ts'), 'utf-8');
    it('exports RateLimitTarget', () => { expect(src).toContain("export type RateLimitTarget"); });
    it('exports RateLimitStrategy', () => { expect(src).toContain("export type RateLimitStrategy"); });
    it('exports ViolationType', () => { expect(src).toContain("export type ViolationType"); });
    it('exports RateLimitPolicy interface', () => { expect(src).toContain("export interface RateLimitPolicy"); });
    it('exports RateViolation interface', () => { expect(src).toContain("export interface RateViolation"); });
    it('exports isQuotaExhausted helper', () => { expect(src).toContain("export function isQuotaExhausted"); });
    it('exports quotaUtilization helper', () => { expect(src).toContain("export function quotaUtilization"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has rate_limiter building kind', () => { expect(types).toContain("'rate_limiter'"); });
    it('has 80 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(80);
    });
    it('has 336 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(336);
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has ratelimit subjects', () => {
      expect(bus).toContain("'sven.ratelimit.policy_created'");
      expect(bus).toContain("'sven.ratelimit.violation_resolved'");
    });
    it('has 335 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(335);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['ratelimit_create_policy','ratelimit_set_quota','ratelimit_add_throttle','ratelimit_check','ratelimit_track_usage','ratelimit_resolve_violation','ratelimit_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 460 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(460); });
    it('has 456 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(456); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-rate-limiting/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-rate-limiting/); });
    it('has 7 actions', () => { expect((skill.match(/  - ratelimit_/g) || []).length).toBe(7); });
  });
});
