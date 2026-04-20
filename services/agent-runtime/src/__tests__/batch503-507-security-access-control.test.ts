import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 503-507: Security & Access Control', () => {
  const verticals = [
    {
      name: 'cert_renewer', migration: '20260621400000_agent_cert_renewer.sql',
      typeFile: 'agent-cert-renewer.ts', skillDir: 'cert-renewer',
      interfaces: ['CertRenewerConfig', 'CertificateStatus', 'RenewalRecord'],
      bk: 'cert_renewer', eks: ['ctrn.cert_expiring', 'ctrn.cert_renewed', 'ctrn.cert_failed', 'ctrn.cert_revoked'],
      subjects: ['sven.ctrn.cert_expiring', 'sven.ctrn.cert_renewed', 'sven.ctrn.cert_failed', 'sven.ctrn.cert_revoked'],
      cases: ['ctrn_check', 'ctrn_renew', 'ctrn_revoke', 'ctrn_monitor', 'ctrn_report', 'ctrn_configure'],
    },
    {
      name: 'vault_syncer', migration: '20260621410000_agent_vault_syncer.sql',
      typeFile: 'agent-vault-syncer.ts', skillDir: 'vault-syncer',
      interfaces: ['VaultSyncerConfig', 'SyncedSecret', 'VaultConnection'],
      bk: 'vault_syncer', eks: ['vlsy.secret_synced', 'vlsy.vault_connected', 'vlsy.rotation_completed', 'vlsy.sync_failed'],
      subjects: ['sven.vlsy.secret_synced', 'sven.vlsy.vault_connected', 'sven.vlsy.rotation_completed', 'sven.vlsy.sync_failed'],
      cases: ['vlsy_sync', 'vlsy_connect', 'vlsy_rotate', 'vlsy_monitor', 'vlsy_report', 'vlsy_configure'],
    },
    {
      name: 'rbac_manager', migration: '20260621420000_agent_rbac_manager.sql',
      typeFile: 'agent-rbac-manager.ts', skillDir: 'rbac-manager',
      interfaces: ['RbacManagerConfig', 'RoleBinding', 'PermissionGrant'],
      bk: 'rbac_manager', eks: ['rbmg.role_assigned', 'rbmg.permission_granted', 'rbmg.access_revoked', 'rbmg.policy_updated'],
      subjects: ['sven.rbmg.role_assigned', 'sven.rbmg.permission_granted', 'sven.rbmg.access_revoked', 'sven.rbmg.policy_updated'],
      cases: ['rbmg_assign', 'rbmg_grant', 'rbmg_revoke', 'rbmg_update', 'rbmg_report', 'rbmg_monitor'],
    },
    {
      name: 'mfa_validator', migration: '20260621430000_agent_mfa_validator.sql',
      typeFile: 'agent-mfa-validator.ts', skillDir: 'mfa-validator',
      interfaces: ['MfaValidatorConfig', 'MfaChallenge', 'ValidationResult'],
      bk: 'mfa_validator', eks: ['mfvl.challenge_issued', 'mfvl.validation_passed', 'mfvl.validation_failed', 'mfvl.bypass_detected'],
      subjects: ['sven.mfvl.challenge_issued', 'sven.mfvl.validation_passed', 'sven.mfvl.validation_failed', 'sven.mfvl.bypass_detected'],
      cases: ['mfvl_challenge', 'mfvl_validate', 'mfvl_bypass', 'mfvl_monitor', 'mfvl_report', 'mfvl_configure'],
    },
    {
      name: 'ip_allowlister', migration: '20260621440000_agent_ip_allowlister.sql',
      typeFile: 'agent-ip-allowlister.ts', skillDir: 'ip-allowlister',
      interfaces: ['IpAllowlisterConfig', 'AllowlistEntry', 'AccessAttempt'],
      bk: 'ip_allowlister', eks: ['ipal.ip_added', 'ipal.ip_removed', 'ipal.access_blocked', 'ipal.allowlist_updated'],
      subjects: ['sven.ipal.ip_added', 'sven.ipal.ip_removed', 'sven.ipal.access_blocked', 'sven.ipal.allowlist_updated'],
      cases: ['ipal_add', 'ipal_remove', 'ipal_block', 'ipal_update', 'ipal_report', 'ipal_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('type file exports interfaces', () => {
        const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', v.typeFile), 'utf-8');
        v.interfaces.forEach((iface) => { expect(content).toContain(`export interface ${iface}`); });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
      });
      test('SKILL.md exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'))).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const content = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
