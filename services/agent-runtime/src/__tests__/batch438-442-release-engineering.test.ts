import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 438-442 — Release Engineering', () => {

  // ── Migration files ──
  const migrationDir = path.join(ROOT, 'services', 'gateway-api', 'migrations');
  const migrations = [
    { file: '20260620750000_agent_feature_flag_manager.sql', table: 'agent_feature_flag_manager_configs' },
    { file: '20260620760000_agent_blue_green_switcher.sql', table: 'agent_blue_green_switcher_configs' },
    { file: '20260620770000_agent_deployment_validator.sql', table: 'agent_deployment_validator_configs' },
    { file: '20260620780000_agent_gradual_rollout_manager.sql', table: 'agent_gradual_rollout_manager_configs' },
    { file: '20260620790000_agent_ab_test_runner.sql', table: 'agent_ab_test_runner_configs' },
  ];

  describe('Step 1 — Migration SQL', () => {
    migrations.forEach(({ file, table }) => {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(migrationDir, file))).toBe(true);
      });
      it(`${file} creates table ${table}`, () => {
        const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
        expect(sql).toContain('CREATE TABLE');
        expect(sql).toContain(table);
      });
      it(`${file} has IF NOT EXISTS`, () => {
        const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
        expect(sql).toContain('IF NOT EXISTS');
      });
    });
  });

  // ── Shared type files ──
  const typeDir = path.join(ROOT, 'packages', 'shared', 'src');
  const typeFiles = [
    { file: 'agent-feature-flag-manager.ts', iface: 'FeatureFlagManagerConfig' },
    { file: 'agent-blue-green-switcher.ts', iface: 'BlueGreenSwitcherConfig' },
    { file: 'agent-deployment-validator.ts', iface: 'DeploymentValidatorConfig' },
    { file: 'agent-gradual-rollout-manager.ts', iface: 'GradualRolloutManagerConfig' },
    { file: 'agent-ab-test-runner.ts', iface: 'ABTestRunnerConfig' },
  ];

  describe('Step 2 — Shared types', () => {
    typeFiles.forEach(({ file, iface }) => {
      it(`${file} exists`, () => {
        expect(fs.existsSync(path.join(typeDir, file))).toBe(true);
      });
      it(`${file} exports ${iface}`, () => {
        const src = fs.readFileSync(path.join(typeDir, file), 'utf-8');
        expect(src).toContain(`export interface ${iface}`);
      });
    });
  });

  // ── Barrel exports ──
  describe('Step 3 — Barrel exports', () => {
    const barrel = fs.readFileSync(path.join(typeDir, 'index.ts'), 'utf-8');
    const expected = [
      './agent-feature-flag-manager',
      './agent-blue-green-switcher',
      './agent-deployment-validator',
      './agent-gradual-rollout-manager',
      './agent-ab-test-runner',
    ];
    expected.forEach(mod => {
      it(`barrel exports ${mod}`, () => {
        expect(barrel).toContain(mod);
      });
    });
  });

  // ── SKILL.md files ──
  const skillDir = path.join(ROOT, 'skills', 'autonomous-economy');
  const skills = [
    'feature-flag-manager',
    'blue-green-switcher',
    'deployment-validator',
    'gradual-rollout-manager',
    'ab-test-runner',
  ];

  describe('Step 4 — SKILL.md files', () => {
    skills.forEach(skill => {
      const skillPath = path.join(skillDir, skill, 'SKILL.md');
      it(`${skill}/SKILL.md exists`, () => {
        expect(fs.existsSync(skillPath)).toBe(true);
      });
      it(`${skill}/SKILL.md has Actions section`, () => {
        const md = fs.readFileSync(skillPath, 'utf-8');
        expect(md).toContain('## Actions');
      });
      it(`${skill}/SKILL.md has pricing`, () => {
        const md = fs.readFileSync(skillPath, 'utf-8');
        expect(md).toContain('pricing:');
      });
    });
  });

  // ── Eidolon types ──
  describe('Step 5 — Eidolon BK/EK/districtFor', () => {
    const typesFile = fs.readFileSync(
      path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts'), 'utf-8'
    );

    const bks = ['feature_flag_manager', 'blue_green_switcher', 'deployment_validator',
                 'gradual_rollout_manager', 'ab_test_runner'];
    bks.forEach(bk => {
      it(`BK contains '${bk}'`, () => { expect(typesFile).toContain(`'${bk}'`); });
    });

    const eks = [
      'ffmg.flag_created', 'ffmg.flag_toggled', 'ffmg.rollout_set', 'ffmg.flag_evaluated',
      'bgsw.environment_created', 'bgsw.traffic_switched', 'bgsw.health_checked', 'bgsw.rollback_triggered',
      'dpvl.validation_started', 'dpvl.check_passed', 'dpvl.check_failed', 'dpvl.report_generated',
      'grlm.rollout_created', 'grlm.step_advanced', 'grlm.rollout_paused', 'grlm.rollout_completed',
      'abtr.test_created', 'abtr.test_started', 'abtr.event_recorded', 'abtr.test_concluded',
    ];
    eks.forEach(ek => {
      it(`EK contains '${ek}'`, () => { expect(typesFile).toContain(`'${ek}'`); });
    });

    bks.forEach(bk => {
      it(`districtFor handles '${bk}'`, () => {
        expect(typesFile).toContain(`case '${bk}':`);
      });
    });
  });

  // ── SUBJECT_MAP ──
  describe('Step 6 — SUBJECT_MAP entries', () => {
    const eventBus = fs.readFileSync(
      path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts'), 'utf-8'
    );
    const subjects = [
      'sven.ffmg.flag_created', 'sven.ffmg.flag_toggled', 'sven.ffmg.rollout_set', 'sven.ffmg.flag_evaluated',
      'sven.bgsw.environment_created', 'sven.bgsw.traffic_switched', 'sven.bgsw.health_checked', 'sven.bgsw.rollback_triggered',
      'sven.dpvl.validation_started', 'sven.dpvl.check_passed', 'sven.dpvl.check_failed', 'sven.dpvl.report_generated',
      'sven.grlm.rollout_created', 'sven.grlm.step_advanced', 'sven.grlm.rollout_paused', 'sven.grlm.rollout_completed',
      'sven.abtr.test_created', 'sven.abtr.test_started', 'sven.abtr.event_recorded', 'sven.abtr.test_concluded',
    ];
    subjects.forEach(s => {
      it(`SUBJECT_MAP has '${s}'`, () => { expect(eventBus).toContain(`'${s}'`); });
    });
  });

  // ── Task executor ──
  describe('Step 7 — Task executor cases + handlers', () => {
    const executor = fs.readFileSync(
      path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts'), 'utf-8'
    );
    const cases = [
      'ffmg_create_flag', 'ffmg_evaluate', 'ffmg_toggle', 'ffmg_set_rollout', 'ffmg_list_stale', 'ffmg_audit',
      'bgsw_create_env', 'bgsw_switch', 'bgsw_health_check', 'bgsw_rollback', 'bgsw_status', 'bgsw_history',
      'dpvl_validate', 'dpvl_run_check', 'dpvl_report', 'dpvl_configure', 'dpvl_retry', 'dpvl_compare',
      'grlm_create', 'grlm_advance', 'grlm_pause', 'grlm_rollback', 'grlm_status', 'grlm_auto_advance',
      'abtr_create', 'abtr_start', 'abtr_record', 'abtr_results', 'abtr_conclude', 'abtr_compare',
    ];
    cases.forEach(c => {
      it(`has case '${c}'`, () => { expect(executor).toContain(`case '${c}'`); });
    });

    const handlers = [
      'handleFfmgCreateFlag', 'handleFfmgEvaluate', 'handleFfmgToggle', 'handleFfmgSetRollout', 'handleFfmgListStale', 'handleFfmgAudit',
      'handleBgswCreateEnv', 'handleBgswSwitch', 'handleBgswHealthCheck', 'handleBgswRollback', 'handleBgswStatus', 'handleBgswHistory',
      'handleDpvlValidate', 'handleDpvlRunCheck', 'handleDpvlReport', 'handleDpvlConfigure', 'handleDpvlRetry', 'handleDpvlCompare',
      'handleGrlmCreate', 'handleGrlmAdvance', 'handleGrlmPause', 'handleGrlmRollback', 'handleGrlmStatus', 'handleGrlmAutoAdvance',
      'handleAbtrCreate', 'handleAbtrStart', 'handleAbtrRecord', 'handleAbtrResults', 'handleAbtrConclude', 'handleAbtrCompare',
    ];
    handlers.forEach(h => {
      it(`has handler ${h}`, () => { expect(executor).toContain(h); });
    });
  });

  // ── .gitattributes ──
  describe('Step 8 — .gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const entries = [
      'feature-flag-manager', 'blue-green-switcher', 'deployment-validator',
      'gradual-rollout-manager', 'ab-test-runner',
    ];
    entries.forEach(e => {
      it(`.gitattributes mentions ${e}`, () => { expect(ga).toContain(e); });
    });
  });
});
