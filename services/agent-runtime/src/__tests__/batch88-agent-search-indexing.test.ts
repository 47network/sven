import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 88 — Agent Search & Indexing', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617250000_agent_search_indexing.sql'), 'utf-8');

    it('creates search_indexes table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS search_indexes'); });
    it('creates search_queries table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS search_queries'); });
    it('creates search_synonyms table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS search_synonyms'); });
    it('creates search_relevance_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS search_relevance_rules'); });
    it('creates search_analytics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS search_analytics'); });

    it('has index_type CHECK constraint', () => { expect(sql).toMatch(/index_type.*CHECK/); });
    it('has query_type CHECK constraint', () => { expect(sql).toMatch(/query_type.*CHECK/); });
    it('has rule_type CHECK constraint', () => { expect(sql).toMatch(/rule_type.*CHECK/); });
    it('has status CHECK constraint for indexes', () => { expect(sql).toMatch(/status.*CHECK.*building/); });

    it('has 20 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/g) || []).length;
      expect(idxCount).toBe(20);
    });

    it('has foreign key references', () => {
      const fks = (sql.match(/REFERENCES search_indexes/g) || []).length;
      expect(fks).toBe(4);
    });

    it('has GIN index for full-text search', () => { expect(sql).toContain('USING GIN'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-search-indexing.ts'), 'utf-8');

    it('exports IndexType', () => { expect(src).toContain("export type IndexType"); });
    it('exports IndexStatus', () => { expect(src).toContain("export type IndexStatus"); });
    it('exports QueryType', () => { expect(src).toContain("export type QueryType"); });
    it('exports RelevanceRuleType', () => { expect(src).toContain("export type RelevanceRuleType"); });
    it('exports AnalyticsPeriod', () => { expect(src).toContain("export type AnalyticsPeriod"); });

    it('exports SearchIndex interface', () => { expect(src).toContain('export interface SearchIndex'); });
    it('exports SearchQuery interface', () => { expect(src).toContain('export interface SearchQuery'); });
    it('exports SearchSynonym interface', () => { expect(src).toContain('export interface SearchSynonym'); });
    it('exports SearchRelevanceRule interface', () => { expect(src).toContain('export interface SearchRelevanceRule'); });
    it('exports SearchAnalytics interface', () => { expect(src).toContain('export interface SearchAnalytics'); });

    it('exports isIndexReady helper', () => { expect(src).toContain('export function isIndexReady'); });
    it('exports zeroResultRate helper', () => { expect(src).toContain('export function zeroResultRate'); });
    it('exports avgQueryLatency helper', () => { expect(src).toContain('export function avgQueryLatency'); });

    it('IndexType has 6 values', () => {
      const m = src.match(/export type IndexType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m[1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });

    it('QueryType has 7 values', () => {
      const m = src.match(/export type QueryType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m[1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-search-indexing', () => { expect(idx).toContain("export * from './agent-search-indexing.js'"); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-search-indexing/SKILL.md'), 'utf-8');

    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-search-indexing/); });
    it('has 7 actions', () => {
      const acts = (skill.match(/  - search_/g) || []).length;
      expect(acts).toBe(7);
    });
    it('has architect archetype', () => { expect(skill).toContain('archetype: architect'); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has search_archive building kind', () => { expect(types).toContain("'search_archive'"); });

    it('has 71 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block[0].match(/\|/g) || []).length;
      expect(pipes).toBe(71);
    });

    it('has 4 search event kinds', () => {
      expect(types).toContain("'search.index_created'");
      expect(types).toContain("'search.query_executed'");
      expect(types).toContain("'search.reindex_completed'");
      expect(types).toContain("'search.relevance_tuned'");
    });

    it('has 300 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block[0].match(/\|/g) || []).length;
      expect(pipes).toBe(300);
    });

    it('districtFor handles search_archive', () => {
      expect(types).toContain("case 'search_archive':");
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');

    it('has 4 search subjects', () => {
      expect(bus).toContain("'sven.search.index_created': 'search.index_created'");
      expect(bus).toContain("'sven.search.query_executed': 'search.query_executed'");
      expect(bus).toContain("'sven.search.reindex_completed': 'search.reindex_completed'");
      expect(bus).toContain("'sven.search.relevance_tuned': 'search.relevance_tuned'");
    });

    it('has 299 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const count = (m[1].match(/^\s+'/gm) || []).length;
      expect(count).toBe(299);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    const cases = ['search_create_index','search_query','search_add_synonym','search_relevance_rule','search_reindex','search_analytics','search_report'];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); });
    }

    const handlers = ['handleSearchCreateIndex','handleSearchQuery','handleSearchAddSynonym','handleSearchRelevanceRule','handleSearchReindex','handleSearchAnalytics','handleSearchReport'];
    for (const h of handlers) {
      it(`has ${h} method`, () => { expect(te).toMatch(new RegExp(`private (?:async )?${h}`)); });
    }

    it('has 397 switch cases total', () => {
      const count = (te.match(/case '/g) || []).length;
      expect(count).toBe(397);
    });

    it('has 393 handler methods total', () => {
      const count = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(393);
    });
  });
});
