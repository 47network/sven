import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 82 — Agent Content Moderation', () => {
  /* ── Migration ── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260617190000_agent_content_moderation.sql'),
      'utf-8',
    );
    it('creates moderation_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS moderation_policies'));
    it('creates moderation_reviews table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS moderation_reviews'));
    it('creates moderation_appeals table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS moderation_appeals'));
    it('creates moderation_queue table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS moderation_queue'));
    it('creates moderation_actions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS moderation_actions'));
    it('has at least 20 indexes', () => {
      const count = (sql.match(/CREATE INDEX/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(20);
    });
    it('has category CHECK on policies', () => expect(sql).toContain("'spam','abuse','nsfw','copyright','misinformation','harassment','illegal','custom'"));
    it('has severity CHECK on policies', () => expect(sql).toContain("'low','medium','high','critical'"));
    it('has action CHECK on policies', () => expect(sql).toContain("'flag','hide','remove','ban','warn','escalate'"));
    it('has content_type CHECK on reviews', () => expect(sql).toContain("'listing','message','review','comment','profile','plugin','skill','file'"));
    it('has verdict CHECK on reviews', () => expect(sql).toContain("'clean','violation','borderline','false_positive'"));
    it('has appeal status CHECK', () => expect(sql).toContain("'pending','under_review','granted','denied','withdrawn'"));
  });

  /* ── Shared Types ── */
  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-content-moderation.ts'), 'utf-8');

    it('exports ModerationCategory type', () => expect(src).toContain('export type ModerationCategory'));
    it('exports ModerationSeverity type', () => expect(src).toContain('export type ModerationSeverity'));
    it('exports AgentcModerationAction type', () => expect(src).toContain('export type AgentcModerationAction'));
    it('exports ModerationContentType type', () => expect(src).toContain('export type ModerationContentType'));
    it('exports ModerationVerdict type', () => expect(src).toContain('export type ModerationVerdict'));

    it('exports ModerationPolicy interface', () => expect(src).toContain('export interface ModerationPolicy'));
    it('exports ModerationReview interface', () => expect(src).toContain('export interface ModerationReview'));
    it('exports ModerationAppeal interface', () => expect(src).toContain('export interface ModerationAppeal'));
    it('exports ModerationQueueItem interface', () => expect(src).toContain('export interface ModerationQueueItem'));
    it('exports ModerationActionRecord interface', () => expect(src).toContain('export interface ModerationActionRecord'));

    it('exports AgentcshouldAutoEscalate helper', () => expect(src).toContain('export function AgentcshouldAutoEscalate'));
    it('exports moderationSeverityScore helper', () => expect(src).toContain('export function moderationSeverityScore'));
    it('exports pendingQueueCount helper', () => expect(src).toContain('export function pendingQueueCount'));

    it('ModerationCategory has 8 values', () => {
      const m = src.match(/export type ModerationCategory = ([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m[1].match(/'/g) || []).length / 2;
      expect(count).toBe(8);
    });

    it('ModerationSeverity has 4 values', () => {
      const m = src.match(/export type ModerationSeverity = ([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m[1].match(/'/g) || []).length / 2;
      expect(count).toBe(4);
    });
  });

  /* ── Barrel export ── */
  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-content-moderation', () => expect(idx).toContain("./agent-content-moderation"));
    it('has at least 107 lines', () => expect(idx.split('\n').length).toBeGreaterThanOrEqual(107));
  });

  /* ── SKILL.md ── */
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-content-moderation/SKILL.md'),
      'utf-8',
    );
    it('has correct skill identifier', () => expect(skill).toMatch(/skill:\s*agent-content-moderation/));
    it('has architect archetype', () => expect(skill).toMatch(/archetype:\s*architect/));
    it('has moderation_screen action', () => expect(skill).toContain('moderation_screen'));
    it('has moderation_review action', () => expect(skill).toContain('moderation_review'));
    it('has moderation_manage_policy action', () => expect(skill).toContain('moderation_manage_policy'));
    it('has moderation_appeal action', () => expect(skill).toContain('moderation_appeal'));
    it('has moderation_manage_queue action', () => expect(skill).toContain('moderation_manage_queue'));
    it('has moderation_action action', () => expect(skill).toContain('moderation_action'));
    it('has moderation_report action', () => expect(skill).toContain('moderation_report'));
  });

  /* ── Eidolon types ── */
  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has moderation_hall building kind', () => expect(types).toContain("'moderation_hall'"));

    it('has 65 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      const count = (block[0].match(/\|/g) || []).length;
      expect(count).toBe(65);
    });

    it('has 276 event kinds', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      const count = (block[0].match(/\|/g) || []).length;
      expect(count).toBe(276);
    });

    it('has moderation.content_screened event', () => expect(types).toContain("'moderation.content_screened'"));
    it('has moderation.verdict_rendered event', () => expect(types).toContain("'moderation.verdict_rendered'"));
    it('has moderation.appeal_filed event', () => expect(types).toContain("'moderation.appeal_filed'"));
    it('has moderation.action_taken event', () => expect(types).toContain("'moderation.action_taken'"));

    it('districtFor maps moderation_hall', () => {
      expect(types).toContain("case 'moderation_hall':");
    });

    it('has 65 districtFor cases', () => {
      const fn = types.match(/function districtFor[\s\S]*?^}/m);
      expect(fn).toBeTruthy();
      const count = (fn[0].match(/case '/g) || []).length;
      expect(count).toBe(65);
    });
  });

  /* ── Event-bus ── */
  describe('Event-bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');

    it('has sven.moderation.content_screened', () => expect(bus).toContain("'sven.moderation.content_screened'"));
    it('has sven.moderation.verdict_rendered', () => expect(bus).toContain("'sven.moderation.verdict_rendered'"));
    it('has sven.moderation.appeal_filed', () => expect(bus).toContain("'sven.moderation.appeal_filed'"));
    it('has sven.moderation.action_taken', () => expect(bus).toContain("'sven.moderation.action_taken'"));

    it('has 275 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const count = (m[1].match(/^\s+'/gm) || []).length;
      expect(count).toBe(275);
    });
  });

  /* ── Task executor ── */
  describe('Task executor', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    it('has moderation_screen switch case', () => expect(tex).toContain("case 'moderation_screen'"));
    it('has moderation_review switch case', () => expect(tex).toContain("case 'moderation_review'"));
    it('has moderation_manage_policy switch case', () => expect(tex).toContain("case 'moderation_manage_policy'"));
    it('has moderation_appeal switch case', () => expect(tex).toContain("case 'moderation_appeal'"));
    it('has moderation_manage_queue switch case', () => expect(tex).toContain("case 'moderation_manage_queue'"));
    it('has moderation_action switch case', () => expect(tex).toContain("case 'moderation_action'"));
    it('has moderation_report switch case', () => expect(tex).toContain("case 'moderation_report'"));

    it('has 355 switch cases', () => {
      const count = (tex.match(/case '/g) || []).length;
      expect(count).toBe(355);
    });

    it('has 351 handler methods', () => {
      const count = (tex.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(351);
    });

    it('handleModerationScreen returns verdict', () => expect(tex).toContain("handler: 'moderation_screen'"));
    it('handleModerationReview returns status', () => expect(tex).toContain("handler: 'moderation_review'"));
    it('handleModerationAppeal returns appeal info', () => expect(tex).toContain("handler: 'moderation_appeal'"));
    it('handleModerationAction returns action info', () => expect(tex).toContain("handler: 'moderation_action'"));
    it('handleModerationReport returns analytics', () => expect(tex).toContain("handler: 'moderation_report'"));
  });

  /* ── Privacy ── */
  describe('Privacy filtering', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters migration', () => expect(ga).toContain('20260617190000_agent_content_moderation.sql'));
    it('filters shared types', () => expect(ga).toContain('agent-content-moderation.ts'));
    it('filters skill', () => expect(ga).toContain('agent-content-moderation/SKILL.md'));
  });

  /* ── CHANGELOG ── */
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 82', () => expect(cl).toContain('Batch 82'));
    it('mentions Content Moderation', () => expect(cl).toContain('Content Moderation'));
  });

  /* ── Migration count ── */
  describe('Migration count', () => {
    const migDir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
    it('has 68 migrations', () => expect(files.length).toBe(68));
  });
});
