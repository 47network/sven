import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 608-612: Secrets & Credential Management', () => {
  const verticals = [
    {
      name: 'credential_broker', migration: '20260622450000_agent_credential_broker.sql',
      typeFile: 'agent-credential-broker.ts', skillDir: 'credential-broker',
      interfaces: ['CredentialBrokerConfig', 'CredentialLease', 'BrokerEvent'],
      bk: 'credential_broker', eks: ['crdb.credential_issued', 'crdb.lease_renewed', 'crdb.lease_revoked', 'crdb.broker_rotated'],
      subjects: ['sven.crdb.credential_issued', 'sven.crdb.lease_renewed', 'sven.crdb.lease_revoked', 'sven.crdb.broker_rotated'],
      cases: ['crdb_issue', 'crdb_renew', 'crdb_revoke', 'crdb_rotate', 'crdb_report', 'crdb_monitor'],
    },
    {
      name: 'token_refresher', migration: '20260622460000_agent_token_refresher.sql',
      typeFile: 'agent-token-refresher.ts', skillDir: 'token-refresher',
      interfaces: ['TokenRefresherConfig', 'RefreshEvent', 'TokenPool'],
      bk: 'token_refresher', eks: ['tkrf.token_refreshed', 'tkrf.refresh_failed', 'tkrf.pool_replenished', 'tkrf.expiry_warned'],
      subjects: ['sven.tkrf.token_refreshed', 'sven.tkrf.refresh_failed', 'sven.tkrf.pool_replenished', 'sven.tkrf.expiry_warned'],
      cases: ['tkrf_refresh', 'tkrf_fail', 'tkrf_replenish', 'tkrf_warn', 'tkrf_report', 'tkrf_monitor'],
    },
    {
      name: 'key_custodian', migration: '20260622470000_agent_key_custodian.sql',
      typeFile: 'agent-key-custodian.ts', skillDir: 'key-custodian',
      interfaces: ['KeyCustodianConfig', 'KeyPair', 'CustodyEvent'],
      bk: 'key_custodian', eks: ['kycs.key_generated', 'kycs.key_escrowed', 'kycs.key_recovered', 'kycs.custody_audited'],
      subjects: ['sven.kycs.key_generated', 'sven.kycs.key_escrowed', 'sven.kycs.key_recovered', 'sven.kycs.custody_audited'],
      cases: ['kycs_generate', 'kycs_escrow', 'kycs_recover', 'kycs_audit', 'kycs_report', 'kycs_monitor'],
    },
    {
      name: 'passphrase_generator', migration: '20260622480000_agent_passphrase_generator.sql',
      typeFile: 'agent-passphrase-generator.ts', skillDir: 'passphrase-generator',
      interfaces: ['PassphraseGeneratorConfig', 'PassphraseResult', 'EntropyCheck'],
      bk: 'passphrase_generator', eks: ['ppgn.passphrase_created', 'ppgn.entropy_checked', 'ppgn.strength_scored', 'ppgn.policy_validated'],
      subjects: ['sven.ppgn.passphrase_created', 'sven.ppgn.entropy_checked', 'sven.ppgn.strength_scored', 'sven.ppgn.policy_validated'],
      cases: ['ppgn_create', 'ppgn_check', 'ppgn_score', 'ppgn_validate', 'ppgn_report', 'ppgn_monitor'],
    },
    {
      name: 'cert_watcher', migration: '20260622490000_agent_cert_watcher.sql',
      typeFile: 'agent-cert-watcher.ts', skillDir: 'cert-watcher',
      interfaces: ['CertWatcherConfig', 'CertStatus', 'RenewalEvent'],
      bk: 'cert_watcher', eks: ['crtw.cert_expiring', 'crtw.cert_renewed', 'crtw.chain_validated', 'crtw.revocation_detected'],
      subjects: ['sven.crtw.cert_expiring', 'sven.crtw.cert_renewed', 'sven.crtw.chain_validated', 'sven.crtw.revocation_detected'],
      cases: ['crtw_expire', 'crtw_renew', 'crtw_validate', 'crtw_revoke', 'crtw_report', 'crtw_monitor'],
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
