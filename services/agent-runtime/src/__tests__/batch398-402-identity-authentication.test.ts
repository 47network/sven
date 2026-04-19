import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 398-402: Identity & Authentication', () => {

  describe('Batch 398 — Token Issuer', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620350000_agent_token_issuer.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-token-issuer.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/token-issuer/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_token_issuer_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_token_issuer_configs'); });
    test('migration creates agent_issued_tokens', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_issued_tokens'); });
    test('migration creates agent_token_revocations', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_token_revocations'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports TokenIssuerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('TokenIssuerConfig'); });
    test('types exports TokenAlgorithm', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('TokenAlgorithm'); });
    test('types exports RevocationReason', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('RevocationReason'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has issue-token', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('issue-token'); });
  });

  describe('Batch 399 — Permission Engine', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620360000_agent_permission_engine.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-permission-engine.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/permission-engine/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_permission_engine_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_permission_engine_configs'); });
    test('migration creates agent_permissions', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_permissions'); });
    test('migration creates agent_permission_checks', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_permission_checks'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports PermissionEngineConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('PermissionEngineConfig'); });
    test('types exports EvaluationStrategy', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('EvaluationStrategy'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has check-permission', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('check-permission'); });
  });

  describe('Batch 400 — Role Manager', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620370000_agent_role_manager.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-role-manager.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/role-manager/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_role_manager_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_role_manager_configs'); });
    test('migration creates agent_roles', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_roles'); });
    test('migration creates agent_role_assignments', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_role_assignments'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports RoleManagerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('RoleManagerConfig'); });
    test('types exports RoleType', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('RoleType'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has create-role', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('create-role'); });
  });

  describe('Batch 401 — Credential Vault', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620380000_agent_credential_vault.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-credential-vault.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/credential-vault/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_credential_vault_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_credential_vault_configs'); });
    test('migration creates agent_credentials', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_credentials'); });
    test('migration creates agent_credential_audit', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_credential_audit'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports CredentialVaultConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('CredentialVaultConfig'); });
    test('types exports CredentialType', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('CredentialType'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has store-credential', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('store-credential'); });
  });

  describe('Batch 402 — OAuth Manager', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260620390000_agent_oauth_manager.sql');
    const typPath = path.join(ROOT, 'packages/shared/src/agent-oauth-manager.ts');
    const sklPath = path.join(ROOT, 'skills/autonomous-economy/oauth-manager/SKILL.md');
    test('migration exists', () => { expect(fs.existsSync(migPath)).toBe(true); });
    test('migration creates agent_oauth_manager_configs', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_oauth_manager_configs'); });
    test('migration creates agent_oauth_clients', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_oauth_clients'); });
    test('migration creates agent_oauth_grants', () => { expect(fs.readFileSync(migPath,'utf-8')).toContain('agent_oauth_grants'); });
    test('types file exists', () => { expect(fs.existsSync(typPath)).toBe(true); });
    test('types exports OAuthManagerConfig', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('OAuthManagerConfig'); });
    test('types exports OAuthFlow', () => { expect(fs.readFileSync(typPath,'utf-8')).toContain('OAuthFlow'); });
    test('SKILL.md exists', () => { expect(fs.existsSync(sklPath)).toBe(true); });
    test('SKILL.md has Actions', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('## Actions'); });
    test('SKILL.md has register-client', () => { expect(fs.readFileSync(sklPath,'utf-8')).toContain('register-client'); });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    const names = ['token-issuer','permission-engine','role-manager','credential-vault','oauth-manager'];
    names.forEach(n => {
      test('exports agent-' + n, () => { expect(idx).toContain("from './agent-" + n + "'"); });
    });
  });

  describe('Eidolon types.ts', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['token_issuer','permission_engine','role_manager','credential_vault','oauth_manager'];
    bks.forEach(bk => {
      test('BK ' + bk, () => { expect(c).toContain("'" + bk + "'"); });
      test('districtFor case ' + bk, () => { expect(c).toContain("case '" + bk + "':"); });
    });
    const eks = ['tkis.token_issued','pmen.permission_created','rlmg.role_created','crvt.credential_stored','oamg.client_registered'];
    eks.forEach(ek => {
      test('EK ' + ek, () => { expect(c).toContain("'" + ek + "'"); });
    });
  });

  describe('SUBJECT_MAP', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.tkis.token_issued','sven.tkis.token_revoked','sven.tkis.key_rotated','sven.tkis.token_refreshed',
      'sven.pmen.permission_created','sven.pmen.check_evaluated','sven.pmen.strategy_changed','sven.pmen.batch_evaluated',
      'sven.rlmg.role_created','sven.rlmg.role_assigned','sven.rlmg.assignment_removed','sven.rlmg.permissions_resolved',
      'sven.crvt.credential_stored','sven.crvt.credential_retrieved','sven.crvt.credential_rotated','sven.crvt.expiry_alert',
      'sven.oamg.client_registered','sven.oamg.code_exchanged','sven.oamg.token_introspected','sven.oamg.grant_revoked'
    ];
    subjects.forEach(s => {
      test('subject ' + s, () => { expect(c).toContain("'" + s + "'"); });
    });
  });

  describe('Task executor cases', () => {
    const c = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'tkis_issue_token','tkis_validate_token','tkis_revoke_token','tkis_refresh_token','tkis_list_tokens','tkis_rotate_key',
      'pmen_check_permission','pmen_create_permission','pmen_list_permissions','pmen_evaluate_batch','pmen_get_history','pmen_update_strategy',
      'rlmg_create_role','rlmg_assign_role','rlmg_list_roles','rlmg_get_effective','rlmg_remove_assignment','rlmg_audit_assignments',
      'crvt_store_credential','crvt_retrieve_credential','crvt_rotate_credential','crvt_list_credentials','crvt_check_expiry','crvt_get_audit',
      'oamg_register_client','oamg_authorize','oamg_exchange_code','oamg_client_credentials','oamg_introspect_token','oamg_revoke_grant'
    ];
    cases.forEach(cs => {
      test('case ' + cs, () => { expect(c).toContain("case '" + cs + "'"); });
    });
  });

  describe('.gitattributes', () => {
    const c = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const files = [
      'agent_token_issuer.sql','agent_permission_engine.sql','agent_role_manager.sql',
      'agent_credential_vault.sql','agent_oauth_manager.sql',
      'agent-token-issuer.ts','agent-permission-engine.ts','agent-role-manager.ts',
      'agent-credential-vault.ts','agent-oauth-manager.ts',
      'token-issuer/SKILL.md','permission-engine/SKILL.md','role-manager/SKILL.md',
      'credential-vault/SKILL.md','oauth-manager/SKILL.md'
    ];
    files.forEach(f => {
      test('guards ' + f, () => { expect(c).toContain(f); });
    });
  });
});
