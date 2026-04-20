import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 87 — Agent Content Delivery', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617240000_agent_content_delivery.sql'), 'utf-8');
    it('creates cdn_origins table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS cdn_origins'));
    it('creates cdn_assets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS cdn_assets'));
    it('creates cdn_cache_entries table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS cdn_cache_entries'));
    it('creates cdn_purge_requests table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS cdn_purge_requests'));
    it('creates cdn_analytics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS cdn_analytics'));
    it('has at least 20 indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(20));
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-content-delivery.ts'), 'utf-8');
    it('exports OriginType', () => expect(src).toContain('export type OriginType'));
    it('exports CacheStatus', () => expect(src).toContain('export type CacheStatus'));
    it('exports AgentcPurgeType', () => expect(src).toContain('export type AgentcPurgeType'));
    it('exports RequestType', () => expect(src).toContain('export type RequestType'));
    it('exports CdnOrigin interface', () => expect(src).toContain('export interface CdnOrigin'));
    it('exports CdnAsset interface', () => expect(src).toContain('export interface CdnAsset'));
    it('exports DeliveryCacheEntry interface', () => expect(src).toContain('export interface DeliveryCacheEntry'));
    it('exports isCacheFresh helper', () => expect(src).toContain('export function isCacheFresh'));
    it('exports cacheHitRate helper', () => expect(src).toContain('export function cacheHitRate'));
    it('exports totalBandwidth helper', () => expect(src).toContain('export function totalBandwidth'));
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-content-delivery/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => expect(skill).toMatch(/skill:\s*agent-content-delivery/));
    it('has architect archetype', () => expect(skill).toMatch(/archetype:\s*architect/));
    it('has cdn_register_origin action', () => expect(skill).toContain('cdn_register_origin'));
    it('has cdn_purge action', () => expect(skill).toContain('cdn_purge'));
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has delivery_hub building kind', () => expect(types).toContain("'delivery_hub'"));
    it('has 70 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(70);
    });
    it('has 296 event kinds', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(296);
    });
    it('has cdn.asset_published event', () => expect(types).toContain("'cdn.asset_published'"));
    it('has cdn.cache_purged event', () => expect(types).toContain("'cdn.cache_purged'"));
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.cdn.asset_published', () => expect(bus).toContain("'sven.cdn.asset_published'"));
    it('has sven.cdn.cache_purged', () => expect(bus).toContain("'sven.cdn.cache_purged'"));
    it('has 295 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(295);
    });
  });

  describe('Task executor', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has cdn_register_origin switch case', () => expect(tex).toContain("case 'cdn_register_origin'"));
    it('has cdn_purge switch case', () => expect(tex).toContain("case 'cdn_purge'"));
    it('has cdn_report switch case', () => expect(tex).toContain("case 'cdn_report'"));
    it('has 390 switch cases', () => expect((tex.match(/case '/g) || []).length).toBe(390));
    it('has 386 handler methods', () => expect((tex.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(386));
    it('handleCdnReport returns recommendations', () => expect(tex).toContain("handler: 'cdn_report'"));
  });

  describe('Privacy + CHANGELOG', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('filters migration', () => expect(ga).toContain('20260617240000_agent_content_delivery.sql'));
    it('mentions Batch 87', () => expect(cl).toContain('Batch 87'));
    it('mentions Content Delivery', () => expect(cl).toContain('Content Delivery'));
  });

  describe('Migration count', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 73 migrations', () => expect(files.length).toBe(73));
  });
});
