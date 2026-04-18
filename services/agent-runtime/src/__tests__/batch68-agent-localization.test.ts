import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 68 — Agent Localization & i18n', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260610120000_agent_localization.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['locale_configs','translation_keys','translation_values','locale_content','locale_detection_logs']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => { expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
    it('has Batch 68 header', () => { expect(sql).toContain('Batch 68'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-localization.ts'), 'utf-8');
    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('exports 4 helper constants', () => { expect((src.match(/export const \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('exports 4 helper functions', () => { expect((src.match(/export function \w+/g) || []).length).toBeGreaterThanOrEqual(4); });
    it('LocalizationAction has 7 values', () => {
      const m = src.match(/export type LocalizationAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('re-exports agent-localization', () => { expect(idx).toContain('./agent-localization'); });
    it('has at least 93 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(93); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-localization/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-localization/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
    it('includes all expected actions', () => {
      for (const a of ['locale_create','translation_add','translation_review','content_localize','locale_detect','translation_export','coverage_report']) {
        expect(md).toContain(a);
      }
    });
  });

  describe('Eidolon types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('EidolonBuildingKind has 51 values', () => {
      const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(51);
    });
    it('includes translation_hub building kind', () => { expect(src).toContain("'translation_hub'"); });
    it('EidolonEventKind has 220 values', () => {
      const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(220);
    });
    it('includes 4 locale event kinds', () => {
      for (const e of ['locale.locale_created','locale.translation_approved','locale.content_localized','locale.coverage_updated']) {
        expect(src).toContain(`'${e}'`);
      }
    });
    it('districtFor has 51 cases', () => {
      const dfBlock = src.split('districtFor')[1].split('function ')[0];
      expect((dfBlock.match(/case '\w+':/g) || []).length).toBe(51);
    });
  });

  describe('Event bus', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('SUBJECT_MAP has 219 entries', () => {
      const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(219);
    });
    it('has 4 locale subjects', () => {
      for (const s of ['sven.locale.locale_created','sven.locale.translation_approved','sven.locale.content_localized','sven.locale.coverage_updated']) {
        expect(src).toContain(`'${s}'`);
      }
    });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 257 switch cases', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(257); });
    it('has 253 handler methods', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(253); });
    it('includes 7 batch 68 cases', () => {
      for (const c of ['locale_create','translation_add','translation_review','content_localize','locale_detect','translation_export','coverage_report']) {
        expect(src).toContain(`case '${c}':`);
      }
    });
    it('includes 7 batch 68 handlers', () => {
      for (const h of ['handleLocaleCreate','handleTranslationAdd','handleTranslationReview','handleContentLocalize','handleLocaleDetect','handleTranslationExport','handleCoverageReport']) {
        expect(src).toContain(h);
      }
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks migration private', () => { expect(ga).toContain('20260610120000_agent_localization.sql'); });
    it('marks shared types private', () => { expect(ga).toContain('agent-localization.ts'); });
    it('marks skill private', () => { expect(ga).toContain('agent-localization/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 68', () => { expect(cl).toContain('Batch 68'); });
    it('mentions localization', () => { expect(cl).toMatch(/Localization/i); });
  });

  describe('Migration count', () => {
    it('has 54 migration files', () => {
      expect(fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql')).length).toBe(54);
    });
  });
});
