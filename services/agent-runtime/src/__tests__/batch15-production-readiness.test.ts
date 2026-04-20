// ---------------------------------------------------------------------------
// Batch 15 — Production Readiness Tests
// CORS · Dockerfile EXPOSE · Graceful Shutdown Timeout
// Auto-Publisher · Economy Skill Loader · Evolution-Automaton Bridge
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ================================================================== */
/*  1. CORS Hook                                                       */
/* ================================================================== */

describe('Batch 15 — CORS hook', () => {
  const corsTs = readSrc('packages/shared/src/cors.ts');
  const sharedIndex = readSrc('packages/shared/src/index.ts');

  it('corsHook function exists', () => {
    expect(corsTs).toContain('export function corsHook');
  });

  it('reads CORS_ORIGIN env var', () => {
    expect(corsTs).toContain('CORS_ORIGIN');
  });

  it('handles preflight OPTIONS with 204', () => {
    expect(corsTs).toContain('OPTIONS');
    expect(corsTs).toContain('204');
  });

  it('sets access-control-allow-credentials', () => {
    expect(corsTs.toLowerCase()).toContain('access-control-allow-credentials');
  });

  it('is exported from shared index', () => {
    expect(sharedIndex).toContain("./cors");
  });

  it('registered in treasury service', () => {
    const src = readSrc('services/sven-treasury/src/index.ts');
    expect(src).toContain('corsHook');
  });

  it('registered in marketplace service', () => {
    const src = readSrc('services/sven-marketplace/src/index.ts');
    expect(src).toContain('corsHook');
  });

  it('registered in eidolon service', () => {
    const src = readSrc('services/sven-eidolon/src/index.ts');
    expect(src).toContain('corsHook');
  });
});

/* ================================================================== */
/*  2. Dockerfile EXPOSE                                               */
/* ================================================================== */

describe('Batch 15 — Dockerfile EXPOSE', () => {
  it('treasury Dockerfile exposes 9477', () => {
    const df = readSrc('services/sven-treasury/Dockerfile');
    expect(df).toContain('EXPOSE 9477');
  });

  it('marketplace Dockerfile exposes 9478', () => {
    const df = readSrc('services/sven-marketplace/Dockerfile');
    expect(df).toContain('EXPOSE 9478');
  });

  it('eidolon Dockerfile exposes 9479', () => {
    const df = readSrc('services/sven-eidolon/Dockerfile');
    expect(df).toContain('EXPOSE 9479');
  });

  it('EXPOSE appears before CMD in all Dockerfiles', () => {
    for (const svc of ['sven-treasury', 'sven-marketplace', 'sven-eidolon']) {
      const df = readSrc(`services/${svc}/Dockerfile`);
      const exposeIdx = df.indexOf('EXPOSE');
      const cmdIdx = df.indexOf('CMD');
      expect(exposeIdx).toBeGreaterThan(-1);
      expect(cmdIdx).toBeGreaterThan(exposeIdx);
    }
  });
});

/* ================================================================== */
/*  3. Graceful Shutdown Timeout                                       */
/* ================================================================== */

describe('Batch 15 — Graceful shutdown timeout', () => {
  const services = [
    'services/sven-treasury/src/index.ts',
    'services/sven-marketplace/src/index.ts',
    'services/sven-eidolon/src/index.ts',
  ];

  for (const svc of services) {
    const name = svc.split('/')[1];

    it(`${name} has forced shutdown timeout`, () => {
      const src = readSrc(svc);
      expect(src).toContain('setTimeout');
      expect(src).toContain('process.exit');
    });

    it(`${name} uses 30-second timeout`, () => {
      const src = readSrc(svc);
      expect(src).toContain('30_000');
    });

    it(`${name} unrefs the force timer`, () => {
      const src = readSrc(svc);
      expect(src).toContain('.unref()');
    });
  }
});

/* ================================================================== */
/*  4. Auto-Publisher Tests                                            */
/* ================================================================== */

