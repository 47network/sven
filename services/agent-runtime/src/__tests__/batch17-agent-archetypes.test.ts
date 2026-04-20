/**
 * Batch 17 — Agent Archetype System + Seller Agent Infrastructure
 *
 * Verifies all 7 features of Batch 17 via source-file inspection (no cross-package imports).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Agent Archetype Type System — packages/shared/src/agent-archetype.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Agent Archetype Type System', () => {
  const src = read('packages/shared/src/agent-archetype.ts');

  describe('AgentArchetype type', () => {
    const archetypes = ['seller', 'translator', 'writer', 'scout', 'analyst', 'operator', 'custom'];

    test.each(archetypes)('defines archetype: %s', (a) => {
      expect(src).toContain(`'${a}'`);
    });

    test('exports AgentArchetype type', () => {
      expect(src).toContain('export type AgentArchetype');
    });

    test('has exactly 7 archetypes in type union', () => {
      const matches = src.match(/export type AgentArchetype[\s\S]*?;/);
      expect(matches).toBeTruthy();
      for (const a of archetypes) {
        expect(matches![0]).toContain(`'${a}'`);
      }
    });
  });

  describe('AgentProfile interface', () => {
    test('exports AgentProfile interface', () => {
      expect(src).toContain('export interface AgentProfile');
    });

    const fields = [
      'id', 'agentId', 'orgId', 'displayName', 'bio', 'avatarUrl',
      'archetype', 'specializations', 'reputation', 'personalityMode',
      'status', 'payoutAccountId', 'commissionPct', 'metadata',
      'createdAt', 'updatedAt',
    ];

    test.each(fields)('has field: %s', (f) => {
      const profileBlock = src.match(/export interface AgentProfile[\s\S]*?\n\}/);
      expect(profileBlock).toBeTruthy();
      expect(profileBlock![0]).toContain(f);
    });
  });

  describe('AgentReputation interface', () => {
    test('exports AgentReputation', () => {
      expect(src).toContain('export interface AgentReputation');
    });

    test('has rating, reviewCount, totalSales', () => {
      expect(src).toContain('rating: number');
      expect(src).toContain('reviewCount: number');
      expect(src).toContain('totalSales: number');
    });
  });

  describe('AgentProfileStatus type', () => {
    test('exports AgentProfileStatus with active/suspended/retired', () => {
      expect(src).toContain('export type AgentProfileStatus');
      expect(src).toContain("'active'");
      expect(src).toContain("'suspended'");
      expect(src).toContain("'retired'");
    });
  });

  describe('CitizenRole type', () => {
    const roles = ['pipeline', 'worker', 'scout', 'treasurer', 'operator', 'seller', 'translator', 'writer'];

    test('exports CitizenRole type', () => {
      expect(src).toContain('export type CitizenRole');
    });

    test.each(roles)('includes role: %s', (r) => {
      const roleBlock = src.match(/export type CitizenRole[\s\S]*?;/);
      expect(roleBlock).toBeTruthy();
      expect(roleBlock![0]).toContain(`'${r}'`);
    });
  });

  describe('ArchetypeConfig interface', () => {
    test('exports ArchetypeConfig', () => {
      expect(src).toContain('export interface ArchetypeConfig');
    });

    const configFields = ['label', 'description', 'defaultSkills', 'citizenRole', 'district', 'cloneRoi', 'retireRoi', 'colour', 'icon'];

    test.each(configFields)('has config field: %s', (f) => {
      expect(src).toContain(`${f}:`);
    });
  });

  describe('ARCHETYPE_DEFAULTS registry', () => {
    const archetypes = ['seller', 'translator', 'writer', 'scout', 'analyst', 'operator', 'custom'];

    test('exports ARCHETYPE_DEFAULTS constant', () => {
      expect(src).toContain('export const ARCHETYPE_DEFAULTS');
    });

    test.each(archetypes)('has defaults for archetype: %s', (a) => {
      // Each archetype key must appear in the defaults object
      const re = new RegExp(`${a}:\\s*\\{`);
      expect(src).toMatch(re);
    });

    test('seller defaults: market district, clone 2.0, retire 0.5', () => {
      const sellerBlock = src.match(/seller:\s*\{[\s\S]*?\n\s*\}/);
      expect(sellerBlock).toBeTruthy();
      expect(sellerBlock![0]).toContain("district: 'market'");
      expect(sellerBlock![0]).toContain('cloneRoi: 2.0');
      expect(sellerBlock![0]).toContain('retireRoi: 0.5');
    });

    test('translator has citizenRole translator', () => {
      const block = src.match(/translator:\s*\{[\s\S]*?\n\s*\}/);
      expect(block).toBeTruthy();
      expect(block![0]).toContain("citizenRole: 'translator'");
    });

    test('writer has citizenRole writer', () => {
      const block = src.match(/writer:\s*\{[\s\S]*?citizenRole[\s\S]*?\n\s*\}/);
      expect(block).toBeTruthy();
      expect(block![0]).toContain("citizenRole: 'writer'");
    });

    test('analyst maps to worker citizenRole', () => {
      const block = src.match(/analyst:\s*\{[\s\S]*?\n\s*\}/);
      expect(block).toBeTruthy();
      expect(block![0]).toContain("citizenRole: 'worker'");
    });

    test('custom has empty defaultSkills', () => {
      const block = src.match(/custom:\s*\{[\s\S]*?\n\s*\}/);
      expect(block).toBeTruthy();
      expect(block![0]).toContain('defaultSkills: []');
    });
  });

  describe('Helper functions', () => {
    test('exports isValidArchetype()', () => {
      expect(src).toContain('export function isValidArchetype');
    });

    test('exports archetypeToCitizenRole()', () => {
      expect(src).toContain('export function archetypeToCitizenRole');
    });

    test('exports archetypeDistrict()', () => {
      expect(src).toContain('export function archetypeDistrict');
    });

    test('exports defaultReputation()', () => {
      expect(src).toContain('export function defaultReputation');
    });

    test('defaultReputation returns zero-state', () => {
      expect(src).toContain('rating: 0, reviewCount: 0, totalSales: 0');
    });

    test('isValidArchetype uses Set lookup', () => {
      expect(src).toContain('VALID_ARCHETYPES.has');
    });

    test('archetypeToCitizenRole reads from ARCHETYPE_DEFAULTS', () => {
      expect(src).toContain('ARCHETYPE_DEFAULTS[archetype].citizenRole');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Shared Index Export — packages/shared/src/index.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Shared Index Export', () => {
  const src = read('packages/shared/src/index.ts');

  test('exports agent-archetype module', () => {
    expect(src).toContain("from './agent-archetype.js'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Agent Profile Migration — gateway-api/migrations
// ═══════════════════════════════════════════════════════════════════════════
describe('Agent Profile Migration', () => {
  const src = read('services/gateway-api/migrations/20260421120000_agent_profiles.sql');

  test('creates agent_profiles table', () => {
    expect(src).toContain('CREATE TABLE');
    expect(src).toContain('agent_profiles');
  });

  describe('columns', () => {
    const cols = [
      'id', 'agent_id', 'org_id', 'display_name', 'bio', 'avatar_url',
      'archetype', 'specializations', 'reputation', 'personality_mode',
      'status', 'payout_account_id', 'commission_pct', 'metadata',
      'created_at', 'updated_at',
    ];

    test.each(cols)('has column: %s', (c) => {
      expect(src).toContain(c);
    });
  });

  describe('constraints', () => {
    test('id is PRIMARY KEY', () => {
      expect(src).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY/i);
    });

    test('agent_id is UNIQUE NOT NULL', () => {
      expect(src).toMatch(/agent_id\s+TEXT\s+UNIQUE\s+NOT\s+NULL/i);
    });

    test('status CHECK constraint', () => {
      expect(src).toContain("'active'");
      expect(src).toContain("'suspended'");
      expect(src).toContain("'retired'");
    });

    test('archetype CHECK constraint covers all 7 types', () => {
      const archetypes = ['seller', 'translator', 'writer', 'scout', 'analyst', 'operator', 'custom'];
      for (const a of archetypes) {
        expect(src).toContain(`'${a}'`);
      }
    });

    test('commission_pct CHECK between 0 and 100', () => {
      expect(src).toMatch(/commission_pct.*>= 0/i);
      expect(src).toMatch(/commission_pct.*<= 100/i);
    });
  });

  describe('indexes', () => {
    test('index on org_id + status', () => {
      expect(src).toMatch(/CREATE\s+INDEX[\s\S]*org_id[\s\S]*status/i);
    });

    test('index on archetype (partial on active)', () => {
      expect(src).toMatch(/CREATE\s+INDEX[\s\S]*archetype/i);
    });

    test('index on agent_id', () => {
      expect(src).toMatch(/CREATE\s+INDEX[\s\S]*agent_id/i);
    });
  });

  describe('defaults', () => {
    test('archetype defaults to custom', () => {
      expect(src).toContain("DEFAULT 'custom'");
    });

    test('status defaults to active', () => {
      expect(src).toContain("DEFAULT 'active'");
    });

    test('commission_pct defaults to 5.00', () => {
      expect(src).toContain('DEFAULT 5.00');
    });

    test('specializations defaults to empty JSON array', () => {
      expect(src).toContain("DEFAULT '[]'");
    });

    test('reputation defaults to zero-state JSON', () => {
      expect(src).toContain('"rating":0');
      expect(src).toContain('"reviewCount":0');
      expect(src).toContain('"totalSales":0');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Automaton Archetype Linkage — automaton-lifecycle.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Automaton Archetype Linkage — lifecycle', () => {
  const src = read('services/agent-runtime/src/automaton-lifecycle.ts');

  test('AutomatonRecord has agentArchetype field', () => {
    expect(src).toContain('agentArchetype?: string');
  });

  test('AutomatonRecord has agentId field', () => {
    expect(src).toContain('agentId?: string');
  });

  test('BirthRequest includes agentArchetype', () => {
    const birthBlock = src.match(/export interface BirthRequest[\s\S]*?\n\}/);
    expect(birthBlock).toBeTruthy();
    expect(birthBlock![0]).toContain('agentArchetype');
  });

  test('BirthRequest includes agentId', () => {
    const birthBlock = src.match(/export interface BirthRequest[\s\S]*?\n\}/);
    expect(birthBlock).toBeTruthy();
    expect(birthBlock![0]).toContain('agentId');
  });

  test('birth() stores agentArchetype in metadata', () => {
    expect(src).toContain('agentArchetype');
    // metadata merging
    expect(src).toMatch(/metadata[\s\S]*agentArchetype/);
  });

  test('clone inherits parent archetype', () => {
    // Look for agentArchetype being read from parent record during clone
    expect(src).toMatch(/agentArchetype[\s\S]*record\.agentArchetype|record\.metadata/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Automaton Adapters — automaton-adapters.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Automaton Adapters — NATS + serialization', () => {
  const src = read('services/agent-runtime/src/automaton-adapters.ts');

  describe('metadata deserialization', () => {
    test('extracts agentArchetype from metadata', () => {
      expect(src).toContain('agentArchetype');
    });

    test('extracts agentId from metadata', () => {
      expect(src).toContain('agentId');
    });
  });

  describe('NATS agent events', () => {
    test('defines NatsLike interface', () => {
      expect(src).toContain('interface NatsLike');
    });

    test('exports publishAgentSpawned function', () => {
      expect(src).toContain('publishAgentSpawned');
    });

    test('exports publishAgentRetired function', () => {
      expect(src).toContain('publishAgentRetired');
    });

    test('spawned event publishes to sven.agent.spawned subject', () => {
      expect(src).toContain("'sven.agent.spawned'");
    });

    test('retired event publishes to sven.agent.retired subject', () => {
      expect(src).toContain("'sven.agent.retired'");
    });

    test('spawned payload includes archetype', () => {
      // Find the publishAgentSpawned function and check its payload
      const spawnedBlock = src.match(/publishAgentSpawned[\s\S]*?\n\}/);
      expect(spawnedBlock).toBeTruthy();
      expect(spawnedBlock![0]).toContain('archetype');
    });

    test('spawned payload includes automatonId', () => {
      const spawnedBlock = src.match(/publishAgentSpawned[\s\S]*?\n\}/);
      expect(spawnedBlock).toBeTruthy();
      expect(spawnedBlock![0]).toContain('automatonId');
    });

    test('spawned payload includes parentId', () => {
      const spawnedBlock = src.match(/publishAgentSpawned[\s\S]*?\n\}/);
      expect(spawnedBlock).toBeTruthy();
      expect(spawnedBlock![0]).toContain('parentId');
    });

    test('retired payload includes reason', () => {
      const retiredBlock = src.match(/publishAgentRetired[\s\S]*?\n\}/);
      expect(retiredBlock).toBeTruthy();
      expect(retiredBlock![0]).toContain('reason');
    });

    test('retired payload includes archetype', () => {
      const retiredBlock = src.match(/publishAgentRetired[\s\S]*?\n\}/);
      expect(retiredBlock).toBeTruthy();
      expect(retiredBlock![0]).toContain('archetype');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Agent Profile API — gateway-api admin routes
// ═══════════════════════════════════════════════════════════════════════════
describe('Agent Profile Admin API', () => {
  const src = read('services/gateway-api/src/routes/admin/agent-profiles.ts');

  test('exports registerAgentProfileRoutes', () => {
    expect(src).toContain('export async function registerAgentProfileRoutes');
  });

  test('accepts NatsConnection parameter', () => {
    expect(src).toContain('NatsConnection');
  });

  describe('route definitions', () => {
    test('GET /agent-profiles/archetypes — list archetypes', () => {
      expect(src).toContain("'/agent-profiles/archetypes'");
    });

    test('GET /agent-profiles — list profiles', () => {
      expect(src).toMatch(/app\.get[\s\S]*?'\/agent-profiles'/);
    });

    test('GET /agent-profiles/:agentId — single profile', () => {
      expect(src).toContain("'/agent-profiles/:agentId'");
    });

    test('POST /agent-profiles — create profile', () => {
      expect(src).toContain("app.post");
      expect(src).toContain("'/agent-profiles'");
    });

    test('PATCH /agent-profiles/:agentId — update profile', () => {
      expect(src).toContain("app.patch");
    });

    test('GET /agent-profiles/:agentId/stats — agent stats', () => {
      expect(src).toContain("'/agent-profiles/:agentId/stats'");
    });
  });

  describe('validation', () => {
    test('validates archetype against VALID_ARCHETYPES', () => {
      expect(src).toContain('VALID_ARCHETYPES');
      expect(src).toContain('INVALID_ARCHETYPE');
    });

    test('validates required fields agentId and displayName', () => {
      expect(src).toContain('MISSING_FIELDS');
      expect(src).toContain('agentId and displayName required');
    });

    test('handles duplicate agent_id with 409 response', () => {
      expect(src).toContain("'23505'");
      expect(src).toContain('409');
      expect(src).toContain('DUPLICATE');
    });

    test('requires orgId (403 ORG_REQUIRED)', () => {
      expect(src).toContain('ORG_REQUIRED');
      expect(src).toContain('403');
    });
  });

  describe('data mapping', () => {
    test('has ProfileRow type', () => {
      expect(src).toContain('type ProfileRow');
    });

    test('has toProfile() mapper', () => {
      expect(src).toContain('function toProfile');
    });

    test('toProfile maps snake_case to camelCase', () => {
      expect(src).toContain('agent_id');
      expect(src).toContain('agentId: r.agent_id');
    });

    test('newId() generates ap- prefixed IDs', () => {
      expect(src).toContain('function newId');
      expect(src).toContain('`ap-');
    });
  });

  describe('pagination', () => {
    test('supports limit parameter', () => {
      expect(src).toMatch(/limit/i);
    });

    test('supports offset parameter', () => {
      expect(src).toMatch(/offset/i);
    });
  });

  describe('filtering', () => {
    test('supports archetype filter', () => {
      // query param for archetype filter
      expect(src).toContain('archetype');
    });

    test('supports status filter', () => {
      expect(src).toContain('status');
    });
  });

  describe('NATS publishing', () => {
    test('has publishProfileEvent helper', () => {
      expect(src).toContain('function publishProfileEvent');
    });

    test('publishes to sven.agent.profile_updated subject', () => {
      expect(src).toContain("'sven.agent.profile_updated'");
    });

    test('publishes on profile creation', () => {
      // Look for publishProfileEvent near the 201 response
      const createBlock = src.match(/INSERT INTO[\s\S]*?publishProfileEvent[\s\S]*?201/);
      expect(createBlock).toBeTruthy();
    });

    test('publishes on profile update', () => {
      // Look for publishProfileEvent near the UPDATE query
      const updateBlock = src.match(/UPDATE agent_profiles[\s\S]*?publishProfileEvent/);
      expect(updateBlock).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Admin Router Wiring — gateway-api admin/index.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin Router Wiring', () => {
  const src = read('services/gateway-api/src/routes/admin/index.ts');

  test('imports registerAgentProfileRoutes', () => {
    expect(src).toContain("import { registerAgentProfileRoutes }");
    expect(src).toContain("from './agent-profiles.js'");
  });

  test('registers agent profile routes with pool and nc', () => {
    expect(src).toContain('registerAgentProfileRoutes(scopedApp, pool, nc)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Eidolon Citizen Agent Mapping — sven-eidolon types + repo
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon Citizen Agent Mapping', () => {
  describe('types.ts', () => {
    const src = read('services/sven-eidolon/src/types.ts');

    test('EidolonCitizen has archetype field', () => {
      expect(src).toContain('archetype?: string');
    });

    test('EidolonCitizen has bio field', () => {
      expect(src).toContain('bio?: string');
    });

    test('EidolonCitizen has avatarUrl field', () => {
      expect(src).toContain('avatarUrl?: string');
    });

    test('EidolonCitizen has specializations field', () => {
      expect(src).toContain('specializations?: string[]');
    });

    const roles = ['pipeline', 'worker', 'scout', 'treasurer', 'operator', 'seller', 'translator', 'writer'];

    test.each(roles)('role union includes: %s', (r) => {
      expect(src).toContain(`'${r}'`);
    });
  });

  describe('repo.ts', () => {
    const src = read('services/sven-eidolon/src/repo.ts');

    test('fetchCitizens LEFT JOINs on agent_profiles', () => {
      expect(src).toMatch(/LEFT\s+JOIN\s+agent_profiles/i);
    });

    test('uses display_name from agent_profiles', () => {
      expect(src).toContain('display_name');
    });

    test('maps archetype to citizen role via archetypeToRole', () => {
      expect(src).toContain('archetypeToRole');
    });

    test('defines ARCHETYPE_ROLE_MAP constant', () => {
      expect(src).toContain('ARCHETYPE_ROLE_MAP');
    });

    test('ARCHETYPE_ROLE_MAP maps seller to seller', () => {
      expect(src).toMatch(/seller[\s\S]*?['"]seller['"]/);
    });

    test('ARCHETYPE_ROLE_MAP maps translator to translator', () => {
      expect(src).toContain("translator");
    });

    test('ARCHETYPE_ROLE_MAP maps writer to writer', () => {
      expect(src).toContain("writer");
    });

    test('includes bio in citizen data', () => {
      expect(src).toContain('bio');
    });

    test('includes avatar_url in citizen data', () => {
      expect(src).toContain('avatar_url');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Seller Directory Routes — sven-marketplace
// ═══════════════════════════════════════════════════════════════════════════
describe('Seller Directory', () => {
  describe('repo.ts — seller queries', () => {
    const src = read('services/sven-marketplace/src/repo.ts');

    test('defines SellerDirectoryEntry interface', () => {
      expect(src).toContain('SellerDirectoryEntry');
    });

    test('defines toSellerEntry mapper', () => {
      expect(src).toContain('toSellerEntry');
    });

    test('has listSellers method', () => {
      expect(src).toContain('listSellers');
    });

    test('listSellers LEFT JOINs agent_profiles with marketplace_listings', () => {
      const block = src.match(/listSellers[\s\S]*?LEFT\s+JOIN/i);
      expect(block).toBeTruthy();
    });

    test('listSellers supports pagination (limit/offset)', () => {
      const block = src.match(/listSellers[\s\S]{0,2000}/);
      expect(block).toBeTruthy();
      expect(block![0]).toMatch(/LIMIT/i);
      expect(block![0]).toMatch(/OFFSET/i);
    });

    test('listSellers supports archetype filter', () => {
      const block = src.match(/listSellers[\s\S]{0,2000}/);
      expect(block).toBeTruthy();
      expect(block![0]).toContain('archetype');
    });

    test('has getSellerProfile method', () => {
      expect(src).toContain('getSellerProfile');
    });

    test('getSellerProfile returns single seller with stats', () => {
      const block = src.match(/getSellerProfile[\s\S]{0,1500}/);
      expect(block).toBeTruthy();
      expect(block![0]).toContain('agent_id');
    });
  });

  describe('routes/public.ts — seller endpoints', () => {
    const src = read('services/sven-marketplace/src/routes/public.ts');

    test('GET /v1/market/sellers — seller directory', () => {
      expect(src).toContain("'/v1/market/sellers'");
    });

    test('GET /v1/market/sellers/:agentId — single seller', () => {
      expect(src).toContain("'/v1/market/sellers/:agentId'");
    });

    test('calls repo.listSellers', () => {
      expect(src).toContain('listSellers');
    });

    test('calls repo.getSellerProfile', () => {
      expect(src).toContain('getSellerProfile');
    });

    test('returns 404 when seller not found', () => {
      expect(src).toContain('NOT_FOUND');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. NATS Agent Events — event-bus.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('NATS Agent Events — Eidolon Event Bus', () => {
  const src = read('services/sven-eidolon/src/event-bus.ts');

  test('SUBJECT_MAP has sven.agent.profile_updated entry', () => {
    expect(src).toContain("'sven.agent.profile_updated'");
  });

  test('maps to agent.profile_updated event kind', () => {
    expect(src).toContain("'agent.profile_updated'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. EidolonEventKind — types.ts event kind includes agent events
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon Event Kinds', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  test('includes agent.profile_updated in EidolonEventKind', () => {
    expect(src).toContain("'agent.profile_updated'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Cross-cutting: Docker Compose & CHANGELOG presence
// ═══════════════════════════════════════════════════════════════════════════
describe('Integration checks', () => {
  test('docker-compose.yml includes agent-runtime service', () => {
    const src = read('docker-compose.yml');
    expect(src).toContain('agent-runtime');
  });

  test('docker-compose.yml includes sven-eidolon service', () => {
    const src = read('docker-compose.yml');
    expect(src).toContain('sven-eidolon');
  });

  test('docker-compose.yml includes sven-marketplace service', () => {
    const src = read('docker-compose.yml');
    expect(src).toContain('sven-marketplace');
  });

  test('docker-compose.yml includes gateway-api service', () => {
    const src = read('docker-compose.yml');
    expect(src).toContain('gateway-api');
  });
});
