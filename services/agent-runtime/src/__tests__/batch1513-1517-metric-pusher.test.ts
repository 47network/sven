import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Metric Pusher verticals', () => {
  const verticals = [
    {
      name: 'metric_pusher', migration: '20260631500000_agent_metric_pusher.sql',
      typeFile: 'agent-metric-pusher.ts', skillDir: 'metric-pusher',
      interfaces: ['MetricPusherEntry', 'MetricPusherConfig', 'MetricPusherResult'],
      bk: 'metric_pusher', eks: ['mp.entry_created', 'mp.config_updated', 'mp.export_emitted'],
      subjects: ['sven.mp.entry_created', 'sven.mp.config_updated', 'sven.mp.export_emitted'],
      cases: ['mp_collector', 'mp_aggregator', 'mp_reporter'],
    },
    {
      name: 'metric_pusher_monitor', migration: '20260631510000_agent_metric_pusher_monitor.sql',
      typeFile: 'agent-metric-pusher-monitor.ts', skillDir: 'metric-pusher-monitor',
      interfaces: ['MetricPusherMonitorCheck', 'MetricPusherMonitorConfig', 'MetricPusherMonitorResult'],
      bk: 'metric_pusher_monitor', eks: ['mpm.check_passed', 'mpm.alert_raised', 'mpm.export_emitted'],
      subjects: ['sven.mpm.check_passed', 'sven.mpm.alert_raised', 'sven.mpm.export_emitted'],
      cases: ['mpm_watcher', 'mpm_alerter', 'mpm_reporter'],
    },
    {
      name: 'metric_pusher_auditor', migration: '20260631520000_agent_metric_pusher_auditor.sql',
      typeFile: 'agent-metric-pusher-auditor.ts', skillDir: 'metric-pusher-auditor',
      interfaces: ['MetricPusherAuditEntry', 'MetricPusherAuditConfig', 'MetricPusherAuditResult'],
      bk: 'metric_pusher_auditor', eks: ['mpa.entry_logged', 'mpa.violation_found', 'mpa.export_emitted'],
      subjects: ['sven.mpa.entry_logged', 'sven.mpa.violation_found', 'sven.mpa.export_emitted'],
      cases: ['mpa_scanner', 'mpa_enforcer', 'mpa_reporter'],
    },
    {
      name: 'metric_pusher_reporter', migration: '20260631530000_agent_metric_pusher_reporter.sql',
      typeFile: 'agent-metric-pusher-reporter.ts', skillDir: 'metric-pusher-reporter',
      interfaces: ['MetricPusherReport', 'MetricPusherReportConfig', 'MetricPusherReportResult'],
      bk: 'metric_pusher_reporter', eks: ['mpr.report_generated', 'mpr.insight_found', 'mpr.export_emitted'],
      subjects: ['sven.mpr.report_generated', 'sven.mpr.insight_found', 'sven.mpr.export_emitted'],
      cases: ['mpr_builder', 'mpr_analyst', 'mpr_reporter'],
    },
    {
      name: 'metric_pusher_optimizer', migration: '20260631540000_agent_metric_pusher_optimizer.sql',
      typeFile: 'agent-metric-pusher-optimizer.ts', skillDir: 'metric-pusher-optimizer',
      interfaces: ['MetricPusherOptPlan', 'MetricPusherOptConfig', 'MetricPusherOptResult'],
      bk: 'metric_pusher_optimizer', eks: ['mpo.plan_created', 'mpo.optimization_applied', 'mpo.export_emitted'],
      subjects: ['sven.mpo.plan_created', 'sven.mpo.optimization_applied', 'sven.mpo.export_emitted'],
      cases: ['mpo_planner', 'mpo_executor', 'mpo_reporter'],
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
