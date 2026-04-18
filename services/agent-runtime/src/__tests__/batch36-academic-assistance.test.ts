/**
 * Batch 36 — Academic Assistance Platform
 *
 * Verifies all components of the legitimate academic assistance system:
 * - Migration SQL (4 tables, 8 indexes, CHECK constraint)
 * - Shared types (6 type unions, 6 const arrays, 4 interfaces, helper)
 * - Skill SKILL.md (5 actions, ethics policy)
 * - Task executor handlers (4 cases, 4 handler methods)
 * - Eidolon wiring (building kind, event kinds, districtFor)
 * - Event-bus SUBJECT_MAP entries
 * - .gitattributes argentum-private markers
 * - Shared index.ts export
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ── Migration SQL ──────────────────────────────────────────────────────────

describe('Batch 36 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260509120000_academic_assistance.sql');

  it('exists and has content', () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  it('wraps in transaction', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
  });

  describe('academic_services table', () => {
    it('creates table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS academic_services');
    });

    it('has id primary key', () => {
      expect(sql).toContain('id            TEXT PRIMARY KEY');
    });

    it('has service_type CHECK with 12 values', () => {
      expect(sql).toContain("service_type  TEXT NOT NULL CHECK (service_type IN (");
      const types = ['tutoring', 'formatting', 'citation_review', 'bibliography',
        'research_guidance', 'methodology_review', 'structure_review',
        'plagiarism_check', 'language_editing', 'presentation_coaching',
        'statistical_analysis', 'literature_review'];
      for (const t of types) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it('has price columns', () => {
      expect(sql).toContain('price_tokens');
      expect(sql).toContain('price_eur');
    });

    it('has agent_id column', () => {
      expect(sql).toContain('agent_id      TEXT');
    });

    it('has metadata JSONB', () => {
      expect(sql).toContain("metadata      JSONB NOT NULL DEFAULT '{}'");
    });
  });

  describe('academic_projects table', () => {
    it('creates table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS academic_projects');
    });

    it('has project_type CHECK with 8 values', () => {
      expect(sql).toContain("project_type    TEXT NOT NULL CHECK (project_type IN (");
      const types = ['licenta', 'disertatie', 'referat', 'eseu',
        'proiect_semestrial', 'teza_doctorat', 'articol_stiintific', 'prezentare'];
      for (const t of types) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it('has status CHECK with 9 values', () => {
      expect(sql).toContain("status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (");
      const statuses = ['draft', 'submitted', 'in_review', 'formatting',
        'citation_check', 'language_edit', 'completed', 'delivered', 'cancelled'];
      for (const s of statuses) {
        expect(sql).toContain(`'${s}'`);
      }
    });

    it('has quality_score with range constraint', () => {
      expect(sql).toContain('quality_score');
      expect(sql).toContain('quality_score >= 0');
      expect(sql).toContain('quality_score <= 100');
    });

    it('has assigned_agents JSONB array', () => {
      expect(sql).toContain("assigned_agents JSONB NOT NULL DEFAULT '[]'");
    });

    it('has deadline TIMESTAMPTZ', () => {
      expect(sql).toContain('deadline        TIMESTAMPTZ');
    });
  });

  describe('academic_reviews table', () => {
    it('creates table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS academic_reviews');
    });

    it('has foreign key to academic_projects', () => {
      expect(sql).toContain('REFERENCES academic_projects(id) ON DELETE CASCADE');
    });

    it('has review_type CHECK with 9 values', () => {
      expect(sql).toContain("review_type   TEXT NOT NULL CHECK (review_type IN (");
      const types = ['formatting', 'citation', 'plagiarism', 'grammar', 'structure',
        'methodology', 'content_quality', 'presentation', 'final_check'];
      for (const t of types) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it('has review status CHECK with 4 values', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'needs_revision'];
      for (const s of statuses) {
        expect(sql).toContain(`'${s}'`);
      }
    });

    it('has score with range constraint', () => {
      expect(sql).toContain('score         NUMERIC(5,2)');
      expect(sql).toContain('score >= 0');
      expect(sql).toContain('score <= 100');
    });

    it('has findings and suggestions JSONB arrays', () => {
      expect(sql).toContain("findings      JSONB NOT NULL DEFAULT '[]'");
      expect(sql).toContain("suggestions   JSONB NOT NULL DEFAULT '[]'");
    });
  });

  describe('academic_citations table', () => {
    it('creates table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS academic_citations');
    });

    it('has foreign key to academic_projects', () => {
      const fkMatches = sql.match(/REFERENCES academic_projects\(id\) ON DELETE CASCADE/g);
      expect(fkMatches).not.toBeNull();
      expect(fkMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it('has citation_style CHECK with 7 values', () => {
      expect(sql).toContain("citation_style  TEXT NOT NULL DEFAULT 'apa7' CHECK (citation_style IN (");
      const styles = ['apa7', 'chicago', 'mla9', 'ieee', 'harvard', 'iso690', 'vancouver'];
      for (const s of styles) {
        expect(sql).toContain(`'${s}'`);
      }
    });

    it('has source_type CHECK with 9 values', () => {
      expect(sql).toContain("source_type     TEXT NOT NULL CHECK (source_type IN (");
      const types = ['book', 'journal', 'website', 'conference', 'thesis',
        'report', 'legislation', 'standard', 'patent'];
      for (const t of types) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it('has doi and url nullable columns', () => {
      expect(sql).toContain('doi             TEXT');
      expect(sql).toContain('url             TEXT');
    });
  });

  describe('indexes', () => {
    const indexes = [
      'idx_academic_services_type',
      'idx_academic_services_agent',
      'idx_academic_projects_status',
      'idx_academic_projects_type',
      'idx_academic_reviews_project',
      'idx_academic_reviews_type',
      'idx_academic_citations_project',
      'idx_academic_citations_style',
    ];

    it('creates all 8 indexes', () => {
      for (const idx of indexes) {
        expect(sql).toContain(idx);
      }
    });
  });

  describe('marketplace_tasks CHECK extension', () => {
    it('drops old constraint', () => {
      expect(sql).toContain('DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check');
    });

    it('adds 4 academic task types to CHECK', () => {
      const academicTypes = ['academic_assist', 'academic_format', 'academic_cite', 'academic_review'];
      for (const t of academicTypes) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it('preserves all prior task types', () => {
      const priorTypes = ['auto_task', 'translate', 'write', 'review', 'proofread',
        'misiuni_post', 'council_deliberate', 'fleet_deploy', 'video_create',
        'avatar_customize', 'training_create'];
      for (const t of priorTypes) {
        expect(sql).toContain(`'${t}'`);
      }
    });
  });
});

// ── Shared Types ────────────────────────────────────────────────────────────

describe('Batch 36 — Shared Types (academic-assistance.ts)', () => {
  const src = read('packages/shared/src/academic-assistance.ts');

  it('exists and has content', () => {
    expect(src.length).toBeGreaterThan(500);
  });

  describe('AcademicServiceType', () => {
    it('exports type union with 12 values', () => {
      expect(src).toContain('export type AcademicServiceType');
      const values = ['tutoring', 'formatting', 'citation_review', 'bibliography',
        'research_guidance', 'methodology_review', 'structure_review',
        'plagiarism_check', 'language_editing', 'presentation_coaching',
        'statistical_analysis', 'literature_review'];
      for (const v of values) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports const array', () => {
      expect(src).toContain('export const ACADEMIC_SERVICE_TYPES: AcademicServiceType[]');
    });
  });

  describe('AcademicProjectType', () => {
    it('exports type union with 8 values', () => {
      expect(src).toContain('export type AcademicProjectType');
      const values = ['licenta', 'disertatie', 'referat', 'eseu',
        'proiect_semestrial', 'teza_doctorat', 'articol_stiintific', 'prezentare'];
      for (const v of values) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports const array', () => {
      expect(src).toContain('export const ACADEMIC_PROJECT_TYPES: AcademicProjectType[]');
    });
  });

  describe('AcademicProjectStatus', () => {
    it('exports type union with 9 values', () => {
      expect(src).toContain('export type AcademicProjectStatus');
      const values = ['draft', 'submitted', 'in_review', 'formatting',
        'citation_check', 'language_edit', 'completed', 'delivered', 'cancelled'];
      for (const v of values) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports const array', () => {
      expect(src).toContain('export const ACADEMIC_PROJECT_STATUSES: AcademicProjectStatus[]');
    });
  });

  describe('AcademicReviewType', () => {
    it('exports type union with 9 values', () => {
      expect(src).toContain('export type AcademicReviewType');
      const values = ['formatting', 'citation', 'plagiarism', 'grammar', 'structure',
        'methodology', 'content_quality', 'presentation', 'final_check'];
      for (const v of values) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports const array', () => {
      expect(src).toContain('export const ACADEMIC_REVIEW_TYPES: AcademicReviewType[]');
    });
  });

  describe('CitationStyle', () => {
    it('exports type union with 7 values', () => {
      expect(src).toContain('export type CitationStyle');
      const values = ['apa7', 'chicago', 'mla9', 'ieee', 'harvard', 'iso690', 'vancouver'];
      for (const v of values) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports const array', () => {
      expect(src).toContain('export const CITATION_STYLES: CitationStyle[]');
    });
  });

  describe('SourceType', () => {
    it('exports type union with 9 values', () => {
      expect(src).toContain('export type SourceType');
      const values = ['book', 'journal', 'website', 'conference', 'thesis',
        'report', 'legislation', 'standard', 'patent'];
      for (const v of values) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports const array', () => {
      expect(src).toContain('export const SOURCE_TYPES: SourceType[]');
    });
  });

  describe('Interfaces', () => {
    it('exports AcademicService interface', () => {
      expect(src).toContain('export interface AcademicService');
      expect(src).toContain('serviceType: AcademicServiceType');
      expect(src).toContain('priceTokens: number');
      expect(src).toContain('priceEur: number');
    });

    it('exports AcademicProject interface', () => {
      expect(src).toContain('export interface AcademicProject');
      expect(src).toContain('projectType: AcademicProjectType');
      expect(src).toContain('studentAlias: string');
      expect(src).toContain('assignedAgents: string[]');
      expect(src).toContain('qualityScore: number | null');
    });

    it('exports AcademicReview interface', () => {
      expect(src).toContain('export interface AcademicReview');
      expect(src).toContain('reviewType: AcademicReviewType');
      expect(src).toContain('findings: string[]');
      expect(src).toContain('suggestions: string[]');
      expect(src).toContain('corrected: boolean');
    });

    it('exports AcademicCitation interface', () => {
      expect(src).toContain('export interface AcademicCitation');
      expect(src).toContain('citationStyle: CitationStyle');
      expect(src).toContain('sourceType: SourceType');
      expect(src).toContain('doi: string | null');
    });
  });

  describe('canAdvanceAcademic helper', () => {
    it('exports the function', () => {
      expect(src).toContain('export function canAdvanceAcademic(');
    });

    it('uses ACADEMIC_STATUS_ORDER for progression', () => {
      expect(src).toContain('export const ACADEMIC_STATUS_ORDER: AcademicProjectStatus[]');
      expect(src).toContain('ACADEMIC_STATUS_ORDER.indexOf(current)');
      expect(src).toContain('ACADEMIC_STATUS_ORDER.indexOf(next)');
    });

    it('allows cancelled from any state', () => {
      expect(src).toContain("if (next === 'cancelled') return true;");
    });

    it('only allows advancing by exactly one step', () => {
      expect(src).toContain('return ni === ci + 1;');
    });
  });
});

// ── Shared Index Export ──────────────────────────────────────────────────────

describe('Batch 36 — Shared Index Export', () => {
  const src = read('packages/shared/src/index.ts');

  it('exports academic-assistance module', () => {
    expect(src).toContain("export * from './academic-assistance.js'");
  });

  it('has 61 lines', () => {
    const lineCount = src.split('\n').length;
    expect(lineCount).toBeGreaterThanOrEqual(60);
    expect(lineCount).toBeLessThanOrEqual(65);
  });
});

// ── Skill SKILL.md ──────────────────────────────────────────────────────────

describe('Batch 36 — academic-assist SKILL.md', () => {
  const md = read('skills/autonomous-economy/academic-assist/SKILL.md');

  it('exists and has content', () => {
    expect(md.length).toBeGreaterThan(500);
  });

  it('has YAML frontmatter', () => {
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('name: academic-assist');
    expect(md).toContain('version: 1.0.0');
  });

  it('has archetype: researcher', () => {
    expect(md).toContain('archetype: researcher');
  });

  it('has pricing configuration', () => {
    expect(md).toContain('base: 4.99');
    expect(md).toContain('currency: EUR');
    expect(md).toContain('per: session');
  });

  it('supports Romanian and English languages', () => {
    expect(md).toContain('- ro');
    expect(md).toContain('- en');
  });

  describe('actions', () => {
    it('has format-document action', () => {
      expect(md).toContain('id: format-document');
      expect(md).toContain('name: content');
      expect(md).toContain('name: template');
    });

    it('has review-citations action', () => {
      expect(md).toContain('id: review-citations');
      expect(md).toContain('name: citations');
      expect(md).toContain('name: style');
    });

    it('has structure-review action', () => {
      expect(md).toContain('id: structure-review');
      expect(md).toContain('name: projectType');
    });

    it('has language-edit action', () => {
      expect(md).toContain('id: language-edit');
      expect(md).toContain('name: formalityLevel');
    });

    it('has research-guidance action', () => {
      expect(md).toContain('id: research-guidance');
      expect(md).toContain('name: topic');
      expect(md).toContain('name: questions');
    });
  });

  describe('ethics policy', () => {
    it('has ethics section', () => {
      expect(md).toContain('ethics:');
      expect(md).toContain('policy:');
    });

    it('prohibits plagiarism-related activities', () => {
      expect(md).toContain('prohibited:');
      expect(md).toContain('plagiarism');
      expect(md).toContain('Impersonating student authorship');
    });

    it('references GDPR compliance', () => {
      expect(md).toContain('GDPR');
    });

    it('references academic integrity guidelines', () => {
      expect(md).toContain('Romanian Ministry of Education');
      expect(md).toContain('honour codes');
    });
  });
});

// ── Task Executor ───────────────────────────────────────────────────────────

describe('Batch 36 — Task Executor Handlers', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  it('has 47 switch cases', () => {
    const caseMatches = src.match(/case '/g);
    expect(caseMatches).not.toBeNull();
    expect(caseMatches!.length).toBe(47);
  });

  it('has academic_assist case routing to handleAcademicAssist', () => {
    expect(src).toContain("case 'academic_assist':");
    expect(src).toContain('this.handleAcademicAssist(input)');
  });

  it('has academic_format case routing to handleAcademicFormat', () => {
    expect(src).toContain("case 'academic_format':");
    expect(src).toContain('this.handleAcademicFormat(input)');
  });

  it('has academic_cite case routing to handleAcademicCite', () => {
    expect(src).toContain("case 'academic_cite':");
    expect(src).toContain('this.handleAcademicCite(input)');
  });

  it('has academic_review case routing to handleAcademicReview', () => {
    expect(src).toContain("case 'academic_review':");
    expect(src).toContain('this.handleAcademicReview(input)');
  });

  describe('handleAcademicAssist handler', () => {
    it('defines the handler method', () => {
      expect(src).toContain('private async handleAcademicAssist(input: Record<string, unknown>)');
    });

    it('extracts topic and projectType', () => {
      expect(src).toContain("const topic = String(input.topic ?? '')");
      expect(src).toContain("const projectType = String(input.projectType ?? 'licenta')");
    });

    it('returns guidance with methodology suggestions', () => {
      expect(src).toContain('methodologySuggestions');
      expect(src).toContain('structureRecommendation');
      expect(src).toContain('suggestedSources');
    });

    it('includes disclaimer about guidance-only', () => {
      expect(src).toContain('Guidance only');
      expect(src).toContain('student must produce original work');
    });
  });

  describe('handleAcademicFormat handler', () => {
    it('defines the handler method', () => {
      expect(src).toContain('private async handleAcademicFormat(input: Record<string, unknown>)');
    });

    it('extracts template and language', () => {
      expect(src).toContain("const template = String(input.template ?? 'standard-ro')");
    });

    it('returns formatting changes applied', () => {
      expect(src).toContain('changesApplied');
      expect(src).toContain('Margins set to 2.5cm');
      expect(src).toContain('Times New Roman 12pt');
      expect(src).toContain('Table of contents generated');
    });

    it('returns compliance score', () => {
      expect(src).toContain('complianceScore: 94.5');
    });
  });

  describe('handleAcademicCite handler', () => {
    it('defines the handler method', () => {
      expect(src).toContain('private async handleAcademicCite(input: Record<string, unknown>)');
    });

    it('defaults citation style to apa7', () => {
      expect(src).toContain("const style = String(input.style ?? 'apa7')");
    });

    it('calculates error rate', () => {
      expect(src).toContain('Math.floor(totalCitations * 0.3)');
    });

    it('returns validated citations with formatting', () => {
      expect(src).toContain('validatedCitations');
      expect(src).toContain('style.toUpperCase()');
    });
  });

  describe('handleAcademicReview handler', () => {
    it('defines the handler method', () => {
      expect(src).toContain('private async handleAcademicReview(input: Record<string, unknown>)');
    });

    it('returns findings and suggestions', () => {
      expect(src).toContain('Introduction lacks clear research question');
      expect(src).toContain('Methodology section needs more detail');
      expect(src).toContain('Add explicit research objectives');
    });

    it('includes authorship disclaimer', () => {
      expect(src).toContain('student retains full authorship');
    });

    it('returns score', () => {
      expect(src).toContain('score: 78.5');
    });
  });
});

// ── Eidolon Types ────────────────────────────────────────────────────────────

describe('Batch 36 — Eidolon Types', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  describe('EidolonBuildingKind', () => {
    it('includes tutoring_center', () => {
      expect(src).toContain("'tutoring_center'");
    });

    it('has 20 building kind pipes', () => {
      const buildingSection = src.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect(buildingSection).not.toBeNull();
      const pipes = buildingSection![0].match(/\|/g);
      expect(pipes).not.toBeNull();
      expect(pipes!.length).toBe(20);
    });
  });

  describe('EidolonEventKind', () => {
    it('includes academic.project_submitted', () => {
      expect(src).toContain("'academic.project_submitted'");
    });

    it('includes academic.review_completed', () => {
      expect(src).toContain("'academic.review_completed'");
    });

    it('includes academic.project_delivered', () => {
      expect(src).toContain("'academic.project_delivered'");
    });

    it('includes academic.citation_validated', () => {
      expect(src).toContain("'academic.citation_validated'");
    });

    it('has 93 event kind pipes', () => {
      const eventSection = src.match(/export type EidolonEventKind[\s\S]*?;/);
      expect(eventSection).not.toBeNull();
      const pipes = eventSection![0].match(/\|/g);
      expect(pipes).not.toBeNull();
      expect(pipes!.length).toBe(92);
    });
  });

  describe('districtFor()', () => {
    it('has case for tutoring_center', () => {
      expect(src).toContain("case 'tutoring_center':");
    });

    it('maps tutoring_center to market district', () => {
      expect(src).toContain("case 'tutoring_center':");
      expect(src).toContain("return 'market'");
    });

    it('has 20 total cases', () => {
      const caseMatches = src.match(/case '/g);
      expect(caseMatches).not.toBeNull();
      expect(caseMatches!.length).toBe(20);
    });
  });
});

// ── Event Bus ──────────────────────────────────────────────────────────────

describe('Batch 36 — Event Bus SUBJECT_MAP', () => {
  const src = read('services/sven-eidolon/src/event-bus.ts');

  it('has academic.project_submitted mapping', () => {
    expect(src).toContain("'sven.academic.project_submitted': 'academic.project_submitted'");
  });

  it('has academic.review_completed mapping', () => {
    expect(src).toContain("'sven.academic.review_completed': 'academic.review_completed'");
  });

  it('has academic.project_delivered mapping', () => {
    expect(src).toContain("'sven.academic.project_delivered': 'academic.project_delivered'");
  });

  it('has academic.citation_validated mapping', () => {
    expect(src).toContain("'sven.academic.citation_validated': 'academic.citation_validated'");
  });

  it('has 91 total SUBJECT_MAP entries', () => {
    const entries = src.match(/'sven\.[^']+'\s*:\s*'[^']+'/g);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(91);
  });
});

// ── .gitattributes ────────────────────────────────────────────────────────

describe('Batch 36 — .gitattributes', () => {
  const src = read('.gitattributes');

  it('marks academic-assist skill as argentum-private', () => {
    expect(src).toContain('skills/autonomous-economy/academic-assist/');
    expect(src).toContain('argentum-private');
  });

  it('marks academic_assistance migration as argentum-private', () => {
    expect(src).toContain('academic_assistance');
  });

  it('marks batch36 tests as argentum-private', () => {
    expect(src).toContain('batch36-');
  });

  it('marks academic-assistance.ts as argentum-private', () => {
    expect(src).toContain('academic-assistance.ts');
  });

  it('has at least 63 non-comment argentum-private entries', () => {
    const lines = src.split('\n').filter(l => !l.startsWith('#') && l.includes('argentum-private'));
    expect(lines.length).toBeGreaterThanOrEqual(63);
  });
});
