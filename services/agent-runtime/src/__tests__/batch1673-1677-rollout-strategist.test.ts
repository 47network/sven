import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Rollout Strategist verticals', () => {
  const verticals = [
    {
      name: 'rollout_strategist', migration: '20260633100000_agent_rollout_strategist.sql',
      typeFile: 'agent-rollout-strategist.ts', skillDir: 'rollout-strategist',
      interfaces: ['RolloutStrategistEntry', 'RolloutStrategistConfig', 'RolloutStrategistResult'],
      bk: 'rollout_strategist', eks: ['rs.entry_created', 'rs.config_updated', 'rs.export_emitted'],
      subjects: ['sven.rs.entry_created', 'sven.rs.config_updated', 'sven.rs.export_emitted'],
      cases: ['rs_planner', 'rs_scheduler', 'rs_reporter'],
    },
    {
      name: 'rollout_strategist_monitor', migration: '20260633110000_agent_rollout_strategist_monitor.sql',
      typeFile: 'agent-rollout-strategist-monitor.ts', skillDir: 'rollout-strategist-monitor',
      interfaces: ['RolloutStrategistMonitorCheck', 'RolloutStrategistMonitorConfig', 'RolloutStrategistMonitorResult'],
      bk: 'rollout_strategist_monitor', eks: ['rsm.check_passed', 'rsm.alert_raised', 'rsm.export_emitted'],
      subjects: ['sven.rsm.check_passed', 'sven.rsm.alert_raised', 'sven.rsm.export_emitted'],
      cases: ['rsm_watcher', 'rsm_alerter', 'rsm_reporter'],
    },
    {
      name: 'rollout_strategist_auditor', migration: '20260633120000_agent_rollout_strategist_auditor.sql',
      typeFile: 'agent-rollout-strategist-auditor.ts', skillDir: 'rollout-strategist-auditor',
      interfaces: ['RolloutStrategistAuditEntry', 'RolloutStrategistAuditConfig', 'RolloutStrategistAuditResult'],
      bk: 'rollout_strategist_auditor', eks: ['rsa.entry_logged', 'rsa.violation_found', 'rsa.export_emitted'],
      subjects: ['sven.rsa.entry_logged', 'sven.rsa.violation_found', 'sven.rsa.export_emitted'],
      cases: ['rsa_scanner', 'rsa_enforcer', 'rsa_reporter'],
    },
    {
      name: 'rollout_strategist_reporter', migration: '20260633130000_agent_rollout_strategist_reporter.sql',
      typeFile: 'agent-rollout-strategist-reporter.ts', skillDir: 'rollout-strategist-reporter',
      interfaces: ['RolloutStrategistReport', 'RolloutStrategistReportConfig', 'RolloutStrategistReportResult'],
      bk: 'rollout_strategist_reporter', eks: ['rsr.report_generated', 'rsr.insight_found', 'rsr.export_emitted'],
      subjects: ['sven.rsr.report_generated', 'sven.rsr.insight_found', 'sven.rsr.export_emitted'],
      cases: ['rsr_builder', 'rsr_analyst', 'rsr_reporter'],
    },
    {
      name: 'rollout_strategist_optimizer', migration: '20260633140000_agent_rollout_strategist_optimizer.sql',
      typeFile: 'agent-rollout-strategist-optimizer.ts', skillDir: 'rollout-strategist-optimizer',
      interfaces: ['RolloutStrategistOptPlan', 'RolloutStrategistOptConfig', 'RolloutStrategistOptResult'],
      bk: 'rollout_strategist_optimizer', eks: ['rso.plan_created', 'rso.optimization_applied', 'rso.export_emitted'],
      subjects: ['sven.rso.plan_created', 'sven.rso.optimization_applied', 'sven.rso.export_emitted'],
      cases: ['rso_planner', 'rso_executor', 'rso_reporter'],
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
