import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 188-192: Security & Networking', () => {

  // ─── Batch 188: Credential Manager ───
  describe('Credential Manager Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618250000_agent_credential_manager.sql'), 'utf-8');
    it('creates agent_credential_stores table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_credential_stores'));
    it('creates agent_credentials table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_credentials'));
    it('creates agent_credential_audits table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_credential_audits'));
    it('has store_type check constraint', () => expect(sql).toContain("('vault','keychain','env_vars','config_file','kms','hsm')"));
    it('has store status check constraint', () => expect(sql).toContain("('active','locked','rotating','archived','compromised')"));
    it('has credential_type check constraint', () => expect(sql).toContain("('api_key','password','token','certificate','ssh_key','oauth','service_account')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_credential_stores_agent');
      expect(sql).toContain('idx_agent_credentials_store');
      expect(sql).toContain('idx_agent_credential_audits_credential');
    });
  });

  describe('Credential Manager Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-credential-manager.ts'), 'utf-8');
    it('exports CredentialStoreType', () => expect(ts).toContain('export type CredentialStoreType'));
    it('exports CredentialStoreStatus', () => expect(ts).toContain('export type CredentialStoreStatus'));
    it('exports CredentialType', () => expect(ts).toContain('export type CredentialType'));
    it('exports CredentialStatus', () => expect(ts).toContain('export type CredentialStatus'));
    it('exports CredentialAuditAction', () => expect(ts).toContain('export type CredentialAuditAction'));
    it('exports CredentialRiskLevel', () => expect(ts).toContain('export type CredentialRiskLevel'));
    it('exports CredentialStore interface', () => expect(ts).toContain('export interface CredentialStore'));
    it('exports AgentCredential interface', () => expect(ts).toContain('export interface AgentCredential'));
    it('exports CredentialAudit interface', () => expect(ts).toContain('export interface CredentialAudit'));
  });

  describe('Credential Manager SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-credential-manager/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description field', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references credential management', () => expect(md.toLowerCase()).toContain('credential'));
  });

  // ─── Batch 189: Certificate Manager ───
  describe('Certificate Manager Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618260000_agent_certificate_manager.sql'), 'utf-8');
    it('creates agent_certificate_authorities table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_certificate_authorities'));
    it('creates agent_certificates table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_certificates'));
    it('creates agent_certificate_renewals table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_certificate_renewals'));
    it('has ca_type check constraint', () => expect(sql).toContain("('root','intermediate','external','acme','self_signed')"));
    it('has key_algorithm check constraint', () => expect(sql).toContain("('rsa-2048','rsa-4096','ecdsa-256','ecdsa-384','ed25519')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_certificate_authorities_agent');
      expect(sql).toContain('idx_agent_certificates_ca');
      expect(sql).toContain('idx_agent_certificate_renewals_cert');
    });
  });

  describe('Certificate Manager Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-certificate-manager.ts'), 'utf-8');
    it('exports CertificateAuthorityType', () => expect(ts).toContain('export type CertificateAuthorityType'));
    it('exports CertificateAuthorityStatus', () => expect(ts).toContain('export type CertificateAuthorityStatus'));
    it('exports CertificateKeyAlgorithm', () => expect(ts).toContain('export type CertificateKeyAlgorithm'));
    it('exports CertificateType', () => expect(ts).toContain('export type CertificateType'));
    it('exports CertificateStatus', () => expect(ts).toContain('export type CertificateStatus'));
    it('exports CertificateRenewalType', () => expect(ts).toContain('export type CertificateRenewalType'));
    it('exports CertificateRenewalStatus', () => expect(ts).toContain('export type CertificateRenewalStatus'));
    it('exports CertificateAuthority interface', () => expect(ts).toContain('export interface CertificateAuthority'));
    it('exports AgentCertificate interface', () => expect(ts).toContain('export interface AgentCertificate'));
    it('exports CertificateRenewal interface', () => expect(ts).toContain('export interface CertificateRenewal'));
  });

  describe('Certificate Manager SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-certificate-manager/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description field', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references certificate management', () => expect(md.toLowerCase()).toContain('certificate'));
  });

  // ─── Batch 190: VPN Gateway ───
  describe('VPN Gateway Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618270000_agent_vpn_gateway.sql'), 'utf-8');
    it('creates agent_vpn_networks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vpn_networks'));
    it('creates agent_vpn_peers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vpn_peers'));
    it('creates agent_vpn_sessions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vpn_sessions'));
    it('has network_type check constraint', () => expect(sql).toContain("('wireguard','openvpn','ipsec','site_to_site','mesh','overlay')"));
    it('has peer_type check constraint', () => expect(sql).toContain("('client','server','relay','gateway','mobile')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_vpn_networks_agent');
      expect(sql).toContain('idx_agent_vpn_peers_network');
      expect(sql).toContain('idx_agent_vpn_sessions_peer');
    });
  });

  describe('VPN Gateway Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-vpn-gateway.ts'), 'utf-8');
    it('exports VpnNetworkType', () => expect(ts).toContain('export type VpnNetworkType'));
    it('exports VpnNetworkStatus', () => expect(ts).toContain('export type VpnNetworkStatus'));
    it('exports VpnPeerType', () => expect(ts).toContain('export type VpnPeerType'));
    it('exports VpnPeerStatus', () => expect(ts).toContain('export type VpnPeerStatus'));
    it('exports VpnSessionType', () => expect(ts).toContain('export type VpnSessionType'));
    it('exports VpnSessionStatus', () => expect(ts).toContain('export type VpnSessionStatus'));
    it('exports VpnNetwork interface', () => expect(ts).toContain('export interface VpnNetwork'));
    it('exports VpnPeer interface', () => expect(ts).toContain('export interface VpnPeer'));
    it('exports VpnSession interface', () => expect(ts).toContain('export interface VpnSession'));
  });

  describe('VPN Gateway SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-vpn-gateway/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description field', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references VPN', () => expect(md.toLowerCase()).toContain('vpn'));
  });

  // ─── Batch 191: Proxy Router ───
  describe('Proxy Router Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618280000_agent_proxy_router.sql'), 'utf-8');
    it('creates agent_proxy_upstreams table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_upstreams'));
    it('creates agent_proxy_routes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_routes'));
    it('creates agent_proxy_access_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_access_logs'));
    it('has upstream_type check constraint', () => expect(sql).toContain("('http','https','tcp','udp','grpc','websocket')"));
    it('has route_type check constraint', () => expect(sql).toContain("('prefix','exact','regex','host_header','weighted','canary')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_proxy_upstreams_agent');
      expect(sql).toContain('idx_agent_proxy_routes_upstream');
      expect(sql).toContain('idx_agent_proxy_access_logs_route');
    });
  });

  describe('Proxy Router Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-proxy-router.ts'), 'utf-8');
    it('exports ProxyUpstreamType', () => expect(ts).toContain('export type ProxyUpstreamType'));
    it('exports ProxyUpstreamStatus', () => expect(ts).toContain('export type ProxyUpstreamStatus'));
    it('exports ProxyRouteType', () => expect(ts).toContain('export type ProxyRouteType'));
    it('exports ProxyCacheStatus', () => expect(ts).toContain('export type ProxyCacheStatus'));
    it('exports ProxyUpstream interface', () => expect(ts).toContain('export interface ProxyUpstream'));
    it('exports ProxyRoute interface', () => expect(ts).toContain('export interface ProxyRoute'));
    it('exports ProxyAccessLog interface', () => expect(ts).toContain('export interface ProxyAccessLog'));
  });

  describe('Proxy Router SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-proxy-router/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description field', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references proxy', () => expect(md.toLowerCase()).toContain('proxy'));
  });

  // ─── Batch 192: Access Controller ───
  describe('Access Controller Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618290000_agent_access_controller.sql'), 'utf-8');
    it('creates agent_access_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_access_policies'));
    it('creates agent_access_roles table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_access_roles'));
    it('creates agent_access_grants table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_access_grants'));
    it('has policy_type check constraint', () => expect(sql).toContain("('rbac','abac','acl','mandatory','discretionary','rule_based')"));
    it('has role_type check constraint', () => expect(sql).toContain("('admin','operator','viewer','auditor','service','custom')"));
    it('has grant_type check constraint', () => expect(sql).toContain("('permanent','temporary','scheduled','conditional','emergency')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_access_policies_agent');
      expect(sql).toContain('idx_agent_access_roles_policy');
      expect(sql).toContain('idx_agent_access_grants_role');
    });
  });

  describe('Access Controller Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-access-controller.ts'), 'utf-8');
    it('exports AccessPolicyType', () => expect(ts).toContain('export type AccessPolicyType'));
    it('exports AccessPolicyStatus', () => expect(ts).toContain('export type AccessPolicyStatus'));
    it('exports AccessPolicyEffect', () => expect(ts).toContain('export type AccessPolicyEffect'));
    it('exports AccessRoleType', () => expect(ts).toContain('export type AccessRoleType'));
    it('exports AccessRoleScope', () => expect(ts).toContain('export type AccessRoleScope'));
    it('exports AccessSubjectType', () => expect(ts).toContain('export type AccessSubjectType'));
    it('exports AccessGrantType', () => expect(ts).toContain('export type AccessGrantType'));
    it('exports AccessPolicy interface', () => expect(ts).toContain('export interface AccessPolicy'));
    it('exports AccessRole interface', () => expect(ts).toContain('export interface AccessRole'));
    it('exports AccessGrant interface', () => expect(ts).toContain('export interface AccessGrant'));
  });

  describe('Access Controller SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-access-controller/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description field', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references access control', () => expect(md.toLowerCase()).toContain('access'));
  });

  // ─── Cross-Batch: Barrel Exports ───
  describe('Barrel Exports (index.ts)', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-credential-manager', () => expect(idx).toContain("from './agent-credential-manager.js'"));
    it('exports agent-certificate-manager', () => expect(idx).toContain("from './agent-certificate-manager.js'"));
    it('exports agent-vpn-gateway', () => expect(idx).toContain("from './agent-vpn-gateway.js'"));
    it('exports agent-proxy-router', () => expect(idx).toContain("from './agent-proxy-router.js'"));
    it('exports agent-access-controller', () => expect(idx).toContain("from './agent-access-controller.js'"));
  });

  // ─── Cross-Batch: Eidolon Types ───
  describe('Eidolon BuildingKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has credential_manager BK', () => expect(types).toContain("'credential_manager'"));
    it('has certificate_manager BK', () => expect(types).toContain("'certificate_manager'"));
    it('has vpn_gateway BK', () => expect(types).toContain("'vpn_gateway'"));
    it('has proxy_router BK', () => expect(types).toContain("'proxy_router'"));
    it('has access_controller BK', () => expect(types).toContain("'access_controller'"));
  });

  describe('Eidolon EventKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has credential.store_created EK', () => expect(types).toContain("'credential.store_created'"));
    it('has credential.rotated EK', () => expect(types).toContain("'credential.rotated'"));
    it('has credential.leaked EK', () => expect(types).toContain("'credential.leaked'"));
    it('has credential.audit_completed EK', () => expect(types).toContain("'credential.audit_completed'"));
    it('has certificate.ca_created EK', () => expect(types).toContain("'certificate.ca_created'"));
    it('has certificate.issued EK', () => expect(types).toContain("'certificate.issued'"));
    it('has certificate.renewed EK', () => expect(types).toContain("'certificate.renewed'"));
    it('has certificate.revoked EK', () => expect(types).toContain("'certificate.revoked'"));
    it('has vpn.network_created EK', () => expect(types).toContain("'vpn.network_created'"));
    it('has vpn.peer_connected EK', () => expect(types).toContain("'vpn.peer_connected'"));
    it('has vpn.session_established EK', () => expect(types).toContain("'vpn.session_established'"));
    it('has vpn.tunnel_failed EK', () => expect(types).toContain("'vpn.tunnel_failed'"));
    it('has proxy.upstream_added EK', () => expect(types).toContain("'proxy.upstream_added'"));
    it('has proxy.route_configured EK', () => expect(types).toContain("'proxy.route_configured'"));
    it('has proxy.health_failed EK', () => expect(types).toContain("'proxy.health_failed'"));
    it('has proxy.traffic_anomaly EK', () => expect(types).toContain("'proxy.traffic_anomaly'"));
    it('has access.policy_created EK', () => expect(types).toContain("'access.policy_created'"));
    it('has access.grant_issued EK', () => expect(types).toContain("'access.grant_issued'"));
    it('has access.grant_revoked EK', () => expect(types).toContain("'access.grant_revoked'"));
    it('has access.violation_detected EK', () => expect(types).toContain("'access.violation_detected'"));
  });

  describe('Eidolon districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps credential_manager to a district', () => expect(types).toContain("case 'credential_manager':"));
    it('maps certificate_manager to a district', () => expect(types).toContain("case 'certificate_manager':"));
    it('maps vpn_gateway to a district', () => expect(types).toContain("case 'vpn_gateway':"));
    it('maps proxy_router to a district', () => expect(types).toContain("case 'proxy_router':"));
    it('maps access_controller to a district', () => expect(types).toContain("case 'access_controller':"));
  });

  // ─── Cross-Batch: Event Bus ───
  describe('Event Bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.credential.store_created', () => expect(eb).toContain("'sven.credential.store_created'"));
    it('has sven.credential.rotated', () => expect(eb).toContain("'sven.credential.rotated'"));
    it('has sven.credential.leaked', () => expect(eb).toContain("'sven.credential.leaked'"));
    it('has sven.credential.audit_completed', () => expect(eb).toContain("'sven.credential.audit_completed'"));
    it('has sven.certificate.ca_created', () => expect(eb).toContain("'sven.certificate.ca_created'"));
    it('has sven.certificate.issued', () => expect(eb).toContain("'sven.certificate.issued'"));
    it('has sven.certificate.renewed', () => expect(eb).toContain("'sven.certificate.renewed'"));
    it('has sven.certificate.revoked', () => expect(eb).toContain("'sven.certificate.revoked'"));
    it('has sven.vpn.network_created', () => expect(eb).toContain("'sven.vpn.network_created'"));
    it('has sven.vpn.peer_connected', () => expect(eb).toContain("'sven.vpn.peer_connected'"));
    it('has sven.vpn.session_established', () => expect(eb).toContain("'sven.vpn.session_established'"));
    it('has sven.vpn.tunnel_failed', () => expect(eb).toContain("'sven.vpn.tunnel_failed'"));
    it('has sven.proxy.upstream_added', () => expect(eb).toContain("'sven.proxy.upstream_added'"));
    it('has sven.proxy.route_configured', () => expect(eb).toContain("'sven.proxy.route_configured'"));
    it('has sven.proxy.health_failed', () => expect(eb).toContain("'sven.proxy.health_failed'"));
    it('has sven.proxy.traffic_anomaly', () => expect(eb).toContain("'sven.proxy.traffic_anomaly'"));
    it('has sven.access.policy_created', () => expect(eb).toContain("'sven.access.policy_created'"));
    it('has sven.access.grant_issued', () => expect(eb).toContain("'sven.access.grant_issued'"));
    it('has sven.access.grant_revoked', () => expect(eb).toContain("'sven.access.grant_revoked'"));
    it('has sven.access.violation_detected', () => expect(eb).toContain("'sven.access.violation_detected'"));
  });

  // ─── Cross-Batch: Task Executor ───
  describe('Task Executor Switch Cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'credential_create_store', 'credential_add_credential', 'credential_rotate',
      'credential_audit', 'credential_detect_leaks', 'credential_revoke',
      'certificate_create_ca', 'certificate_issue', 'certificate_renew',
      'certificate_revoke_cert', 'certificate_monitor_expiry', 'certificate_verify_chain',
      'vpn_create_network', 'vpn_add_peer', 'vpn_monitor_sessions',
      'vpn_rotate_keys', 'vpn_diagnose_tunnel', 'vpn_generate_config',
      'proxy_create_upstream', 'proxy_add_route', 'proxy_configure_rate_limit',
      'proxy_analyze_traffic', 'proxy_update_weights', 'proxy_toggle_maintenance',
      'access_create_policy', 'access_define_role', 'access_grant_access',
      'access_revoke_access', 'access_evaluate_access', 'access_audit_grants',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task Executor Handler Methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleCredentialCreateStore', 'handleCredentialAddCredential', 'handleCredentialRotate',
      'handleCredentialAudit', 'handleCredentialDetectLeaks', 'handleCredentialRevoke',
      'handleCertificateCreateCa', 'handleCertificateIssue', 'handleCertificateRenew',
      'handleCertificateRevokeCert', 'handleCertificateMonitorExpiry', 'handleCertificateVerifyChain',
      'handleVpnCreateNetwork', 'handleVpnAddPeer', 'handleVpnMonitorSessions',
      'handleVpnRotateKeys', 'handleVpnDiagnoseTunnel', 'handleVpnGenerateConfig',
      'handleProxyCreateUpstream', 'handleProxyAddRoute', 'handleProxyConfigureRateLimit',
      'handleProxyAnalyzeTraffic', 'handleProxyUpdateWeights', 'handleProxyToggleMaintenance',
      'handleAccessCreatePolicy', 'handleAccessDefineRole', 'handleAccessGrantAccess',
      'handleAccessRevokeAccess', 'handleAccessEvaluateAccess', 'handleAccessAuditGrants',
    ];
    for (const h of handlers) {
      it(`has method ${h}`, () => expect(te).toContain(`${h}(task`));
    }
  });

  // ─── Cross-Batch: .gitattributes ───
  describe('.gitattributes Privacy Filters', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters credential-manager migration', () => expect(ga).toContain('20260618250000_agent_credential_manager.sql'));
    it('filters credential-manager types', () => expect(ga).toContain('agent-credential-manager.ts'));
    it('filters credential-manager SKILL', () => expect(ga).toContain('agent-credential-manager/SKILL.md'));
    it('filters certificate-manager migration', () => expect(ga).toContain('20260618260000_agent_certificate_manager.sql'));
    it('filters certificate-manager types', () => expect(ga).toContain('agent-certificate-manager.ts'));
    it('filters certificate-manager SKILL', () => expect(ga).toContain('agent-certificate-manager/SKILL.md'));
    it('filters vpn-gateway migration', () => expect(ga).toContain('20260618270000_agent_vpn_gateway.sql'));
    it('filters vpn-gateway types', () => expect(ga).toContain('agent-vpn-gateway.ts'));
    it('filters vpn-gateway SKILL', () => expect(ga).toContain('agent-vpn-gateway/SKILL.md'));
    it('filters proxy-router migration', () => expect(ga).toContain('20260618280000_agent_proxy_router.sql'));
    it('filters proxy-router types', () => expect(ga).toContain('agent-proxy-router.ts'));
    it('filters proxy-router SKILL', () => expect(ga).toContain('agent-proxy-router/SKILL.md'));
    it('filters access-controller migration', () => expect(ga).toContain('20260618290000_agent_access_controller.sql'));
    it('filters access-controller types', () => expect(ga).toContain('agent-access-controller.ts'));
    it('filters access-controller SKILL', () => expect(ga).toContain('agent-access-controller/SKILL.md'));
  });
});
