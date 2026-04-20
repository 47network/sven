import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════
// Batch 37 — Agent Service Domains (*.from.sven.systems)
// ═══════════════════════════════════════════════════════════════════

describe('Batch 37 — Agent Service Domains', () => {
  // ── Migration ──────────────────────────────────────────────────
  describe('migration 20260510120000_agent_service_domains.sql', () => {
    const sql = read('services/gateway-api/migrations/20260510120000_agent_service_domains.sql');

    it('creates service_templates table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_templates');
    });

    it('creates agent_service_domains table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_service_domains');
    });

    it('creates service_deployments table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_deployments');
    });

    it('creates service_domain_analytics table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_domain_analytics');
    });

    it('has service_type CHECK constraint', () => {
      expect(sql).toContain("'research_lab'");
      expect(sql).toContain("'consulting'");
      expect(sql).toContain("'design_studio'");
      expect(sql).toContain("'translation_bureau'");
      expect(sql).toContain("'writing_house'");
      expect(sql).toContain("'data_analytics'");
      expect(sql).toContain("'dev_shop'");
      expect(sql).toContain("'marketing_agency'");
      expect(sql).toContain("'legal_office'");
      expect(sql).toContain("'education_center'");
      expect(sql).toContain("'custom'");
    });

    it('has domain status CHECK constraint', () => {
      expect(sql).toContain("'provisioning'");
      expect(sql).toContain("'active'");
      expect(sql).toContain("'suspended'");
      expect(sql).toContain("'archived'");
    });

    it('has deploy_status CHECK constraint', () => {
      expect(sql).toContain("'pending'");
      expect(sql).toContain("'building'");
      expect(sql).toContain("'deploying'");
      expect(sql).toContain("'live'");
      expect(sql).toContain("'failed'");
      expect(sql).toContain("'rolled_back'");
    });

    it('references agent_profiles', () => {
      expect(sql).toContain('REFERENCES agent_profiles(id)');
    });

    it('has subdomain UNIQUE constraint', () => {
      expect(sql).toContain('subdomain      TEXT NOT NULL UNIQUE');
    });

    it('creates indexes on agent_service_domains', () => {
      expect(sql).toContain('idx_agent_service_domains_agent');
      expect(sql).toContain('idx_agent_service_domains_status');
    });

    it('creates index on service_deployments', () => {
      expect(sql).toContain('idx_service_deployments_domain');
    });

    it('has unique constraint on analytics domain+day', () => {
      expect(sql).toContain('UNIQUE(domain_id, day)');
    });

    it('tracks revenue and visitors on domains', () => {
      expect(sql).toContain('revenue_total');
      expect(sql).toContain('visitor_count');
      expect(sql).toContain('tokens_invested');
    });

    it('has health_url and last_health on deployments', () => {
      expect(sql).toContain('health_url');
      expect(sql).toContain('last_health');
    });
  });

  // ── Shared Types ───────────────────────────────────────────────
  describe('shared types agent-service-domains.ts', () => {
    const src = read('packages/shared/src/agent-service-domains.ts');

    it('exports ServiceType union', () => {
      expect(src).toContain("export type ServiceType =");
      expect(src).toContain("| 'research_lab'");
      expect(src).toContain("| 'custom'");
    });

    it('exports DomainStatus type', () => {
      expect(src).toContain("export type DomainStatus =");
    });

    it('exports DeployStatus type', () => {
      expect(src).toContain("export type DeployStatus =");
    });

    it('exports DomainHealthStatus type', () => {
      expect(src).toContain("export type DomainHealthStatus =");
    });

    it('exports SERVICE_TYPES array', () => {
      expect(src).toContain('export const SERVICE_TYPES');
    });

    it('exports DOMAIN_BASE constant', () => {
      expect(src).toContain("export const DOMAIN_BASE = 'from.sven.systems'");
    });

    it('exports AgentServiceDomain interface', () => {
      expect(src).toContain('export interface AgentServiceDomain');
    });

    it('exports ServiceTemplate interface', () => {
      expect(src).toContain('export interface ServiceTemplate');
    });

    it('exports ServiceDeployment interface', () => {
      expect(src).toContain('export interface ServiceDeployment');
    });

    it('exports ServiceDomainAnalytics interface', () => {
      expect(src).toContain('export interface ServiceDomainAnalytics');
    });

    it('exports fullDomain helper', () => {
      expect(src).toContain('export function fullDomain(');
    });

    it('exports fullUrl helper', () => {
      expect(src).toContain('export function fullUrl(');
    });

    it('exports isValidSubdomain helper', () => {
      expect(src).toContain('export function isValidSubdomain(');
    });

    it('exports RESERVED_SUBDOMAINS set', () => {
      expect(src).toContain('export const RESERVED_SUBDOMAINS');
      expect(src).toContain("'admin'");
      expect(src).toContain("'api'");
    });

    it('exports isSubdomainAvailable helper', () => {
      expect(src).toContain('export function isSubdomainAvailable(');
    });

    it('exports SERVICE_TYPE_LABELS record', () => {
      expect(src).toContain('export const SERVICE_TYPE_LABELS');
      expect(src).toContain("research_lab: 'Research Laboratory'");
    });

    it('is exported from shared index', () => {
      const idx = read('packages/shared/src/index.ts');
      expect(idx).toContain("export * from './agent-service-domains.js'");
    });
  });

  // ── service-spawn SKILL.md ─────────────────────────────────────
  describe('service-spawn SKILL.md', () => {
    const skill = read('skills/autonomous-economy/service-spawn/SKILL.md');

    it('has correct name', () => {
      expect(skill).toContain('name: service-spawn');
    });

    it('lists spawn-service action', () => {
      expect(skill).toContain('spawn-service');
    });

    it('defines subdomain input', () => {
      expect(skill).toContain('subdomain:');
    });

    it('defines serviceType input with enum values', () => {
      expect(skill).toContain('serviceType:');
      expect(skill).toContain('research_lab');
      expect(skill).toContain('custom');
    });

    it('specifies pricing in 47Tokens', () => {
      expect(skill).toContain('spawn: 50');
      expect(skill).toContain('47Tokens');
    });

    it('references from.sven.systems domain', () => {
      expect(skill).toContain('from.sven.systems');
    });

    it('describes revenue sharing model', () => {
      expect(skill).toContain('90% to service-owning agent');
      expect(skill).toContain('10% to Sven treasury');
    });

    it('includes service type table', () => {
      expect(skill).toContain('research_lab');
      expect(skill).toContain('consulting');
      expect(skill).toContain('design_studio');
    });
  });

  // ── service-manage SKILL.md ────────────────────────────────────
  describe('service-manage SKILL.md', () => {
    const skill = read('skills/autonomous-economy/service-manage/SKILL.md');

    it('has correct name', () => {
      expect(skill).toContain('name: service-manage');
    });

    it('lists management actions', () => {
      expect(skill).toContain('update-config');
      expect(skill).toContain('update-branding');
      expect(skill).toContain('redeploy');
      expect(skill).toContain('view-analytics');
      expect(skill).toContain('suspend-service');
      expect(skill).toContain('resume-service');
      expect(skill).toContain('archive-service');
      expect(skill).toContain('scale-service');
    });

    it('describes health monitoring', () => {
      expect(skill).toContain('Health Monitoring');
      expect(skill).toContain('healthy');
      expect(skill).toContain('degraded');
    });

    it('specifies pricing', () => {
      expect(skill).toContain('manage: 5');
      expect(skill).toContain('redeploy: 20');
    });
  });

  // ── Task Executor ──────────────────────────────────────────────
  describe('task-executor handlers', () => {
    const src = read('services/sven-marketplace/src/task-executor.ts');

    it('has service_spawn switch case', () => {
      expect(src).toContain("case 'service_spawn':");
    });

    it('has service_manage switch case', () => {
      expect(src).toContain("case 'service_manage':");
    });

    it('has service_analytics switch case', () => {
      expect(src).toContain("case 'service_analytics':");
    });

    it('has handleServiceSpawn method', () => {
      expect(src).toContain('private async handleServiceSpawn(');
    });

    it('has handleServiceManage method', () => {
      expect(src).toContain('private async handleServiceManage(');
    });

    it('has handleServiceAnalytics method', () => {
      expect(src).toContain('private async handleServiceAnalytics(');
    });

    it('spawn handler generates from.sven.systems URL', () => {
      expect(src).toContain('.from.sven.systems');
    });

    it('spawn handler returns domainId and subdomain', () => {
      expect(src).toContain('domainId');
      expect(src).toContain('subdomain');
      expect(src).toContain('fullUrl');
    });

    it('has 50 switch cases total', () => {
      const cases = (src.match(/case '/g) || []).length;
      expect(cases).toBe(50);
    });

    it('has 42 handler methods total', () => {
      const handlers = (src.match(/private async handle/g) || []).length;
      expect(handlers).toBe(42);
    });
  });

  // ── Eidolon types ──────────────────────────────────────────────
  describe('Eidolon types.ts', () => {
    const src = read('services/sven-eidolon/src/types.ts');

    it('has service_portal building kind', () => {
      expect(src).toContain("| 'service_portal'");
    });

    it('has 21 building kinds', () => {
      const section = src.split('EidolonBuildingKind')[1]?.split(';')[0] ?? '';
      const pipes = (section.match(/\|/g) || []).length;
      expect(pipes).toBe(21);
    });

    it('has service.domain_created event kind', () => {
      expect(src).toContain("| 'service.domain_created'");
    });

    it('has service.domain_activated event kind', () => {
      expect(src).toContain("| 'service.domain_activated'");
    });

    it('has service.deployed event kind', () => {
      expect(src).toContain("| 'service.deployed'");
    });

    it('has service.domain_archived event kind', () => {
      expect(src).toContain("| 'service.domain_archived'");
    });

    it('districtFor maps service_portal to market', () => {
      expect(src).toContain("case 'service_portal':");
    });

    it('has 21 districtFor cases', () => {
      const fnSection = src.split('function districtFor')[1] ?? '';
      const cases = (fnSection.match(/case '/g) || []).length;
      expect(cases).toBe(21);
    });
  });

  // ── Event Bus ──────────────────────────────────────────────────
  describe('event-bus.ts SUBJECT_MAP', () => {
    const src = read('services/sven-eidolon/src/event-bus.ts');

    it('maps sven.service.domain_created', () => {
      expect(src).toContain("'sven.service.domain_created': 'service.domain_created'");
    });

    it('maps sven.service.domain_activated', () => {
      expect(src).toContain("'sven.service.domain_activated': 'service.domain_activated'");
    });

    it('maps sven.service.deployed', () => {
      expect(src).toContain("'sven.service.deployed': 'service.deployed'");
    });

    it('maps sven.service.domain_archived', () => {
      expect(src).toContain("'sven.service.domain_archived': 'service.domain_archived'");
    });

    it('has 95 SUBJECT_MAP entries total', () => {
      const entries = (src.match(/'sven\./g) || []).length;
      expect(entries).toBe(95);
    });
  });

  // ── .gitattributes ─────────────────────────────────────────────
  describe('.gitattributes', () => {
    const ga = read('.gitattributes');

    it('marks service-spawn skill private', () => {
      expect(ga).toContain('skills/autonomous-economy/service-spawn/**  argentum-private export-ignore');
    });

    it('marks service-manage skill private', () => {
      expect(ga).toContain('skills/autonomous-economy/service-manage/**  argentum-private export-ignore');
    });

    it('marks shared types private', () => {
      expect(ga).toContain('packages/shared/src/agent-service-domains.ts  argentum-private export-ignore');
    });

    it('marks migration private', () => {
      expect(ga).toContain('services/gateway-api/migrations/20260510120000_agent_service_domains.sql  argentum-private export-ignore');
    });

    it('marks batch37 tests private', () => {
      expect(ga).toContain('services/agent-runtime/src/__tests__/batch37-*.test.ts  argentum-private export-ignore');
    });
  });
});
