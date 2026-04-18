/**
 * Batch 35 — Public Release (Argentum Branch)
 *
 * Verifies all release-readiness artifacts:
 * - .gitattributes with argentum-private markers
 * - Issue templates (bug report + feature request)
 * - Dependabot configuration
 * - Branch strategy documentation
 * - Public stripping manifest
 * - Existing community files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT, LICENSE)
 * - Existing CI/CD workflows
 * - PR template
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

// ── .gitattributes ────────────────────────────────────────────────────────

describe('Batch 35 — .gitattributes', () => {
  const src = read('.gitattributes');

  it('exists and has content', () => {
    expect(src.length).toBeGreaterThan(100);
  });

  it('marks sven-treasury as argentum-private', () => {
    expect(src).toContain('services/sven-treasury/');
    expect(src).toContain('argentum-private');
  });

  it('marks sven-marketplace as argentum-private', () => {
    expect(src).toContain('services/sven-marketplace/');
  });

  it('marks sven-eidolon as argentum-private', () => {
    expect(src).toContain('services/sven-eidolon/');
  });

  it('marks trading skills as argentum-private', () => {
    expect(src).toContain('skills/trading/');
  });

  it('marks autonomous-economy skills as argentum-private', () => {
    expect(src).toContain('skills/autonomous-economy/');
  });

  it('marks economy shared types as argentum-private', () => {
    expect(src).toContain('packages/shared/src/marketplace.ts');
    expect(src).toContain('packages/shared/src/treasury.ts');
    expect(src).toContain('packages/shared/src/eidolon.ts');
    expect(src).toContain('packages/shared/src/misiuni.ts');
    expect(src).toContain('packages/shared/src/xlvii-merch.ts');
  });

  it('marks economy migrations as argentum-private', () => {
    expect(src).toContain('20260422120000_marketplace_tasks_tokens_goals.sql');
    expect(src).toContain('20260508120000_micro_training.sql');
  });

  it('marks batch test files as argentum-private', () => {
    expect(src).toContain('batch7-*.test.ts');
    expect(src).toContain('batch34-*.test.ts');
  });

  it('includes export-ignore on all private entries', () => {
    const privateLines = src.split('\n').filter(l =>
      l.includes('argentum-private') && !l.startsWith('#')
    );
    for (const line of privateLines) {
      expect(line).toContain('export-ignore');
    }
  });

  it('has 60 argentum-private entries', () => {
    const count = (src.match(/argentum-private/g) || []).length;
    expect(count).toBe(60);
  });

  it('sets eol=lf for source files', () => {
    expect(src).toContain('*.ts   text eol=lf');
    expect(src).toContain('*.md   text eol=lf');
    expect(src).toContain('*.sql  text eol=lf');
  });

  it('marks lock files as binary', () => {
    expect(src).toContain('*.lock binary');
  });
});

// ── Issue Templates ───────────────────────────────────────────────────────

describe('Batch 35 — Bug report template', () => {
  const src = read('.github/ISSUE_TEMPLATE/bug_report.yml');

  it('exists', () => {
    expect(src.length).toBeGreaterThan(100);
  });

  it('has name field', () => {
    expect(src).toContain('name:');
    expect(src).toContain('Bug Report');
  });

  it('has description field', () => {
    expect(src).toContain('description:');
  });

  it('includes bug and triage labels', () => {
    expect(src).toContain('"bug"');
    expect(src).toContain('"triage"');
  });

  it('has steps to reproduce field', () => {
    expect(src).toContain('Steps to reproduce');
  });

  it('has expected behaviour field', () => {
    expect(src).toContain('Expected behaviour');
  });

  it('has component dropdown', () => {
    expect(src).toContain('Gateway API');
    expect(src).toContain('Agent Runtime');
    expect(src).toContain('Skill Runner');
  });

  it('has deployment type dropdown', () => {
    expect(src).toContain('Self-hosted (Docker Compose)');
    expect(src).toContain('SaaS (app.sven.systems)');
  });

  it('has pre-submission checklist', () => {
    expect(src).toContain('Pre-submission checklist');
    expect(src).toContain('not a duplicate');
  });
});

describe('Batch 35 — Feature request template', () => {
  const src = read('.github/ISSUE_TEMPLATE/feature_request.yml');

  it('exists', () => {
    expect(src.length).toBeGreaterThan(100);
  });

  it('has name field', () => {
    expect(src).toContain('Feature Request');
  });

  it('includes enhancement label', () => {
    expect(src).toContain('"enhancement"');
  });

  it('has problem statement field', () => {
    expect(src).toContain('Problem statement');
  });

  it('has proposed solution field', () => {
    expect(src).toContain('Proposed solution');
  });

  it('has impact dropdown', () => {
    expect(src).toContain('Minor improvement');
    expect(src).toContain('Critical / blocking');
  });
});

describe('Batch 35 — Issue template config', () => {
  const src = read('.github/ISSUE_TEMPLATE/config.yml');

  it('disables blank issues', () => {
    expect(src).toContain('blank_issues_enabled: false');
  });

  it('links to discussions', () => {
    expect(src).toContain('Discussions');
  });

  it('links to security advisories', () => {
    expect(src).toContain('Security vulnerability');
  });
});

// ── Dependabot ────────────────────────────────────────────────────────────

describe('Batch 35 — Dependabot', () => {
  const src = read('.github/dependabot.yml');

  it('exists', () => {
    expect(src.length).toBeGreaterThan(100);
  });

  it('has version 2', () => {
    expect(src).toContain('version: 2');
  });

  it('configures npm ecosystem', () => {
    expect(src).toContain('package-ecosystem: npm');
  });

  it('configures github-actions ecosystem', () => {
    expect(src).toContain('package-ecosystem: github-actions');
  });

  it('configures docker-compose ecosystem', () => {
    expect(src).toContain('package-ecosystem: docker-compose');
  });

  it('uses Bucharest timezone', () => {
    expect(src).toContain('Europe/Bucharest');
  });

  it('groups typescript dependencies', () => {
    expect(src).toContain('typescript:');
    expect(src).toContain('"typescript"');
  });

  it('groups testing dependencies', () => {
    expect(src).toContain('testing:');
    expect(src).toContain('"jest"');
  });

  it('has security label', () => {
    expect(src).toContain('"security"');
  });
});

// ── Branch strategy doc ───────────────────────────────────────────────────

describe('Batch 35 — Argentum branch strategy', () => {
  const src = read('docs/release/argentum-branch-strategy.md');

  it('exists', () => {
    expect(src.length).toBeGreaterThan(500);
  });

  it('explains dual-branch model', () => {
    expect(src).toContain('argentum');
    expect(src).toContain('Private');
    expect(src).toContain('sven');
    expect(src).toContain('Public');
  });

  it('lists private services', () => {
    expect(src).toContain('sven-treasury');
    expect(src).toContain('sven-marketplace');
    expect(src).toContain('sven-eidolon');
  });

  it('lists private skill categories', () => {
    expect(src).toContain('skills/trading/');
    expect(src).toContain('skills/autonomous-economy/');
  });

  it('lists public components', () => {
    expect(src).toContain('Gateway API');
    expect(src).toContain('Agent Runtime');
    expect(src).toContain('channel adapters');
    expect(src).toContain('RAG pipeline');
  });

  it('describes git archive workflow', () => {
    expect(src).toContain('git archive');
    expect(src).toContain('export-ignore');
  });

  it('has release checklist', () => {
    expect(src).toContain('Release checklist');
    expect(src).toContain('CHANGELOG');
    expect(src).toContain('Dependabot');
  });
});

// ── Public stripping manifest ─────────────────────────────────────────────

describe('Batch 35 — Public stripping manifest', () => {
  const src = read('docs/release/public-stripping-manifest.md');

  it('exists', () => {
    expect(src.length).toBeGreaterThan(500);
  });

  it('lists private services', () => {
    expect(src).toContain('services/sven-treasury/');
    expect(src).toContain('services/sven-marketplace/');
    expect(src).toContain('services/sven-eidolon/');
  });

  it('lists private skill directories', () => {
    expect(src).toContain('skills/trading/');
    expect(src).toContain('skills/autonomous-economy/');
  });

  it('lists all 15 private shared type files', () => {
    const sharedTypes = [
      'marketplace.ts', 'treasury.ts', 'eidolon.ts', 'misiuni.ts',
      'xlvii-merch.ts', 'publishing-pipeline.ts', 'social-media.ts',
      'llm-council.ts', 'persistent-memory.ts', 'model-fleet.ts',
      'asi-evolve.ts', 'skill-registry.ts', 'video-content.ts',
      'agent-avatars.ts', 'micro-training.ts',
    ];
    for (const f of sharedTypes) {
      expect(src).toContain(f);
    }
  });

  it('lists private migrations', () => {
    expect(src).toContain('20260422120000_marketplace_tasks_tokens_goals.sql');
    expect(src).toContain('20260508120000_micro_training.sql');
  });

  it('documents index.ts sanitization', () => {
    expect(src).toContain('index.ts sanitization');
    expect(src).toContain("export * from './marketplace.js'");
  });

  it('provides verification commands', () => {
    expect(src).toContain('Verification');
    expect(src).toContain('git ls-files');
    expect(src).toContain('LEAK DETECTED');
  });
});

// ── Existing community files ──────────────────────────────────────────────

describe('Batch 35 — Community files', () => {
  it('CONTRIBUTING.md exists', () => {
    expect(exists('CONTRIBUTING.md')).toBe(true);
  });

  it('CODE_OF_CONDUCT.md exists', () => {
    expect(exists('CODE_OF_CONDUCT.md')).toBe(true);
  });

  it('SECURITY.md exists', () => {
    expect(exists('SECURITY.md')).toBe(true);
  });

  it('SUPPORT.md exists', () => {
    expect(exists('SUPPORT.md')).toBe(true);
  });

  it('LICENSE exists', () => {
    expect(exists('LICENSE')).toBe(true);
  });

  it('RELEASE.md exists', () => {
    expect(exists('RELEASE.md')).toBe(true);
  });

  it('CHANGELOG.md exists', () => {
    expect(exists('CHANGELOG.md')).toBe(true);
  });

  it('MAINTAINERS.md exists', () => {
    expect(exists('MAINTAINERS.md')).toBe(true);
  });

  it('PR template exists', () => {
    expect(exists('.github/pull_request_template.md')).toBe(true);
  });
});

// ── CI/CD Workflows ───────────────────────────────────────────────────────

describe('Batch 35 — CI/CD workflows', () => {
  const workflowDir = path.join(ROOT, '.github', 'workflows');

  it('has deployment pipeline', () => {
    expect(exists('.github/workflows/deployment-pipeline.yml')).toBe(true);
  });

  it('has security baseline', () => {
    expect(exists('.github/workflows/security-baseline.yml')).toBe(true);
  });

  it('has flutter CI', () => {
    expect(exists('.github/workflows/flutter.yml')).toBe(true);
  });

  it('has parity e2e', () => {
    expect(exists('.github/workflows/parity-e2e.yml')).toBe(true);
  });

  it('has release status', () => {
    expect(exists('.github/workflows/release-status.yml')).toBe(true);
  });

  it('has at least 20 workflow files', () => {
    const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));
    expect(files.length).toBeGreaterThanOrEqual(20);
  });
});

// ── Overall readiness ─────────────────────────────────────────────────────

describe('Batch 35 — Release readiness', () => {
  it('.gitattributes covers all 17 private migrations', () => {
    const ga = read('.gitattributes');
    const migrationLines = ga.split('\n').filter(l =>
      l.includes('migrations/') && l.includes('argentum-private')
    );
    expect(migrationLines.length).toBe(17);
  });

  it('.gitattributes covers all 15 private shared type files', () => {
    const ga = read('.gitattributes');
    const sharedLines = ga.split('\n').filter(l =>
      l.includes('packages/shared/src/') && l.includes('argentum-private')
    );
    expect(sharedLines.length).toBe(15);
  });

  it('.gitattributes covers 20 batch test patterns', () => {
    const ga = read('.gitattributes');
    const testLines = ga.split('\n').filter(l =>
      l.includes('batch') && l.includes('.test.ts') && l.includes('argentum-private')
    );
    expect(testLines.length).toBe(20);
  });

  it('all 7 new Batch 35 files exist', () => {
    const files = [
      '.gitattributes',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      '.github/ISSUE_TEMPLATE/feature_request.yml',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.github/dependabot.yml',
      'docs/release/argentum-branch-strategy.md',
      'docs/release/public-stripping-manifest.md',
    ];
    for (const f of files) {
      expect(exists(f)).toBe(true);
    }
  });
});
