import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8');
}

// ── Batch 123: DNS Zone Management ──
describe('Batch 123 — DNS Zone Management', () => {
  const mig = readFile('services/gateway-api/migrations/20260617600000_agent_dns_zones.sql');
  const types = readFile('packages/shared/src/agent-dns-zones.ts');
  const skill = readFile('skills/agent-dns-zones/SKILL.md');

  describe('Migration', () => {
    it('creates agent_dns_zones table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_dns_zones'));
    it('creates agent_dns_records table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_dns_records'));
    it('creates agent_dns_change_log table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_dns_change_log'));
    it('has zone_name column', () => expect(mig).toContain('zone_name TEXT NOT NULL'));
    it('has record_type CHECK', () => expect(mig).toContain("record_type IN ('A','AAAA','CNAME','MX','TXT','SRV','NS','CAA','PTR')"));
    it('has change_type CHECK', () => expect(mig).toContain("change_type IN ('create','update','delete','import','export')"));
    it('indexes zone agent', () => expect(mig).toContain('idx_dns_zones_agent'));
    it('indexes records by zone', () => expect(mig).toContain('idx_dns_records_zone'));
  });

  describe('Types', () => {
    it('exports DnsProvider', () => expect(types).toContain("export type DnsProvider"));
    it('exports ManagedDnsRecordType', () => expect(types).toContain("export type ManagedDnsRecordType"));
    it('exports ManagedDnsZone', () => expect(types).toContain("export interface ManagedDnsZone"));
    it('exports ManagedDnsRecord', () => expect(types).toContain("export interface ManagedDnsRecord"));
    it('exports DnsChangeLog', () => expect(types).toContain("export interface DnsChangeLog"));
    it('exports DnsZoneStats', () => expect(types).toContain("export interface DnsZoneStats"));
  });

  describe('Skill', () => {
    it('exists', () => expect(existsSync(join(ROOT, 'skills/agent-dns-zones/SKILL.md'))).toBe(true));
    it('has correct name', () => expect(skill).toContain('name: agent-dns-zones'));
    it('has dns_create_zone trigger', () => expect(skill).toContain('dns_create_zone'));
    it('has dns_report trigger', () => expect(skill).toContain('dns_report'));
    it('has pricing', () => expect(skill).toContain('base: 0.10'));
  });
});

// ── Batch 124: TLS Certificate Management ──
describe('Batch 124 — TLS Certificate Management', () => {
  const mig = readFile('services/gateway-api/migrations/20260617610000_agent_tls_certificates.sql');
  const types = readFile('packages/shared/src/agent-tls-certificates.ts');
  const skill = readFile('skills/agent-tls-certificates/SKILL.md');

  describe('Migration', () => {
    it('creates agent_tls_certificates table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_tls_certificates'));
    it('creates agent_cert_challenges table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_cert_challenges'));
    it('creates agent_cert_deployments table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_cert_deployments'));
    it('has cert_type CHECK', () => expect(mig).toContain("cert_type IN ('dv','ov','ev','self_signed','wildcard')"));
    it('has challenge_type CHECK', () => expect(mig).toContain("challenge_type IN ('http01','dns01','tls_alpn01')"));
    it('indexes certs by expiry', () => expect(mig).toContain('idx_certs_expiry'));
  });

  describe('Types', () => {
    it('exports CertIssuer', () => expect(types).toContain("export type CertIssuer"));
    it('exports CertStatus', () => expect(types).toContain("export type CertStatus"));
    it('exports CertDeploymentStatus', () => expect(types).toContain("export type CertDeploymentStatus"));
    it('exports TlsCertificate', () => expect(types).toContain("export interface TlsCertificate"));
    it('exports CertChallenge', () => expect(types).toContain("export interface CertChallenge"));
    it('exports TlsCertificateStats', () => expect(types).toContain("export interface TlsCertificateStats"));
  });

  describe('Skill', () => {
    it('exists', () => expect(existsSync(join(ROOT, 'skills/agent-tls-certificates/SKILL.md'))).toBe(true));
    it('has correct name', () => expect(skill).toContain('name: agent-tls-certificates'));
    it('has cert_provision trigger', () => expect(skill).toContain('cert_provision'));
    it('has pricing', () => expect(skill).toContain('base: 0.25'));
  });
});