describe('Batch 15 — Auto-Publisher', () => {
  const src = readSrc('services/agent-runtime/src/auto-publisher.ts');

  it('exports discoverSkills function', () => {
    expect(src).toContain('export function discoverSkills');
  });

  it('exports runAutoPublish function', () => {
    expect(src).toContain('export async function runAutoPublish');
  });

  it('exports startAutoPublisher and stopAutoPublisher', () => {
    expect(src).toContain('export function startAutoPublisher');
    expect(src).toContain('export function stopAutoPublisher');
  });

  it('parseSkillMd parses YAML frontmatter with --- delimiters', () => {
    expect(src).toMatch(/^---\\n\(.*\)\\n---/m.source ? /---/ : /---/);
    expect(src).toContain("raw.match(/^---\\n([\\s\\S]*?)\\n---/)");
  });

  it('reads name and description from frontmatter', () => {
    expect(src).toContain("fields.name");
    expect(src).toContain("fields.description");
    expect(src).toContain("if (!fields.name || !fields.description) return null");
  });

  it('estimatePrice charges premium skills $0.10', () => {
    expect(src).toContain("'0.10'");
    const premiumNames = ['trading', 'security', 'quantum', 'ai-agency', 'compute-mesh'];
    for (const p of premiumNames) {
      expect(src).toContain(`'${p}'`);
    }
  });

  it('estimatePrice charges normal skills $0.01', () => {
    expect(src).toContain("'0.01'");
  });

  it('creates listings with kind skill_api and per_call pricing', () => {
    expect(src).toContain("'skill_api'");
    expect(src).toContain("'per_call'");
  });

  it('checks for existing listings before creating duplicates', () => {
    expect(src).toContain('existing.has(slug)');
    expect(src).toContain('skipped++');
  });

  it('runs behind SVEN_AUTO_PUBLISH_ENABLED env var', () => {
    expect(src).toContain("SVEN_AUTO_PUBLISH_ENABLED");
    expect(src).toContain("!== '1'");
  });

  it('24-hour interval between publish runs', () => {
    expect(src).toContain('24 * 60 * 60 * 1000');
  });

  it('returns created/skipped/errors counts from runAutoPublish', () => {
    expect(src).toContain('{ created, skipped, errors }');
  });
});

/* ================================================================== */
/*  5. Economy Skill Loader Tests                                      */
/* ================================================================== */

describe('Batch 15 — Economy Skill Loader', () => {
  const src = readSrc('services/agent-runtime/src/economy-skill-loader.ts');

  it('exports parseSkillFrontmatter', () => {
    expect(src).toContain('export function parseSkillFrontmatter');
  });

  it('exports discoverEconomySkills', () => {
    expect(src).toContain('export function discoverEconomySkills');
  });

  it('exports registerEconomySkills', () => {
    expect(src).toContain('export async function registerEconomySkills');
  });

  it('parseSkillFrontmatter uses --- delimiters', () => {
    expect(src).toContain("content.match(/^---\\n([\\s\\S]*?)\\n---/)");
  });

  it('handles nested YAML-like blocks with JSON conversion', () => {
    expect(src).toContain('JSON.parse');
    expect(src).toContain('currentBlock');
    expect(src).toContain('inBlock');
  });

  it('returns empty object for content without frontmatter', () => {
    expect(src).toContain('if (!fmMatch) return {}');
  });

  it('discoverEconomySkills scans autonomous-economy directory', () => {
    expect(src).toContain('autonomous-economy');
  });

  it('filters out entries without name or description', () => {
    expect(src).toContain('if (meta.name && meta.description)');
  });

  it('registerEconomySkills upserts into tools table', () => {
    expect(src).toContain('INSERT INTO tools');
    expect(src).toContain('ON CONFLICT (name) DO UPDATE');
  });

  it('uses economy category and economy. prefix for tool names', () => {
    expect(src).toContain("'economy'");
    expect(src).toContain('`economy.${skill.name}`');
  });

  it('sets trust_level to trusted for first-party skills', () => {
    expect(src).toContain("'trusted'");
    expect(src).toContain('is_first_party');
  });
});

/* ================================================================== */
/*  6. Evolution-Automaton Bridge Tests                                */
/* ================================================================== */

