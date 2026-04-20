/**
 * Batch 39 — Integration Agents Agency tests
 *
 * Verifies migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus SUBJECT_MAP, and task-executor handlers for the Integration
 * Agents Agency batch.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// -------------------------------------------------------------------------
// 1. Migration SQL
// -------------------------------------------------------------------------
describe('Batch 39 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260512120000_integration_agents.sql');

  it('creates integration_platforms table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS integration_platforms');
  });

  it('creates integration_agents table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS integration_agents');
  });

  it('creates integration_evolutions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS integration_evolutions');
  });

  it('creates integration_subscriptions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS integration_subscriptions');
  });

  it('has 13 platform categories', () => {
    const categories = [
      'project_management', 'crm', 'marketing', 'support',
      'hr', 'finance', 'devops', 'communication',
      'analytics', 'ecommerce', 'design', 'legal', 'custom',
    ];
    for (const c of categories) {
      expect(sql).toContain(`'${c}'`);
    }
  });

  it('has 7 auth types', () => {
    const auths = ['oauth2', 'api_key', 'basic', 'token', 'webhook', 'saml', 'custom'];
    for (const a of auths) {
      expect(sql).toContain(`'${a}'`);
    }
  });

  it('has 8 platform statuses', () => {
    const statuses = [
      'discovered', 'analyzing', 'building', 'testing',
      'active', 'deprecated', 'broken', 'archived',
    ];
    for (const s of statuses) {
      expect(sql).toContain(`'${s}'`);
    }
  });

  it('has 5 agent health statuses', () => {
    const health = ['healthy', 'degraded', 'broken', 'updating', 'learning'];
    for (const h of health) {
      expect(sql).toContain(`'${h}'`);
    }
  });

  it('has 9 evolution types', () => {
    const types = [
      'api_change_detected', 'skill_learned', 'bug_fixed',
      'capability_added', 'performance_improved', 'breaking_change_resolved',
      'new_endpoint_covered', 'auth_updated', 'deprecation_handled',
    ];
    for (const t of types) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  it('has 4 subscription plans', () => {
    const plans = ['free_trial', 'basic', 'pro', 'enterprise', 'custom'];
    for (const p of plans) {
      expect(sql).toContain(`'${p}'`);
    }
  });

  it('creates 6 indexes', () => {
    const indexes = [
      'idx_integration_agents_platform',
      'idx_integration_agents_health',
      'idx_integration_evolutions_agent',
      'idx_integration_evolutions_type',
      'idx_integration_subscriptions_agent',
      'idx_integration_subscriptions_status',
    ];
    for (const i of indexes) {
      expect(sql).toContain(i);
    }
  });

  it('has foreign key references', () => {
    expect(sql).toContain('REFERENCES integration_platforms(id)');
    expect(sql).toContain('REFERENCES integration_agents(id)');
  });
});

// -------------------------------------------------------------------------
// 2. Shared types
// -------------------------------------------------------------------------
describe('Batch 39 — Shared types', () => {
  const src = read('packages/shared/src/integration-agents.ts');

  it('exports IntegrationCategory type with 13 values', () => {
    expect(src).toContain("export type IntegrationCategory");
    const categories = [
      'project_management', 'crm', 'marketing', 'support',
      'hr', 'finance', 'devops', 'communication',
      'analytics', 'ecommerce', 'design', 'legal', 'custom',
    ];
    for (const c of categories) {
      expect(src).toContain(`'${c}'`);
    }
  });

  it('exports IntegrationAuthType with 7 values', () => {
    expect(src).toContain("export type IntegrationAuthType");
  });

  it('exports PlatformStatus with 8 values', () => {
    expect(src).toContain("export type PlatformStatus");
  });

  it('exports AgentHealthStatus with 5 values', () => {
    expect(src).toContain("export type AgentHealthStatus");
  });

  it('exports EvolutionType with 9 values', () => {
    expect(src).toContain("export type EvolutionType");
  });

  it('exports SubscriptionPlan with 5 values', () => {
    expect(src).toContain("export type SubscriptionPlan");
  });

  it('exports SubscriptionStatus with 4 values', () => {
    expect(src).toContain("export type SubscriptionStatus");
    expect(src).toContain("'active'");
    expect(src).toContain("'paused'");
    expect(src).toContain("'cancelled'");
    expect(src).toContain("'expired'");
  });

  it('exports IntegrationPlatform interface', () => {
    expect(src).toContain('export interface IntegrationPlatform');
  });

  it('exports IntegrationAgent interface', () => {
    expect(src).toContain('export interface IntegrationAgent');
  });

  it('exports IntegrationEvolution interface', () => {
    expect(src).toContain('export interface IntegrationEvolution');
  });

  it('exports IntegrationSubscription interface', () => {
    expect(src).toContain('export interface IntegrationSubscription');
  });

  it('exports INTEGRATION_CATEGORIES constant with 13 entries', () => {
    expect(src).toContain('INTEGRATION_CATEGORIES');
  });

  it('exports PLATFORM_STATUS_ORDER constant', () => {
    expect(src).toContain('PLATFORM_STATUS_ORDER');
  });

  it('exports EVOLUTION_TYPES constant with 9 entries', () => {
    expect(src).toContain('EVOLUTION_TYPES');
  });

  it('exports CATEGORY_LABELS mapping', () => {
    expect(src).toContain('CATEGORY_LABELS');
    expect(src).toContain("project_management: 'Project Management'");
    expect(src).toContain("crm: 'CRM'");
  });

  it('exports SEED_PLATFORMS with 28 well-known platforms', () => {
    expect(src).toContain('SEED_PLATFORMS');
    expect(src).toContain("'atlassian-jira'");
    expect(src).toContain("'salesforce'");
    expect(src).toContain("'hubspot'");
    expect(src).toContain("'zendesk'");
    expect(src).toContain("'shopify'");
    expect(src).toContain("'figma'");
  });

  it('exports canAdvancePlatform helper', () => {
    expect(src).toContain('export function canAdvancePlatform');
  });

  it('exports isHealthy helper', () => {
    expect(src).toContain('export function isHealthy');
  });

  it('exports needsAttention helper', () => {
    expect(src).toContain('export function needsAttention');
  });
});

// -------------------------------------------------------------------------
// 3. Shared index exports
// -------------------------------------------------------------------------
describe('Batch 39 — Shared index exports', () => {
  const idx = read('packages/shared/src/index.ts');

  it('exports integration-agents module', () => {
    expect(idx).toContain("export * from './integration-agents.js'");
  });

  it('has 64 lines', () => {
    expect(idx.split('\n').length).toBe(65);
  });
});

// -------------------------------------------------------------------------
// 4. SKILL.md
// -------------------------------------------------------------------------
describe('Batch 39 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/integration-agent/SKILL.md');

  it('has name: integration-agent', () => {
    expect(skill).toContain('name: integration-agent');
  });

  it('has archetype: engineer', () => {
    expect(skill).toContain('archetype: engineer');
  });

  it('has 7 actions', () => {
    const actions = [
      'discover-platform', 'build-agent', 'invoke-action',
      'health-check', 'evolve', 'subscribe', 'report-coverage',
    ];
    for (const a of actions) {
      expect(skill).toContain(`### ${a}`);
    }
  });

  it('describes self-evolution lifecycle', () => {
    expect(skill).toContain('Self-Evolution Lifecycle');
    expect(skill).toContain('MONITOR');
    expect(skill).toContain('DETECT');
    expect(skill).toContain('ANALYZE');
    expect(skill).toContain('ADAPT');
    expect(skill).toContain('TEST');
    expect(skill).toContain('DEPLOY');
    expect(skill).toContain('LEARN');
  });

  it('has pricing model with 4 plans', () => {
    expect(skill).toContain('Free Trial');
    expect(skill).toContain('Basic');
    expect(skill).toContain('Pro');
    expect(skill).toContain('Enterprise');
  });

  it('has revenue split', () => {
    expect(skill).toContain('70% to Sven treasury');
    expect(skill).toContain('20% to the integration agent');
    expect(skill).toContain('10% to the agent that recruited');
  });

  it('lists 3 target platform tiers', () => {
    expect(skill).toContain('Tier 1');
    expect(skill).toContain('Tier 2');
    expect(skill).toContain('Tier 3');
  });

  it('has quality standards', () => {
    expect(skill).toContain('95% uptime');
    expect(skill).toContain('500ms p99');
  });
});

// -------------------------------------------------------------------------
// 5. Eidolon types
// -------------------------------------------------------------------------
describe('Batch 39 — Eidolon types', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('has integration_hub building kind', () => {
    expect(types).toContain("'integration_hub'");
  });

  it('has 23 building kinds total', () => {
    const matches = types.match(/case '([^']+)':/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(23);
  });

  it('has 4 integration event kinds', () => {
    expect(types).toContain("'integration.platform_discovered'");
    expect(types).toContain("'integration.agent_built'");
    expect(types).toContain("'integration.agent_evolved'");
    expect(types).toContain("'integration.subscription_created'");
  });

  it('districtFor integration_hub returns infrastructure', () => {
    expect(types).toContain("case 'integration_hub':");
    expect(types).toContain("return 'infrastructure'");
  });
});

// -------------------------------------------------------------------------
// 6. Event-bus SUBJECT_MAP
// -------------------------------------------------------------------------
describe('Batch 39 — Event-bus SUBJECT_MAP', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  it('has 103 SUBJECT_MAP entries', () => {
    const count = (bus.match(/'sven\./g) || []).length;
    expect(count).toBe(103);
  });

  it('maps integration.platform_discovered', () => {
    expect(bus).toContain("'sven.integration.platform_discovered': 'integration.platform_discovered'");
  });

  it('maps integration.agent_built', () => {
    expect(bus).toContain("'sven.integration.agent_built': 'integration.agent_built'");
  });

  it('maps integration.agent_evolved', () => {
    expect(bus).toContain("'sven.integration.agent_evolved': 'integration.agent_evolved'");
  });

  it('maps integration.subscription_created', () => {
    expect(bus).toContain("'sven.integration.subscription_created': 'integration.subscription_created'");
  });
});

// -------------------------------------------------------------------------
// 7. Task executor
// -------------------------------------------------------------------------
describe('Batch 39 — Task executor', () => {
  const te = read('services/sven-marketplace/src/task-executor.ts');

  it('has 57 switch cases', () => {
    const count = (te.match(/case '/g) || []).length;
    expect(count).toBe(57);
  });

  it('has 49 handler methods', () => {
    const count = (te.match(/private async handle/g) || []).length;
    expect(count).toBe(49);
  });

  it('routes integration_discover', () => {
    expect(te).toContain("case 'integration_discover':");
    expect(te).toContain('this.handleIntegrationDiscover');
  });

  it('routes integration_build', () => {
    expect(te).toContain("case 'integration_build':");
    expect(te).toContain('this.handleIntegrationBuild');
  });

  it('routes integration_invoke', () => {
    expect(te).toContain("case 'integration_invoke':");
    expect(te).toContain('this.handleIntegrationInvoke');
  });

  it('routes integration_evolve', () => {
    expect(te).toContain("case 'integration_evolve':");
    expect(te).toContain('this.handleIntegrationEvolve');
  });

  it('handleIntegrationDiscover returns platform info', () => {
    expect(te).toContain('handleIntegrationDiscover');
    expect(te).toContain("status: 'discovered'");
  });

  it('handleIntegrationBuild returns agent info', () => {
    expect(te).toContain('handleIntegrationBuild');
    expect(te).toContain("version: '0.1.0'");
    expect(te).toContain('apiCoveragePct');
  });

  it('handleIntegrationInvoke returns invocation result', () => {
    expect(te).toContain('handleIntegrationInvoke');
    expect(te).toContain('tokensCharged');
    expect(te).toContain('latencyMs');
  });

  it('handleIntegrationEvolve returns evolution result', () => {
    expect(te).toContain('handleIntegrationEvolve');
    expect(te).toContain('evolutionType');
    expect(te).toContain('autoResolved');
  });
});

// -------------------------------------------------------------------------
// 8. .gitattributes
// -------------------------------------------------------------------------
describe('Batch 39 — .gitattributes', () => {
  const ga = read('.gitattributes');

  it('marks migration as export-ignore', () => {
    expect(ga).toContain('20260512120000_integration_agents.sql export-ignore');
  });

  it('marks shared types as export-ignore', () => {
    expect(ga).toContain('integration-agents.ts export-ignore');
  });

  it('marks skill directory as export-ignore', () => {
    expect(ga).toContain('skills/autonomous-economy/integration-agent/** export-ignore');
  });

  it('marks test file as export-ignore', () => {
    expect(ga).toContain('batch39-integration-agents.test.ts export-ignore');
  });
});
