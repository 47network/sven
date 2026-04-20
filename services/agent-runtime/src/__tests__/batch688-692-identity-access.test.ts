import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 688-692: Identity & Access', () => {
  const verticals = [
    {
      name: 'sso_federator', migration: '20260623250000_agent_sso_federator.sql',
      typeFile: 'agent-sso-federator.ts', skillDir: 'sso-federator',
      interfaces: ['SsoFederatorConfig', 'IdentityProvider', 'FederatorEvent'],
      bk: 'sso_federator', eks: ['ssfd.idp_registered', 'ssfd.assertion_validated', 'ssfd.attribute_mapped', 'ssfd.session_established'],
      subjects: ['sven.ssfd.idp_registered', 'sven.ssfd.assertion_validated', 'sven.ssfd.attribute_mapped', 'sven.ssfd.session_established'],
      cases: ['ssfd_register', 'ssfd_validate', 'ssfd_map', 'ssfd_establish', 'ssfd_report', 'ssfd_monitor'],
    },
    {
      name: 'role_provisioner', migration: '20260623260000_agent_role_provisioner.sql',
      typeFile: 'agent-role-provisioner.ts', skillDir: 'role-provisioner',
      interfaces: ['RoleProvisionerConfig', 'RoleAssignment', 'ProvisionerEvent'],
      bk: 'role_provisioner', eks: ['rlpv.role_assigned', 'rlpv.role_revoked', 'rlpv.policy_synced', 'rlpv.expiration_processed'],
      subjects: ['sven.rlpv.role_assigned', 'sven.rlpv.role_revoked', 'sven.rlpv.policy_synced', 'sven.rlpv.expiration_processed'],
      cases: ['rlpv_assign', 'rlpv_revoke', 'rlpv_sync', 'rlpv_expire', 'rlpv_report', 'rlpv_monitor'],
    },
    {
      name: 'mfa_enforcer', migration: '20260623270000_agent_mfa_enforcer.sql',
      typeFile: 'agent-mfa-enforcer.ts', skillDir: 'mfa-enforcer',
      interfaces: ['MfaEnforcerConfig', 'MfaChallenge', 'EnforcerEvent'],
      bk: 'mfa_enforcer', eks: ['mfen.challenge_issued', 'mfen.factor_verified', 'mfen.bypass_blocked', 'mfen.recovery_initiated'],
      subjects: ['sven.mfen.challenge_issued', 'sven.mfen.factor_verified', 'sven.mfen.bypass_blocked', 'sven.mfen.recovery_initiated'],
      cases: ['mfen_challenge', 'mfen_verify', 'mfen_block', 'mfen_recover', 'mfen_report', 'mfen_monitor'],
    },
    {
      name: 'session_revoker', migration: '20260623280000_agent_session_revoker.sql',
      typeFile: 'agent-session-revoker.ts', skillDir: 'session-revoker',
      interfaces: ['SessionRevokerConfig', 'RevocationTarget', 'RevokerEvent'],
      bk: 'session_revoker', eks: ['srvk.session_terminated', 'srvk.token_invalidated', 'srvk.cache_purged', 'srvk.broadcast_sent'],
      subjects: ['sven.srvk.session_terminated', 'sven.srvk.token_invalidated', 'sven.srvk.cache_purged', 'sven.srvk.broadcast_sent'],
      cases: ['srvk_terminate', 'srvk_invalidate', 'srvk_purge', 'srvk_broadcast', 'srvk_report', 'srvk_monitor'],
    },
    {
      name: 'scim_provisioner', migration: '20260623290000_agent_scim_provisioner.sql',
      typeFile: 'agent-scim-provisioner.ts', skillDir: 'scim-provisioner',
      interfaces: ['ScimProvisionerConfig', 'ScimResource', 'ScimEvent'],
      bk: 'scim_provisioner', eks: ['scpv.user_created', 'scpv.user_updated', 'scpv.group_synced', 'scpv.deprovisioning_completed'],
      subjects: ['sven.scpv.user_created', 'sven.scpv.user_updated', 'sven.scpv.group_synced', 'sven.scpv.deprovisioning_completed'],
      cases: ['scpv_create', 'scpv_update', 'scpv_sync', 'scpv_deprovision', 'scpv_report', 'scpv_monitor'],
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
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