// ── Batch 125: Secrets Vault ──
describe('Batch 125 — Secrets Vault', () => {
  const mig = readFile('services/gateway-api/migrations/20260617620000_agent_secrets_vault.sql');
  const types = readFile('packages/shared/src/agent-secrets-vault.ts');
  const skill = readFile('skills/agent-secrets-vault/SKILL.md');

  describe('Migration', () => {
    it('creates agent_secret_vaults table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_secret_vaults'));
    it('creates agent_secrets table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_secrets'));
    it('creates agent_secret_access_log table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_secret_access_log'));
    it('has engine CHECK', () => expect(mig).toContain("engine IN ('kv','transit','pki','database','ssh')"));
    it('has action CHECK', () => expect(mig).toContain("action IN ('read','write','delete','rotate','seal','unseal','list')"));
    it('has encrypted_data column', () => expect(mig).toContain('encrypted_data BYTEA'));
    it('indexes secrets expiry', () => expect(mig).toContain('idx_secrets_expiry'));
  });

  describe('Types', () => {
    it('exports VaultEngine', () => expect(types).toContain("export type VaultEngine"));
    it('exports VaultAction', () => expect(types).toContain("export type VaultAction"));
    it('exports SecretVault', () => expect(types).toContain("export interface SecretVault"));
    it('exports VaultSecret', () => expect(types).toContain("export interface VaultSecret"));
    it('exports VaultAccessLog', () => expect(types).toContain("export interface VaultAccessLog"));
    it('exports SecretsVaultStats', () => expect(types).toContain("export interface SecretsVaultStats"));
  });

  describe('Skill', () => {
    it('exists', () => expect(existsSync(join(ROOT, 'skills/agent-secrets-vault/SKILL.md'))).toBe(true));
    it('has correct name', () => expect(skill).toContain('name: agent-secrets-vault'));
    it('has vault_store_secret trigger', () => expect(skill).toContain('vault_store_secret'));
    it('has pricing', () => expect(skill).toContain('base: 0.05'));
  });
});

// ── Batch 126: Compliance Audit ──
describe('Batch 126 — Compliance Audit', () => {
  const mig = readFile('services/gateway-api/migrations/20260617630000_agent_compliance_audit.sql');
  const types = readFile('packages/shared/src/agent-compliance-audit.ts');
  const skill = readFile('skills/agent-compliance-audit/SKILL.md');

  describe('Migration', () => {
    it('creates agent_compliance_frameworks table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_compliance_frameworks'));
    it('creates agent_compliance_controls table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_compliance_controls'));
    it('creates agent_audit_reports table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_audit_reports'));
    it('has framework_type CHECK', () => expect(mig).toContain("framework_type IN ('gdpr','soc2','hipaa','pci_dss','iso27001','custom')"));
    it('has severity CHECK', () => expect(mig).toContain("severity IN ('critical','high','medium','low')"));
    it('has compliance_score column', () => expect(mig).toContain('compliance_score NUMERIC'));
    it('indexes by framework type', () => expect(mig).toContain('idx_frameworks_type'));
  });

  describe('Types', () => {
    it('exports ComplianceFrameworkType', () => expect(types).toContain("export type ComplianceFrameworkType"));
    it('exports ControlStatus', () => expect(types).toContain("export type ControlStatus"));
    it('exports ControlSeverity', () => expect(types).toContain("export type ControlSeverity"));
    it('exports AuditComplianceFramework', () => expect(types).toContain("export interface AuditComplianceFramework"));
    it('exports ComplianceControl', () => expect(types).toContain("export interface ComplianceControl"));
    it('exports AuditReport', () => expect(types).toContain("export interface AuditReport"));
    it('exports ComplianceAuditStats', () => expect(types).toContain("export interface ComplianceAuditStats"));
  });

  describe('Skill', () => {
    it('exists', () => expect(existsSync(join(ROOT, 'skills/agent-compliance-audit/SKILL.md'))).toBe(true));
    it('has correct name', () => expect(skill).toContain('name: agent-compliance-audit'));
    it('has compliance_run_audit trigger', () => expect(skill).toContain('compliance_run_audit'));
    it('has pricing', () => expect(skill).toContain('base: 5.00'));
  });
});

// ── Batch 127: Rate Limiting ──
describe('Batch 127 — Rate Limiting', () => {
  const mig = readFile('services/gateway-api/migrations/20260617640000_agent_rate_limiting.sql');
  const types = readFile('packages/shared/src/agent-rate-limiting.ts');
  const skill = readFile('skills/agent-rate-limiting/SKILL.md');

  describe('Migration', () => {
    it('creates agent_rate_limit_policies table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_rate_limit_policies'));
    it('creates agent_rate_limit_counters table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_rate_limit_counters'));
    it('creates agent_rate_limit_overrides table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_rate_limit_overrides'));
    it('has scope CHECK', () => expect(mig).toContain("scope IN ('global','per_agent','per_ip','per_api_key','per_endpoint')"));
    it('has throttle_strategy CHECK', () => expect(mig).toContain("throttle_strategy IN ('reject','queue','throttle','degrade')"));
    it('has override_type CHECK', () => expect(mig).toContain("override_type IN ('whitelist','blacklist','custom_limit','temporary_boost')"));
    it('indexes by scope', () => expect(mig).toContain('idx_rl_policies_scope'));
  });

  describe('Types', () => {
    it('exports RateLimitScope', () => expect(types).toContain("export type RateLimitScope"));
    it('exports ThrottleStrategy', () => expect(types).toContain("export type ThrottleStrategy"));
    it('exports RateLimitPolicy', () => expect(types).toContain("export interface RateLimitPolicy"));
    it('exports RateLimitCounter', () => expect(types).toContain("export interface RateLimitCounter"));
    it('exports RateLimitOverride', () => expect(types).toContain("export interface RateLimitOverride"));
    it('exports RateLimitingStats', () => expect(types).toContain("export interface RateLimitingStats"));
  });

  describe('Skill', () => {
    it('exists', () => expect(existsSync(join(ROOT, 'skills/agent-rate-limiting/SKILL.md'))).toBe(true));
    it('has correct name', () => expect(skill).toContain('name: agent-rate-limiting'));
    it('has ratelimit_create_policy trigger', () => expect(skill).toContain('ratelimit_create_policy'));
    it('has pricing', () => expect(skill).toContain('base: 0.10'));
  });
});

