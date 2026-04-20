import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 72 — Agent Caching & CDN', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260614120000_agent_caching_cdn.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['cache_policies','cache_entries','cdn_distributions','cache_purge_requests','cache_analytics']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => { expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-caching-cdn.ts'), 'utf-8');
    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('CachingAction has 7 values', () => {
      const m = src.match(/export type CachingAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-caching-cdn/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-caching-cdn/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
  });

  describe('Eidolon types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('BK=55', () => { const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/); expect((m![1].match(/\|/g) || []).length).toBe(55); });
    it('EK=236', () => { const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/); expect((m![1].match(/\|/g) || []).length).toBe(236); });
    it('DF=55', () => { const d = src.split('districtFor')[1].split('function ')[0]; expect((d.match(/case '\w+':/g) || []).length).toBe(55); });
    it('includes cache_tower', () => { expect(src).toContain("'cache_tower'"); });
  });

  describe('Event bus', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('SM=235', () => { const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s); expect((m![1].match(/^\s+'/gm) || []).length).toBe(235); });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('SC=285', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(285); });
    it('HM=281', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(281); });
    it('includes batch 72 handlers', () => {
      for (const h of ['handlePolicyCreate','handleEntrySet','handleEntryInvalidate','handleCdnDeploy','handlePurgeRequest','handleAnalyticsQuery','handleCacheReport']) {
        expect(src).toContain(h);
      }
    });
  });

  describe('Infra', () => {
    it('.gitattributes marks batch 72 private', () => {
      const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
      expect(ga).toContain('agent_caching_cdn.sql');
      expect(ga).toContain('agent-caching-cdn.ts');
    });
    it('CHANGELOG mentions Batch 72', () => { expect(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8')).toContain('Batch 72'); });
    it('58 migrations', () => { expect(fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql')).length).toBe(58); });
  });
});
