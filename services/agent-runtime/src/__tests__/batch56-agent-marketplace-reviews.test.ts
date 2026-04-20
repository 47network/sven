/**
 * Batch 56 — Agent Marketplace Reviews
 *
 * Verifies migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, task-executor handlers, barrel export,
 * .gitattributes privacy lines, and CHANGELOG entry.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ================================================================== */
/*  1. Migration SQL                                                   */
/* ================================================================== */
describe('Batch 56 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260529120000_agent_marketplace_reviews.sql');

  it('creates marketplace_reviews table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS marketplace_reviews');
  });
  it('creates review_responses table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS review_responses');
  });
  it('creates review_moderation table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS review_moderation');
  });
  it('creates review_votes table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS review_votes');
  });
  it('creates review_analytics table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS review_analytics');
  });
  it('has at least 17 indexes', () => {
    const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
    expect(idxCount).toBeGreaterThanOrEqual(17);
  });
});

/* ================================================================== */
/*  2. Shared types — type unions                                      */
/* ================================================================== */
describe('Batch 56 — Shared type unions', () => {
  const src = read('packages/shared/src/agent-marketplace-reviews.ts');

  const countValues = (typeName: string) => {
    const re = new RegExp(`export type ${typeName}\\s*=\\s*([^;]+);`);
    const m = src.match(re);
    if (!m) return 0;
    return (m[1].match(/'/g) || []).length / 2;
  };

  it('ReviewStatus has 5 values', () => expect(countValues('ReviewStatus')).toBe(5));
  it('ResponseType has 5 values', () => expect(countValues('ResponseType')).toBe(5));
  it('ModerationAction has 6 values', () => expect(countValues('ModerationAction')).toBe(6));
  it('VoteType has 5 values', () => expect(countValues('VoteType')).toBe(5));
  it('ReviewSortBy has 5 values', () => expect(countValues('ReviewSortBy')).toBe(5));
  it('SentimentLabel has 5 values', () => expect(countValues('SentimentLabel')).toBe(5));
  it('ReviewAction has 7 values', () => expect(countValues('ReviewAction')).toBe(7));
});

/* ================================================================== */
/*  3. Shared types — interfaces                                       */
/* ================================================================== */
describe('Batch 56 — Shared interfaces', () => {
  const src = read('packages/shared/src/agent-marketplace-reviews.ts');

  it('exports MarketplaceReview', () => expect(src).toContain('export interface MarketplaceReview'));
  it('exports ReviewResponse', () => expect(src).toContain('export interface ReviewResponse'));
  it('exports ReviewModeration', () => expect(src).toContain('export interface ReviewModeration'));
  it('exports ReviewVote', () => expect(src).toContain('export interface ReviewVote'));
  it('exports ReviewAnalytics', () => expect(src).toContain('export interface ReviewAnalytics'));
});

/* ================================================================== */
/*  4. Shared types — constants                                        */
/* ================================================================== */
describe('Batch 56 — Shared constants', () => {
  const src = read('packages/shared/src/agent-marketplace-reviews.ts');

  it('exports REVIEW_STATUSES', () => expect(src).toContain('export const REVIEW_STATUSES'));
  it('exports RESPONSE_TYPES', () => expect(src).toContain('export const RESPONSE_TYPES'));
  it('exports MODERATION_ACTIONS', () => expect(src).toContain('export const MODERATION_ACTIONS'));
  it('exports VOTE_TYPES', () => expect(src).toContain('export const VOTE_TYPES'));
  it('exports REVIEW_SORT_OPTIONS', () => expect(src).toContain('export const REVIEW_SORT_OPTIONS'));
  it('exports SENTIMENT_LABELS', () => expect(src).toContain('export const SENTIMENT_LABELS'));
});

/* ================================================================== */
/*  5. Shared types — helper functions                                 */
/* ================================================================== */
describe('Batch 56 — Shared helpers', () => {
  const src = read('packages/shared/src/agent-marketplace-reviews.ts');

  it('exports isReviewVisible', () => expect(src).toContain('export function isReviewVisible'));
  it('exports isPositiveRating', () => expect(src).toContain('export function isPositiveRating'));
  it('exports getSentimentLabel', () => expect(src).toContain('export function getSentimentLabel'));
  it('exports calculateAverageRating', () => expect(src).toContain('export function calculateAverageRating'));
});

/* ================================================================== */
/*  6. Barrel export                                                   */
/* ================================================================== */
describe('Batch 56 — Barrel export', () => {
  const idx = read('packages/shared/src/index.ts');

  it('re-exports agent-marketplace-reviews', () => {
    expect(idx).toContain("./agent-marketplace-reviews");
  });
  it('index.ts has at least 81 lines', () => {
    expect(idx.split('\n').length).toBeGreaterThanOrEqual(81);
  });
});

/* ================================================================== */
/*  7. SKILL.md                                                        */
/* ================================================================== */
describe('Batch 56 — SKILL.md', () => {
  const md = read('skills/autonomous-economy/marketplace-reviews/SKILL.md');

  it('has correct skill identifier', () => expect(md).toMatch(/skill:\s*agent-marketplace-reviews/));
  it('lists review_submit action', () => expect(md).toContain('review_submit'));
  it('lists review_respond action', () => expect(md).toContain('review_respond'));
  it('lists review_moderate action', () => expect(md).toContain('review_moderate'));
  it('lists review_vote action', () => expect(md).toContain('review_vote'));
  it('lists analytics_generate action', () => expect(md).toContain('analytics_generate'));
  it('lists review_flag action', () => expect(md).toContain('review_flag'));
  it('lists review_highlight action', () => expect(md).toContain('review_highlight'));
});

/* ================================================================== */
/*  8. Eidolon building kind                                           */
/* ================================================================== */
describe('Batch 56 — Eidolon building kind', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('includes review_forum building kind', () => {
    expect(types).toContain("'review_forum'");
  });
  it('has 39 building kinds total', () => {
    const m = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
    expect(m).not.toBeNull();
    const pipes = (m![0].match(/\|/g) || []).length;
    expect(pipes).toBe(39);
  });
});

/* ================================================================== */
/*  9. Eidolon event kinds                                             */
/* ================================================================== */
describe('Batch 56 — Eidolon event kinds', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('includes reviews.review_submitted', () => expect(types).toContain("'reviews.review_submitted'"));
  it('includes reviews.response_posted', () => expect(types).toContain("'reviews.response_posted'"));
  it('includes reviews.review_moderated', () => expect(types).toContain("'reviews.review_moderated'"));
  it('includes reviews.analytics_generated', () => expect(types).toContain("'reviews.analytics_generated'"));
  it('has 172 event kinds total', () => {
    const m = types.match(/export type EidolonEventKind[\s\S]*?;/);
    expect(m).not.toBeNull();
    const pipes = (m![0].match(/\|/g) || []).length;
    expect(pipes).toBe(172);
  });
});

