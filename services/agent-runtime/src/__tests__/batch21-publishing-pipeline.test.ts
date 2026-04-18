// ---------------------------------------------------------------------------
// Batch 21 — Publishing Pipeline
// Validates migration, shared types, skills, admin API, task executor handlers,
// NATS event-bus subjects, and Eidolon building kind integration.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ────────────────────────── helpers ──────────────────────────

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
//  1. Migration SQL structure
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260425120000_publishing_pipeline.sql');

  it('creates publishing_projects table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS publishing_projects');
  });

  it('creates editorial_stages table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS editorial_stages');
  });

  it('creates quality_reviews table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS quality_reviews');
  });

  it('creates book_catalog table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS book_catalog');
  });

  it('publishing_projects has id TEXT PRIMARY KEY', () => {
    expect(sql).toMatch(/publishing_projects[\s\S]*?id\s+TEXT PRIMARY KEY/);
  });

  it('publishing_projects has status CHECK constraint with all values', () => {
    const statusValues = ['manuscript', 'editing', 'proofreading', 'formatting',
      'cover_design', 'review', 'approved', 'published', 'rejected'];
    for (const s of statusValues) {
      expect(sql).toContain(`'${s}'`);
    }
  });

  it('publishing_projects has target_format CHECK with all formats', () => {
    const formats = ['epub', 'kindle_mobi', 'pdf', 'paperback', 'hardcover', 'audiobook'];
    for (const f of formats) {
      expect(sql).toContain(`'${f}'`);
    }
  });

  it('editorial_stages references publishing_projects', () => {
    expect(sql).toMatch(/editorial_stages[\s\S]*?REFERENCES publishing_projects/);
  });

  it('editorial_stages has stage_type CHECK with all types', () => {
    const types = ['editing', 'proofreading', 'formatting', 'cover_design', 'review', 'genre_research'];
    for (const t of types) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  it('editorial_stages has status CHECK with all statuses', () => {
    const statuses = ['pending', 'in_progress', 'completed', 'failed', 'skipped'];
    for (const s of statuses) {
      expect(sql).toContain(`'${s}'`);
    }
  });

  it('quality_reviews has score CHECK 0–100', () => {
    expect(sql).toMatch(/score\s+INTEGER\s+NOT NULL\s+CHECK\s*\(score >= 0 AND score <= 100\)/);
  });

  it('quality_reviews has category CHECK with all categories', () => {
    const categories = ['grammar', 'style', 'plot', 'pacing', 'characters',
      'worldbuilding', 'formatting', 'cover', 'overall'];
    for (const c of categories) {
      expect(sql).toContain(`'${c}'`);
    }
  });

  it('quality_reviews references editorial_stages and publishing_projects', () => {
    expect(sql).toMatch(/quality_reviews[\s\S]*?REFERENCES editorial_stages/);
    expect(sql).toMatch(/quality_reviews[\s\S]*?REFERENCES publishing_projects/);
  });

  it('book_catalog has UNIQUE constraint on project_id', () => {
    expect(sql).toMatch(/book_catalog[\s\S]*?project_id\s+TEXT\s+NOT NULL\s+UNIQUE/);
  });

  it('book_catalog has isbn UNIQUE', () => {
    expect(sql).toMatch(/book_catalog[\s\S]*?isbn\s+TEXT\s+UNIQUE/);
  });

  it('has all expected indexes', () => {
    const indexes = [
      'idx_pub_projects_org', 'idx_pub_projects_author',
      'idx_pub_projects_status', 'idx_pub_projects_genre',
      'idx_edit_stages_project', 'idx_edit_stages_agent', 'idx_edit_stages_status',
      'idx_quality_reviews_stage', 'idx_quality_reviews_project', 'idx_quality_reviews_reviewer',
      'idx_book_catalog_listing', 'idx_book_catalog_isbn',
    ];
    for (const idx of indexes) {
      expect(sql).toContain(idx);
    }
  });

  it('ALTERs marketplace_tasks CHECK constraint with new task types', () => {
    expect(sql).toContain('ALTER TABLE marketplace_tasks');
    expect(sql).toContain('marketplace_tasks_task_type_check');
    const newTypes = ['review', 'proofread', 'format', 'cover_design', 'genre_research'];
    for (const t of newTypes) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  it('preserves original marketplace task types', () => {
    const origTypes = ['translate', 'write', 'design', 'research', 'support', 'custom'];
    for (const t of origTypes) {
      expect(sql).toContain(`'${t}'`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  2. Shared types — publishing-pipeline.ts
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Shared types', () => {
  const src = readFile('packages/shared/src/publishing-pipeline.ts');

  it('exports PublishingStatus type', () => {
    expect(src).toContain('export type PublishingStatus');
  });

  it('PublishingStatus has all 9 values', () => {
    const values = ['manuscript', 'editing', 'proofreading', 'formatting',
      'cover_design', 'review', 'approved', 'published', 'rejected'];
    for (const v of values) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports EditorialStageType type', () => {
    expect(src).toContain('export type EditorialStageType');
  });

  it('EditorialStageType has 6 values', () => {
    const values = ['editing', 'proofreading', 'formatting', 'cover_design', 'review', 'genre_research'];
    for (const v of values) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports StageStatus type', () => {
    expect(src).toContain('export type StageStatus');
  });

  it('exports BookFormat type', () => {
    expect(src).toContain('export type BookFormat');
  });

  it('BookFormat has all 6 values', () => {
    const values = ['epub', 'kindle_mobi', 'pdf', 'paperback', 'hardcover', 'audiobook'];
    for (const v of values) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports QualityCategory type', () => {
    expect(src).toContain('export type QualityCategory');
  });

  it('QualityCategory has all 9 values', () => {
    const values = ['grammar', 'style', 'plot', 'pacing', 'characters',
      'worldbuilding', 'formatting', 'cover', 'overall'];
    for (const v of values) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports PublishingProject interface with all fields', () => {
    expect(src).toContain('export interface PublishingProject');
    const fields = ['id: string', 'orgId: string', 'authorAgentId: string',
      'title: string', 'genre: string', 'language: string',
      'status: PublishingStatus', 'wordCount: number', 'chapterCount: number',
      'targetFormat: BookFormat', 'manuscriptUrl: string | null'];
    for (const f of fields) {
      expect(src).toContain(f);
    }
  });

  it('exports EditorialStage interface', () => {
    expect(src).toContain('export interface EditorialStage');
    expect(src).toContain('stageType: EditorialStageType');
    expect(src).toContain('status: StageStatus');
    expect(src).toContain('assignedAgentId: string | null');
  });

  it('exports QualityReview interface', () => {
    expect(src).toContain('export interface QualityReview');
    expect(src).toContain('score: number');
    expect(src).toContain('category: QualityCategory');
    expect(src).toContain('approved: boolean');
  });

  it('exports BookCatalogEntry interface', () => {
    expect(src).toContain('export interface BookCatalogEntry');
    expect(src).toContain('format: BookFormat');
    expect(src).toContain('salesCount: number');
    expect(src).toContain('totalRevenue: number');
  });

  it('exports PUBLISHING_STATUS_ORDER with correct sequence', () => {
    expect(src).toContain('export const PUBLISHING_STATUS_ORDER');
    // Extract the array block starting from '= [' to the matching ']'
    const orderMatch = src.match(/PUBLISHING_STATUS_ORDER[^=]*=\s*\[([^\]]+)\]/);
    expect(orderMatch).toBeTruthy();
    const order = orderMatch![1];
    // Verify order: manuscript before editing, editing before proofreading, etc.
    const idxManuscript = order.indexOf('manuscript');
    const idxEditing = order.indexOf('editing');
    const idxProofreading = order.indexOf('proofreading');
    const idxFormatting = order.indexOf('formatting');
    const idxPublished = order.indexOf('published');
    expect(idxManuscript).toBeGreaterThanOrEqual(0);
    expect(idxManuscript).toBeLessThan(idxEditing);
    expect(idxEditing).toBeLessThan(idxProofreading);
    expect(idxProofreading).toBeLessThan(idxFormatting);
    expect(idxFormatting).toBeLessThan(idxPublished);
  });

  it('exports canAdvanceTo function', () => {
    expect(src).toContain('export function canAdvanceTo');
  });

  it('canAdvanceTo rejects same status', () => {
    expect(src).toContain('if (current === next) return false');
  });

  it('canAdvanceTo allows rejected only from review', () => {
    expect(src).toContain("if (next === 'rejected') return current === 'review'");
  });

  it('canAdvanceTo validates one-step forward progression', () => {
    expect(src).toContain('nextIdx === currentIdx + 1');
  });

  it('exports stageTypeToProjectStatus mapping function', () => {
    expect(src).toContain('export function stageTypeToProjectStatus');
  });

  it('genre_research maps to null (no project status change)', () => {
    expect(src).toContain('genre_research: null');
  });

  it('exports PUBLISHING_TASK_TYPES constant', () => {
    expect(src).toContain('export const PUBLISHING_TASK_TYPES');
    const taskTypes = ['review', 'proofread', 'format', 'cover_design', 'genre_research'];
    for (const t of taskTypes) {
      expect(src).toContain(`'${t}'`);
    }
  });

  it('exports MIN_APPROVAL_SCORE as 70', () => {
    expect(src).toContain('export const MIN_APPROVAL_SCORE = 70');
  });

  it('is re-exported from packages/shared/src/index.ts', () => {
    const idx = readFile('packages/shared/src/index.ts');
    expect(idx).toContain("from './publishing-pipeline");
  });
});

// ═══════════════════════════════════════════════════════════════
//  3. Skills — book-review
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — book-review skill', () => {
  const skill = readFile('skills/autonomous-economy/book-review/SKILL.md');

  it('has YAML frontmatter with name: book-review', () => {
    expect(skill).toMatch(/^---/);
    expect(skill).toContain('name: book-review');
  });

  it('has version 1.0.0', () => {
    expect(skill).toContain('version: 1.0.0');
  });

  it('is in autonomous-economy category', () => {
    expect(skill).toContain('category: autonomous-economy');
  });

  it('uses analyst archetype', () => {
    expect(skill).toContain('archetype: analyst');
  });

  it('defines action input with review types', () => {
    expect(skill).toContain('full-review');
    expect(skill).toContain('chapter-review');
    expect(skill).toContain('style-check');
    expect(skill).toContain('plot-analysis');
  });

  it('requires content input', () => {
    expect(skill).toContain('name: content');
  });

  it('has description mentioning structured scoring', () => {
    expect(skill).toContain('scoring');
  });
});

// ═══════════════════════════════════════════════════════════════
//  4. Skills — book-proofread
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — book-proofread skill', () => {
  const skill = readFile('skills/autonomous-economy/book-proofread/SKILL.md');

  it('has name: book-proofread', () => {
    expect(skill).toContain('name: book-proofread');
  });

  it('uses writer archetype', () => {
    expect(skill).toContain('archetype: writer');
  });

  it('defines proofreading actions', () => {
    expect(skill).toContain('full-proofread');
    expect(skill).toContain('chapter-proofread');
    expect(skill).toContain('style-guide-check');
    expect(skill).toContain('consistency-check');
  });

  it('mentions grammar in description', () => {
    expect(skill).toContain('grammar');
  });

  it('is in autonomous-economy category', () => {
    expect(skill).toContain('category: autonomous-economy');
  });
});

// ═══════════════════════════════════════════════════════════════
//  5. Skills — book-format
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — book-format skill', () => {
  const skill = readFile('skills/autonomous-economy/book-format/SKILL.md');

  it('has name: book-format', () => {
    expect(skill).toContain('name: book-format');
  });

  it('uses designer archetype', () => {
    expect(skill).toContain('archetype: designer');
  });

  it('defines format actions for each output type', () => {
    expect(skill).toContain('format-epub');
    expect(skill).toContain('format-kindle');
    expect(skill).toContain('format-pdf');
    expect(skill).toContain('format-paperback');
    expect(skill).toContain('generate-toc');
  });

  it('mentions EPUB and Kindle in description', () => {
    expect(skill).toContain('EPUB');
    expect(skill).toContain('Kindle');
  });

  it('is in autonomous-economy category', () => {
    expect(skill).toContain('category: autonomous-economy');
  });
});

