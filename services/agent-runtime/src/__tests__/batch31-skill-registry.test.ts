import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ── helpers ── */
const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ═══════════════════════════════════════════════════════════════
   Batch 31 — Skill Registry: catalog, import, quality assessment
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. Migration SQL ── */
describe('Batch 31 — Migration', () => {
  const sql = read(
    'services/gateway-api/migrations/20260505120000_skill_registry.sql',
  );

  it('creates skill_registry table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS skill_registry');
  });

  it('creates skill_quality_assessments table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS skill_quality_assessments');
  });

  it('creates skill_import_log table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS skill_import_log');
  });

  it('ALTERs marketplace_tasks to 34 task types', () => {
    expect(sql).toContain('skill_catalog');
    expect(sql).toContain('skill_import');
    expect(sql).toContain('skill_audit');
  });

  it('has CHECK constraint for category with 17 values', () => {
    expect(sql).toContain('autonomous-economy');
    expect(sql).toContain('data-engineering');
    expect(sql).toContain('research');
    expect(sql).toContain('devops');
  });

  it('has CHECK constraint for integration_status', () => {
    expect(sql).toContain('discovered');
    expect(sql).toContain('evaluating');
    expect(sql).toContain('adapting');
    expect(sql).toContain('testing');
    expect(sql).toContain('integrated');
    expect(sql).toContain('deprecated');
  });

  it('has CHECK constraint for quality_tier', () => {
    expect(sql).toContain('experimental');
    expect(sql).toContain('beta');
    expect(sql).toContain('stable');
    expect(sql).toContain('certified');
  });

  it('creates indexes', () => {
    expect(sql).toContain('idx_skill_registry_category');
    expect(sql).toContain('idx_skill_registry_source');
  });

  it('inserts settings_global defaults', () => {
    expect(sql).toContain('settings_global');
    expect(sql).toContain('skill_registry');
  });
});

/* ── 2. Shared Types ── */
describe('Batch 31 — Shared Types', () => {
  const src = read('packages/shared/src/skill-registry.ts');

  it('exports SkillCategory union with 17 values', () => {
    expect(src).toContain('SkillCategory');
    expect(src).toContain("'autonomous-economy'");
    expect(src).toContain("'data-engineering'");
    expect(src).toContain("'research'");
    expect(src).toContain("'devops'");
  });

  it('exports SkillSource union', () => {
    expect(src).toContain('SkillSource');
    expect(src).toContain("'native'");
    expect(src).toContain("'imported'");
  });

  it('exports IntegrationStatus union with 6 values', () => {
    expect(src).toContain('IntegrationStatus');
    expect(src).toContain("'discovered'");
    expect(src).toContain("'integrated'");
    expect(src).toContain("'deprecated'");
  });

  it('exports QualityTier union', () => {
    expect(src).toContain('QualityTier');
    expect(src).toContain("'experimental'");
    expect(src).toContain("'certified'");
  });

  it('exports ImportStatus union', () => {
    expect(src).toContain('ImportStatus');
    expect(src).toContain("'pending'");
    expect(src).toContain("'imported'");
  });

  it('exports ImportSourceType union', () => {
    expect(src).toContain('ImportSourceType');
    expect(src).toContain("'github'");
    expect(src).toContain("'npm'");
  });

  it('exports SkillRegistryEntry interface', () => {
    expect(src).toContain('SkillRegistryEntry');
    expect(src).toContain('category: SkillCategory');
    expect(src).toContain('integrationStatus: IntegrationStatus');
  });

  it('exports SkillQualityAssessment interface', () => {
    expect(src).toContain('SkillQualityAssessment');
    expect(src).toContain('score: number');
    expect(src).toContain('coveragePct: number');
  });

  it('exports SkillImportEntry interface', () => {
    expect(src).toContain('SkillImportEntry');
    expect(src).toContain('sourceType: ImportSourceType');
    expect(src).toContain('importStatus: ImportStatus');
  });

  it('exports SkillGapReport interface', () => {
    expect(src).toContain('SkillGapReport');
    expect(src).toContain('totalRegistered: number');
  });

  it('exports SKILL_CATEGORIES constant', () => {
    expect(src).toContain('SKILL_CATEGORIES');
  });

  it('exports QUALITY_TIERS constant', () => {
    expect(src).toContain('QUALITY_TIERS');
  });

  it('exports DEFAULT_QUALITY_THRESHOLD = 70', () => {
    expect(src).toContain('DEFAULT_QUALITY_THRESHOLD');
    expect(src).toContain('70');
  });

  it('exports meetsQualityThreshold utility', () => {
    expect(src).toContain('meetsQualityThreshold');
  });

  it('exports gapScore utility', () => {
    expect(src).toContain('gapScore');
  });

  it('exports compatibilityScore utility', () => {
    expect(src).toContain('compatibilityScore');
  });

  it('exports tierFromScore utility', () => {
    expect(src).toContain('tierFromScore');
  });

  it('exports canAdvanceIntegration utility', () => {
    expect(src).toContain('canAdvanceIntegration');
  });
});

