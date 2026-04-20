import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 738-742: Configuration & Feature Flags', () => {
  const verticals = [
    {
      name: 'feature_flag_evaluator', migration: '20260623750000_agent_feature_flag_evaluator.sql',
      typeFile: 'agent-feature-flag-evaluator.ts', skillDir: 'feature-flag-evaluator',
      interfaces: ['FeatureFlagEvaluatorConfig', 'FlagEvaluation', 'EvaluatorEvent'],
      bk: 'feature_flag_evaluator', eks: ['ffev.flag_evaluated', 'ffev.targeting_matched', 'ffev.exposure_recorded', 'ffev.killswitch_engaged'],
      subjects: ['sven.ffev.flag_evaluated', 'sven.ffev.targeting_matched', 'sven.ffev.exposure_recorded', 'sven.ffev.killswitch_engaged'],
      cases: ['ffev_evaluate', 'ffev_match', 'ffev_record', 'ffev_engage', 'ffev_report', 'ffev_monitor'],
    },
    {
      name: 'ab_test_assigner', migration: '20260623760000_agent_ab_test_assigner.sql',
      typeFile: 'agent-ab-test-assigner.ts', skillDir: 'ab-test-assigner',
      interfaces: ['AbTestAssignerConfig', 'TestAssignment', 'AssignerEvent'],
      bk: 'ab_test_assigner', eks: ['abts.variant_assigned', 'abts.cohort_locked', 'abts.exposure_logged', 'abts.results_computed'],
      subjects: ['sven.abts.variant_assigned', 'sven.abts.cohort_locked', 'sven.abts.exposure_logged', 'sven.abts.results_computed'],
      cases: ['abts_assign', 'abts_lock', 'abts_log', 'abts_compute', 'abts_report', 'abts_monitor'],
    },
    {
      name: 'config_distributor', migration: '20260623770000_agent_config_distributor.sql',
      typeFile: 'agent-config-distributor.ts', skillDir: 'config-distributor',
      interfaces: ['ConfigDistributorConfig', 'ConfigBundle', 'DistributorEvent'],
      bk: 'config_distributor', eks: ['cfgd.bundle_published', 'cfgd.client_subscribed', 'cfgd.update_pushed', 'cfgd.acknowledgment_received'],
      subjects: ['sven.cfgd.bundle_published', 'sven.cfgd.client_subscribed', 'sven.cfgd.update_pushed', 'sven.cfgd.acknowledgment_received'],
      cases: ['cfgd_publish', 'cfgd_subscribe', 'cfgd_push', 'cfgd_ack', 'cfgd_report', 'cfgd_monitor'],
    },
    {
      name: 'credential_vault_rotator', migration: '20260623780000_agent_credential_vault_rotator.sql',
      typeFile: 'agent-credential-vault-rotator.ts', skillDir: 'credential-vault-rotator',
      interfaces: ['CredentialVaultRotatorConfig', 'RotationJob', 'RotatorEvent'],
      bk: 'credential_vault_rotator', eks: ['cvrt.rotation_scheduled', 'cvrt.credential_rotated', 'cvrt.consumer_notified', 'cvrt.audit_logged'],
      subjects: ['sven.cvrt.rotation_scheduled', 'sven.cvrt.credential_rotated', 'sven.cvrt.consumer_notified', 'sven.cvrt.audit_logged'],
      cases: ['cvrt_schedule', 'cvrt_rotate', 'cvrt_notify', 'cvrt_log', 'cvrt_report', 'cvrt_monitor'],
    },
    {
      name: 'key_management_orchestrator', migration: '20260623790000_agent_key_management_orchestrator.sql',
      typeFile: 'agent-key-management-orchestrator.ts', skillDir: 'key-management-orchestrator',
      interfaces: ['KeyManagementOrchestratorConfig', 'CryptoKey', 'OrchestratorEvent'],
      bk: 'key_management_orchestrator', eks: ['kmor.key_generated', 'kmor.key_rotated', 'kmor.key_archived', 'kmor.envelope_wrapped'],
      subjects: ['sven.kmor.key_generated', 'sven.kmor.key_rotated', 'sven.kmor.key_archived', 'sven.kmor.envelope_wrapped'],
      cases: ['kmor_generate', 'kmor_rotate', 'kmor_archive', 'kmor_wrap', 'kmor_report', 'kmor_monitor'],
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
