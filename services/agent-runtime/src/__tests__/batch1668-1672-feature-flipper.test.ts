import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Feature Flipper verticals', () => {
  const verticals = [
    {
      name: 'feature_flipper', migration: '20260633050000_agent_feature_flipper.sql',
      typeFile: 'agent-feature-flipper.ts', skillDir: 'feature-flipper',
      interfaces: ['FeatureFlipperEntry', 'FeatureFlipperConfig', 'FeatureFlipperResult'],
      bk: 'feature_flipper', eks: ['ff.entry_created', 'ff.config_updated', 'ff.export_emitted'],
      subjects: ['sven.ff.entry_created', 'sven.ff.config_updated', 'sven.ff.export_emitted'],
      cases: ['ff_toggler', 'ff_evaluator', 'ff_reporter'],
    },
    {
      name: 'feature_flipper_monitor', migration: '20260633060000_agent_feature_flipper_monitor.sql',
      typeFile: 'agent-feature-flipper-monitor.ts', skillDir: 'feature-flipper-monitor',
      interfaces: ['FeatureFlipperMonitorCheck', 'FeatureFlipperMonitorConfig', 'FeatureFlipperMonitorResult'],
      bk: 'feature_flipper_monitor', eks: ['ffm.check_passed', 'ffm.alert_raised', 'ffm.export_emitted'],
      subjects: ['sven.ffm.check_passed', 'sven.ffm.alert_raised', 'sven.ffm.export_emitted'],
      cases: ['ffm_watcher', 'ffm_alerter', 'ffm_reporter'],
    },
    {
      name: 'feature_flipper_auditor', migration: '20260633070000_agent_feature_flipper_auditor.sql',
      typeFile: 'agent-feature-flipper-auditor.ts', skillDir: 'feature-flipper-auditor',
      interfaces: ['FeatureFlipperAuditEntry', 'FeatureFlipperAuditConfig', 'FeatureFlipperAuditResult'],
      bk: 'feature_flipper_auditor', eks: ['ffa.entry_logged', 'ffa.violation_found', 'ffa.export_emitted'],
      subjects: ['sven.ffa.entry_logged', 'sven.ffa.violation_found', 'sven.ffa.export_emitted'],
      cases: ['ffa_scanner', 'ffa_enforcer', 'ffa_reporter'],
    },
    {
      name: 'feature_flipper_reporter', migration: '20260633080000_agent_feature_flipper_reporter.sql',
      typeFile: 'agent-feature-flipper-reporter.ts', skillDir: 'feature-flipper-reporter',
      interfaces: ['FeatureFlipperReport', 'FeatureFlipperReportConfig', 'FeatureFlipperReportResult'],
      bk: 'feature_flipper_reporter', eks: ['ffr.report_generated', 'ffr.insight_found', 'ffr.export_emitted'],
      subjects: ['sven.ffr.report_generated', 'sven.ffr.insight_found', 'sven.ffr.export_emitted'],
      cases: ['ffr_builder', 'ffr_analyst', 'ffr_reporter'],
    },
    {
      name: 'feature_flipper_optimizer', migration: '20260633090000_agent_feature_flipper_optimizer.sql',
      typeFile: 'agent-feature-flipper-optimizer.ts', skillDir: 'feature-flipper-optimizer',
      interfaces: ['FeatureFlipperOptPlan', 'FeatureFlipperOptConfig', 'FeatureFlipperOptResult'],
      bk: 'feature_flipper_optimizer', eks: ['ffo.plan_created', 'ffo.optimization_applied', 'ffo.export_emitted'],
      subjects: ['sven.ffo.plan_created', 'sven.ffo.optimization_applied', 'sven.ffo.export_emitted'],
      cases: ['ffo_planner', 'ffo_executor', 'ffo_reporter'],
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
