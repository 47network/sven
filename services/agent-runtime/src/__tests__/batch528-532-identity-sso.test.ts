import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 528-532: Identity & SSO', () => {
  const verticals = [
    {
      name: 'oauth_provider', migration: '20260621650000_agent_oauth_provider.sql',
      typeFile: 'agent-oauth-provider.ts', skillDir: 'oauth-provider',
      interfaces: ['OauthProviderConfig', 'OauthClient', 'OauthGrant'],
      bk: 'oauth_provider', eks: ['oatp.client_registered', 'oatp.token_issued', 'oatp.grant_revoked', 'oatp.scope_validated'],
      subjects: ['sven.oatp.client_registered', 'sven.oatp.token_issued', 'sven.oatp.grant_revoked', 'sven.oatp.scope_validated'],
      cases: ['oatp_register', 'oatp_issue', 'oatp_revoke', 'oatp_validate', 'oatp_report', 'oatp_monitor'],
    },
    {
      name: 'saml_bridge', migration: '20260621660000_agent_saml_bridge.sql',
      typeFile: 'agent-saml-bridge.ts', skillDir: 'saml-bridge',
      interfaces: ['SamlBridgeConfig', 'SamlAssertion', 'SamlMetadata'],
      bk: 'saml_bridge', eks: ['smlb.assertion_received', 'smlb.metadata_synced', 'smlb.sso_completed', 'smlb.session_federated'],
      subjects: ['sven.smlb.assertion_received', 'sven.smlb.metadata_synced', 'sven.smlb.sso_completed', 'sven.smlb.session_federated'],
      cases: ['smlb_receive', 'smlb_sync', 'smlb_complete', 'smlb_federate', 'smlb_report', 'smlb_monitor'],
    },
    {
      name: 'token_minter', migration: '20260621670000_agent_token_minter.sql',
      typeFile: 'agent-token-minter.ts', skillDir: 'token-minter',
      interfaces: ['TokenMinterConfig', 'MintedToken', 'TokenPolicy'],
      bk: 'token_minter', eks: ['tkmn.token_minted', 'tkmn.token_refreshed', 'tkmn.token_revoked', 'tkmn.policy_applied'],
      subjects: ['sven.tkmn.token_minted', 'sven.tkmn.token_refreshed', 'sven.tkmn.token_revoked', 'sven.tkmn.policy_applied'],
      cases: ['tkmn_mint', 'tkmn_refresh', 'tkmn_revoke', 'tkmn_apply', 'tkmn_report', 'tkmn_monitor'],
    },
    {
      name: 'session_rotator', migration: '20260621680000_agent_session_rotator.sql',
      typeFile: 'agent-session-rotator.ts', skillDir: 'session-rotator',
      interfaces: ['SessionRotatorConfig', 'RotationEvent', 'SessionState'],
      bk: 'session_rotator', eks: ['ssrt.session_rotated', 'ssrt.key_regenerated', 'ssrt.idle_terminated', 'ssrt.rotation_scheduled'],
      subjects: ['sven.ssrt.session_rotated', 'sven.ssrt.key_regenerated', 'sven.ssrt.idle_terminated', 'sven.ssrt.rotation_scheduled'],
      cases: ['ssrt_rotate', 'ssrt_regenerate', 'ssrt_terminate', 'ssrt_schedule', 'ssrt_report', 'ssrt_monitor'],
    },
    {
      name: 'identity_linker', migration: '20260621690000_agent_identity_linker.sql',
      typeFile: 'agent-identity-linker.ts', skillDir: 'identity-linker',
      interfaces: ['IdentityLinkerConfig', 'LinkedIdentity', 'LinkMapping'],
      bk: 'identity_linker', eks: ['idlk.identity_linked', 'idlk.provider_connected', 'idlk.merge_completed', 'idlk.conflict_resolved'],
      subjects: ['sven.idlk.identity_linked', 'sven.idlk.provider_connected', 'sven.idlk.merge_completed', 'sven.idlk.conflict_resolved'],
      cases: ['idlk_link', 'idlk_connect', 'idlk_merge', 'idlk_resolve', 'idlk_report', 'idlk_monitor'],
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
