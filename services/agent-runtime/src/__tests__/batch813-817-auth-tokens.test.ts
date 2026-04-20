import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 813-817: Auth & Token Services', () => {
  const verticals = [
    {
      name: 'oauth_token_service', migration: '20260624500000_agent_oauth_token_service.sql',
      typeFile: 'agent-oauth-token-service.ts', skillDir: 'oauth-token-service',
      interfaces: ['OauthTokenServiceConfig', 'TokenRequest', 'ServiceEvent'],
      bk: 'oauth_token_service', eks: ['oats.grant_validated', 'oats.token_issued', 'oats.token_introspected', 'oats.token_revoked'],
      subjects: ['sven.oats.grant_validated', 'sven.oats.token_issued', 'sven.oats.token_introspected', 'sven.oats.token_revoked'],
      cases: ['oats_validate', 'oats_issue', 'oats_introspect', 'oats_revoke', 'oats_report', 'oats_monitor'],
    },
    {
      name: 'api_key_issuer', migration: '20260624510000_agent_api_key_issuer.sql',
      typeFile: 'agent-api-key-issuer.ts', skillDir: 'api-key-issuer',
      interfaces: ['ApiKeyIssuerConfig', 'ApiKey', 'IssuerEvent'],
      bk: 'api_key_issuer', eks: ['akis.request_authorized', 'akis.key_generated', 'akis.scope_attached', 'akis.key_distributed'],
      subjects: ['sven.akis.request_authorized', 'sven.akis.key_generated', 'sven.akis.scope_attached', 'sven.akis.key_distributed'],
      cases: ['akis_authorize', 'akis_generate', 'akis_attach', 'akis_distribute', 'akis_report', 'akis_monitor'],
    },
    {
      name: 'jwt_signer', migration: '20260624520000_agent_jwt_signer.sql',
      typeFile: 'agent-jwt-signer.ts', skillDir: 'jwt-signer',
      interfaces: ['JwtSignerConfig', 'SigningRequest', 'SignerEvent'],
      bk: 'jwt_signer', eks: ['jwts.claims_assembled', 'jwts.header_built', 'jwts.signature_generated', 'jwts.token_emitted'],
      subjects: ['sven.jwts.claims_assembled', 'sven.jwts.header_built', 'sven.jwts.signature_generated', 'sven.jwts.token_emitted'],
      cases: ['jwts_assemble', 'jwts_build', 'jwts_generate', 'jwts_emit', 'jwts_report', 'jwts_monitor'],
    },
    {
      name: 'session_store_manager', migration: '20260624530000_agent_session_store_manager.sql',
      typeFile: 'agent-session-store-manager.ts', skillDir: 'session-store-manager',
      interfaces: ['SessionStoreManagerConfig', 'Session', 'ManagerEvent'],
      bk: 'session_store_manager', eks: ['sssm.session_created', 'sssm.session_loaded', 'sssm.session_invalidated', 'sssm.eviction_run'],
      subjects: ['sven.sssm.session_created', 'sven.sssm.session_loaded', 'sven.sssm.session_invalidated', 'sven.sssm.eviction_run'],
      cases: ['sssm_create', 'sssm_load', 'sssm_invalidate', 'sssm_evict', 'sssm_report', 'sssm_monitor'],
    },
    {
      name: 'refresh_token_rotator', migration: '20260624540000_agent_refresh_token_rotator.sql',
      typeFile: 'agent-refresh-token-rotator.ts', skillDir: 'refresh-token-rotator',
      interfaces: ['RefreshTokenRotatorConfig', 'RefreshSession', 'RotatorEvent'],
      bk: 'refresh_token_rotator', eks: ['rftr.refresh_received', 'rftr.reuse_detected', 'rftr.token_rotated', 'rftr.family_revoked'],
      subjects: ['sven.rftr.refresh_received', 'sven.rftr.reuse_detected', 'sven.rftr.token_rotated', 'sven.rftr.family_revoked'],
      cases: ['rftr_receive', 'rftr_detect', 'rftr_rotate', 'rftr_revoke', 'rftr_report', 'rftr_monitor'],
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
