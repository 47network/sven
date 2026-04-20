import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 613-617: Auth & Identity', () => {
  const verticals = [
    {
      name: 'cookie_manager', migration: '20260622500000_agent_cookie_manager.sql',
      typeFile: 'agent-cookie-manager.ts', skillDir: 'cookie-manager',
      interfaces: ['CookieManagerConfig', 'CookiePolicy', 'CookieEvent'],
      bk: 'cookie_manager', eks: ['ckmg.cookie_set', 'ckmg.cookie_expired', 'ckmg.consent_updated', 'ckmg.policy_enforced'],
      subjects: ['sven.ckmg.cookie_set', 'sven.ckmg.cookie_expired', 'sven.ckmg.consent_updated', 'sven.ckmg.policy_enforced'],
      cases: ['ckmg_set', 'ckmg_expire', 'ckmg_consent', 'ckmg_enforce', 'ckmg_report', 'ckmg_monitor'],
    },
    {
      name: 'auth_flow_builder', migration: '20260622510000_agent_auth_flow_builder.sql',
      typeFile: 'agent-auth-flow-builder.ts', skillDir: 'auth-flow-builder',
      interfaces: ['AuthFlowBuilderConfig', 'AuthFlow', 'FlowEvent'],
      bk: 'auth_flow_builder', eks: ['afbl.flow_created', 'afbl.step_completed', 'afbl.flow_validated', 'afbl.mfa_triggered'],
      subjects: ['sven.afbl.flow_created', 'sven.afbl.step_completed', 'sven.afbl.flow_validated', 'sven.afbl.mfa_triggered'],
      cases: ['afbl_create', 'afbl_step', 'afbl_validate', 'afbl_mfa', 'afbl_report', 'afbl_monitor'],
    },
    {
      name: 'scope_resolver', migration: '20260622520000_agent_scope_resolver.sql',
      typeFile: 'agent-scope-resolver.ts', skillDir: 'scope-resolver',
      interfaces: ['ScopeResolverConfig', 'ScopeMap', 'ResolverEvent'],
      bk: 'scope_resolver', eks: ['scrs.scope_resolved', 'scrs.scope_denied', 'scrs.hierarchy_updated', 'scrs.conflict_detected'],
      subjects: ['sven.scrs.scope_resolved', 'sven.scrs.scope_denied', 'sven.scrs.hierarchy_updated', 'sven.scrs.conflict_detected'],
      cases: ['scrs_resolve', 'scrs_deny', 'scrs_hierarchy', 'scrs_conflict', 'scrs_report', 'scrs_monitor'],
    },
    {
      name: 'claim_validator', migration: '20260622530000_agent_claim_validator.sql',
      typeFile: 'agent-claim-validator.ts', skillDir: 'claim-validator',
      interfaces: ['ClaimValidatorConfig', 'ClaimResult', 'ValidationEvent'],
      bk: 'claim_validator', eks: ['clvd.claim_valid', 'clvd.claim_rejected', 'clvd.schema_updated', 'clvd.issuer_verified'],
      subjects: ['sven.clvd.claim_valid', 'sven.clvd.claim_rejected', 'sven.clvd.schema_updated', 'sven.clvd.issuer_verified'],
      cases: ['clvd_valid', 'clvd_reject', 'clvd_schema', 'clvd_issuer', 'clvd_report', 'clvd_monitor'],
    },
    {
      name: 'consent_tracker', migration: '20260622540000_agent_consent_tracker.sql',
      typeFile: 'agent-consent-tracker.ts', skillDir: 'consent-tracker',
      interfaces: ['ConsentTrackerConfig', 'ConsentRecord', 'ConsentEvent'],
      bk: 'consent_tracker', eks: ['cntk.consent_granted', 'cntk.consent_revoked', 'cntk.preference_updated', 'cntk.audit_logged'],
      subjects: ['sven.cntk.consent_granted', 'sven.cntk.consent_revoked', 'sven.cntk.preference_updated', 'sven.cntk.audit_logged'],
      cases: ['cntk_grant', 'cntk_revoke', 'cntk_preference', 'cntk_audit', 'cntk_report', 'cntk_monitor'],
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
