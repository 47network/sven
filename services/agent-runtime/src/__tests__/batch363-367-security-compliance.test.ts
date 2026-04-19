import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 363-367 — Security & Compliance', () => {

  // ── Batch 363: Encryption Manager ──────────────────────────────────

  describe('Batch 363 — Encryption Manager migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260620000000_agent_encryption_manager.sql'), 'utf-8');
    it('creates agent_encryption_manager_configs', () => expect(sql).toContain('agent_encryption_manager_configs'));
    it('creates agent_encryption_keys', () => expect(sql).toContain('agent_encryption_keys'));
    it('creates agent_encrypted_data_registry', () => expect(sql).toContain('agent_encrypted_data_registry'));
    it('has index on keys agent', () => expect(sql).toContain('idx_encryption_keys_agent'));
    it('has index on keys status', () => expect(sql).toContain('idx_encryption_keys_status'));
    it('references config FK', () => expect(sql).toContain('REFERENCES agent_encryption_manager_configs(id)'));
  });

  describe('Batch 363 — Encryption Manager types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-encryption-manager.ts'), 'utf-8');
    const enums = ['EncryptionAlgorithm', 'KeyStatus', 'KeyPurpose', 'DataType'];
    const ifaces = ['EncryptionManagerConfig', 'EncryptionKey', 'EncryptedDataRegistry'];
    enums.forEach(e => it(`exports ${e}`, () => expect(src).toContain(e)));
    ifaces.forEach(i => it(`exports ${i}`, () => expect(src).toContain(i)));
    it('has aes-256-gcm algorithm', () => expect(src).toContain('aes-256-gcm'));
    it('has chacha20-poly1305', () => expect(src).toContain('chacha20-poly1305'));
  });

  describe('Batch 363 — Encryption Manager SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/encryption-manager/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('encryption-manager'));
    it('has price 15.99', () => expect(md).toContain('15.99'));
    it('has archetype engineer', () => expect(md).toContain('engineer'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has generate-key action', () => expect(md).toContain('generate-key'));
    it('has rotate-key action', () => expect(md).toContain('rotate-key'));
  });

  // ── Batch 364: Certificate Rotator ─────────────────────────────────

  describe('Batch 364 — Certificate Rotator migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260620010000_agent_certificate_rotator.sql'), 'utf-8');
    it('creates agent_certificate_rotator_configs', () => expect(sql).toContain('agent_certificate_rotator_configs'));
    it('creates agent_certificates', () => expect(sql).toContain('agent_certificates'));
    it('creates agent_cert_rotation_logs', () => expect(sql).toContain('agent_cert_rotation_logs'));
    it('has index on certs expires', () => expect(sql).toContain('idx_certificates_expires'));
    it('has auto_renew column', () => expect(sql).toContain('auto_renew'));
    it('references rotator config FK', () => expect(sql).toContain('REFERENCES agent_certificate_rotator_configs(id)'));
  });

  describe('Batch 364 — Certificate Rotator types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-certificate-rotator.ts'), 'utf-8');
    const enums = ['RotationStrategy', 'CertAuthority', 'CertKeyType', 'CertStatus'];
    const ifaces = ['CertificateRotatorConfig', 'Certificate', 'CertRotationLog'];
    enums.forEach(e => it(`exports ${e}`, () => expect(src).toContain(e)));
    ifaces.forEach(i => it(`exports ${i}`, () => expect(src).toContain(i)));
    it('has lets_encrypt authority', () => expect(src).toContain('lets_encrypt'));
    it('has ecdsa_p256 key type', () => expect(src).toContain('ecdsa_p256'));
  });

  describe('Batch 364 — Certificate Rotator SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/certificate-rotator/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('certificate-rotator'));
    it('has price 12.99', () => expect(md).toContain('12.99'));
    it('has archetype engineer', () => expect(md).toContain('engineer'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has issue-cert action', () => expect(md).toContain('issue-cert'));
    it('has rotate-cert action', () => expect(md).toContain('rotate-cert'));
  });

  // ── Batch 365: Vulnerability Assessor ──────────────────────────────

  describe('Batch 365 — Vulnerability Assessor migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260620020000_agent_vulnerability_assessor.sql'), 'utf-8');
    it('creates agent_vulnerability_assessor_configs', () => expect(sql).toContain('agent_vulnerability_assessor_configs'));
    it('creates agent_vulnerability_assessments', () => expect(sql).toContain('agent_vulnerability_assessments'));
    it('creates agent_assessment_findings', () => expect(sql).toContain('agent_assessment_findings'));
    it('has index on findings severity', () => expect(sql).toContain('idx_findings_severity'));
    it('has cvss_score column', () => expect(sql).toContain('cvss_score'));
    it('has cve_id column', () => expect(sql).toContain('cve_id'));
  });

  describe('Batch 365 — Vulnerability Assessor types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-vulnerability-assessor.ts'), 'utf-8');
    const enums = ['ScanFrequency', 'AssessorSeverity', 'AssessmentStatus', 'FindingStatus'];
    const ifaces = ['VulnerabilityAssessorConfig', 'VulnerabilityAssessment', 'AssessmentFinding'];
    enums.forEach(e => it(`exports ${e}`, () => expect(src).toContain(e)));
    ifaces.forEach(i => it(`exports ${i}`, () => expect(src).toContain(i)));
    it('has critical severity', () => expect(src).toContain("'critical'"));
    it('has false_positive status', () => expect(src).toContain('false_positive'));
  });

  describe('Batch 365 — Vulnerability Assessor SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/vulnerability-assessor/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('vulnerability-assessor'));
    it('has price 18.99', () => expect(md).toContain('18.99'));
    it('has archetype analyst', () => expect(md).toContain('analyst'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has start-assessment action', () => expect(md).toContain('start-assessment'));
    it('has check-cve action', () => expect(md).toContain('check-cve'));
  });

  // ── Batch 366: Compliance Reporter ─────────────────────────────────

  describe('Batch 366 — Compliance Reporter migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260620030000_agent_compliance_reporter.sql'), 'utf-8');
    it('creates agent_compliance_reporter_configs', () => expect(sql).toContain('agent_compliance_reporter_configs'));
    it('creates agent_compliance_reports', () => expect(sql).toContain('agent_compliance_reports'));
    it('creates agent_compliance_evidence', () => expect(sql).toContain('agent_compliance_evidence'));
    it('has index on reports framework', () => expect(sql).toContain('idx_compliance_reports_framework'));
    it('has overall_score column', () => expect(sql).toContain('overall_score'));
    it('has passing_controls column', () => expect(sql).toContain('passing_controls'));
  });

  describe('Batch 366 — Compliance Reporter types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-compliance-reporter.ts'), 'utf-8');
    const enums = ['ComplianceFramework', 'ReportFrequency', 'ReportStatus', 'EvidenceStatus'];
    const ifaces = ['ComplianceReporterConfig', 'ComplianceReport', 'ComplianceEvidence'];
    enums.forEach(e => it(`exports ${e}`, () => expect(src).toContain(e)));
    ifaces.forEach(i => it(`exports ${i}`, () => expect(src).toContain(i)));
    it('has soc2 framework', () => expect(src).toContain("'soc2'"));
    it('has gdpr framework', () => expect(src).toContain("'gdpr'"));
  });

  describe('Batch 366 — Compliance Reporter SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/compliance-reporter/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('compliance-reporter'));
    it('has price 24.99', () => expect(md).toContain('24.99'));
    it('has archetype analyst', () => expect(md).toContain('analyst'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has generate-report action', () => expect(md).toContain('generate-report'));
    it('has collect-evidence action', () => expect(md).toContain('collect-evidence'));
  });

  // ── Batch 367: Identity Resolver ───────────────────────────────────

  describe('Batch 367 — Identity Resolver migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260620040000_agent_identity_resolver.sql'), 'utf-8');
    it('creates agent_identity_resolver_configs', () => expect(sql).toContain('agent_identity_resolver_configs'));
    it('creates agent_identity_records', () => expect(sql).toContain('agent_identity_records'));
    it('creates agent_identity_resolution_logs', () => expect(sql).toContain('agent_identity_resolution_logs'));
    it('has index on records external', () => expect(sql).toContain('idx_identity_records_external'));
    it('has verified column', () => expect(sql).toContain('verified'));
    it('references resolver config FK', () => expect(sql).toContain('REFERENCES agent_identity_resolver_configs(id)'));
  });

  describe('Batch 367 — Identity Resolver types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-identity-resolver.ts'), 'utf-8');
    const enums = ['ResolutionStrategy', 'IdentityType', 'IdentityStatus', 'IdentityProvider'];
    const ifaces = ['IdentityResolverConfig', 'IdentityRecord', 'IdentityResolutionLog'];
    enums.forEach(e => it(`exports ${e}`, () => expect(src).toContain(e)));
    ifaces.forEach(i => it(`exports ${i}`, () => expect(src).toContain(i)));
    it('has federated strategy', () => expect(src).toContain("'federated'"));
    it('has oidc provider', () => expect(src).toContain("'oidc'"));
  });

  describe('Batch 367 — Identity Resolver SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/identity-resolver/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('identity-resolver'));
    it('has price 13.99', () => expect(md).toContain('13.99'));
    it('has archetype engineer', () => expect(md).toContain('engineer'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has resolve-identity action', () => expect(md).toContain('resolve-identity'));
    it('has sync-provider action', () => expect(md).toContain('sync-provider'));
  });

  // ── Cross-cutting: Barrel exports ──────────────────────────────────

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    const modules = ['agent-encryption-manager', 'agent-certificate-rotator', 'agent-vulnerability-assessor', 'agent-compliance-reporter', 'agent-identity-resolver'];
    modules.forEach(m => it(`exports ${m}`, () => expect(idx).toContain(m)));
  });

  // ── Cross-cutting: Eidolon BK + EK + districtFor ──────────────────

  describe('Eidolon types wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['encryption_manager', 'certificate_rotator', 'vulnerability_assessor', 'compliance_reporter', 'identity_resolver'];
    bks.forEach(bk => it(`BK includes ${bk}`, () => expect(types).toContain(`'${bk}'`)));

    const eks = ['encm.key_generated', 'encm.key_rotated', 'encm.data_encrypted', 'encm.key_destroyed',
      'crtr.cert_issued', 'crtr.cert_renewed', 'crtr.cert_rotated', 'crtr.cert_revoked',
      'vlas.assessment_started', 'vlas.assessment_completed', 'vlas.finding_reported', 'vlas.remediation_applied',
      'cmrp.report_generated', 'cmrp.evidence_collected', 'cmrp.posture_scored', 'cmrp.audit_exported',
      'idrs.identity_resolved', 'idrs.identity_verified', 'idrs.provider_synced', 'idrs.access_audited'];
    eks.forEach(ek => it(`EK includes ${ek}`, () => expect(types).toContain(`'${ek}'`)));

    bks.forEach(bk => it(`districtFor has case '${bk}'`, () => expect(types).toContain(`case '${bk}':`)));
  });

  // ── Cross-cutting: SUBJECT_MAP ─────────────────────────────────────

  describe('SUBJECT_MAP entries', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.encm.key_generated', 'sven.encm.key_rotated', 'sven.encm.data_encrypted', 'sven.encm.key_destroyed',
      'sven.crtr.cert_issued', 'sven.crtr.cert_renewed', 'sven.crtr.cert_rotated', 'sven.crtr.cert_revoked',
      'sven.vlas.assessment_started', 'sven.vlas.assessment_completed', 'sven.vlas.finding_reported', 'sven.vlas.remediation_applied',
      'sven.cmrp.report_generated', 'sven.cmrp.evidence_collected', 'sven.cmrp.posture_scored', 'sven.cmrp.audit_exported',
      'sven.idrs.identity_resolved', 'sven.idrs.identity_verified', 'sven.idrs.provider_synced', 'sven.idrs.access_audited'
    ];
    subjects.forEach(s => it(`has ${s}`, () => expect(bus).toContain(`'${s}'`)));
  });

  // ── Cross-cutting: Task executor switch cases ──────────────────────

  describe('Task executor switch cases', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'encm_generate_key', 'encm_rotate_key', 'encm_encrypt_data', 'encm_decrypt_data', 'encm_list_keys', 'encm_destroy_key',
      'crtr_issue_cert', 'crtr_renew_cert', 'crtr_rotate_cert', 'crtr_revoke_cert', 'crtr_check_expiry', 'crtr_audit_certs',
      'vlas_start_assessment', 'vlas_scan_dependencies', 'vlas_check_cve', 'vlas_generate_report', 'vlas_recommend_fixes', 'vlas_schedule_scan',
      'cmrp_generate_report', 'cmrp_collect_evidence', 'cmrp_map_controls', 'cmrp_score_posture', 'cmrp_schedule_report', 'cmrp_export_audit',
      'idrs_resolve_identity', 'idrs_verify_identity', 'idrs_link_identity', 'idrs_list_identities', 'idrs_audit_access', 'idrs_sync_provider'
    ];
    cases.forEach(c => it(`has case '${c}'`, () => expect(exec).toContain(`case '${c}'`)));
  });

  // ── Cross-cutting: Handler methods ─────────────────────────────────

  describe('Task executor handler methods', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleEncmGenerateKey', 'handleEncmRotateKey', 'handleEncmEncryptData', 'handleEncmDecryptData', 'handleEncmListKeys', 'handleEncmDestroyKey',
      'handleCrtrIssueCert', 'handleCrtrRenewCert', 'handleCrtrRotateCert', 'handleCrtrRevokeCert', 'handleCrtrCheckExpiry', 'handleCrtrAuditCerts',
      'handleVlasStartAssessment', 'handleVlasScanDependencies', 'handleVlasCheckCve', 'handleVlasGenerateReport', 'handleVlasRecommendFixes', 'handleVlasScheduleScan',
      'handleCmrpGenerateReport', 'handleCmrpCollectEvidence', 'handleCmrpMapControls', 'handleCmrpScorePosture', 'handleCmrpScheduleReport', 'handleCmrpExportAudit',
      'handleIdrsResolveIdentity', 'handleIdrsVerifyIdentity', 'handleIdrsLinkIdentity', 'handleIdrsListIdentities', 'handleIdrsAuditAccess', 'handleIdrsSyncProvider'
    ];
    handlers.forEach(h => it(`has ${h}`, () => expect(exec).toContain(h)));
  });

  // ── Cross-cutting: .gitattributes ──────────────────────────────────

  describe('.gitattributes privacy entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const entries = [
      '20260620000000_agent_encryption_manager.sql', '20260620010000_agent_certificate_rotator.sql',
      '20260620020000_agent_vulnerability_assessor.sql', '20260620030000_agent_compliance_reporter.sql',
      '20260620040000_agent_identity_resolver.sql',
      'agent-encryption-manager.ts', 'agent-certificate-rotator.ts',
      'agent-vulnerability-assessor.ts', 'agent-compliance-reporter.ts', 'agent-identity-resolver.ts',
      'encryption-manager/SKILL.md', 'certificate-rotator/SKILL.md',
      'vulnerability-assessor/SKILL.md', 'compliance-reporter/SKILL.md', 'identity-resolver/SKILL.md'
    ];
    entries.forEach(e => it(`has ${e}`, () => expect(ga).toContain(e)));
  });
});
