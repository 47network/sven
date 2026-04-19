import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 478-482: DevOps & Deployment', () => {
  const verticals = [
    {
      name: 'secret_injector',
      migration: '20260621150000_agent_secret_injector.sql',
      typeFile: 'agent-secret-injector.ts',
      skillDir: 'secret-injector',
      interfaces: ['SecretInjectorConfig', 'InjectedSecret', 'SecretAuditEntry'],
      bk: 'secret_injector',
      eks: ['sinj.secret_injected', 'sinj.secret_rotated', 'sinj.secret_revoked', 'sinj.audit_generated'],
      subjects: ['sven.sinj.secret_injected', 'sven.sinj.secret_rotated', 'sven.sinj.secret_revoked', 'sven.sinj.audit_generated'],
      cases: ['sinj_inject', 'sinj_rotate', 'sinj_audit', 'sinj_revoke', 'sinj_report', 'sinj_monitor'],
    },
    {
      name: 'deploy_verifier',
      migration: '20260621160000_agent_deploy_verifier.sql',
      typeFile: 'agent-deploy-verifier.ts',
      skillDir: 'deploy-verifier',
      interfaces: ['DeployVerifierConfig', 'VerificationResult', 'DeploymentApproval'],
      bk: 'deploy_verifier',
      eks: ['dpvr.verification_passed', 'dpvr.verification_failed', 'dpvr.smoke_completed', 'dpvr.rollback_checked'],
      subjects: ['sven.dpvr.verification_passed', 'sven.dpvr.verification_failed', 'sven.dpvr.smoke_completed', 'sven.dpvr.rollback_checked'],
      cases: ['dpvr_verify', 'dpvr_health', 'dpvr_smoke', 'dpvr_rollback', 'dpvr_report', 'dpvr_monitor'],
    },
    {
      name: 'env_provisioner',
      migration: '20260621170000_agent_env_provisioner.sql',
      typeFile: 'agent-env-provisioner.ts',
      skillDir: 'env-provisioner',
      interfaces: ['EnvProvisionerConfig', 'ProvisionedEnvironment', 'EnvironmentCleanup'],
      bk: 'env_provisioner',
      eks: ['envp.env_provisioned', 'envp.env_torn_down', 'envp.ttl_extended', 'envp.cleanup_completed'],
      subjects: ['sven.envp.env_provisioned', 'sven.envp.env_torn_down', 'sven.envp.ttl_extended', 'sven.envp.cleanup_completed'],
      cases: ['envp_provision', 'envp_teardown', 'envp_extend', 'envp_list', 'envp_report', 'envp_monitor'],
    },
    {
      name: 'release_tagger',
      migration: '20260621180000_agent_release_tagger.sql',
      typeFile: 'agent-release-tagger.ts',
      skillDir: 'release-tagger',
      interfaces: ['ReleaseTaggerConfig', 'ReleaseTag', 'ReleaseNotes'],
      bk: 'release_tagger',
      eks: ['rltg.tag_created', 'rltg.version_bumped', 'rltg.notes_generated', 'rltg.tag_signed'],
      subjects: ['sven.rltg.tag_created', 'sven.rltg.version_bumped', 'sven.rltg.notes_generated', 'sven.rltg.tag_signed'],
      cases: ['rltg_tag', 'rltg_bump', 'rltg_notes', 'rltg_sign', 'rltg_report', 'rltg_monitor'],
    },
    {
      name: 'stack_auditor',
      migration: '20260621190000_agent_stack_auditor.sql',
      typeFile: 'agent-stack-auditor.ts',
      skillDir: 'stack-auditor',
      interfaces: ['StackAuditorConfig', 'AuditFinding', 'AuditReport'],
      bk: 'stack_auditor',
      eks: ['skad.audit_completed', 'skad.vulnerability_found', 'skad.license_checked', 'skad.auto_fix_applied'],
      subjects: ['sven.skad.audit_completed', 'sven.skad.vulnerability_found', 'sven.skad.license_checked', 'sven.skad.auto_fix_applied'],
      cases: ['skad_audit', 'skad_vulnerabilities', 'skad_licenses', 'skad_outdated', 'skad_report', 'skad_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      // 1. Migration
      test('migration file exists', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(migPath)).toBe(true);
      });
      test('migration has correct table', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(migPath, 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });

      // 2. Types
      test('type file exists', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(tf)).toBe(true);
      });
      test('type file exports interfaces', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(tf, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });

      // 3. Barrel
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`from './${modName}'`);
      });

      // 4. SKILL.md
      test('SKILL.md exists', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(sp)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(sp, 'utf-8');
        expect(content).toContain('## Actions');
      });

      // 5. BK
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });

      // 6. EK
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });

      // 7. districtFor
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });

      // 8. SUBJECT_MAP
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => {
          expect(eb).toContain(`'${subj}'`);
        });
      });

      // 9. Task executor cases
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => {
          expect(te).toContain(`case '${cs}'`);
        });
      });
    });
  });
});
