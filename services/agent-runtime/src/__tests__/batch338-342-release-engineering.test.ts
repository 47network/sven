import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 338-342: Release Engineering', () => {

  const migrations = [
    { file: '20260619750000_agent_feature_flag.sql', tables: ['agent_feature_flag_configs', 'agent_feature_flags', 'agent_flag_evaluations'] },
    { file: '20260619760000_agent_rollback_manager.sql', tables: ['agent_rollback_manager_configs', 'agent_deployment_snapshots', 'agent_rollback_operations'] },
    { file: '20260619770000_agent_blue_green_router.sql', tables: ['agent_blue_green_router_configs', 'agent_environment_slots', 'agent_traffic_switches'] },
    { file: '20260619780000_agent_chaos_tester.sql', tables: ['agent_chaos_tester_configs', 'agent_chaos_experiments', 'agent_chaos_results'] },
    { file: '20260619790000_agent_deployment_gate.sql', tables: ['agent_deployment_gate_configs', 'agent_gate_checks', 'agent_gate_decisions'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true); });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
    }
  });

  const typeFiles = [
    { file: 'agent-feature-flag.ts', exports: ['FlagType', 'EvaluationMode', 'RolloutStrategy'] },
    { file: 'agent-rollback-manager.ts', exports: ['SnapshotStatus', 'RollbackStatus', 'RollbackInitiator'] },
    { file: 'agent-blue-green-router.ts', exports: ['SwitchStrategy', 'SlotColor', 'HealthStatus'] },
    { file: 'agent-chaos-tester.ts', exports: ['ChaosExperimentType', 'BlastRadius', 'ChaosStatus'] },
    { file: 'agent-deployment-gate.ts', exports: ['GateCheckType', 'GateDecision', 'DecisionAuthority'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true); });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => { expect(fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8')).toContain(exp); });
      }
    }
  });

  describe('Barrel exports in index.ts', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    for (const b of ['agent-feature-flag', 'agent-rollback-manager', 'agent-blue-green-router', 'agent-chaos-tester', 'agent-deployment-gate']) {
      it(`exports ${b}`, () => { expect(idx).toContain(b); });
    }
  });

  const skills = [
    { dir: 'feature-flag', price: '11.99', archetype: 'engineer' },
    { dir: 'rollback-manager', price: '15.99', archetype: 'engineer' },
    { dir: 'blue-green-router', price: '19.99', archetype: 'engineer' },
    { dir: 'chaos-tester', price: '24.99', archetype: 'engineer' },
    { dir: 'deployment-gate', price: '13.99', archetype: 'engineer' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const p = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => { expect(fs.existsSync(p)).toBe(true); });
      it(`${s.dir}/SKILL.md has correct price`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.price); });
      it(`${s.dir}/SKILL.md has correct archetype`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.archetype); });
      it(`${s.dir}/SKILL.md has Actions section`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain('## Actions'); });
    }
  });

  describe('Eidolon types.ts', () => {
    const tc = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['feature_flag', 'rollback_manager', 'blue_green_router', 'chaos_tester', 'deployment_gate']) {
      it(`has BK '${bk}'`, () => { expect(tc).toContain(`'${bk}'`); });
    }
    for (const ek of ['fflg.flag_created', 'rbmg.snapshot_created', 'bgrn.slot_deployed', 'chts.experiment_started', 'dpgt.checks_passed']) {
      it(`has EK '${ek}'`, () => { expect(tc).toContain(`'${ek}'`); });
    }
    for (const bk of ['feature_flag', 'rollback_manager', 'blue_green_router', 'chaos_tester', 'deployment_gate']) {
      it(`has districtFor case '${bk}'`, () => { expect(tc).toContain(`case '${bk}':`); });
    }
  });

  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.fflg.flag_created', 'sven.fflg.flag_evaluated', 'sven.fflg.rollout_changed', 'sven.fflg.flag_toggled',
      'sven.rbmg.snapshot_created', 'sven.rbmg.rollback_executed', 'sven.rbmg.version_restored', 'sven.rbmg.snapshot_expired',
      'sven.bgrn.slot_deployed', 'sven.bgrn.traffic_switched', 'sven.bgrn.health_changed', 'sven.bgrn.warmup_completed',
      'sven.chts.experiment_started', 'sven.chts.experiment_completed', 'sven.chts.experiment_aborted', 'sven.chts.hypothesis_validated',
      'sven.dpgt.checks_passed', 'sven.dpgt.gate_approved', 'sven.dpgt.gate_rejected', 'sven.dpgt.override_applied',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(bus).toContain(`'${s}'`); });
    }
  });

  describe('Task executor', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'fflg_create_flag', 'fflg_evaluate_flag', 'fflg_update_rollout', 'fflg_list_flags', 'fflg_audit_history', 'fflg_bulk_toggle',
      'rbmg_create_snapshot', 'rbmg_list_snapshots', 'rbmg_execute_rollback', 'rbmg_auto_rollback', 'rbmg_compare_versions', 'rbmg_cleanup_expired',
      'bgrn_deploy_slot', 'bgrn_switch_traffic', 'bgrn_health_check', 'bgrn_warmup_slot', 'bgrn_rollback_switch', 'bgrn_slot_status',
      'chts_create_experiment', 'chts_run_experiment', 'chts_abort_experiment', 'chts_analyze_results', 'chts_schedule_experiment', 'chts_generate_report',
      'dpgt_configure_checks', 'dpgt_run_checks', 'dpgt_request_approval', 'dpgt_gate_status', 'dpgt_override_gate', 'dpgt_audit_decisions',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(exec).toContain(`case '${c}'`); });
    }
    for (const h of ['handleFflgCreateFlag', 'handleRbmgCreateSnapshot', 'handleBgrnDeploySlot', 'handleChtsCreateExperiment', 'handleDpgtConfigureChecks']) {
      it(`has handler ${h}`, () => { expect(exec).toContain(h); });
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    for (const e of [
      'agent_feature_flag.sql', 'agent_rollback_manager.sql', 'agent_blue_green_router.sql', 'agent_chaos_tester.sql', 'agent_deployment_gate.sql',
      'agent-feature-flag.ts', 'agent-rollback-manager.ts', 'agent-blue-green-router.ts', 'agent-chaos-tester.ts', 'agent-deployment-gate.ts',
      'feature-flag/SKILL.md', 'rollback-manager/SKILL.md', 'blue-green-router/SKILL.md', 'chaos-tester/SKILL.md', 'deployment-gate/SKILL.md',
    ]) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});
