import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Usage Analytics management verticals', () => {
  const verticals = [
    {
      name: 'usage_analytics', migration: '20260629350000_agent_usage_analytics.sql',
      typeFile: 'agent-usage-analytics.ts', skillDir: 'usage-analytics',
      interfaces: ['UsageAnalyticsEntry', 'UsageAnalyticsConfig', 'UsageAnalyticsResult'],
      bk: 'usage_analytics', eks: ['ua.entry_created', 'ua.config_updated', 'ua.export_emitted'],
      subjects: ['sven.ua.entry_created', 'sven.ua.config_updated', 'sven.ua.export_emitted'],
      cases: ['ua_collector', 'ua_analyzer', 'ua_reporter'],
    },
    {
      name: 'usage_analytics_monitor', migration: '20260629360000_agent_usage_analytics_monitor.sql',
      typeFile: 'agent-usage-analytics-monitor.ts', skillDir: 'usage-analytics-monitor',
      interfaces: ['UsageAnalyticsMonitorCheck', 'UsageAnalyticsMonitorConfig', 'UsageAnalyticsMonitorResult'],
      bk: 'usage_analytics_monitor', eks: ['uam.check_passed', 'uam.alert_raised', 'uam.export_emitted'],
      subjects: ['sven.uam.check_passed', 'sven.uam.alert_raised', 'sven.uam.export_emitted'],
      cases: ['uam_watcher', 'uam_alerter', 'uam_reporter'],
    },
    {
      name: 'usage_analytics_auditor', migration: '20260629370000_agent_usage_analytics_auditor.sql',
      typeFile: 'agent-usage-analytics-auditor.ts', skillDir: 'usage-analytics-auditor',
      interfaces: ['UsageAnalyticsAuditEntry', 'UsageAnalyticsAuditConfig', 'UsageAnalyticsAuditResult'],
      bk: 'usage_analytics_auditor', eks: ['uaa.entry_logged', 'uaa.violation_found', 'uaa.export_emitted'],
      subjects: ['sven.uaa.entry_logged', 'sven.uaa.violation_found', 'sven.uaa.export_emitted'],
      cases: ['uaa_scanner', 'uaa_enforcer', 'uaa_reporter'],
    },
    {
      name: 'usage_analytics_reporter', migration: '20260629380000_agent_usage_analytics_reporter.sql',
      typeFile: 'agent-usage-analytics-reporter.ts', skillDir: 'usage-analytics-reporter',
      interfaces: ['UsageAnalyticsReport', 'UsageAnalyticsReportConfig', 'UsageAnalyticsReportResult'],
      bk: 'usage_analytics_reporter', eks: ['uar.report_generated', 'uar.insight_found', 'uar.export_emitted'],
      subjects: ['sven.uar.report_generated', 'sven.uar.insight_found', 'sven.uar.export_emitted'],
      cases: ['uar_builder', 'uar_analyst', 'uar_reporter'],
    },
    {
      name: 'usage_analytics_optimizer', migration: '20260629390000_agent_usage_analytics_optimizer.sql',
      typeFile: 'agent-usage-analytics-optimizer.ts', skillDir: 'usage-analytics-optimizer',
      interfaces: ['UsageAnalyticsOptPlan', 'UsageAnalyticsOptConfig', 'UsageAnalyticsOptResult'],
      bk: 'usage_analytics_optimizer', eks: ['uao.plan_created', 'uao.optimization_applied', 'uao.export_emitted'],
      subjects: ['sven.uao.plan_created', 'sven.uao.optimization_applied', 'sven.uao.export_emitted'],
      cases: ['uao_planner', 'uao_executor', 'uao_reporter'],
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