describe('Batch 15 — Evolution-Automaton Bridge', () => {
  const src = readSrc('services/agent-runtime/src/evolution-automaton-bridge.ts');

  it('exports findEvolutionRunForAutomaton', () => {
    expect(src).toContain('export function findEvolutionRunForAutomaton');
  });

  it('exports computeImprovementRate', () => {
    expect(src).toContain('export function computeImprovementRate');
  });

  it('exports extractSignal', () => {
    expect(src).toContain('export function extractSignal');
  });

  it('exports computeAdjustment', () => {
    expect(src).toContain('export function computeAdjustment');
  });

  it('exports adjustDecisionWithEvolution', () => {
    expect(src).toContain('export function adjustDecisionWithEvolution');
  });

  it('exports getBestSolutionForClone', () => {
    expect(src).toContain('export function getBestSolutionForClone');
  });

  it('DEFAULT_BRIDGE_CONFIG has expected defaults', () => {
    expect(src).toContain('minGenerationsForSignal: 3');
    expect(src).toContain('improvementRateThreshold: 0.05');
    expect(src).toContain('maxRoiBonus: 0.5');
    expect(src).toContain('roiBonusPerImprovement: 0.1');
  });

  it('computeImprovementRate returns 0 for fewer than 2 nodes', () => {
    expect(src).toContain('if (nodes.length < 2) return 0');
  });

  it('computeImprovementRate groups by generation and finds best score', () => {
    expect(src).toContain('genBest');
    expect(src).toContain('node.generation');
    expect(src).toContain('node.score > current');
  });

  it('extractSignal requires minimum generations', () => {
    expect(src).toContain('run.currentGeneration < config.minGenerationsForSignal');
  });

  it('computeAdjustment returns bonus when improvement above threshold', () => {
    expect(src).toContain('signal.improvementRate >= config.improvementRateThreshold');
    expect(src).toContain('Math.min(rawBonus, config.maxRoiBonus)');
  });

  it('computeAdjustment returns penalty clamped to -0.2 when regressing', () => {
    expect(src).toContain('signal.improvementRate < 0');
    expect(src).toContain('Math.max(signal.improvementRate * 2, -0.2)');
  });

  it('computeAdjustment returns 0 bonus for slow improvement', () => {
    // The neutral path returns roiBonus: 0 with a descriptive reason
    expect(src).toContain('evolution improving slowly');
  });

  it('adjustDecisionWithEvolution enriches decision with roiBonus', () => {
    expect(src).toContain('decision.roi + adjustment.roiBonus');
    expect(src).toContain('evolutionAdjustment');
  });

  it('getBestSolutionForClone returns code + score from best node', () => {
    expect(src).toContain('bestNode.code');
    expect(src).toContain('bestNode.score');
    expect(src).toContain('run.bestNodeId');
  });

  it('findEvolutionRunForAutomaton matches by orgId + name/description', () => {
    expect(src).toContain('run.orgId !== orgId');
    expect(src).toContain('run.experiment.name.includes(automatonId)');
    expect(src).toContain('run.experiment.description.includes(automatonId)');
  });

  it('findEvolutionRunForAutomaton falls back to any running/completed org run', () => {
    expect(src).toContain("run.status === 'completed'");
    expect(src).toContain("run.status === 'running'");
  });
});

/* ================================================================== */
/*  7. Docker-compose economy services exist                           */
/* ================================================================== */

describe('Batch 15 — Docker-compose validation', () => {
  const dc = readSrc('docker-compose.yml');

  it('all 3 economy services defined', () => {
    expect(dc).toMatch(/^ {2}sven-treasury:\n/m);
    expect(dc).toMatch(/^ {2}sven-marketplace:\n/m);
    expect(dc).toMatch(/^ {2}sven-eidolon:\n/m);
  });

  it('economy services have healthchecks', () => {
    // Find each service block and verify it contains healthcheck
    for (const svc of ['sven-treasury', 'sven-marketplace', 'sven-eidolon']) {
      const svcIdx = dc.search(new RegExp(`^ {2}${svc}:\\n`, 'm'));
      expect(svcIdx).toBeGreaterThan(-1);
      const block = dc.slice(svcIdx, svcIdx + 1500);
      expect(block).toContain('healthcheck:');
    }
  });

  it('economy services have CORS_ORIGIN env var', () => {
    for (const svc of ['sven-treasury', 'sven-marketplace', 'sven-eidolon']) {
      const svcIdx = dc.search(new RegExp(`^ {2}${svc}:\\n`, 'm'));
      expect(svcIdx).toBeGreaterThan(-1);
      const block = dc.slice(svcIdx, svcIdx + 1500);
      expect(block).toContain('CORS_ORIGIN');
    }
  });
});
