import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 443-447 — Infrastructure Operations', () => {

  const migrationDir = path.join(ROOT, 'services', 'gateway-api', 'migrations');
  const migrations = [
    { file: '20260620800000_agent_config_syncer.sql', table: 'agent_config_syncer_configs' },
    { file: '20260620810000_agent_environment_prober.sql', table: 'agent_environment_prober_configs' },
    { file: '20260620820000_agent_secrets_rotator.sql', table: 'agent_secrets_rotator_configs' },
    { file: '20260620830000_agent_infra_scanner.sql', table: 'agent_infra_scanner_configs' },
    { file: '20260620840000_agent_health_dashboard.sql', table: 'agent_health_dashboard_configs' },
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

  const typeDir = path.join(ROOT, 'packages', 'shared', 'src');
  const typeFiles = [
    { file: 'agent-config-syncer.ts', iface: 'ConfigSyncerConfig' },
    { file: 'agent-environment-prober.ts', iface: 'EnvironmentProberConfig' },
    { file: 'agent-secrets-rotator.ts', iface: 'SecretsRotatorConfig' },
    { file: 'agent-infra-scanner.ts', iface: 'InfraScannerConfig' },
    { file: 'agent-health-dashboard.ts', iface: 'HealthDashboardConfig' },
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

  describe('Step 3 — Barrel exports', () => {
    const barrel = fs.readFileSync(path.join(typeDir, 'index.ts'), 'utf-8');
    ['./agent-config-syncer', './agent-environment-prober', './agent-secrets-rotator',
     './agent-infra-scanner', './agent-health-dashboard'].forEach(mod => {
      it(`barrel exports ${mod}`, () => { expect(barrel).toContain(mod); });
    });
  });

  const skillDir = path.join(ROOT, 'skills', 'autonomous-economy');
  const skills = ['config-syncer', 'environment-prober', 'secrets-rotator', 'infra-scanner', 'health-dashboard'];

  describe('Step 4 — SKILL.md files', () => {
    skills.forEach(skill => {
      const skillPath = path.join(skillDir, skill, 'SKILL.md');
      it(`${skill}/SKILL.md exists`, () => { expect(fs.existsSync(skillPath)).toBe(true); });
      it(`${skill}/SKILL.md has Actions section`, () => {
        expect(fs.readFileSync(skillPath, 'utf-8')).toContain('## Actions');
      });
      it(`${skill}/SKILL.md has pricing`, () => {
        expect(fs.readFileSync(skillPath, 'utf-8')).toContain('pricing:');
      });
    });
  });

  describe('Step 5 — Eidolon BK/EK/districtFor', () => {
    const typesFile = fs.readFileSync(path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts'), 'utf-8');
    const bks = ['config_syncer', 'environment_prober', 'secrets_rotator', 'infra_scanner', 'health_dashboard'];
    bks.forEach(bk => { it(`BK contains '${bk}'`, () => { expect(typesFile).toContain(`'${bk}'`); }); });

    const eks = [
      'cfsn.key_synced', 'cfsn.drift_detected', 'cfsn.conflict_resolved', 'cfsn.bulk_completed',
      'envp.probe_completed', 'envp.target_unhealthy', 'envp.uptime_reported', 'envp.alert_triggered',
      'scrt.secret_rotated', 'scrt.rotation_overdue', 'scrt.bulk_rotated', 'scrt.verification_done',
      'ifsn.scan_completed', 'ifsn.finding_detected', 'ifsn.remediation_generated', 'ifsn.report_exported',
      'hdsh.dashboard_created', 'hdsh.widget_added', 'hdsh.alert_configured', 'hdsh.snapshot_taken',
    ];
    eks.forEach(ek => { it(`EK contains '${ek}'`, () => { expect(typesFile).toContain(`'${ek}'`); }); });
    bks.forEach(bk => { it(`districtFor handles '${bk}'`, () => { expect(typesFile).toContain(`case '${bk}':`); }); });
  });

  describe('Step 6 — SUBJECT_MAP entries', () => {
    const eventBus = fs.readFileSync(path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.cfsn.key_synced', 'sven.cfsn.drift_detected', 'sven.cfsn.conflict_resolved', 'sven.cfsn.bulk_completed',
      'sven.envp.probe_completed', 'sven.envp.target_unhealthy', 'sven.envp.uptime_reported', 'sven.envp.alert_triggered',
      'sven.scrt.secret_rotated', 'sven.scrt.rotation_overdue', 'sven.scrt.bulk_rotated', 'sven.scrt.verification_done',
      'sven.ifsn.scan_completed', 'sven.ifsn.finding_detected', 'sven.ifsn.remediation_generated', 'sven.ifsn.report_exported',
      'sven.hdsh.dashboard_created', 'sven.hdsh.widget_added', 'sven.hdsh.alert_configured', 'sven.hdsh.snapshot_taken',
    ];
    subjects.forEach(s => { it(`SUBJECT_MAP has '${s}'`, () => { expect(eventBus).toContain(`'${s}'`); }); });
  });

  describe('Step 7 — Task executor cases + handlers', () => {
    const executor = fs.readFileSync(path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts'), 'utf-8');
    const cases = [
      'cfsn_sync', 'cfsn_detect_drift', 'cfsn_resolve', 'cfsn_history', 'cfsn_bulk_sync', 'cfsn_set_source',
      'envp_probe', 'envp_schedule', 'envp_history', 'envp_alert', 'envp_bulk_probe', 'envp_compare',
      'scrt_rotate', 'scrt_schedule', 'scrt_check_overdue', 'scrt_history', 'scrt_bulk_rotate', 'scrt_verify',
      'ifsn_scan', 'ifsn_quick_scan', 'ifsn_findings', 'ifsn_remediate', 'ifsn_compare', 'ifsn_export',
      'hdsh_create', 'hdsh_add_widget', 'hdsh_alert', 'hdsh_snapshot', 'hdsh_export', 'hdsh_clone',
    ];
    cases.forEach(c => { it(`has case '${c}'`, () => { expect(executor).toContain(`case '${c}'`); }); });
    const handlers = [
      'handleCfsnSync', 'handleCfsnDetectDrift', 'handleCfsnResolve', 'handleCfsnHistory', 'handleCfsnBulkSync', 'handleCfsnSetSource',
      'handleEnvpProbe', 'handleEnvpSchedule', 'handleEnvpHistory', 'handleEnvpAlert', 'handleEnvpBulkProbe', 'handleEnvpCompare',
      'handleScrtRotate', 'handleScrtSchedule', 'handleScrtCheckOverdue', 'handleScrtHistory', 'handleScrtBulkRotate', 'handleScrtVerify',
      'handleIfsnScan', 'handleIfsnQuickScan', 'handleIfsnFindings', 'handleIfsnRemediate', 'handleIfsnCompare', 'handleIfsnExport',
      'handleHdshCreate', 'handleHdshAddWidget', 'handleHdshAlert', 'handleHdshSnapshot', 'handleHdshExport', 'handleHdshClone',
    ];
    handlers.forEach(h => { it(`has handler ${h}`, () => { expect(executor).toContain(h); }); });
  });

  describe('Step 8 — .gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    ['config-syncer', 'environment-prober', 'secrets-rotator', 'infra-scanner', 'health-dashboard'].forEach(e => {
      it(`.gitattributes mentions ${e}`, () => { expect(ga).toContain(e); });
    });
  });
});
