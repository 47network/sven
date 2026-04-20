/**
 * Batch 51 — Agent Knowledge Base & Documentation
 *
 * Validates migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus SUBJECT_MAP, task-executor handlers, and .gitattributes.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── helpers ──────────────────────────────────────────────────────────
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ── Migration SQL ────────────────────────────────────────────────────
describe('Batch 51 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260524120000_agent_knowledge_base.sql');

  const tables = [
    'knowledge_articles',
    'knowledge_revisions',
    'knowledge_categories',
    'knowledge_feedback',
    'knowledge_search_index',
  ];

  test.each(tables)('creates table %s', (t) => {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
  });

  test('creates 5 tables total', () => {
    const m = sql.match(/CREATE TABLE IF NOT EXISTS/g) || [];
    expect(m.length).toBe(5);
  });

  test('creates 16 indexes', () => {
    const m = sql.match(/CREATE INDEX IF NOT EXISTS/g) || [];
    expect(m.length).toBe(16);
  });

  test('includes GIN index on search_vector', () => {
    expect(sql).toContain('USING gin(search_vector)');
  });

  test('knowledge_articles has TSVECTOR-related search_index', () => {
    expect(sql).toContain('search_vector    TSVECTOR');
  });

  test('knowledge_revisions has UNIQUE constraint on article_id + revision_number', () => {
    expect(sql).toContain('UNIQUE(article_id, revision_number)');
  });

  test('knowledge_articles has self-referencing parent_id', () => {
    expect(sql).toContain('parent_id        TEXT REFERENCES knowledge_articles(id)');
  });

  test('knowledge_categories has self-referencing parent_id', () => {
    expect(sql).toContain('parent_id        TEXT REFERENCES knowledge_categories(id)');
  });

  test('migration file exists in correct location', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260524120000_agent_knowledge_base.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);
  });
});

// ── Shared Types ─────────────────────────────────────────────────────
describe('Batch 51 — Shared types', () => {
  const src = read('packages/shared/src/agent-knowledge-base.ts');

  describe('type unions', () => {
    const typeTests: [string, number][] = [
      ['KnowledgeArticleType', 9],
      ['KnowledgeArticleStatus', 5],
      ['KnowledgeVisibility', 4],
      ['KnowledgeCategory', 9],
      ['KnowledgeFeedbackType', 5],
      ['KnowledgeSearchScope', 5],
      ['KnowledgeAction', 7],
    ];

    test('has 7 type unions', () => {
      expect(typeTests.length).toBe(7);
      for (const [name] of typeTests) {
        expect(src).toContain(`export type ${name}`);
      }
    });

    test.each(typeTests)('%s has %d values', (name, count) => {
      const re = new RegExp(`export type ${name}\\s*=[^;]+;`, 's');
      const match = src.match(re);
      expect(match).not.toBeNull();
      const quotes = (match![0].match(/'/g) || []).length;
      expect(quotes / 2).toBe(count);
    });
  });

  describe('interfaces', () => {
    const ifaces = [
      'KnowledgeArticle',
      'KnowledgeRevision',
      'KnowledgeCategoryInfo',
      'KnowledgeFeedback',
      'KnowledgeSearchResult',
    ];

    test.each(ifaces)('exports interface %s', (name) => {
      expect(src).toContain(`export interface ${name}`);
    });

    test('has 5 interfaces total', () => {
      const m = src.match(/export interface /g) || [];
      expect(m.length).toBe(5);
    });
  });

  describe('constants', () => {
    const consts = [
      'KNOWLEDGE_ARTICLE_TYPES',
      'KNOWLEDGE_STATUSES',
      'KNOWLEDGE_VISIBILITIES',
      'KNOWLEDGE_CATEGORIES',
      'KNOWLEDGE_FEEDBACK_TYPES',
      'KNOWLEDGE_ACTIONS',
    ];

    test.each(consts)('exports constant %s', (name) => {
      expect(src).toContain(`export const ${name}`);
    });

    test('has 6 constants total', () => {
      const m = src.match(/export const /g) || [];
      expect(m.length).toBe(6);
    });
  });

  describe('helper functions', () => {
    const helpers = [
      'isArticlePublishable',
      'isArticleEditable',
      'getArticleQualityScore',
      'calculateHelpfulnessRatio',
    ];

    test.each(helpers)('exports function %s', (name) => {
      expect(src).toContain(`export function ${name}`);
    });

    test('has 4 helper functions total', () => {
      const m = src.match(/export function /g) || [];
      expect(m.length).toBe(4);
    });
  });

  describe('specific type values', () => {
    test('KnowledgeArticleType includes glossary', () => {
      expect(src).toContain("'glossary'");
    });

    test('KnowledgeArticleStatus includes deprecated', () => {
      expect(src).toContain("'deprecated'");
    });

    test('KnowledgeVisibility includes restricted', () => {
      expect(src).toContain("'restricted'");
    });

    test('KnowledgeCategory includes incident_response', () => {
      expect(src).toContain("'incident_response'");
    });

    test('KnowledgeFeedbackType includes inaccurate', () => {
      expect(src).toContain("'inaccurate'");
    });

    test('KnowledgeSearchScope includes mine', () => {
      expect(src).toContain("'mine'");
    });
  });
});

// ── Barrel export ────────────────────────────────────────────────────
describe('Batch 51 — Barrel export', () => {
  const barrel = read('packages/shared/src/index.ts');

  test('exports agent-knowledge-base module', () => {
    expect(barrel).toContain("export * from './agent-knowledge-base.js'");
  });

  test('index.ts has at least 76 lines', () => {
    const lines = barrel.split('\n').length;
    expect(lines).toBeGreaterThanOrEqual(76);
  });
});

// ── SKILL.md ─────────────────────────────────────────────────────────
describe('Batch 51 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/knowledge-base/SKILL.md');

  test('has correct skill identifier', () => {
    expect(skill).toMatch(/skill:\s*knowledge-base/);
  });

  test('has correct name', () => {
    expect(skill).toContain('name: Agent Knowledge Base & Documentation');
  });

  test('status is active', () => {
    expect(skill).toMatch(/status:\s*active/);
  });

  test('category is autonomous-economy', () => {
    expect(skill).toMatch(/category:\s*autonomous-economy/);
  });

  const actions = [
    'article_create',
    'article_update',
    'article_publish',
    'article_archive',
    'article_search',
    'feedback_submit',
    'category_manage',
  ];

  test.each(actions)('documents action %s', (a) => {
    expect(skill).toContain(`### ${a}`);
  });

  test('has exactly 7 actions', () => {
    const m = skill.match(/### \w+/g) || [];
    expect(m.length).toBe(7);
  });
});

// ── Eidolon types.ts ─────────────────────────────────────────────────
describe('Batch 51 — Eidolon types.ts', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  test('EidolonBuildingKind includes knowledge_library', () => {
    expect(types).toContain("'knowledge_library'");
  });

  test('EidolonBuildingKind has 34 values', () => {
    const re = /export type EidolonBuildingKind[\s\S]*?;/;
    const match = types.match(re);
    expect(match).not.toBeNull();
    const pipes = (match![0].match(/\|/g) || []).length;
    expect(pipes).toBe(34);
  });

  const eventKinds = [
    'knowledge.article_created',
    'knowledge.article_published',
    'knowledge.article_archived',
    'knowledge.feedback_received',
  ];

  test.each(eventKinds)('EidolonEventKind includes %s', (e) => {
    expect(types).toContain(`'${e}'`);
  });

  test('EidolonEventKind has 152 values', () => {
    const re = /export type EidolonEventKind[\s\S]*?;/;
    const match = types.match(re);
    expect(match).not.toBeNull();
    const pipes = (match![0].match(/\|/g) || []).length;
    expect(pipes).toBe(152);
  });

  test('districtFor maps knowledge_library to civic', () => {
    expect(types).toContain("case 'knowledge_library':");
    expect(types).toContain("return 'civic';");
  });

  test('districtFor has 34 cases', () => {
    const fnMatch = types.match(/export function districtFor[\s\S]*?^}/m);
    expect(fnMatch).not.toBeNull();
    const cases = (fnMatch![0].match(/case '/g) || []).length;
    expect(cases).toBe(34);
  });
});

// ── Event-bus SUBJECT_MAP ────────────────────────────────────────────
describe('Batch 51 — Event-bus SUBJECT_MAP', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  const subjects = [
    ['sven.knowledge.article_created', 'knowledge.article_created'],
    ['sven.knowledge.article_published', 'knowledge.article_published'],
    ['sven.knowledge.article_archived', 'knowledge.article_archived'],
    ['sven.knowledge.feedback_received', 'knowledge.feedback_received'],
  ];

  test.each(subjects)('maps %s → %s', (nats, eidolon) => {
    expect(bus).toContain(`'${nats}'`);
    expect(bus).toContain(`'${eidolon}'`);
  });

  test('SUBJECT_MAP has 151 entries', () => {
    const re = /SUBJECT_MAP[^{]*\{([^}]+)\}/s;
    const match = bus.match(re);
    expect(match).not.toBeNull();
    const entries = (match![1].match(/^\s+'/gm) || []).length;
    expect(entries).toBe(151);
  });
});

// ── Task executor ────────────────────────────────────────────────────
describe('Batch 51 — Task executor', () => {
  const exec = read('services/sven-marketplace/src/task-executor.ts');

  const switchCases = [
    'knowledge_article_create',
    'knowledge_article_update',
    'knowledge_article_publish',
    'knowledge_article_archive',
    'knowledge_article_search',
    'knowledge_feedback_submit',
    'knowledge_category_manage',
  ];

  test.each(switchCases)('has switch case for %s', (c) => {
    expect(exec).toContain(`case '${c}':`);
  });

  const handlers = [
    'handleKnowledgeArticleCreate',
    'handleKnowledgeArticleUpdate',
    'handleKnowledgeArticlePublish',
    'handleKnowledgeArticleArchive',
    'handleKnowledgeArticleSearch',
    'handleKnowledgeFeedbackSubmit',
    'handleKnowledgeCategoryManage',
  ];

  test.each(handlers)('has handler method %s', (h) => {
    expect(exec).toMatch(new RegExp(`private (?:async )?${h}\\(`));
  });

  test('has 138 switch cases total', () => {
    const m = exec.match(/case '/g) || [];
    expect(m.length).toBe(138);
  });

  test('has 134 handler methods total', () => {
    const m = exec.match(/private (?:async )?handle[A-Z]/g) || [];
    expect(m.length).toBe(134);
  });
});

// ── .gitattributes ───────────────────────────────────────────────────
describe('Batch 51 — .gitattributes', () => {
  const ga = read('.gitattributes');

  test('marks migration as export-ignore', () => {
    expect(ga).toContain('20260524120000_agent_knowledge_base.sql export-ignore');
  });

  test('marks shared types as export-ignore', () => {
    expect(ga).toContain('agent-knowledge-base.ts export-ignore');
  });

  test('marks skill directory as export-ignore', () => {
    expect(ga).toContain('skills/autonomous-economy/knowledge-base/** export-ignore');
  });
});

// ── File counts ──────────────────────────────────────────────────────
describe('Batch 51 — File counts', () => {
  test('37 migration SQL files', () => {
    const dir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBe(37);
  });

  test('shared/index.ts has at least 76 lines', () => {
    const content = read('packages/shared/src/index.ts');
    const lines = content.split('\n').length;
    expect(lines).toBeGreaterThanOrEqual(76);
  });
});
