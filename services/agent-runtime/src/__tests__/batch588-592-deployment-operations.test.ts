import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 588-592: Deployment Operations', () => {
  const verticals = [
    {
      name: 'deploy_sentinel', migration: '20260622250000_agent_deploy_sentinel.sql',
      typeFile: 'agent-deploy-sentinel.ts', skillDir: 'deploy-sentinel',
      interfaces: ['DeploySentinelConfig', 'DeployEvent', 'DeployStatus'],
      bk: 'deploy_sentinel', eks: ['dpst.deploy_started', 'dpst.health_checked', 'dpst.deploy_completed', 'dpst.anomaly_detected'],
      subjects: ['sven.dpst.deploy_started', 'sven.dpst.health_checked', 'sven.dpst.deploy_completed', 'sven.dpst.anomaly_detected'],
      cases: ['dpst_deploy', 'dpst_check', 'dpst_complete', 'dpst_anomaly', 'dpst_report', 'dpst_monitor'],
    },
    {
      name: 'rollback_pilot', migration: '20260622260000_agent_rollback_pilot.sql',
      typeFile: 'agent-rollback-pilot.ts', skillDir: 'rollback-pilot',
      interfaces: ['RollbackPilotConfig', 'RollbackEvent', 'RecoveryPlan'],
      bk: 'rollback_pilot', eks: ['rbpl.rollback_initiated', 'rbpl.snapshot_restored', 'rbpl.recovery_completed', 'rbpl.rollback_failed'],
      subjects: ['sven.rbpl.rollback_initiated', 'sven.rbpl.snapshot_restored', 'sven.rbpl.recovery_completed', 'sven.rbpl.rollback_failed'],
      cases: ['rbpl_rollback', 'rbpl_restore', 'rbpl_recover', 'rbpl_fail', 'rbpl_report', 'rbpl_monitor'],
    },
    {
      name: 'env_promoter', migration: '20260622270000_agent_env_promoter.sql',
      typeFile: 'agent-env-promoter.ts', skillDir: 'env-promoter',
      interfaces: ['EnvPromoterConfig', 'PromotionEvent', 'EnvironmentDiff'],
      bk: 'env_promoter', eks: ['envp.promotion_started', 'envp.diff_calculated', 'envp.promotion_completed', 'envp.conflict_resolved'],
      subjects: ['sven.envp.promotion_started', 'sven.envp.diff_calculated', 'sven.envp.promotion_completed', 'sven.envp.conflict_resolved'],
      cases: ['envp_promote', 'envp_diff', 'envp_complete', 'envp_resolve', 'envp_report', 'envp_monitor'],
    },
    {
      name: 'config_drifter', migration: '20260622280000_agent_config_drifter.sql',
      typeFile: 'agent-config-drifter.ts', skillDir: 'config-drifter',
      interfaces: ['ConfigDrifterConfig', 'DriftReport', 'RemediationAction'],
      bk: 'config_drifter', eks: ['cfdr.drift_detected', 'cfdr.baseline_updated', 'cfdr.remediation_applied', 'cfdr.compliance_checked'],
      subjects: ['sven.cfdr.drift_detected', 'sven.cfdr.baseline_updated', 'sven.cfdr.remediation_applied', 'sven.cfdr.compliance_checked'],
      cases: ['cfdr_detect', 'cfdr_update', 'cfdr_remediate', 'cfdr_check', 'cfdr_report', 'cfdr_monitor'],
    },
    {
      name: 'infra_reconciler', migration: '20260622290000_agent_infra_reconciler.sql',
      typeFile: 'agent-infra-reconciler.ts', skillDir: 'infra-reconciler',
      interfaces: ['InfraReconcilerConfig', 'ReconcileEvent', 'DesiredState'],
      bk: 'infra_reconciler', eks: ['ifrc.reconcile_started', 'ifrc.state_compared', 'ifrc.reconcile_applied', 'ifrc.drift_corrected'],
      subjects: ['sven.ifrc.reconcile_started', 'sven.ifrc.state_compared', 'sven.ifrc.reconcile_applied', 'sven.ifrc.drift_corrected'],
      cases: ['ifrc_reconcile', 'ifrc_compare', 'ifrc_apply', 'ifrc_correct', 'ifrc_report', 'ifrc_monitor'],
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
