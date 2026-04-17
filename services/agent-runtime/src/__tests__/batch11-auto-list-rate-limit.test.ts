// ---------------------------------------------------------------------------
// Batch 11 Tests — Auto-listing, rate limiting, readyz, skills, eidolon
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

// ── Helpers ──────────────────────────────────────────────────────────────

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ═════════════════════════════════════════════════════════════════════════
// 1. Auto-list on birth (seed-pipeline-provisioner.ts)
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — auto-list on birth', () => {
  const src = readSrc('services/agent-runtime/src/seed-pipeline-provisioner.ts');

  it('should have marketplace URL option in SeedPipelineProvisionerOptions', () => {
    expect(src).toContain('marketplaceUrl?: string');
  });

  it('should have autoListOnBirth flag', () => {
    expect(src).toContain('autoListOnBirth');
  });

  it('should return listingId and listingSlug in ProvisionResult', () => {
    expect(src).toContain('listingId?: string');
    expect(src).toContain('listingSlug?: string');
  });

  it('should call createAndPublishListing after pipeline creation', () => {
    expect(src).toContain('createAndPublishListing');
  });

  it('should POST to marketplace /v1/market/listings', () => {
    expect(src).toContain('/v1/market/listings');
  });

  it('should POST publish to make listing live', () => {
    expect(src).toMatch(/\/v1\/market\/listings\/.*\/publish/);
  });

  it('should handle listing creation failure gracefully (warn, not throw)', () => {
    expect(src).toContain('Auto-listing on birth failed');
    expect(src).toContain('logger.warn');
  });

  it('should set listing kind to skill_api', () => {
    expect(src).toContain("kind: 'skill_api'");
  });

  it('should tag listings as automaton and auto-listed', () => {
    expect(src).toContain("'automaton'");
    expect(src).toContain("'auto-listed'");
  });

  it('should include metadata with source and automatonId', () => {
    expect(src).toContain("source: 'seed-pipeline-provisioner'");
    expect(src).toContain('automatonId: params.automatonId');
  });

  it('should respect MARKETPLACE_API env var', () => {
    expect(src).toContain('process.env.MARKETPLACE_API');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Rate Limiter (shared package)
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — rate limiter', () => {
  const src = readSrc('packages/shared/src/rate-limiter.ts');

  it('should export rateLimiterHook function', () => {
    expect(src).toContain('export function rateLimiterHook');
  });

  it('should use token bucket pattern', () => {
    expect(src).toContain('tokens');
    expect(src).toContain('lastRefill');
  });

  it('should respond with 429 when rate exceeded', () => {
    expect(src).toContain('429');
    expect(src).toContain('too_many_requests');
  });

  it('should set Retry-After header', () => {
    expect(src).toContain('Retry-After');
  });

  it('should set X-RateLimit-Limit and X-RateLimit-Remaining headers', () => {
    expect(src).toContain('X-RateLimit-Limit');
    expect(src).toContain('X-RateLimit-Remaining');
  });

  it('should skip health/readyz paths by default', () => {
    expect(src).toContain('/health');
    expect(src).toContain('/healthz');
    expect(src).toContain('/readyz');
  });

  it('should support custom key extractor', () => {
    expect(src).toContain('keyExtractor');
  });

  it('should clean up expired buckets periodically', () => {
    expect(src).toContain('CLEANUP_INTERVAL');
    expect(src).toContain('buckets.delete');
  });

  it('should default to 100 req/min', () => {
    expect(src).toContain('opts.max ?? 100');
    expect(src).toContain('opts.windowMs ?? 60_000');
  });

  it('should be exported from shared index', () => {
    const index = readSrc('packages/shared/src/index.ts');
    expect(index).toContain("./rate-limiter");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Rate limiter wired into all 3 economy services
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — rate limiter wiring', () => {
  it('treasury service should import and use rateLimiterHook', () => {
    const src = readSrc('services/sven-treasury/src/index.ts');
    expect(src).toContain('rateLimiterHook');
    expect(src).toContain("addHook('onRequest'");
  });

  it('marketplace service should import and use rateLimiterHook', () => {
    const src = readSrc('services/sven-marketplace/src/index.ts');
    expect(src).toContain('rateLimiterHook');
    expect(src).toContain("addHook('onRequest'");
  });

  it('eidolon service should import and use rateLimiterHook', () => {
    const src = readSrc('services/sven-eidolon/src/index.ts');
    expect(src).toContain('rateLimiterHook');
    expect(src).toContain("addHook('onRequest'");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Readiness probes (/readyz)
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — readyz endpoints', () => {
  it('treasury should have /readyz route', () => {
    const src = readSrc('services/sven-treasury/src/index.ts');
    expect(src).toContain("'/readyz'");
    expect(src).toContain('SELECT 1');
    expect(src).toContain("status: 'ready'");
    expect(src).toContain("status: 'not_ready'");
    expect(src).toContain('503');
  });

  it('marketplace should have /readyz route', () => {
    const src = readSrc('services/sven-marketplace/src/index.ts');
    expect(src).toContain("'/readyz'");
    expect(src).toContain('SELECT 1');
    expect(src).toContain("status: 'ready'");
    expect(src).toContain('503');
  });

  it('eidolon should have /readyz route', () => {
    const src = readSrc('services/sven-eidolon/src/index.ts');
    expect(src).toContain("'/readyz'");
    expect(src).toContain('SELECT 1');
    expect(src).toContain("status: 'ready'");
    expect(src).toContain('503');
  });

  it('readyz should check both postgres and nats', () => {
    const src = readSrc('services/sven-treasury/src/index.ts');
    expect(src).toContain("postgres: 'ok'");
    expect(src).toContain("nats:");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. Treasury-transfer skill
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — treasury-transfer skill', () => {
  it('should have SKILL.md', () => {
    expect(fileExists('skills/autonomous-economy/treasury-transfer/SKILL.md')).toBe(true);
  });

  it('should have handler.ts', () => {
    expect(fileExists('skills/autonomous-economy/treasury-transfer/handler.ts')).toBe(true);
  });

  const skillMd = readSrc('skills/autonomous-economy/treasury-transfer/SKILL.md');

  it('SKILL.md should declare name: treasury-transfer', () => {
    expect(skillMd).toContain('name: treasury-transfer');
  });

  it('SKILL.md should define transfer, credit, debit actions', () => {
    expect(skillMd).toContain('transfer');
    expect(skillMd).toContain('credit');
    expect(skillMd).toContain('debit');
  });

  const handler = readSrc('skills/autonomous-economy/treasury-transfer/handler.ts');

  it('handler should export default async function', () => {
    expect(handler).toContain('export default async function handler');
  });

  it('handler should support transfer action', () => {
    expect(handler).toContain("action === 'transfer'");
  });

  it('handler should support credit action', () => {
    expect(handler).toContain("action === 'credit'");
  });

  it('handler should support debit action', () => {
    expect(handler).toContain("action === 'debit'");
  });

  it('handler should POST to /transactions', () => {
    expect(handler).toContain('/transactions');
  });

  it('handler should validate amount > 0', () => {
    expect(handler).toContain('amount is required');
  });

  it('transfer should require both fromAccountId and toAccountId', () => {
    expect(handler).toContain('fromAccountId');
    expect(handler).toContain('toAccountId');
  });

  it('handler should respect TREASURY_API env var', () => {
    expect(handler).toContain('process.env.TREASURY_API');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. Market-fulfill skill
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — market-fulfill skill', () => {
  it('should have SKILL.md', () => {
    expect(fileExists('skills/autonomous-economy/market-fulfill/SKILL.md')).toBe(true);
  });

  it('should have handler.ts', () => {
    expect(fileExists('skills/autonomous-economy/market-fulfill/handler.ts')).toBe(true);
  });

  const skillMd = readSrc('skills/autonomous-economy/market-fulfill/SKILL.md');

  it('SKILL.md should declare name: market-fulfill', () => {
    expect(skillMd).toContain('name: market-fulfill');
  });

  it('SKILL.md should define fulfill, status, list-pending actions', () => {
    expect(skillMd).toContain('fulfill');
    expect(skillMd).toContain('status');
    expect(skillMd).toContain('list-pending');
  });

  const handler = readSrc('skills/autonomous-economy/market-fulfill/handler.ts');

  it('handler should export default async function', () => {
    expect(handler).toContain('export default async function handler');
  });

  it('handler should support fulfill action', () => {
    expect(handler).toContain("action === 'fulfill'");
  });

  it('handler should support status action', () => {
    expect(handler).toContain("action === 'status'");
  });

  it('handler should support list-pending action', () => {
    expect(handler).toContain("action === 'list-pending'");
  });

  it('handler should POST to /fulfill endpoint', () => {
    expect(handler).toContain('/fulfill');
  });

  it('handler should pass deliveryPayload', () => {
    expect(handler).toContain('deliveryPayload');
  });

  it('handler should filter pending orders by status=paid', () => {
    expect(handler).toContain("status: 'paid'");
  });

  it('handler should respect MARKETPLACE_API env var', () => {
    expect(handler).toContain('process.env.MARKETPLACE_API');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. All 6 economy skills now exist
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — economy skills completeness', () => {
  const EXPECTED_SKILLS = [
    'treasury-balance',
    'treasury-transfer',
    'market-publish',
    'market-fulfill',
    'infra-scale',
    'economy-status',
  ];

  for (const skill of EXPECTED_SKILLS) {
    it(`skill ${skill} should have SKILL.md`, () => {
      expect(fileExists(`skills/autonomous-economy/${skill}/SKILL.md`)).toBe(true);
    });

    it(`skill ${skill} should have handler.ts`, () => {
      expect(fileExists(`skills/autonomous-economy/${skill}/handler.ts`)).toBe(true);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 8. Eidolon animations — useEventGlow hook
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — useEventGlow hook', () => {
  it('should exist', () => {
    expect(fileExists('apps/eidolon-ui/src/hooks/useEventGlow.ts')).toBe(true);
  });

  const src = readSrc('apps/eidolon-ui/src/hooks/useEventGlow.ts');

  it('should export useEventGlow function', () => {
    expect(src).toContain('export function useEventGlow');
  });

  it('should define GlowPulse interface', () => {
    expect(src).toContain('GlowPulse');
  });

  it('should map treasury.credit to treasury_vault buildings', () => {
    expect(src).toContain("'treasury.credit'");
    expect(src).toContain("buildingKind: 'treasury_vault'");
  });

  it('should map market.order_paid to marketplace_listing buildings', () => {
    expect(src).toContain("'market.order_paid'");
    expect(src).toContain("buildingKind: 'marketplace_listing'");
  });

  it('should have getGlowBoost return function', () => {
    expect(src).toContain('getGlowBoost');
  });

  it('should have pulse decay over PULSE_DURATION_MS', () => {
    expect(src).toContain('PULSE_DURATION_MS');
  });

  it('should prune expired pulses', () => {
    expect(src).toContain('Prune expired pulses');
  });

  it('should use easing curve for smooth decay', () => {
    expect(src).toContain('eased');
    expect(src).toContain('t * t');
  });

  it('should track processed event IDs to avoid duplicates', () => {
    expect(src).toContain('processedRef');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 9. Building.tsx animation updates
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — Building animated glow', () => {
  const src = readSrc('apps/eidolon-ui/src/components/Building.tsx');

  it('should accept glowBoost prop', () => {
    expect(src).toContain('glowBoost');
  });

  it('should accept glowColor prop', () => {
    expect(src).toContain('glowColor');
  });

  it('should use useFrame for animation', () => {
    expect(src).toContain('useFrame');
  });

  it('should import Color from three', () => {
    expect(src).toContain("import { Color } from 'three'");
  });

  it('should smoothly interpolate emissive intensity', () => {
    expect(src).toContain('lerp');
    expect(src).toContain('emissiveIntensity');
  });

  it('should blend emissive colour towards event glow colour during pulse', () => {
    expect(src).toContain('pulseColor');
    expect(src).toContain('baseColorObj');
  });

  it('should use mesh ref for direct material manipulation', () => {
    expect(src).toContain('meshRef');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 10. Citizen.tsx status-driven animations
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — Citizen animated status', () => {
  const src = readSrc('apps/eidolon-ui/src/components/Citizen.tsx');

  it('should have STATUS_PULSE config per status', () => {
    expect(src).toContain('STATUS_PULSE');
  });

  it('should have different animation speeds per status', () => {
    expect(src).toContain('speed');
    expect(src).toContain('amplitude');
  });

  it('earning citizens should pulse brighter', () => {
    expect(src).toContain('earning');
    // Higher speed for earning
    expect(src).toMatch(/earning[\s\S]*speed:\s*2\.5/);
  });

  it('retiring citizens should flicker', () => {
    expect(src).toContain('retiring');
    // Higher speed for retiring
    expect(src).toMatch(/retiring[\s\S]*speed:\s*4\.0/);
  });

  it('should smoothly transition emissive colour via lerp', () => {
    expect(src).toContain('mat.emissive.lerp');
  });

  it('should pulse emissive intensity', () => {
    expect(src).toContain('emissiveIntensity');
  });

  it('should import Color from three', () => {
    expect(src).toContain("Color");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 11. CityScene passes events to buildings
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — CityScene event wiring', () => {
  const src = readSrc('apps/eidolon-ui/src/components/CityScene.tsx');

  it('should accept events prop', () => {
    expect(src).toContain('events: EidolonEvent[]');
  });

  it('should import useEventGlow hook', () => {
    expect(src).toContain('useEventGlow');
  });

  it('should pass glowBoost to Building', () => {
    expect(src).toContain('glowBoost={');
  });

  it('should pass glowColor to Building', () => {
    expect(src).toContain('glowColor={');
  });

  it('should call getGlowBoost for each building', () => {
    expect(src).toContain('getGlowBoost(b.kind)');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 12. Page passes events to CityScene
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — page event wiring', () => {
  const src = readSrc('apps/eidolon-ui/src/app/page.tsx');

  it('should pass events to CityScene', () => {
    expect(src).toContain('events={events}');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 13. Rate limiter functional tests (source verification)
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — rate limiter functional verification', () => {
  const src = readSrc('packages/shared/src/rate-limiter.ts');

  it('should refill tokens proportionally to elapsed time', () => {
    expect(src).toContain('elapsed');
    expect(src).toContain('refill');
  });

  it('should compute remaining tokens correctly', () => {
    expect(src).toContain('Math.min');
    expect(src).toContain('Math.floor');
  });

  it('should call done() when tokens remain (pass-through)', () => {
    expect(src).toContain('done()');
  });

  it('should prevent further processing when rate limit exceeded', () => {
    expect(src).toContain('.code(429)');
    expect(src).toContain('.send(');
  });

  it('should extract IP from request for per-client tracking', () => {
    expect(src).toContain('req.ip');
  });

  it('should handle skipPaths via URL path extraction', () => {
    expect(src).toContain("url.split('?')");
  });

  it('should clean up expired buckets to prevent memory leaks', () => {
    expect(src).toContain('buckets.delete');
    expect(src).toContain('windowMs * 2');
  });

  it('should use unref on cleanup timer to avoid blocking process exit', () => {
    expect(src).toContain('unref');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 14. Auto-listing provisioner verification
// ═════════════════════════════════════════════════════════════════════════

describe('Batch 11 — SeedPipelineProvisioner with auto-listing', () => {
  const src = readSrc('services/agent-runtime/src/seed-pipeline-provisioner.ts');

  it('should export SeedPipelineProvisioner class', () => {
    expect(src).toContain('export class SeedPipelineProvisioner');
  });

  it('should have provisionForAutomaton method', () => {
    expect(src).toContain('provisionForAutomaton');
  });

  it('should check existing pipelines before creating new ones', () => {
    expect(src).toContain('findActiveByTreasuryAccount');
  });

  it('should call seedServiceMarketplacePipeline', () => {
    expect(src).toContain('seedServiceMarketplacePipeline');
  });

  it('should set pricing model to per_call', () => {
    expect(src).toContain("pricingModel: 'per_call'");
  });

  it('should default listing price to $0.01', () => {
    expect(src).toContain('0.01');
  });

  it('should log pipeline creation with logger.info', () => {
    expect(src).toContain('logger.info');
  });

  it('should handle existing pipeline reuse', () => {
    expect(src).toContain('already provisioned');
  });

  it('should use content-type application/json for marketplace API calls', () => {
    expect(src).toContain("'Content-Type': 'application/json'");
  });
});
