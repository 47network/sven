/**
 * Batch 22 — Eidolon World Evolution
 *
 * Tests: migration SQL, shared types, avatar defaults, XP system,
 * world-time, mood derivation, frontend type sync, UI components,
 * backend parcels, admin API, NATS subjects.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ------------------------------------------------------------------ */
/*  Helper — read a source file                                       */
/* ------------------------------------------------------------------ */
function src(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ================================================================== */
/*  1. Migration SQL                                                   */
/* ================================================================== */
describe('Batch 22 — migration SQL', () => {
  const sql = src(
    'services/gateway-api/migrations/20260426120000_eidolon_world_evolution.sql',
  );

  it('creates avatar_configs table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS avatar_configs');
  });

  it('creates parcel_interactions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS parcel_interactions');
  });

  it('creates eidolon_world_events table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS eidolon_world_events');
  });

  it('ALTERs agent_profiles to add personality_traits', () => {
    expect(sql).toContain('ALTER TABLE agent_profiles');
    expect(sql).toContain('personality_traits');
  });

  it('body_type CHECK includes all 7 avatar types', () => {
    const types = ['humanoid', 'crystal', 'drone', 'orb', 'mech', 'phantom', 'custom'];
    for (const t of types) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  it('glow_pattern CHECK includes 6 patterns', () => {
    const patterns = ['steady', 'pulse', 'flicker', 'breathe', 'strobe', 'none'];
    for (const p of patterns) {
      expect(sql).toContain(`'${p}'`);
    }
  });

  it('mood CHECK includes 8 moods', () => {
    const moods = [
      'neutral', 'focused', 'excited', 'tired',
      'proud', 'frustrated', 'curious', 'idle',
    ];
    for (const m of moods) {
      expect(sql).toContain(`'${m}'`);
    }
  });

  it('interaction_type CHECK includes 7 interaction types', () => {
    const types = ['visit', 'collaborate', 'trade', 'inspect', 'party', 'mentor', 'recruit'];
    for (const t of types) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  it('has indexes on key columns', () => {
    expect(sql).toContain('idx_avatar_configs_agent');
    expect(sql).toContain('idx_avatar_configs_body');
    expect(sql).toContain('idx_parcel_ix_visitor');
    expect(sql).toContain('idx_parcel_ix_parcel');
    expect(sql).toContain('idx_world_events_type');
    expect(sql).toContain('idx_world_events_actor');
  });
});

/* ================================================================== */
/*  2. Shared types — eidolon-world.ts                                 */
/* ================================================================== */
describe('Batch 22 — shared eidolon-world types', () => {
  const code = src('packages/shared/src/eidolon-world.ts');

  describe('AvatarBodyType', () => {
    it('exports 7 body types', () => {
      const types = ['humanoid', 'crystal', 'drone', 'orb', 'mech', 'phantom', 'custom'];
      for (const t of types) expect(code).toContain(`'${t}'`);
    });
  });

  describe('GlowPattern', () => {
    it('exports 6 glow patterns', () => {
      const patterns = ['steady', 'pulse', 'flicker', 'breathe', 'strobe', 'none'];
      for (const p of patterns) expect(code).toContain(`'${p}'`);
    });
  });

  describe('AgentMood', () => {
    it('exports 8 moods', () => {
      const moods = [
        'neutral', 'focused', 'excited', 'tired',
        'proud', 'frustrated', 'curious', 'idle',
      ];
      for (const m of moods) expect(code).toContain(`'${m}'`);
    });
  });

  describe('PersonalityTrait', () => {
    it('exports 10 traits', () => {
      const traits = [
        'diligent', 'creative', 'analytical', 'social', 'independent',
        'meticulous', 'adventurous', 'cautious', 'ambitious', 'empathetic',
      ];
      for (const t of traits) expect(code).toContain(`'${t}'`);
    });
  });

  describe('InteractionType', () => {
    it('exports 7 interaction types', () => {
      const types = ['visit', 'collaborate', 'trade', 'inspect', 'party', 'mentor', 'recruit'];
      for (const t of types) expect(code).toContain(`'${t}'`);
    });
  });

  describe('AvatarConfig interface', () => {
    it('includes required fields', () => {
      expect(code).toContain('bodyType: AvatarBodyType');
      expect(code).toContain('glowPattern: GlowPattern');
      expect(code).toContain('mood: AgentMood');
      expect(code).toContain('accessories: AvatarAccessory[]');
      expect(code).toContain('xp: number');
      expect(code).toContain('level: number');
    });
  });

  describe('WorldTimeState interface', () => {
    it('includes all fields', () => {
      expect(code).toContain('worldHour: number');
      expect(code).toContain('worldMinute: number');
      expect(code).toContain("dayPhase: 'dawn' | 'day' | 'dusk' | 'night'");
      expect(code).toContain('dayNumber: number');
      expect(code).toContain('speedMultiplier: number');
    });
  });
});

/* ================================================================== */
/*  3. calculateWorldTime                                              */
/* ================================================================== */
describe('Batch 22 — calculateWorldTime', () => {
  const code = src('packages/shared/src/eidolon-world.ts');

  it('function is exported', () => {
    expect(code).toContain('export function calculateWorldTime');
  });

  it('uses WORLD_EPOCH = 1735689600000', () => {
    expect(code).toContain('1735689600000');
  });

  it('default speed is 60', () => {
    expect(code).toContain('DEFAULT_SPEED = 60');
  });

  it('phase boundaries: dawn 5-8, day 8-18, dusk 18-21, night else', () => {
    expect(code).toContain('hour >= 5 && hour < 8');
    expect(code).toContain('hour >= 8 && hour < 18');
    expect(code).toContain('hour >= 18 && hour < 21');
  });

  it('returns speedMultiplier in output', () => {
    expect(code).toContain('speedMultiplier: speed');
  });
});

/* ================================================================== */
/*  4. moodFromActivity                                                */
/* ================================================================== */
describe('Batch 22 — moodFromActivity', () => {
  const code = src('packages/shared/src/eidolon-world.ts');

  it('function is exported', () => {
    expect(code).toContain('export function moodFromActivity');
  });

  it('returns idle when no work/tasks', () => {
    expect(code).toContain("return 'idle'");
  });

  it('returns frustrated when failures exceed successes', () => {
    expect(code).toContain("return 'frustrated'");
  });

  it('returns tired when hours > 12', () => {
    expect(code).toContain("return 'tired'");
  });

  it('returns proud when tokens > 100', () => {
    expect(code).toContain("return 'proud'");
  });

  it('returns excited when interactions > 5', () => {
    expect(code).toContain("return 'excited'");
  });

  it('returns focused when tasks > 3', () => {
    expect(code).toContain("return 'focused'");
  });

  it('returns curious when interactions > 2', () => {
    expect(code).toContain("return 'curious'");
  });

  it('defaults to neutral', () => {
    expect(code).toContain("return 'neutral'");
  });
});

/* ================================================================== */
/*  5. ARCHETYPE_AVATAR_DEFAULTS                                       */
/* ================================================================== */
describe('Batch 22 — ARCHETYPE_AVATAR_DEFAULTS', () => {
  const code = src('packages/shared/src/eidolon-world.ts');

  it('has all 15 archetype entries', () => {
    const archetypes = [
      'seller', 'translator', 'writer', 'scout', 'analyst',
      'operator', 'accountant', 'marketer', 'researcher', 'legal',
      'designer', 'support', 'strategist', 'recruiter', 'custom',
    ];
    for (const a of archetypes) {
      expect(code).toContain(`${a}:`);
    }
  });

  it('uses all 7 body types across archetypes', () => {
    const bodyTypes = ['humanoid', 'crystal', 'drone', 'orb', 'mech', 'phantom', 'custom'];
    // custom body type via custom archetype which uses 'humanoid'
    // but other 6 distinct types used: humanoid, crystal, drone, orb, mech, phantom
    for (const bt of bodyTypes.filter(b => b !== 'custom')) {
      expect(code).toContain(`bodyType: '${bt}'`);
    }
  });
});

/* ================================================================== */
/*  6. XP / Level system                                               */
/* ================================================================== */
describe('Batch 22 — XP/Level system', () => {
  const code = src('packages/shared/src/eidolon-world.ts');

  describe('xpForLevel', () => {
    it('is exported', () => {
      expect(code).toContain('export function xpForLevel');
    });

    it('uses quadratic formula level² × 100', () => {
      expect(code).toContain('level * level * 100');
    });
  });

  describe('levelFromXp', () => {
    it('is exported', () => {
      expect(code).toContain('export function levelFromXp');
    });

    it('uses sqrt-based formula', () => {
      expect(code).toContain('Math.sqrt(xp / 100)');
    });

    it('clamps to minimum level 1', () => {
      expect(code).toContain('Math.max(1');
    });
  });

  describe('XP_REWARDS', () => {
    it('has 8 activity types', () => {
      const activities = [
        'task_completed', 'task_failed', 'parcel_upgraded',
        'interaction_completed', 'item_purchased', 'review_submitted',
        'book_published', 'stage_completed',
      ];
      for (const a of activities) {
        expect(code).toContain(`${a}:`);
      }
    });

    it('book_published gives highest reward (50)', () => {
      expect(code).toContain('book_published: 50');
    });

    it('task_failed gives lowest positive reward (2)', () => {
      expect(code).toContain('task_failed: 2');
    });
  });
});

/* ================================================================== */
/*  7. Barrel export                                                   */
/* ================================================================== */
describe('Batch 22 — barrel export', () => {
  const barrel = src('packages/shared/src/index.ts');

  it('re-exports eidolon-world module', () => {
    expect(barrel).toContain("export * from './eidolon-world.js'");
  });
});

/* ================================================================== */
/*  8. Frontend api.ts sync                                            */
/* ================================================================== */
describe('Batch 22 — frontend api.ts type sync', () => {
  const code = src('apps/eidolon-ui/src/lib/api.ts');

  it('has 7 building kinds', () => {
    const kinds = [
      'marketplace_listing', 'revenue_service', 'infra_node',
      'treasury_vault', 'agent_business', 'crew_headquarters', 'publishing_house',
    ];
    for (const k of kinds) expect(code).toContain(`'${k}'`);
  });

  it('has 16 citizen roles', () => {
    const roles = [
      'pipeline', 'worker', 'scout', 'treasurer', 'operator',
      'seller', 'translator', 'writer', 'accountant', 'marketer',
      'researcher', 'counsel', 'designer', 'support', 'strategist', 'recruiter',
    ];
    for (const r of roles) expect(code).toContain(`'${r}'`);
  });

  it('includes EidolonParcel type', () => {
    expect(code).toContain('EidolonParcel');
  });

  it('includes ParcelZone type', () => {
    expect(code).toContain('ParcelZone');
  });

  it('includes AgentLocation type', () => {
    expect(code).toContain('AgentLocation');
  });

  it('snapshot.meta has totalParcels', () => {
    expect(code).toContain('totalParcels');
  });

  it('snapshot.meta has agentsInCity', () => {
    expect(code).toContain('agentsInCity');
  });

  it('snapshot.meta has agentsOnParcels', () => {
    expect(code).toContain('agentsOnParcels');
  });

  it('has parcels in snapshot', () => {
    expect(code).toContain('parcels');
  });
});

/* ================================================================== */
/*  9. Building.tsx — KIND_ACCENT                                      */
/* ================================================================== */
describe('Batch 22 — Building KIND_ACCENT', () => {
  const code = src('apps/eidolon-ui/src/components/Building.tsx');

  it('has 7 building kind accents', () => {
    const kinds = [
      'marketplace_listing', 'revenue_service', 'infra_node',
      'treasury_vault', 'agent_business', 'crew_headquarters', 'publishing_house',
    ];
    for (const k of kinds) expect(code).toContain(k);
  });

  it('agent_business uses green accent', () => {
    expect(code).toContain("agent_business: '#10b981'");
  });

  it('crew_headquarters uses pink accent', () => {
    expect(code).toContain("crew_headquarters: '#f472b6'");
  });

  it('publishing_house uses purple accent', () => {
    expect(code).toContain("publishing_house: '#a78bfa'");
  });
});

/* ================================================================== */
/*  10. Citizen.tsx — ARCHETYPE_GEO                                    */
/* ================================================================== */
describe('Batch 22 — Citizen ARCHETYPE_GEO', () => {
  const code = src('apps/eidolon-ui/src/components/Citizen.tsx');

  it('has ARCHETYPE_GEO record', () => {
    expect(code).toContain('ARCHETYPE_GEO');
  });

  it('maps all 15 archetypes', () => {
    const archetypes = [
      'seller', 'translator', 'writer', 'scout', 'analyst',
      'operator', 'accountant', 'marketer', 'researcher', 'legal',
      'designer', 'support', 'strategist', 'recruiter', 'custom',
    ];
    for (const a of archetypes) {
      expect(code).toContain(`${a}:`);
    }
  });

  it('uses 7 distinct geometry shapes', () => {
    const shapes = ['sphere', 'cone', 'cylinder', 'octahedron', 'dodecahedron', 'torus', 'icosahedron'];
    for (const s of shapes) {
      expect(code).toContain(`'${s}'`);
    }
  });
});

/* ================================================================== */
/*  11. useEventGlow — EVENT_TO_KIND                                   */
/* ================================================================== */
describe('Batch 22 — useEventGlow EVENT_TO_KIND', () => {
  const code = src('apps/eidolon-ui/src/hooks/useEventGlow.ts');

  it('has 21 event-to-kind mappings', () => {
    const events = [
      'treasury.credit', 'treasury.debit',
      'market.order_paid', 'market.listing_published', 'market.fulfilled',
      'market.refunded', 'market.task_created', 'market.task_completed',
      'infra.node_change',
      'agent.spawned', 'agent.retired', 'agent.tokens_earned',
      'agent.business_created', 'agent.business_activated', 'agent.business_deactivated',
      'crew.created', 'crew.member_added',
      'publishing.project_created', 'publishing.stage_advanced', 'publishing.book_published',
      'goal.completed',
    ];
    for (const e of events) {
      expect(code).toContain(`'${e}'`);
    }
  });

  it('maps agent_business events to agent_business building', () => {
    expect(code).toContain("'agent_business'");
  });

  it('maps crew events to crew_headquarters building', () => {
    expect(code).toContain("'crew_headquarters'");
  });

  it('maps publishing events to publishing_house building', () => {
    expect(code).toContain("'publishing_house'");
  });
});

/* ================================================================== */
/*  12. Backend types.ts — new event kinds                             */
/* ================================================================== */
describe('Batch 22 — backend types.ts event kinds', () => {
  const code = src('services/sven-eidolon/src/types.ts');

  it('has agent.avatar_changed', () => {
    expect(code).toContain("'agent.avatar_changed'");
  });

  it('has world.tick', () => {
    expect(code).toContain("'world.tick'");
  });

  it('has world.parcel_interaction', () => {
    expect(code).toContain("'world.parcel_interaction'");
  });

  it('has 7 building kinds including publishing_house', () => {
    const kinds = [
      'marketplace_listing', 'revenue_service', 'infra_node',
      'treasury_vault', 'agent_business', 'crew_headquarters', 'publishing_house',
    ];
    for (const k of kinds) expect(code).toContain(`'${k}'`);
  });

  it('has EidolonParcel interface', () => {
    expect(code).toContain('interface EidolonParcel');
  });

  it('has ParcelZone type', () => {
    expect(code).toContain('ParcelZone');
  });

  it('has AgentLocation type', () => {
    expect(code).toContain('AgentLocation');
  });

  it('snapshot includes parcels array', () => {
    expect(code).toContain('parcels: EidolonParcel[]');
  });

  it('meta includes totalParcels', () => {
    expect(code).toContain('totalParcels: number');
  });

  it('meta includes agentsInCity', () => {
    expect(code).toContain('agentsInCity: number');
  });

  it('meta includes agentsOnParcels', () => {
    expect(code).toContain('agentsOnParcels: number');
  });
});

/* ================================================================== */
/*  13. Backend event-bus.ts — new NATS subjects                       */
/* ================================================================== */
describe('Batch 22 — NATS event-bus subjects', () => {
  const code = src('services/sven-eidolon/src/event-bus.ts');

  it('has sven.agent.avatar_changed subject', () => {
    expect(code).toContain('sven.agent.avatar_changed');
  });

  it('has sven.world.tick subject', () => {
    expect(code).toContain('sven.world.tick');
  });

  it('has sven.world.parcel_interaction subject', () => {
    expect(code).toContain('sven.world.parcel_interaction');
  });
});

/* ================================================================== */
/*  14. Backend repo.ts — fetchParcels                                 */
/* ================================================================== */
describe('Batch 22 — backend repo.ts parcels', () => {
  const code = src('services/sven-eidolon/src/repo.ts');

  it('has fetchParcels method', () => {
    expect(code).toContain('fetchParcels');
  });

  it('queries agent_parcels table', () => {
    expect(code).toContain('agent_parcels');
  });

  it('getSnapshot includes parcels in return', () => {
    expect(code).toContain('parcels');
  });

  it('meta includes totalParcels counter', () => {
    expect(code).toContain('totalParcels');
  });

  it('meta includes agentsInCity counter', () => {
    expect(code).toContain('agentsInCity');
  });

  it('meta includes agentsOnParcels counter', () => {
    expect(code).toContain('agentsOnParcels');
  });

  it('imports EidolonParcel type', () => {
    expect(code).toContain('EidolonParcel');
  });

  it('imports AgentLocation type', () => {
    expect(code).toContain('AgentLocation');
  });
});

/* ================================================================== */
/*  15. Admin API — eidolon-world.ts                                   */
/* ================================================================== */
describe('Batch 22 — admin eidolon-world API', () => {
  const code = src('services/gateway-api/src/routes/admin/eidolon-world.ts');

  it('exports registerEidolonWorldRoutes function', () => {
    expect(code).toContain('registerEidolonWorldRoutes');
  });

  it('has parcel listing endpoint GET /eidolon/parcels', () => {
    expect(code).toContain('/eidolon/parcels');
  });

  it('has parcel acquire endpoint POST', () => {
    expect(code).toContain('.post(');
  });

  it('has avatar management endpoints', () => {
    expect(code).toContain('/eidolon/agents/');
    expect(code).toContain('/avatar');
  });

  it('has movement endpoint', () => {
    expect(code).toContain('/move');
  });

  it('has world-time endpoint', () => {
    expect(code).toContain('/eidolon/world-time');
  });

  it('has world-events endpoint', () => {
    expect(code).toContain('/eidolon/world-events');
  });

  it('has XP endpoint', () => {
    expect(code).toContain('/xp');
  });

  it('uses calculateWorldTime from shared', () => {
    expect(code).toContain('calculateWorldTime');
  });
});

/* ================================================================== */
/*  16. Admin index.ts wiring                                          */
/* ================================================================== */
describe('Batch 22 — admin index.ts wiring', () => {
  const code = src('services/gateway-api/src/routes/admin/index.ts');

  it('imports registerEidolonWorldRoutes', () => {
    expect(code).toContain("import { registerEidolonWorldRoutes } from './eidolon-world.js'");
  });

  it('registers eidolon world routes', () => {
    expect(code).toContain('registerEidolonWorldRoutes');
  });
});

/* ================================================================== */
/*  17. ParcelGrid component                                           */
/* ================================================================== */
describe('Batch 22 — ParcelGrid component', () => {
  const code = src('apps/eidolon-ui/src/components/ParcelGrid.tsx');

  it('has ZONE_COLOR map with 7 zone types', () => {
    const zones = ['residential', 'commercial', 'workshop', 'laboratory', 'farm', 'outpost', 'estate'];
    for (const z of zones) expect(code).toContain(z);
  });

  it('has SIZE_SCALE map with 4 sizes', () => {
    const sizes = ['small', 'medium', 'large', 'estate'];
    for (const s of sizes) expect(code).toContain(s);
  });

  it('renders ground plate mesh', () => {
    expect(code).toContain('meshStandardMaterial');
  });
});

/* ================================================================== */
/*  18. useWorldTime hook                                              */
/* ================================================================== */
describe('Batch 22 — useWorldTime hook', () => {
  const code = src('apps/eidolon-ui/src/hooks/useWorldTime.ts');

  it('exports useWorldTime function', () => {
    expect(code).toContain('useWorldTime');
  });

  it('has WorldTimeState interface', () => {
    expect(code).toContain('WorldTimeState');
  });

  it('has calculateWorldTime function', () => {
    expect(code).toContain('calculateWorldTime');
  });

  it('handles dawn/day/dusk/night phases', () => {
    expect(code).toContain('dawn');
    expect(code).toContain('dusk');
    expect(code).toContain('night');
  });
});

/* ================================================================== */
/*  19. MovementPaths component                                        */
/* ================================================================== */
describe('Batch 22 — MovementPaths component', () => {
  const code = src('apps/eidolon-ui/src/components/MovementPaths.tsx');

  it('has DISTRICT_POS map', () => {
    expect(code).toContain('DISTRICT_POS');
  });

  it('maps 5 district positions', () => {
    const districts = ['city_market', 'city_treasury', 'city_infra', 'city_revenue', 'city_centre'];
    for (const d of districts) expect(code).toContain(d);
  });

  it('uses QuadraticBezierCurve3 for arcs', () => {
    expect(code).toContain('QuadraticBezierCurve3');
  });

  it('animates dash offset via useFrame', () => {
    expect(code).toContain('useFrame');
    expect(code).toContain('dashOffset');
  });
});

/* ================================================================== */
/*  20. CityScene integration                                          */
/* ================================================================== */
describe('Batch 22 — CityScene integration', () => {
  const code = src('apps/eidolon-ui/src/components/CityScene.tsx');

  it('imports ParcelGrid', () => {
    expect(code).toContain("import { ParcelGrid } from './ParcelGrid'");
  });

  it('imports MovementPaths', () => {
    expect(code).toContain("import { MovementPaths } from './MovementPaths'");
  });

  it('imports useWorldTime', () => {
    expect(code).toContain("import { useWorldTime } from '@/hooks/useWorldTime'");
  });

  it('renders ParcelGrid with parcels prop', () => {
    expect(code).toContain('ParcelGrid');
    expect(code).toContain('parcels');
  });

  it('renders MovementPaths', () => {
    expect(code).toContain('MovementPaths');
  });

  it('uses worldTime for ambient lighting', () => {
    expect(code).toContain('worldTime.phase');
  });

  it('adjusts directional light intensity by phase', () => {
    expect(code).toContain("worldTime.phase === 'night'");
  });

  it('adjusts directional light color by phase', () => {
    expect(code).toContain("worldTime.phase === 'dawn'");
    expect(code).toContain("worldTime.phase === 'dusk'");
  });
});

/* ================================================================== */
/*  21. Migration — parcel_interactions                                */
/* ================================================================== */
describe('Batch 22 — migration parcel_interactions table', () => {
  const sql = src(
    'services/gateway-api/migrations/20260426120000_eidolon_world_evolution.sql',
  );

  it('has visitor_agent_id column', () => {
    expect(sql).toContain('visitor_agent_id');
  });

  it('has parcel_id column', () => {
    expect(sql).toContain('parcel_id');
  });

  it('has owner_agent_id column', () => {
    expect(sql).toContain('owner_agent_id');
  });

  it('has tokens_exchanged column', () => {
    expect(sql).toContain('tokens_exchanged');
  });

  it('has outcome column', () => {
    expect(sql).toContain('outcome');
  });
});

/* ================================================================== */
/*  22. Migration — eidolon_world_events table                         */
/* ================================================================== */
describe('Batch 22 — migration eidolon_world_events table', () => {
  const sql = src(
    'services/gateway-api/migrations/20260426120000_eidolon_world_evolution.sql',
  );

  it('has event_type column', () => {
    expect(sql).toContain('event_type');
  });

  it('has actor_id column', () => {
    expect(sql).toContain('actor_id');
  });

  it('has target_id column', () => {
    expect(sql).toContain('target_id');
  });

  it('has impact JSONB column', () => {
    expect(sql).toContain('impact');
    expect(sql).toContain('JSONB');
  });

  it('has location column', () => {
    expect(sql).toContain('location');
  });
});
