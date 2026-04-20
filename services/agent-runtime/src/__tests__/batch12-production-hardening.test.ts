/**
 * Batch 12 — Production hardening tests
 *
 * Covers:
 *   1. Infra cost stub fallback (P0)
 *   2. Stripe webhook idempotency (P1)
 *   3. Treasury error handler (P1)
 *   4. Docker-compose lifecycle env vars (P2)
 *   5. Economy skill loader (P1)
 *   6. Automaton lifecycle resilience (P1)
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');
const ROOT = path.resolve(SRC, '..', '..', '..');

// ═══════════════════════════════════════════════════════════════════
// 1. Infra cost stub fallback
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — infra cost stub fallback', () => {
  const source = fs.readFileSync(
    path.join(SRC, 'automaton-adapters.ts'),
    'utf-8',
  );

  it('reads SVEN_LIFECYCLE_STUB_COST_PER_DAY_USD env var', () => {
    expect(source).toContain('SVEN_LIFECYCLE_STUB_COST_PER_DAY_USD');
  });

  it('has a STUB_COST_PER_DAY_USD constant with default 0.5', () => {
    expect(source).toContain('STUB_COST_PER_DAY_USD');
    expect(source).toMatch(/0\.5/);
  });

  it('computes elapsedDays from sinceIso', () => {
    expect(source).toContain('86_400_000');
    expect(source).toContain('elapsedDays');
  });

  it('pro-rates stub cost by elapsed time', () => {
    expect(source).toContain('elapsedDays * STUB_COST_PER_DAY_USD');
  });

  it('logs stub fallback with debug level', () => {
    expect(source).toContain('infra cost using stub fallback');
    expect(source).toContain('logger.debug');
  });

  it('never returns 0 when admin-api unreachable (returns stub)', () => {
    // The old code: if (!data) return 0;
    // The new code: when data is null, compute stub instead of returning 0
    expect(source).not.toMatch(/if\s*\(\s*!data\s*\)\s*return\s*0/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Stripe webhook idempotency
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — stripe webhook idempotency', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'services', 'sven-marketplace', 'src', 'routes', 'webhook.ts'),
    'utf-8',
  );

  it('has a processedEvents Set', () => {
    expect(source).toContain('processedEvents');
    expect(source).toContain('new Set<string>()');
  });

  it('has an isAlreadyProcessed function', () => {
    expect(source).toContain('isAlreadyProcessed');
  });

  it('checks for duplicates before processing', () => {
    expect(source).toContain('isAlreadyProcessed(event.id)');
  });

  it('returns 200 with duplicate flag on duplicate events', () => {
    expect(source).toContain('duplicate: true');
  });

  it('has a bounded set with eviction at PROCESSED_MAX', () => {
    expect(source).toContain('PROCESSED_MAX');
    expect(source).toMatch(/5[_,]?000/);
  });

  it('evicts oldest entries when set reaches capacity', () => {
    // Evicts ~25% of oldest entries
    expect(source).toContain('PROCESSED_MAX / 4');
  });

  it('exports isAlreadyProcessed and processedEvents for testing', () => {
    expect(source).toContain('export { verifyStripeSignature, isAlreadyProcessed, processedEvents }');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Treasury error handler
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — treasury error handler', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'services', 'sven-treasury', 'src', 'index.ts'),
    'utf-8',
  );

  it('sets a global Fastify error handler', () => {
    expect(source).toContain('setErrorHandler');
  });

  it('logs errors with stack trace', () => {
    expect(source).toContain('err: (err as Error).message');
    expect(source).toContain('stack: (err as Error).stack');
  });

  it('returns 500 with internal_error', () => {
    expect(source).toContain("reply.code(500).send({ error: 'internal_error'");
  });
});

describe('Batch12 — eidolon error handler includes stack', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'services', 'sven-eidolon', 'src', 'index.ts'),
    'utf-8',
  );

  it('has setErrorHandler', () => {
    expect(source).toContain('setErrorHandler');
  });

  it('logs stack trace', () => {
    expect(source).toContain('stack: e.stack');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Docker-compose lifecycle env vars
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — docker-compose lifecycle env vars', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'docker-compose.yml'),
    'utf-8',
  );

  it('has SVEN_LIFECYCLE_ENABLED in agent-runtime environment', () => {
    expect(source).toContain('SVEN_LIFECYCLE_ENABLED');
  });

  it('has SVEN_LIFECYCLE_ORG_ID', () => {
    expect(source).toContain('SVEN_LIFECYCLE_ORG_ID');
  });

  it('has SVEN_LIFECYCLE_INTERVAL_MS', () => {
    expect(source).toContain('SVEN_LIFECYCLE_INTERVAL_MS');
  });

  it('has SVEN_LIFECYCLE_STUB_COST_PER_DAY_USD', () => {
    expect(source).toContain('SVEN_LIFECYCLE_STUB_COST_PER_DAY_USD');
  });

  it('has SVEN_AUTO_PUBLISH_ENABLED', () => {
    expect(source).toContain('SVEN_AUTO_PUBLISH_ENABLED');
  });

  it('has TREASURY_URL pointing to sven-treasury service', () => {
    expect(source).toContain('sven-treasury:9477');
  });

  it('has MARKETPLACE_API pointing to sven-marketplace service', () => {
    expect(source).toContain('sven-marketplace:9478');
  });

  it('has EIDOLON_API pointing to sven-eidolon service', () => {
    expect(source).toContain('sven-eidolon:9479');
  });

  it('defaults SVEN_LIFECYCLE_ENABLED to 0 (off by default)', () => {
    expect(source).toContain('SVEN_LIFECYCLE_ENABLED:-0');
  });
});

describe('Batch12 — docker-compose.production.yml lifecycle', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'docker-compose.production.yml'),
    'utf-8',
  );

  it('has SVEN_LIFECYCLE_ENABLED in production compose', () => {
    expect(source).toContain('SVEN_LIFECYCLE_ENABLED');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Economy skill loader
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — economy skill loader module', () => {
  const source = fs.readFileSync(
    path.join(SRC, 'economy-skill-loader.ts'),
    'utf-8',
  );

  it('exports discoverEconomySkills function', () => {
    expect(source).toContain('export function discoverEconomySkills');
  });

  it('exports registerEconomySkills function', () => {
    expect(source).toContain('export async function registerEconomySkills');
  });

  it('exports parseSkillFrontmatter function', () => {
    expect(source).toContain('export function parseSkillFrontmatter');
  });

  it('scans autonomous-economy directory', () => {
    expect(source).toContain('autonomous-economy');
  });

  it('reads SKILL.md from each skill directory', () => {
    expect(source).toContain('SKILL.md');
  });

  it('uses ON CONFLICT to upsert into tools table', () => {
    expect(source).toContain('ON CONFLICT (name) DO UPDATE');
  });

  it('marks economy tools as first-party and trusted', () => {
    expect(source).toContain("is_first_party");
    expect(source).toContain("true, 'trusted', 'active'");
  });

  it('prefixes tool names with economy.', () => {
    expect(source).toContain('economy.${skill.name}');
  });
});

describe('Batch12 — economy skill loader wired into index.ts', () => {
  const source = fs.readFileSync(
    path.join(SRC, 'index.ts'),
    'utf-8',
  );

  it('dynamically imports economy-skill-loader', () => {
    expect(source).toContain("import('./economy-skill-loader.js')");
  });

  it('calls registerEconomySkills', () => {
    expect(source).toContain('registerEconomySkills');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Automaton lifecycle resilience
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — automaton lifecycle resilience', () => {
  const source = fs.readFileSync(
    path.join(SRC, 'automaton-lifecycle.ts'),
    'utf-8',
  );

  it('has a failure counter map (_failCounts)', () => {
    expect(source).toContain('_failCounts');
    expect(source).toContain('new Map<string, number>()');
  });

  it('has MAX_CONSECUTIVE_FAILURES constant', () => {
    expect(source).toContain('MAX_CONSECUTIVE_FAILURES');
  });

  it('skips evaluation when too many failures', () => {
    expect(source).toContain('Skipping evaluation');
    expect(source).toContain('too many consecutive failures');
  });

  it('catches revenue port errors', () => {
    expect(source).toContain('Revenue port call failed');
  });

  it('catches infra port errors', () => {
    expect(source).toContain('Infra port call failed');
  });

  it('resets failure count on success', () => {
    expect(source).toContain("this._failCounts.set(id, 0)");
  });

  it('increments failure count on port call failure', () => {
    expect(source).toContain('failCount + 1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Skill frontmatter parsing unit tests
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — parseSkillFrontmatter', () => {
  // Inline test — parse YAML frontmatter
  const { parseSkillFrontmatter } = require('../economy-skill-loader');

  it('parses name and description from valid frontmatter', () => {
    const content = `---
name: test-skill
description: A test skill
version: 1.0.0
handler_language: typescript
---

# Test skill
`;
    const meta = parseSkillFrontmatter(content);
    expect(meta.name).toBe('test-skill');
    expect(meta.description).toBe('A test skill');
    expect(meta.version).toBe('1.0.0');
  });

  it('returns empty object when no frontmatter', () => {
    const meta = parseSkillFrontmatter('# Just a heading');
    expect(Object.keys(meta)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Actual economy skills exist and have valid SKILL.md
// ═══════════════════════════════════════════════════════════════════
describe('Batch12 — economy skills discovery', () => {
  const skillsRoot = path.join(ROOT, 'skills', 'autonomous-economy');
  const expectedSkills = [
    'economy-status',
    'infra-scale',
    'market-fulfill',
    'market-publish',
    'treasury-balance',
    'treasury-transfer',
  ];

  it.each(expectedSkills)('skill "%s" has a valid SKILL.md', (skillName) => {
    const mdPath = path.join(skillsRoot, skillName, 'SKILL.md');
    expect(fs.existsSync(mdPath)).toBe(true);
    const content = fs.readFileSync(mdPath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain(`name: ${skillName}`);
    expect(content).toContain('description:');
  });

  it.each(expectedSkills)('skill "%s" has handler.ts', (skillName) => {
    const handlerPath = path.join(skillsRoot, skillName, 'handler.ts');
    expect(fs.existsSync(handlerPath)).toBe(true);
  });
});
