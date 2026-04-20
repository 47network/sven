# Public Stripping Manifest

## Purpose

This document lists every file and directory that must be **removed** when
creating the public `sven` branch from the private `argentum` branch.

All entries below correspond to paths marked `argentum-private` in `.gitattributes`.

---

## Private services (full directories)

| Path | Reason |
|------|--------|
| `services/sven-treasury/` | 47Token wallet, crypto payment rails, treasury API |
| `services/sven-marketplace/` | Autonomous economy task execution, pricing, listings |
| `services/sven-eidolon/` | 3D world simulation, agent parcels, avatars, 47Token shops |
| `services/marketing-intel/` | Competitive intelligence, market research |

## Private skills (full directories)

| Path | Reason |
|------|--------|
| `skills/trading/` | 10 trading skills (backtest, chart, market-data, news, order, portfolio, predictions, risk, strategy, tool-builder) |
| `skills/autonomous-economy/` | 30+ economy skills (book publishing, social media, misiuni, XLVII, ASI-evolve, fleet, council, memory, etc.) |

## Private shared types

| Path | Reason |
|------|--------|
| `packages/shared/src/marketplace.ts` | Marketplace type definitions |
| `packages/shared/src/treasury.ts` | Treasury/wallet type definitions |
| `packages/shared/src/eidolon.ts` | Eidolon world type definitions |
| `packages/shared/src/misiuni.ts` | Misiuni platform types |
| `packages/shared/src/xlvii-merch.ts` | XLVII merch types |
| `packages/shared/src/publishing-pipeline.ts` | Publishing pipeline types |
| `packages/shared/src/social-media.ts` | Social media types |
| `packages/shared/src/llm-council.ts` | LLM council types |
| `packages/shared/src/persistent-memory.ts` | Persistent memory types |
| `packages/shared/src/model-fleet.ts` | Model fleet types |
| `packages/shared/src/asi-evolve.ts` | ASI-Evolve types |
| `packages/shared/src/skill-registry.ts` | Skill registry types |
| `packages/shared/src/video-content.ts` | Video content types |
| `packages/shared/src/agent-avatars.ts` | Agent avatars types |
| `packages/shared/src/micro-training.ts` | Micro-training types |

## Private migrations

| Path | Reason |
|------|--------|
| `20260422120000_marketplace_tasks_tokens_goals.sql` | Economy tables |
| `20260423120000_agent_business_spaces.sql` | Business space tables |
| `20260424120000_agent_crews_oversight.sql` | Crew management tables |
| `20260425120000_publishing_pipeline.sql` | Publishing tables |
| `20260426120000_eidolon_world_evolution.sql` | Eidolon world tables |
| `20260427060000_misiuni_platform.sql` | Misiuni tables |
| `20260427080000_publishing_v2.sql` | Publishing v2 tables |
| `20260429120000_social_media.sql` | Social media tables |
| `20260430120000_xlvii_merch.sql` | XLVII merch tables |
| `20260501120000_llm_council.sql` | LLM council tables |
| `20260502120000_persistent_memory.sql` | Memory tables |
| `20260503120000_model_fleet.sql` | Model fleet tables |
| `20260504120000_asi_evolve.sql` | ASI-Evolve tables |
| `20260505120000_skill_registry.sql` | Skill registry tables |
| `20260506120000_video_content.sql` | Video content tables |
| `20260507120000_agent_avatars.sql` | Agent avatars tables |
| `20260508120000_micro_training.sql` | Micro-training tables |

## Private tests

| Pattern | Reason |
|---------|--------|
| `batch7-*.test.ts` through `batch34-*.test.ts` | Economy batch test suites |

## Private config

| Path | Reason |
|------|--------|
| `docker-compose.profiles.yml` | Economy service profiles |

---

## index.ts sanitization

When creating the public branch, `packages/shared/src/index.ts` must have
all economy-related re-exports removed. The following lines must be deleted:

```typescript
// REMOVE these lines for public branch:
export * from './marketplace.js';
export * from './treasury.js';
export * from './eidolon.js';
export * from './misiuni.js';
export * from './xlvii-merch.js';
export * from './publishing-pipeline.js';
export * from './social-media.js';
export * from './llm-council.js';
export * from './persistent-memory.js';
export * from './model-fleet.js';
export * from './asi-evolve.js';
export * from './skill-registry.js';
export * from './video-content.js';
export * from './agent-avatars.js';
export * from './micro-training.js';
```

---

## Verification

After stripping, run:

```bash
# Ensure no private files remain
git ls-files | grep -E '(treasury|marketplace|eidolon|misiuni|xlvii|trading)' && echo "LEAK DETECTED" || echo "Clean"

# Ensure no argentum-private attributes reference live files
git check-attr argentum-private -- $(git ls-files) | grep -v 'unspecified' && echo "Private files present" || echo "Clean"

# Ensure shared/index.ts has no economy exports
grep -c 'marketplace\|treasury\|eidolon\|misiuni\|xlvii' packages/shared/src/index.ts && echo "LEAK" || echo "Clean"
```