/* ================================================================== */
/*  10. districtFor mapping                                            */
/* ================================================================== */
describe('Batch 56 — districtFor mapping', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('maps review_forum to market district', () => {
    expect(types).toContain("case 'review_forum':");
    expect(types).toContain("return 'market'");
  });
  it('has 39 districtFor cases total', () => {
    const caseCount = (types.match(/case '/g) || []).length;
    expect(caseCount).toBe(39);
  });
});

/* ================================================================== */
/*  11. Event-bus SUBJECT_MAP                                          */
/* ================================================================== */
describe('Batch 56 — Event-bus SUBJECT_MAP', () => {
  const eb = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.reviews.review_submitted', () => {
    expect(eb).toContain("'sven.reviews.review_submitted': 'reviews.review_submitted'");
  });
  it('maps sven.reviews.response_posted', () => {
    expect(eb).toContain("'sven.reviews.response_posted': 'reviews.response_posted'");
  });
  it('maps sven.reviews.review_moderated', () => {
    expect(eb).toContain("'sven.reviews.review_moderated': 'reviews.review_moderated'");
  });
  it('maps sven.reviews.analytics_generated', () => {
    expect(eb).toContain("'sven.reviews.analytics_generated': 'reviews.analytics_generated'");
  });
  it('has 171 SUBJECT_MAP entries total', () => {
    const m = eb.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
    expect(m).not.toBeNull();
    const entries = (m![1].match(/^\s+'/gm) || []).length;
    expect(entries).toBe(171);
  });
});

/* ================================================================== */
/*  12. Task-executor switch cases                                     */
/* ================================================================== */
describe('Batch 56 — Task-executor switch cases', () => {
  const te = read('services/sven-marketplace/src/task-executor.ts');

  const cases = [
    'review_submit', 'review_respond', 'review_moderate',
    'review_vote', 'analytics_generate', 'review_flag', 'review_highlight',
  ];

  cases.forEach((c) => {
    it(`routes case '${c}'`, () => {
      expect(te).toContain(`case '${c}':`);
    });
  });

  it('has 173 switch cases total', () => {
    const count = (te.match(/case '/g) || []).length;
    expect(count).toBe(173);
  });
});

/* ================================================================== */
/*  13. Task-executor handler methods                                  */
/* ================================================================== */
describe('Batch 56 — Task-executor handler methods', () => {
  const te = read('services/sven-marketplace/src/task-executor.ts');

  const handlers = [
    'handleReviewSubmit', 'handleReviewRespond', 'handleReviewModerate',
    'handleReviewVote', 'handleAnalyticsGenerate', 'handleReviewFlag',
    'handleReviewHighlight',
  ];

  handlers.forEach((h) => {
    it(`defines ${h}`, () => {
      expect(te).toMatch(new RegExp(`private (?:async )?${h}\\(`));
    });
  });

  it('has 169 handler methods total', () => {
    const count = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
    expect(count).toBe(169);
  });
});

/* ================================================================== */
/*  14. .gitattributes privacy                                         */
/* ================================================================== */
describe('Batch 56 — .gitattributes privacy', () => {
  const ga = read('.gitattributes');

  it('marks migration as export-ignore', () => {
    expect(ga).toContain('20260529120000_agent_marketplace_reviews.sql export-ignore');
  });
  it('marks shared types as export-ignore', () => {
    expect(ga).toContain('agent-marketplace-reviews.ts export-ignore');
  });
  it('marks skill dir as export-ignore', () => {
    expect(ga).toContain('marketplace-reviews/** export-ignore');
  });
});

/* ================================================================== */
/*  15. CHANGELOG entry                                                */
/* ================================================================== */
describe('Batch 56 — CHANGELOG', () => {
  const cl = read('CHANGELOG.md');

  it('mentions Batch 56', () => {
    expect(cl).toContain('Batch 56');
  });
  it('mentions Agent Marketplace Reviews', () => {
    expect(cl).toContain('Agent Marketplace Reviews');
  });
});

/* ================================================================== */
/*  16. Migration count                                                */
/* ================================================================== */
describe('Batch 56 — Global counts', () => {
  it('has 42 migration files', () => {
    const dir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
    expect(files.length).toBe(42);
  });
});