// ── Wiring Tests ──
describe('Batches 123-127 — Wiring', () => {
  const eidolon = readFile('services/sven-eidolon/src/types.ts');
  const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');
  const taskExec = readFile('services/sven-marketplace/src/task-executor.ts');
  const sharedIdx = readFile('packages/shared/src/index.ts');
  const gitattr = readFile('.gitattributes');

  describe('Shared index.ts', () => {
    it('exports dns-zones', () => expect(sharedIdx).toContain("./agent-dns-zones.js"));
    it('exports tls-certificates', () => expect(sharedIdx).toContain("./agent-tls-certificates.js"));
    it('exports secrets-vault', () => expect(sharedIdx).toContain("./agent-secrets-vault.js"));
    it('exports compliance-audit', () => expect(sharedIdx).toContain("./agent-compliance-audit.js"));
    it('exports rate-limiting', () => expect(sharedIdx).toContain("./agent-rate-limiting.js"));
  });

  describe('Eidolon BK', () => {
    it('has dns_registry', () => expect(eidolon).toContain("'dns_registry'"));
    it('has cert_tower', () => expect(eidolon).toContain("'cert_tower'"));
    it('has secret_vault', () => expect(eidolon).toContain("'secret_vault'"));
    it('has audit_hall', () => expect(eidolon).toContain("'audit_hall'"));
    it('has rate_gate', () => expect(eidolon).toContain("'rate_gate'"));
  });

  describe('Eidolon EK', () => {
    it('has dns.zone_created', () => expect(eidolon).toContain("'dns.zone_created'"));
    it('has cert.provisioned', () => expect(eidolon).toContain("'cert.provisioned'"));
    it('has vault.secret_stored', () => expect(eidolon).toContain("'vault.secret_stored'"));
    it('has compliance.audit_completed', () => expect(eidolon).toContain("'compliance.audit_completed'"));
    it('has ratelimit.policy_created', () => expect(eidolon).toContain("'ratelimit.policy_created'"));
  });

  describe('Eidolon districtFor', () => {
    const matches = eidolon.match(/case 'dns_registry'/g) || [];
    it('dns_registry in districtFor', () => expect(matches.length).toBeGreaterThanOrEqual(1));
  });

  describe('Event Bus', () => {
    it('has dns.zone_created subject', () => expect(eventBus).toContain("'sven.dns.zone_created'"));
    it('has cert.provisioned subject', () => expect(eventBus).toContain("'sven.cert.provisioned'"));
    it('has vault.secret_stored subject', () => expect(eventBus).toContain("'sven.vault.secret_stored'"));
    it('has compliance.audit_completed subject', () => expect(eventBus).toContain("'sven.compliance.audit_completed'"));
    it('has ratelimit.policy_created subject', () => expect(eventBus).toContain("'sven.ratelimit.policy_created'"));
  });

  describe('Task Executor switch cases', () => {
    it('has dns_create_zone', () => expect(taskExec).toContain("case 'dns_create_zone'"));
    it('has cert_provision', () => expect(taskExec).toContain("case 'cert_provision'"));
    it('has vault_create', () => expect(taskExec).toContain("case 'vault_create'"));
    it('has compliance_run_audit', () => expect(taskExec).toContain("case 'compliance_run_audit'"));
    it('has ratelimit_create_policy', () => expect(taskExec).toContain("case 'ratelimit_create_policy'"));
  });

  describe('Task Executor handlers', () => {
    it('has handleDnsCreateZone', () => expect(taskExec).toContain('handleDnsCreateZone'));
    it('has handleCertProvision', () => expect(taskExec).toContain('handleCertProvision'));
    it('has handleVaultCreate', () => expect(taskExec).toContain('handleVaultCreate'));
    it('has handleComplianceRunAudit', () => expect(taskExec).toContain('handleComplianceRunAudit'));
    it('has handleRatelimitCreatePolicy', () => expect(taskExec).toContain('handleRatelimitCreatePolicy'));
  });

  describe('.gitattributes', () => {
    it('has dns-zones entries', () => expect(gitattr).toContain('agent_dns_zones.sql'));
    it('has tls-certificates entries', () => expect(gitattr).toContain('agent_tls_certificates.sql'));
    it('has secrets-vault entries', () => expect(gitattr).toContain('agent_secrets_vault.sql'));
    it('has compliance-audit entries', () => expect(gitattr).toContain('agent_compliance_audit.sql'));
    it('has rate-limiting entries', () => expect(gitattr).toContain('agent_rate_limiting.sql'));
  });
});
