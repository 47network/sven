import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ────────────────────────────────────────────────────────────────
 * Batch 38 — Research Labs Infrastructure
 * ──────────────────────────────────────────────────────────────── */

describe('Batch 38 — Research Labs', () => {
  /* ── Migration ─────────────────────────────────────────────── */
  describe('Migration — 20260511120000_research_labs.sql', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260511120000_research_labs.sql'),
      'utf-8',
    );

    it('creates research_labs table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS research_labs');
    });

    it('creates research_projects table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS research_projects');
    });

    it('creates research_papers table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS research_papers');
    });

    it('creates research_datasets table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS research_datasets');
    });

    it('has lab status check constraint', () => {
      expect(sql).toMatch(/lab_status_chk|CHECK[\s\S]*founding/);
    });

    it('references research_labs from projects', () => {
      expect(sql).toContain('REFERENCES research_labs');
    });

    it('references research_projects from papers', () => {
      expect(sql).toContain('REFERENCES research_projects');
    });
  });

  /* ── Shared Types ──────────────────────────────────────────── */
  describe('Shared types — research-labs.ts', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/research-labs.ts'),
      'utf-8',
    );

    it('exports ResearchFocusArea type', () => {
      expect(src).toContain('ResearchFocusArea');
    });

    it('includes cybersecurity focus area', () => {
      expect(src).toContain('cybersecurity');
    });

    it('includes nlp focus area', () => {
      expect(src).toContain('nlp');
    });

    it('includes computer_vision focus area', () => {
      expect(src).toContain('computer_vision');
    });

    it('exports LabStatus type', () => {
      expect(src).toContain('LabStatus');
    });

    it('includes founding status', () => {
      expect(src).toContain('founding');
    });

    it('includes active status', () => {
      expect(src).toContain('active');
    });

    it('exports ResearchProjectStatus type', () => {
      expect(src).toContain('ResearchProjectStatus');
    });

    it('includes proposal status', () => {
      expect(src).toContain('proposal');
    });

    it('includes peer_review status', () => {
      expect(src).toContain('peer_review');
    });

    it('exports PaperStatus type', () => {
      expect(src).toContain('PaperStatus');
    });

    it('includes draft paper status', () => {
      expect(src).toContain("'draft'");
    });

    it('includes published paper status', () => {
      expect(src).toContain("'published'");
    });

    it('exports DatasetFormat type', () => {
      expect(src).toContain('DatasetFormat');
    });

    it('exports DatasetAccessLevel type', () => {
      expect(src).toContain('DatasetAccessLevel');
    });

    it('exports ResearchLab interface', () => {
      expect(src).toContain('ResearchLab');
    });

    it('exports ResearchProject interface', () => {
      expect(src).toContain('ResearchProject');
    });

    it('exports ResearchPaper interface', () => {
      expect(src).toContain('ResearchPaper');
    });

    it('exports ResearchDataset interface', () => {
      expect(src).toContain('ResearchDataset');
    });

    it('exports canAdvanceProject helper', () => {
      expect(src).toContain('canAdvanceProject');
    });

    it('exports PROJECT_STATUS_ORDER', () => {
      expect(src).toContain('PROJECT_STATUS_ORDER');
    });

    it('exports FOCUS_AREA_LABELS', () => {
      expect(src).toContain('FOCUS_AREA_LABELS');
    });
  });

  /* ── Shared index export ───────────────────────────────────── */
  describe('Shared index export', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('exports research-labs module', () => {
      expect(idx).toContain("export * from './research-labs.js'");
    });

    it('has at least 60 non-empty lines', () => {
      const lines = idx.split('\n').filter((l) => l.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(60);
    });
  });

  /* ── Skill SKILL.md ────────────────────────────────────────── */
  describe('Skill — research-lab SKILL.md', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/research-lab/SKILL.md'),
      'utf-8',
    );

    it('has name field', () => {
      expect(md).toContain('name:');
    });

    it('declares create-lab action', () => {
      expect(md).toContain('create-lab');
    });

    it('declares start-project action', () => {
      expect(md).toContain('start-project');
    });

    it('declares advance-project action', () => {
      expect(md).toContain('advance-project');
    });

    it('declares submit-paper action', () => {
      expect(md).toContain('submit-paper');
    });

    it('declares publish-dataset action', () => {
      expect(md).toContain('publish-dataset');
    });

    it('declares recruit-collaborator action', () => {
      expect(md).toContain('recruit-collaborator');
    });

    it('mentions pricing', () => {
      expect(md).toMatch(/pricing|cost|token/i);
    });

    it('mentions reputation', () => {
      expect(md).toMatch(/reputation|impact/i);
    });
  });

  /* ── Eidolon types — BuildingKind ──────────────────────────── */
  describe('Eidolon BuildingKind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes research_campus building kind', () => {
      expect(types).toContain("'research_campus'");
    });

    it('has 22 building kinds (22 pipes in type section)', () => {
      const kindSection = types.match(/EidolonBuildingKind[\s\S]*?;/);
      expect(kindSection).not.toBeNull();
      const pipes = (kindSection![0].match(/\|/g) || []).length;
      expect(pipes).toBe(22);
    });
  });

  /* ── Eidolon types — EventKind ─────────────────────────────── */
  describe('Eidolon EventKind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes research.lab_founded event', () => {
      expect(types).toContain("'research.lab_founded'");
    });

    it('includes research.project_started event', () => {
      expect(types).toContain("'research.project_started'");
    });

    it('includes research.paper_published event', () => {
      expect(types).toContain("'research.paper_published'");
    });

    it('includes research.dataset_released event', () => {
      expect(types).toContain("'research.dataset_released'");
    });
  });

  /* ── Eidolon districtFor ───────────────────────────────────── */
  describe('Eidolon districtFor()', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('maps research_campus to infrastructure', () => {
      expect(types).toContain("case 'research_campus':");
      expect(types).toContain("return 'infrastructure'");
    });

    it('has 22 districtFor cases', () => {
      const fn = types.slice(types.indexOf('function districtFor'));
      const caseCount = (fn.match(/case '/g) || []).length;
      expect(caseCount).toBe(22);
    });
  });

  /* ── Event bus SUBJECT_MAP ─────────────────────────────────── */
  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('maps sven.research.lab_founded', () => {
      expect(bus).toContain("'sven.research.lab_founded': 'research.lab_founded'");
    });

    it('maps sven.research.project_started', () => {
      expect(bus).toContain("'sven.research.project_started': 'research.project_started'");
    });

    it('maps sven.research.paper_published', () => {
      expect(bus).toContain("'sven.research.paper_published': 'research.paper_published'");
    });

    it('maps sven.research.dataset_released', () => {
      expect(bus).toContain("'sven.research.dataset_released': 'research.dataset_released'");
    });

    it('has 99 SUBJECT_MAP entries', () => {
      const entries = (bus.match(/'sven\./g) || []).length;
      expect(entries).toBe(99);
    });
  });

  /* ── Task executor — switch cases ──────────────────────────── */
  describe('Task executor — research handlers', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has research_lab switch case', () => {
      expect(te).toContain("case 'research_lab':");
    });

    it('routes to handleResearchLab', () => {
      expect(te).toContain('this.handleResearchLab');
    });

    it('has research_project switch case', () => {
      expect(te).toContain("case 'research_project':");
    });

    it('routes to handleResearchProject', () => {
      expect(te).toContain('this.handleResearchProject');
    });

    it('has research_paper switch case', () => {
      expect(te).toContain("case 'research_paper':");
    });

    it('routes to handleResearchPaper', () => {
      expect(te).toContain('this.handleResearchPaper');
    });

    it('has 53 switch cases total', () => {
      const caseCount = (te.match(/case '/g) || []).length;
      expect(caseCount).toBe(53);
    });

    it('has 45 handler methods total', () => {
      const handlerCount = (te.match(/private async handle/g) || []).length;
      expect(handlerCount).toBe(45);
    });
  });

  /* ── Task executor — handler output ────────────────────────── */
  describe('Task executor — handler outputs', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('handleResearchLab returns labId', () => {
      expect(te).toContain('labId');
    });

    it('handleResearchLab returns focusArea', () => {
      const handlerSection = te.slice(te.indexOf('handleResearchLab'));
      expect(handlerSection).toContain('focusArea');
    });

    it('handleResearchProject returns projectId', () => {
      const handlerSection = te.slice(te.indexOf('handleResearchProject'));
      expect(handlerSection).toContain('projectId');
    });

    it('handleResearchProject returns methodology', () => {
      const handlerSection = te.slice(te.indexOf('handleResearchProject'));
      expect(handlerSection).toContain('methodology');
    });

    it('handleResearchPaper returns paperId', () => {
      const handlerSection = te.slice(te.indexOf('handleResearchPaper'));
      expect(handlerSection).toContain('paperId');
    });

    it('handleResearchPaper returns keywords', () => {
      const handlerSection = te.slice(te.indexOf('handleResearchPaper'));
      expect(handlerSection).toContain('keywords');
    });

    it('handleResearchPaper returns citationCount', () => {
      const handlerSection = te.slice(te.indexOf('handleResearchPaper'));
      expect(handlerSection).toContain('citationCount');
    });
  });

  /* ── .gitattributes ────────────────────────────────────────── */
  describe('.gitattributes — Batch 38 entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks research-lab skill as private', () => {
      expect(ga).toContain('skills/autonomous-economy/research-lab/**');
    });

    it('marks research-labs shared types as private', () => {
      expect(ga).toContain('packages/shared/src/research-labs.ts');
    });

    it('marks research_labs migration as private', () => {
      expect(ga).toContain('20260511120000_research_labs.sql');
    });

    it('marks batch38 tests as private', () => {
      expect(ga).toContain('batch38-*.test.ts');
    });
  });
});