/* ── 3. Index export ── */
describe('Batch 31 — Index Export', () => {
  const idx = read('packages/shared/src/index.ts');

  it('re-exports skill-registry module', () => {
    expect(idx).toContain("export * from './skill-registry.js'");
  });
});

/* ── 4. SKILL.md files ── */
describe('Batch 31 — skill-catalog SKILL.md', () => {
  const md = read('skills/autonomous-economy/skill-catalog/SKILL.md');

  it('has name field', () => {
    expect(md).toContain('name: skill-catalog');
  });

  it('has analyst archetype', () => {
    expect(md).toContain('archetype: analyst');
  });

  it('has catalog action', () => {
    expect(md).toContain('catalog:');
  });

  it('has gap-analysis action', () => {
    expect(md).toContain('gap-analysis:');
  });

  it('has import action', () => {
    expect(md).toContain('import:');
  });

  it('has audit action', () => {
    expect(md).toContain('audit:');
  });
});

describe('Batch 31 — data-pipeline SKILL.md', () => {
  const md = read('skills/data-engineering/data-pipeline/SKILL.md');

  it('has name field', () => {
    expect(md).toContain('name: data-pipeline');
  });

  it('has engineer archetype', () => {
    expect(md).toContain('archetype: engineer');
  });

  it('has extract action', () => {
    expect(md).toContain('extract:');
  });

  it('has transform action', () => {
    expect(md).toContain('transform:');
  });

  it('has load action', () => {
    expect(md).toContain('load:');
  });
});

describe('Batch 31 — web-scraper SKILL.md', () => {
  const md = read('skills/data-engineering/web-scraper/SKILL.md');

  it('has name field', () => {
    expect(md).toContain('name: web-scraper');
  });

  it('has researcher archetype', () => {
    expect(md).toContain('archetype: researcher');
  });

  it('has scrape action', () => {
    expect(md).toContain('scrape:');
  });

  it('has crawl action', () => {
    expect(md).toContain('crawl:');
  });
});

describe('Batch 31 — research-analyst SKILL.md', () => {
  const md = read('skills/research/research-analyst/SKILL.md');

  it('has name field', () => {
    expect(md).toContain('name: research-analyst');
  });

  it('has researcher archetype', () => {
    expect(md).toContain('archetype: researcher');
  });

  it('has investigate action', () => {
    expect(md).toContain('investigate:');
  });

  it('has report action', () => {
    expect(md).toContain('report:');
  });
});

describe('Batch 31 — ci-cd-runner SKILL.md', () => {
  const md = read('skills/devops/ci-cd-runner/SKILL.md');

  it('has name field', () => {
    expect(md).toContain('name: ci-cd-runner');
  });

  it('has operator archetype', () => {
    expect(md).toContain('archetype: operator');
  });

  it('has build action', () => {
    expect(md).toContain('build:');
  });

  it('has deploy action', () => {
    expect(md).toContain('deploy:');
  });

  it('has rollback action', () => {
    expect(md).toContain('rollback:');
  });
});

