import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Feature Switch management verticals', () => {
  const verticals = [
    {
      name: 'feature_switch', migration: '20260628550000_agent_feature_switch.sql',
      typeFile: 'agent-feature-switch.ts', skillDir: 'feature-switch',
      interfaces: ['FeatureSwitchRule', 'FeatureSwitchConfig', 'FeatureSwitchResult'],
      bk: 'feature_switch', eks: ['fs.rule_created', 'fs.config_updated', 'fs.export_emitted'],
      subjects: ['sven.fs.rule_created', 'sven.fs.config_updated', 'sven.fs.export_emitted'],
      cases: ['fs_planner', 'fs_enforcer', 'fs_reporter'],
    },
    {
      name: 'feature_switch_monitor', migration: '20260628560000_agent_feature_switch_monitor.sql',
      typeFile: 'agent-feature-switch-monitor.ts', skillDir: 'feature-switch-monitor',
      interfaces: ['FeatureSwitchMonitorCheck', 'FeatureSwitchMonitorConfig', 'FeatureSwitchMonitorResult'],
      bk: 'feature_switch_monitor', eks: ['fsm.check_passed', 'fsm.alert_raised', 'fsm.export_emitted'],
      subjects: ['sven.fsm.check_passed', 'sven.fsm.alert_raised', 'sven.fsm.export_emitted'],
      cases: ['fsm_watcher', 'fsm_alerter', 'fsm_reporter'],
    },
    {
      name: 'feature_switch_auditor', migration: '20260628570000_agent_feature_switch_auditor.sql',
      typeFile: 'agent-feature-switch-auditor.ts', skillDir: 'feature-switch-auditor',
      interfaces: ['FeatureSwitchAuditEntry', 'FeatureSwitchAuditConfig', 'FeatureSwitchAuditResult'],
      bk: 'feature_switch_auditor', eks: ['fsa.entry_logged', 'fsa.violation_found', 'fsa.export_emitted'],
      subjects: ['sven.fsa.entry_logged', 'sven.fsa.violation_found', 'sven.fsa.export_emitted'],
      cases: ['fsa_scanner', 'fsa_enforcer', 'fsa_reporter'],
    },
    {
      name: 'feature_switch_reporter', migration: '20260628580000_agent_feature_switch_reporter.sql',
      typeFile: 'agent-feature-switch-reporter.ts', skillDir: 'feature-switch-reporter',
      interfaces: ['FeatureSwitchReport', 'FeatureSwitchReportConfig', 'FeatureSwitchReportResult'],
      bk: 'feature_switch_reporter', eks: ['fsr.report_generated', 'fsr.insight_found', 'fsr.export_emitted'],
      subjects: ['sven.fsr.report_generated', 'sven.fsr.insight_found', 'sven.fsr.export_emitted'],
      cases: ['fsr_builder', 'fsr_analyst', 'fsr_reporter'],
    },
    {
      name: 'feature_switch_optimizer', migration: '20260628590000_agent_feature_switch_optimizer.sql',
      typeFile: 'agent-feature-switch-optimizer.ts', skillDir: 'feature-switch-optimizer',
      interfaces: ['FeatureSwitchOptPlan', 'FeatureSwitchOptConfig', 'FeatureSwitchOptResult'],
      bk: 'feature_switch_optimizer', eks: ['fso.plan_created', 'fso.optimization_applied', 'fso.export_emitted'],
      subjects: ['sven.fso.plan_created', 'sven.fso.optimization_applied', 'sven.fso.export_emitted'],
      cases: ['fso_planner', 'fso_executor', 'fso_reporter'],
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