// ═══════════════════════════════════════════════════════════════
//  6. Skills — book-cover-design
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — book-cover-design skill', () => {
  const skill = readFile('skills/autonomous-economy/book-cover-design/SKILL.md');

  it('has name: book-cover-design', () => {
    expect(skill).toContain('name: book-cover-design');
  });

  it('uses designer archetype', () => {
    expect(skill).toContain('archetype: designer');
  });

  it('defines cover design actions', () => {
    expect(skill).toContain('generate-brief');
    expect(skill).toContain('generate-prompt');
    expect(skill).toContain('review-cover');
    expect(skill).toContain('suggest-typography');
  });

  it('mentions AI-powered in description', () => {
    expect(skill).toContain('AI-powered');
  });

  it('is in autonomous-economy category', () => {
    expect(skill).toContain('category: autonomous-economy');
  });
});

// ═══════════════════════════════════════════════════════════════
//  7. Publishing Admin API
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Publishing Admin API', () => {
  const api = readFile('services/gateway-api/src/routes/admin/publishing.ts');

  it('exports registerPublishingRoutes function', () => {
    expect(api).toContain('export function registerPublishingRoutes');
  });

  it('accepts FastifyInstance, Pool, and optional NatsConnection', () => {
    expect(api).toContain('app: FastifyInstance');
    expect(api).toContain('pool: Pool');
    expect(api).toContain('nc?: NatsConnection | null');
  });

  it('imports canAdvanceTo from @sven/shared', () => {
    expect(api).toContain("canAdvanceTo");
    expect(api).toContain("from '@sven/shared'");
  });

  it('imports stageTypeToProjectStatus from @sven/shared', () => {
    expect(api).toContain('stageTypeToProjectStatus');
  });

  it('imports MIN_APPROVAL_SCORE', () => {
    expect(api).toContain('MIN_APPROVAL_SCORE');
  });

  // Project CRUD routes
  it('registers GET /publishing/projects', () => {
    expect(api).toContain("app.get('/publishing/projects'");
  });

  it('registers GET /publishing/projects/:projectId', () => {
    expect(api).toContain("app.get('/publishing/projects/:projectId'");
  });

  it('registers POST /publishing/projects', () => {
    expect(api).toContain("app.post('/publishing/projects'");
  });

  it('registers PATCH /publishing/projects/:projectId', () => {
    expect(api).toContain("app.patch('/publishing/projects/:projectId'");
  });

  it('registers DELETE /publishing/projects/:projectId', () => {
    expect(api).toContain("app.delete('/publishing/projects/:projectId'");
  });

  // Stage routes
  it('registers POST /publishing/projects/:projectId/stages', () => {
    expect(api).toContain("app.post('/publishing/projects/:projectId/stages'");
  });

  it('registers PATCH /publishing/stages/:stageId', () => {
    expect(api).toContain("app.patch('/publishing/stages/:stageId'");
  });

  it('registers POST /publishing/stages/:stageId/complete', () => {
    expect(api).toContain("app.post('/publishing/stages/:stageId/complete'");
  });

  // Review routes
  it('registers POST /publishing/stages/:stageId/reviews', () => {
    expect(api).toContain("app.post('/publishing/stages/:stageId/reviews'");
  });

  it('registers GET /publishing/projects/:projectId/reviews', () => {
    expect(api).toContain("app.get('/publishing/projects/:projectId/reviews'");
  });

  // Catalog routes
  it('registers POST /publishing/projects/:projectId/publish', () => {
    expect(api).toContain("app.post('/publishing/projects/:projectId/publish'");
  });

  it('registers GET /publishing/catalog', () => {
    expect(api).toContain("app.get('/publishing/catalog'");
  });

  // Validation
  it('validates required fields on project creation', () => {
    expect(api).toContain("authorAgentId, title, and genre are required");
  });

  it('validates stage type against VALID_STAGE_TYPES', () => {
    expect(api).toContain('VALID_STAGE_TYPES.includes(stageType)');
  });

  it('validates progression with canAdvanceTo', () => {
    expect(api).toContain('canAdvanceTo(currentStatus, targetStatus)');
  });

  it('validates project status before publishing', () => {
    expect(api).toContain("project.status !== 'approved'");
    expect(api).toContain("project.status !== 'review'");
  });

  it('auto-approves reviews when score >= MIN_APPROVAL_SCORE', () => {
    expect(api).toContain('score >= MIN_APPROVAL_SCORE');
  });

  // NATS publishing
  it('publishes sven.publishing.project_created on new projects', () => {
    expect(api).toContain("'sven.publishing.project_created'");
  });

  it('publishes sven.publishing.stage_advanced on stage creation', () => {
    expect(api).toContain("'sven.publishing.stage_advanced'");
  });

  it('publishes sven.publishing.review_submitted on review', () => {
    expect(api).toContain("'sven.publishing.review_submitted'");
  });

  it('publishes sven.publishing.book_published on publish', () => {
    expect(api).toContain("'sven.publishing.book_published'");
  });

  // Marketplace listing creation
  it('creates marketplace listing with kind digital_good on publish', () => {
    expect(api).toContain("'digital_good'");
  });

  it('includes bookMeta in listing metadata', () => {
    expect(api).toContain('bookMeta');
  });

  // Auto-advance on stage complete
  it('supports autoAdvance on stage completion', () => {
    expect(api).toContain('autoAdvance');
  });
});