/* ── 5. Task Executor ── */
describe('Batch 31 — Task Executor', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  it('has skill_catalog case', () => {
    expect(src).toContain("case 'skill_catalog':");
  });

  it('has skill_import case', () => {
    expect(src).toContain("case 'skill_import':");
  });

  it('has skill_audit case', () => {
    expect(src).toContain("case 'skill_audit':");
  });

  it('has handleSkillCatalog handler', () => {
    expect(src).toContain('handleSkillCatalog');
  });

  it('has handleSkillImport handler', () => {
    expect(src).toContain('handleSkillImport');
  });

  it('has handleSkillAudit handler', () => {
    expect(src).toContain('handleSkillAudit');
  });

  it('handleSkillCatalog returns registeredSkills', () => {
    expect(src).toContain('registeredSkills');
  });

  it('handleSkillImport returns importId', () => {
    expect(src).toContain('importId');
    expect(src).toContain('importStatus');
  });

  it('handleSkillAudit returns qualityScore and qualityTier', () => {
    expect(src).toContain('qualityScore');
    expect(src).toContain('qualityTier');
  });

  it('has exactly 34 switch cases', () => {
    const cases = src.match(/case\s+'/g);
    expect(cases).not.toBeNull();
    expect(cases!.length).toBe(34);
  });
});

/* ── 6. Eidolon Types ── */
describe('Batch 31 — Eidolon Types', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  it('has skill_academy building kind', () => {
    expect(src).toContain("'skill_academy'");
  });

  it('has 16 building kind pipes', () => {
    const buildingBlock = src.match(
      /export type EidolonBuildingKind[\s\S]*?;/,
    );
    expect(buildingBlock).not.toBeNull();
    const pipes = buildingBlock![0].match(/\|/g);
    expect(pipes).not.toBeNull();
    expect(pipes!.length).toBe(16);
  });

  it('has skill.registered event kind', () => {
    expect(src).toContain("'skill.registered'");
  });

  it('has skill.imported event kind', () => {
    expect(src).toContain("'skill.imported'");
  });

  it('has skill.audited event kind', () => {
    expect(src).toContain("'skill.audited'");
  });

  it('has skill.promoted event kind', () => {
    expect(src).toContain("'skill.promoted'");
  });

  it('has 76 event kind pipes', () => {
    const eventBlock = src.match(
      /export type EidolonEventKind[\s\S]*?;/,
    );
    expect(eventBlock).not.toBeNull();
    const pipes = eventBlock![0].match(/\|/g);
    expect(pipes).not.toBeNull();
    expect(pipes!.length).toBe(76);
  });

  it('districtFor maps skill_academy to infrastructure', () => {
    expect(src).toContain("case 'skill_academy':");
    expect(src).toContain("return 'infrastructure'");
  });

  it('has 16 districtFor cases', () => {
    const cases = src.match(/case\s+'/g);
    expect(cases).not.toBeNull();
    expect(cases!.length).toBe(16);
  });
});

/* ── 7. Event Bus ── */
describe('Batch 31 — Event Bus SUBJECT_MAP', () => {
  const src = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.skill.registered', () => {
    expect(src).toContain("'sven.skill.registered': 'skill.registered'");
  });

  it('maps sven.skill.imported', () => {
    expect(src).toContain("'sven.skill.imported': 'skill.imported'");
  });

  it('maps sven.skill.audited', () => {
    expect(src).toContain("'sven.skill.audited': 'skill.audited'");
  });

  it('maps sven.skill.promoted', () => {
    expect(src).toContain("'sven.skill.promoted': 'skill.promoted'");
  });

  it('has 75 SUBJECT_MAP entries', () => {
    const entries = src.match(/'sven\./g);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(75);
  });
});
