import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Coverage Tracker verticals', () => {
  const verticals = [
    {
      name: 'coverage_tracker', migration: '20260634000000_agent_coverage_tracker.sql',
      typeFile: 'agent-coverage-tracker.ts', skillDir: 'coverage-tracker',
      interfaces: ['CoverageTrackerEntry', 'CoverageTrackerConfig', 'CoverageTrackerResult'],
      bk: 'coverage_tracker', eks: ['ct.entry_created', 'ct.config_updated', 'ct.export_emitted'],
      subjects: ['sven.ct.entry_created', 'sven.ct.config_updated', 'sven.ct.export_emitted'],
      cases: ['ct_collector', 'ct_analyzer', 'ct_reporter'],
    },
    {
      name: 'coverage_tracker_monitor', migration: '20260634010000_agent_coverage_tracker_monitor.sql',
      typeFile: 'agent-coverage-tracker-monitor.ts', skillDir: 'coverage-tracker-monitor',
      interfaces: ['CoverageTrackerMonitorCheck', 'CoverageTrackerMonitorConfig', 'CoverageTrackerMonitorResult'],
      bk: 'coverage_tracker_monitor', eks: ['ctm.check_passed', 'ctm.alert_raised', 'ctm.export_emitted'],
      subjects: ['sven.ctm.check_passed', 'sven.ctm.alert_raised', 'sven.ctm.export_emitted'],
      cases: ['ctm_watcher', 'ctm_alerter', 'ctm_reporter'],
    },
    {
      name: 'coverage_tracker_auditor', migration: '20260634020000_agent_coverage_tracker_auditor.sql',
      typeFile: 'agent-coverage-tracker-auditor.ts', skillDir: 'coverage-tracker-auditor',
      interfaces: ['CoverageTrackerAuditEntry', 'CoverageTrackerAuditConfig', 'CoverageTrackerAuditResult'],
      bk: 'coverage_tracker_auditor', eks: ['cta.entry_logged', 'cta.violation_found', 'cta.export_emitted'],
      subjects: ['sven.cta.entry_logged', 'sven.cta.violation_found', 'sven.cta.export_emitted'],
      cases: ['cta_scanner', 'cta_enforcer', 'cta_reporter'],
    },
    {
      name: 'coverage_tracker_reporter', migration: '20260634030000_agent_coverage_tracker_reporter.sql',
      typeFile: 'agent-coverage-tracker-reporter.ts', skillDir: 'coverage-tracker-reporter',
      interfaces: ['CoverageTrackerReport', 'CoverageTrackerReportConfig', 'CoverageTrackerReportResult'],
      bk: 'coverage_tracker_reporter', eks: ['ctr.report_generated', 'ctr.insight_found', 'ctr.export_emitted'],
      subjects: ['sven.ctr.report_generated', 'sven.ctr.insight_found', 'sven.ctr.export_emitted'],
      cases: ['ctr_builder', 'ctr_analyst', 'ctr_reporter'],
    },
    {
      name: 'coverage_tracker_optimizer', migration: '20260634040000_agent_coverage_tracker_optimizer.sql',
      typeFile: 'agent-coverage-tracker-optimizer.ts', skillDir: 'coverage-tracker-optimizer',
      interfaces: ['CoverageTrackerOptPlan', 'CoverageTrackerOptConfig', 'CoverageTrackerOptResult'],
      bk: 'coverage_tracker_optimizer', eks: ['cto.plan_created', 'cto.optimization_applied', 'cto.export_emitted'],
      subjects: ['sven.cto.plan_created', 'sven.cto.optimization_applied', 'sven.cto.export_emitted'],
      cases: ['cto_planner', 'cto_executor', 'cto_reporter'],
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