// ═══════════════════════════════════════════════════════════════
//  8. Admin wiring
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Admin wiring', () => {
  const idx = readFile('services/gateway-api/src/routes/admin/index.ts');

  it('imports registerPublishingRoutes', () => {
    expect(idx).toContain("import { registerPublishingRoutes }");
  });

  it('calls registerPublishingRoutes in mountAdminRoutes', () => {
    expect(idx).toContain('registerPublishingRoutes(');
  });
});

// ═══════════════════════════════════════════════════════════════
//  9. Task Executor — new handlers
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Task executor handlers', () => {
  const src = readFile('services/sven-marketplace/src/task-executor.ts');

  it('routes review task type', () => {
    expect(src).toContain("case 'review':");
    expect(src).toContain('handleReview');
  });

  it('routes proofread task type', () => {
    expect(src).toContain("case 'proofread':");
    expect(src).toContain('handleProofread');
  });

  it('routes format task type', () => {
    expect(src).toContain("case 'format':");
    expect(src).toContain('handleFormat');
  });

  it('routes cover_design task type', () => {
    expect(src).toContain("case 'cover_design':");
    expect(src).toContain('handleCoverDesign');
  });

  it('routes genre_research task type', () => {
    expect(src).toContain("case 'genre_research':");
    expect(src).toContain('handleGenreResearch');
  });

  // Review handler
  it('handleReview returns scores object', () => {
    expect(src).toMatch(/handleReview[\s\S]*?scores/);
  });

  it('handleReview returns overallScore', () => {
    expect(src).toContain('overallScore');
  });

  it('handleReview returns approved field', () => {
    expect(src).toMatch(/handleReview[\s\S]*?approved:/);
  });

  it('handleReview returns suggestions array', () => {
    expect(src).toMatch(/handleReview[\s\S]*?suggestions:/);
  });

  // Proofread handler
  it('handleProofread returns corrections array', () => {
    expect(src).toMatch(/handleProofread[\s\S]*?corrections/);
  });

  it('handleProofread returns errorCount', () => {
    expect(src).toContain('errorCount');
  });

  it('handleProofread returns correctedText', () => {
    expect(src).toContain('correctedText');
  });

  it('handleProofread returns readabilityScore', () => {
    expect(src).toContain('readabilityScore');
  });

  // Format handler
  it('handleFormat returns formattedContent', () => {
    expect(src).toContain('formattedContent');
  });

  it('handleFormat returns pageCount', () => {
    expect(src).toMatch(/handleFormat[\s\S]*?pageCount/);
  });

  it('handleFormat returns tocGenerated', () => {
    expect(src).toContain('tocGenerated');
  });

  // Cover design handler
  it('handleCoverDesign returns designBrief', () => {
    expect(src).toContain('designBrief');
  });

  it('handleCoverDesign returns aiPrompt', () => {
    expect(src).toContain('aiPrompt');
  });

  it('handleCoverDesign returns typography object', () => {
    expect(src).toContain('typography');
    expect(src).toContain('titleFont');
    expect(src).toContain('authorFont');
  });

  it('handleCoverDesign returns colorPalette', () => {
    expect(src).toContain('colorPalette');
  });

  // Genre research handler
  it('handleGenreResearch returns trends array', () => {
    expect(src).toMatch(/handleGenreResearch[\s\S]*?trends/);
  });

  it('handleGenreResearch returns competition object', () => {
    expect(src).toMatch(/handleGenreResearch[\s\S]*?competition/);
  });

  it('handleGenreResearch returns recommendations', () => {
    expect(src).toMatch(/handleGenreResearch[\s\S]*?recommendations/);
  });
});

