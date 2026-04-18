import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 77 — Agent Multi-Tenancy', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617140000_agent_multi_tenancy.sql'), 'utf-8');
    it('creates tenants table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenants'); });
    it('creates tenant_members table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenant_members'); });
    it('creates tenant_quotas table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenant_quotas'); });
    it('creates tenant_invitations table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenant_invitations'); });
    it('creates tenant_audit_log table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS tenant_audit_log'); });
    it('has at least 20 indexes', () => { expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-multi-tenancy.ts'), 'utf-8');
    it('exports TenantPlan type', () => { expect(src).toContain('export type TenantPlan'); });
    it('exports TenantStatus type', () => { expect(src).toContain('export type TenantStatus'); });
    it('exports TenantMemberRole type', () => { expect(src).toContain('export type TenantMemberRole'); });
    it('exports TenantQuotaResource type', () => { expect(src).toContain('export type TenantQuotaResource'); });
    it('exports TenantInvitationStatus type', () => { expect(src).toContain('export type TenantInvitationStatus'); });
    it('exports Tenant interface', () => { expect(src).toContain('export interface Tenant'); });
    it('exports TenantMember interface', () => { expect(src).toContain('export interface TenantMember'); });
    it('exports TenantQuota interface', () => { expect(src).toContain('export interface TenantQuota'); });
    it('exports TenantInvitation interface', () => { expect(src).toContain('export interface TenantInvitation'); });
    it('exports TenantAuditEntry interface', () => { expect(src).toContain('export interface TenantAuditEntry'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-multi-tenancy module', () => { expect(idx).toContain("export * from './agent-multi-tenancy.js'"); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-multi-tenancy/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-multi-tenancy/); });
    it('has architect archetype', () => { expect(md).toMatch(/archetype:\s*architect/); });
    it('has 7 actions', () => { expect((md.match(/^### /gm) || []).length).toBe(7); });
  });

  describe('Eidolon Building Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes tenant_hub building kind', () => { expect(types).toContain("'tenant_hub'"); });
    it('has 60 building kind values', () => {
      const m = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(60);
    });
  });

  describe('Eidolon Event Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes tenant event kinds', () => {
      expect(types).toContain("'tenant.created'");
      expect(types).toContain("'tenant.member_joined'");
      expect(types).toContain("'tenant.quota_exceeded'");
      expect(types).toContain("'tenant.plan_upgraded'");
    });
    it('has 256 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(256);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps tenant_hub to civic', () => { expect(types).toContain("case 'tenant_hub':"); });
    it('has 60 cases', () => {
      const m = types.match(/export function districtFor[\s\S]*?^}/m);
      expect((m![0].match(/case '/g) || []).length).toBe(60);
    });
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 tenant subject entries', () => {
      expect(bus).toContain("'sven.tenant.created'");
      expect(bus).toContain("'sven.tenant.member_joined'");
      expect(bus).toContain("'sven.tenant.quota_exceeded'");
      expect(bus).toContain("'sven.tenant.plan_upgraded'");
    });
    it('has 255 total entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(255);
    });
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 tenant switch cases', () => {
      expect(te).toContain("case 'tenant_create':");
      expect(te).toContain("case 'tenant_manage_members':");
      expect(te).toContain("case 'tenant_enforce_quotas':");
      expect(te).toContain("case 'tenant_send_invitation':");
      expect(te).toContain("case 'tenant_audit_query':");
      expect(te).toContain("case 'tenant_upgrade_plan':");
      expect(te).toContain("case 'tenant_report':");
    });
    it('has 320 total switch cases', () => { expect((te.match(/case '/g) || []).length).toBe(320); });
  });

  describe('Task executor handler methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 tenant handler methods', () => {
      expect(te).toMatch(/private (?:async )?handleTenantCreate/);
      expect(te).toMatch(/private (?:async )?handleTenantManageMembers/);
      expect(te).toMatch(/private (?:async )?handleTenantEnforceQuotas/);
      expect(te).toMatch(/private (?:async )?handleTenantSendInvitation/);
      expect(te).toMatch(/private (?:async )?handleTenantAuditQuery/);
      expect(te).toMatch(/private (?:async )?handleTenantUpgradePlan/);
      expect(te).toMatch(/private (?:async )?handleTenantReport/);
    });
    it('has 316 total handler methods', () => {
      expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(316);
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks tenancy migration as private', () => { expect(ga).toContain('20260617140000_agent_multi_tenancy.sql'); });
    it('marks tenancy shared types as private', () => { expect(ga).toContain('agent-multi-tenancy.ts'); });
    it('marks tenancy skill as private', () => { expect(ga).toContain('agent-multi-tenancy/SKILL.md'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 77', () => { expect(cl).toContain('Batch 77'); });
    it('mentions Agent Multi-Tenancy', () => { expect(cl).toContain('Agent Multi-Tenancy'); });
  });

  describe('Migrations', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 63 migration files', () => { expect(files.length).toBe(63); });
  });
});
