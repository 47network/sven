import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 64 — Agent Secrets & Credentials Management', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260606120000_agent_secrets_credentials.sql'), 'utf-8');

    it('creates agent_secrets table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_secrets'); });
    it('creates secret_rotations table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS secret_rotations'); });
    it('creates secret_access_logs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS secret_access_logs'); });
    it('creates secret_policies table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS secret_policies'); });
    it('creates secret_shares table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS secret_shares'); });

    it('has secret_type CHECK constraint', () => { expect(sql).toMatch(/secret_type.*CHECK/); });
    it('has scope CHECK constraint', () => { expect(sql).toMatch(/scope.*CHECK/); });
    it('has rotation_type CHECK constraint', () => { expect(sql).toMatch(/rotation_type.*CHECK/); });
    it('has access_type CHECK constraint', () => { expect(sql).toMatch(/access_type.*CHECK/); });
    it('has share_type CHECK constraint', () => { expect(sql).toMatch(/share_type.*CHECK/); });
    it('has rotation status CHECK constraint', () => { expect(sql).toMatch(/status.*CHECK.*pending.*in_progress.*completed.*failed.*rolled_back/s); });

    it('has at least 19 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/g) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(19);
    });

    it('has encrypted_value column', () => { expect(sql).toContain('encrypted_value'); });
    it('has encryption_algo column', () => { expect(sql).toContain('encryption_algo'); });
    it('has UNIQUE constraint on agent_id + secret_name', () => { expect(sql).toContain('UNIQUE(agent_id, secret_name)'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-secrets-credentials.ts'), 'utf-8');

    it('exports SecretType', () => { expect(src).toContain("export type SecretType"); });
    it('exports SecretScope', () => { expect(src).toContain("export type SecretScope"); });
    it('exports RotationType', () => { expect(src).toContain("export type RotationType"); });
    it('exports RotationStatus', () => { expect(src).toContain("export type RotationStatus"); });
    it('exports AccessType', () => { expect(src).toContain("export type AccessType"); });
    it('exports ShareType', () => { expect(src).toContain("export type ShareType"); });
    it('exports SecretsAction', () => { expect(src).toContain("export type SecretsAction"); });

    it('SecretType has 6 values', () => {
      const m = src.match(/export type SecretType\s*=\s*([^;]+)/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(6);
    });

    it('exports AgentSecret interface', () => { expect(src).toContain('export interface AgentSecret'); });
    it('exports SecretRotation interface', () => { expect(src).toContain('export interface SecretRotation'); });
    it('exports SecretAccessLog interface', () => { expect(src).toContain('export interface SecretAccessLog'); });
    it('exports SecretPolicy interface', () => { expect(src).toContain('export interface SecretPolicy'); });
    it('exports SecretShare interface', () => { expect(src).toContain('export interface SecretShare'); });

    it('exports isSecretExpired helper', () => { expect(src).toContain('export function isSecretExpired'); });
    it('exports needsRotation helper', () => { expect(src).toContain('export function needsRotation'); });
    it('exports isShareActive helper', () => { expect(src).toContain('export function isShareActive'); });
    it('exports maskSecret helper', () => { expect(src).toContain('export function maskSecret'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-secrets-credentials', () => { expect(idx).toContain("./agent-secrets-credentials"); });
    it('has at least 89 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(89); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-secrets-credentials/SKILL.md'), 'utf-8');

    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-secrets-credentials/); });
    it('has secret_store action', () => { expect(skill).toContain('### secret_store'); });
    it('has secret_retrieve action', () => { expect(skill).toContain('### secret_retrieve'); });
    it('has secret_rotate action', () => { expect(skill).toContain('### secret_rotate'); });
    it('has secret_revoke action', () => { expect(skill).toContain('### secret_revoke'); });
    it('has secret_share action', () => { expect(skill).toContain('### secret_share'); });
    it('has policy_create action', () => { expect(skill).toContain('### policy_create'); });
    it('has audit_query action', () => { expect(skill).toContain('### audit_query'); });
    it('is in security category', () => { expect(skill).toMatch(/category:\s*security/); });
  });

  describe('Eidolon building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has secret_vault building kind', () => { expect(types).toContain("'secret_vault'"); });

    it('has 47 total building kinds', () => {
      const bk = types.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect(bk).toBeTruthy();
      const pipes = (bk![1].match(/\|/g) || []).length;
      expect(pipes).toBe(47);
    });
  });

  describe('Eidolon event kinds', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has secrets.secret_stored event', () => { expect(types).toContain("'secrets.secret_stored'"); });
    it('has secrets.secret_rotated event', () => { expect(types).toContain("'secrets.secret_rotated'"); });
    it('has secrets.access_logged event', () => { expect(types).toContain("'secrets.access_logged'"); });
    it('has secrets.policy_enforced event', () => { expect(types).toContain("'secrets.policy_enforced'"); });

    it('has 204 total event kinds', () => {
      const ek = types.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect(ek).toBeTruthy();
      const pipes = (ek![1].match(/\|/g) || []).length;
      expect(pipes).toBe(204);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has secret_vault case', () => { expect(types).toContain("case 'secret_vault':"); });
    it('has 47 cases', () => {
      const dfn = types.split('districtFor')[1]?.split('function ')[0] || '';
      const cases = (dfn.match(/case '\w+':/g) || []).length;
      expect(cases).toBe(47);
    });
  });

  describe('SUBJECT_MAP', () => {
    const ebus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');

    it('has sven.secrets.secret_stored', () => { expect(ebus).toContain("'sven.secrets.secret_stored'"); });
    it('has sven.secrets.secret_rotated', () => { expect(ebus).toContain("'sven.secrets.secret_rotated'"); });
    it('has sven.secrets.access_logged', () => { expect(ebus).toContain("'sven.secrets.access_logged'"); });
    it('has sven.secrets.policy_enforced', () => { expect(ebus).toContain("'sven.secrets.policy_enforced'"); });

    it('has 203 entries', () => {
      const m = ebus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const entries = (m![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(203);
    });
  });

  describe('Task executor switch cases', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    it('has secret_store case', () => { expect(tex).toContain("case 'secret_store'"); });
    it('has secret_retrieve case', () => { expect(tex).toContain("case 'secret_retrieve'"); });
    it('has secret_rotate case', () => { expect(tex).toContain("case 'secret_rotate'"); });
    it('has secret_revoke case', () => { expect(tex).toContain("case 'secret_revoke'"); });
    it('has secret_share case', () => { expect(tex).toContain("case 'secret_share'"); });
    it('has policy_create case', () => { expect(tex).toContain("case 'policy_create'"); });
    it('has audit_query case', () => { expect(tex).toContain("case 'audit_query'"); });
    it('has 229 total switch cases', () => {
      const count = (tex.match(/case '\w+':/g) || []).length;
      expect(count).toBe(229);
    });
  });

  describe('Task executor handlers', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    it('has handleSecretStore', () => { expect(tex).toContain('handleSecretStore'); });
    it('has handleSecretRetrieve', () => { expect(tex).toContain('handleSecretRetrieve'); });
    it('has handleSecretRotate', () => { expect(tex).toContain('handleSecretRotate'); });
    it('has handleSecretRevoke', () => { expect(tex).toContain('handleSecretRevoke'); });
    it('has handleSecretShare', () => { expect(tex).toContain('handleSecretShare'); });
    it('has handlePolicyCreate', () => { expect(tex).toContain('handlePolicyCreate'); });
    it('has handleAuditQuery', () => { expect(tex).toContain('handleAuditQuery'); });
    it('has 225 total handlers', () => {
      const count = (tex.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(225);
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('covers migration', () => { expect(ga).toContain('agent_secrets_credentials.sql'); });
    it('covers shared types', () => { expect(ga).toContain('agent-secrets-credentials.ts'); });
    it('covers skill', () => { expect(ga).toContain('agent-secrets-credentials/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 64', () => { expect(cl).toContain('Batch 64'); });
    it('mentions Agent Secrets', () => { expect(cl).toContain('Agent Secrets'); });
  });

  describe('Migration count', () => {
    it('has 50 migration files', () => {
      const migs = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
      expect(migs.length).toBe(50);
    });
  });
});