// ═══════════════════════════════════════════════════════════════
//  10. Marketplace types — published_book ListingKind
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Marketplace ListingKind', () => {
  const src = readFile('services/sven-marketplace/src/types.ts');

  it('ListingKind includes published_book', () => {
    expect(src).toContain("'published_book'");
  });
});

// ═══════════════════════════════════════════════════════════════
//  11. NATS event-bus — publishing subjects
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — NATS event-bus subjects', () => {
  const src = readFile('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.publishing.project_created', () => {
    expect(src).toContain("'sven.publishing.project_created': 'publishing.project_created'");
  });

  it('maps sven.publishing.stage_advanced', () => {
    expect(src).toContain("'sven.publishing.stage_advanced': 'publishing.stage_advanced'");
  });

  it('maps sven.publishing.review_submitted', () => {
    expect(src).toContain("'sven.publishing.review_submitted': 'publishing.review_submitted'");
  });

  it('maps sven.publishing.book_published', () => {
    expect(src).toContain("'sven.publishing.book_published': 'publishing.book_published'");
  });
});

// ═══════════════════════════════════════════════════════════════
//  12. Eidolon types — publishing_house building kind
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Eidolon types', () => {
  const src = readFile('services/sven-eidolon/src/types.ts');

  it('EidolonBuildingKind includes publishing_house', () => {
    expect(src).toContain("'publishing_house'");
  });

  it('EidolonEventKind includes publishing.project_created', () => {
    expect(src).toContain("'publishing.project_created'");
  });

  it('EidolonEventKind includes publishing.stage_advanced', () => {
    expect(src).toContain("'publishing.stage_advanced'");
  });

  it('EidolonEventKind includes publishing.review_submitted', () => {
    expect(src).toContain("'publishing.review_submitted'");
  });

  it('EidolonEventKind includes publishing.book_published', () => {
    expect(src).toContain("'publishing.book_published'");
  });

  it('districtFor maps publishing_house to market', () => {
    expect(src).toMatch(/case 'publishing_house':[\s\S]*?return 'market'/);
  });
});

// ═══════════════════════════════════════════════════════════════
//  13. Skill count validation
// ═══════════════════════════════════════════════════════════════
describe('Batch 21 — Skills directory', () => {
  const skillsDir = path.join(ROOT, 'skills/autonomous-economy');

  it('has at least 12 skill directories', () => {
    const dirs = fs.readdirSync(skillsDir)
      .filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory());
    expect(dirs.length).toBeGreaterThanOrEqual(12);
  });

  it('each new skill has a SKILL.md file', () => {
    const newSkills = ['book-review', 'book-proofread', 'book-format', 'book-cover-design'];
    for (const s of newSkills) {
      const skillPath = path.join(skillsDir, s, 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    }
  });
});
