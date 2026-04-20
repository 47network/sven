import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 393-397: Security & Governance', () => {

  describe('Batch 393 — Access Control Manager', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620300000_agent_access_control_manager.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-access-control-manager.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/access-control-manager/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_access_control_manager_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_access_control_manager_configs'); });
    test('migration creates agent_access_policies', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_access_policies'); });
    test('migration creates agent_access_logs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_access_logs'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports AccessControlManagerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('AccessControlManagerConfig'); });
    test('types exports DefaultPolicy', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('DefaultPolicy'); });
    test('types exports AccessDecision', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('AccessDecision'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-policy', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-policy'); });
  });

  describe('Batch 394 — Threat Detection Engine', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620310000_agent_threat_detection_engine.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-threat-detection-engine.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/threat-detection-engine/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_threat_detection_engine_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_threat_detection_engine_configs'); });
    test('migration creates agent_threat_rules', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_threat_rules'); });
    test('migration creates agent_threat_events', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_threat_events'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports ThreatDetectionEngineConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('ThreatDetectionEngineConfig'); });
    test('types exports SensitivityLevel', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('SensitivityLevel'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-rule', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-rule'); });
  });

  describe('Batch 395 — Secret Manager', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620320000_agent_secret_manager.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-secret-manager.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/secret-manager/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_secret_manager_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_secret_manager_configs'); });
    test('migration creates agent_secrets', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_secrets'); });
    test('migration creates agent_secret_access_logs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_secret_access_logs'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports SecretManagerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('SecretManagerConfig'); });
    test('types exports SecretType', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('SecretType'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has store-secret', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('store-secret'); });
  });

  describe('Batch 396 — Encryption Engine', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620330000_agent_encryption_engine.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-encryption-engine.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/encryption-engine/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_encryption_engine_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_encryption_engine_configs'); });
    test('migration creates agent_encryption_keys', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_encryption_keys'); });
    test('migration creates agent_encryption_operations', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_encryption_operations'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports EncryptionEngineConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('EncryptionEngineConfig'); });
    test('types exports KeyDerivation', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('KeyDerivation'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has encrypt-data', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('encrypt-data'); });
  });

  describe('Batch 397 — Audit Trail Manager', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620340000_agent_audit_trail_manager.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-audit-trail-manager.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/audit-trail-manager/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_audit_trail_manager_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_audit_trail_manager_configs'); });
    test('migration creates agent_audit_entries', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_audit_entries'); });
    test('migration creates agent_audit_exports', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_audit_exports'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports AuditTrailManagerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('AuditTrailManagerConfig'); });
    test('types exports ExportFormat', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('ExportFormat'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has log-event', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('log-event'); });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    ['access-control-manager','threat-detection-engine','secret-manager','encryption-engine','audit-trail-manager'].forEach(n => {
      test(`exports agent-${n}`, () => { expect(idx).toContain(`from './agent-${n}'`); });
    });
  });

  describe('Eidolon types.ts', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    ['access_control_manager','threat_detection_engine','secret_manager','encryption_engine','audit_trail_manager'].forEach(bk => {
      test(`BK '${bk}'`, () => { expect(c).toContain(`'${bk}'`); });
      test(`districtFor case '${bk}'`, () => { expect(c).toContain(`case '${bk}':`); });
    });
    ['acmg.policy_created','thde.threat_detected','scmg.secret_stored','ence.data_encrypted','audm.event_logged'].forEach(ek => {
      test(`EK '${ek}'`, () => { expect(c).toContain(`'${ek}'`); });
    });
  });

  describe('SUBJECT_MAP', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    [
      'sven.acmg.policy_created','sven.acmg.access_evaluated','sven.acmg.policy_updated','sven.acmg.mfa_configured',
      'sven.thde.rule_created','sven.thde.threat_detected','sven.thde.event_resolved','sven.thde.scan_completed',
      'sven.scmg.secret_stored','sven.scmg.secret_retrieved','sven.scmg.secret_rotated','sven.scmg.secret_deleted',
      'sven.ence.data_encrypted','sven.ence.data_decrypted','sven.ence.key_generated','sven.ence.signature_verified',
      'sven.audm.event_logged','sven.audm.trail_exported','sven.audm.integrity_verified','sven.audm.retention_updated'
    ].forEach(s => {
      test(`subject '${s}'`, () => { expect(c).toContain(`'${s}'`); });
    });
  });

  describe('Task executor cases', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    [
      'acmg_create_policy','acmg_evaluate_access','acmg_list_policies','acmg_get_access_logs','acmg_update_policy','acmg_configure_mfa',
      'thde_create_rule','thde_scan_now','thde_list_events','thde_investigate_event','thde_update_sensitivity','thde_resolve_event',
      'scmg_store_secret','scmg_retrieve_secret','scmg_rotate_secret','scmg_list_secrets','scmg_delete_secret','scmg_get_access_log',
      'ence_encrypt_data','ence_decrypt_data','ence_generate_key','ence_sign_data','ence_verify_signature','ence_list_keys',
      'audm_log_event','audm_query_trail','audm_export_trail','audm_verify_integrity','audm_get_statistics','audm_configure_retention'
    ].forEach(c2 => {
      test(`case '${c2}'`, () => { expect(c).toContain(`case '${c2}'`); });
    });
  });

  describe('.gitattributes', () => {
    const c = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    [
      'agent_access_control_manager.sql','agent_threat_detection_engine.sql','agent_secret_manager.sql',
      'agent_encryption_engine.sql','agent_audit_trail_manager.sql',
      'agent-access-control-manager.ts','agent-threat-detection-engine.ts','agent-secret-manager.ts',
      'agent-encryption-engine.ts','agent-audit-trail-manager.ts',
      'access-control-manager/SKILL.md','threat-detection-engine/SKILL.md','secret-manager/SKILL.md',
      'encryption-engine/SKILL.md','audit-trail-manager/SKILL.md'
    ].forEach(f => {
      test(`guards ${f}`, () => { expect(c).toContain(f); });
    });
  });
});
