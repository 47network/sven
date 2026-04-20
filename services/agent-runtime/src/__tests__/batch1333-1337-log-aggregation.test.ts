import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Log Aggregation verticals', () => {
  const verticals = [
    {
      name: 'log_aggregation', migration: '20260629700000_agent_log_aggregation.sql',
      typeFile: 'agent-log-aggregation.ts', skillDir: 'log-aggregation',
      interfaces: ['LogAggregationEntry', 'LogAggregationConfig', 'LogAggregationResult'],
      bk: 'log_aggregation', eks: ['la.entry_created', 'la.config_updated', 'la.export_emitted'],
      subjects: ['sven.la.entry_created', 'sven.la.config_updated', 'sven.la.export_emitted'],
      cases: ['la_collector', 'la_indexer', 'la_reporter'],
    },
    {
      name: 'log_aggregation_monitor', migration: '20260629710000_agent_log_aggregation_monitor.sql',
      typeFile: 'agent-log-aggregation-monitor.ts', skillDir: 'log-aggregation-monitor',
      interfaces: ['LogAggregationMonitorCheck', 'LogAggregationMonitorConfig', 'LogAggregationMonitorResult'],
      bk: 'log_aggregation_monitor', eks: ['lam.check_passed', 'lam.alert_raised', 'lam.export_emitted'],
      subjects: ['sven.lam.check_passed', 'sven.lam.alert_raised', 'sven.lam.export_emitted'],
      cases: ['lam_watcher', 'lam_alerter', 'lam_reporter'],
    },
    {
      name: 'log_aggregation_auditor', migration: '20260629720000_agent_log_aggregation_auditor.sql',
      typeFile: 'agent-log-aggregation-auditor.ts', skillDir: 'log-aggregation-auditor',
      interfaces: ['LogAggregationAuditEntry', 'LogAggregationAuditConfig', 'LogAggregationAuditResult'],
      bk: 'log_aggregation_auditor', eks: ['laa.entry_logged', 'laa.violation_found', 'laa.export_emitted'],
      subjects: ['sven.laa.entry_logged', 'sven.laa.violation_found', 'sven.laa.export_emitted'],
      cases: ['laa_scanner', 'laa_enforcer', 'laa_reporter'],
    },
    {
      name: 'log_aggregation_reporter', migration: '20260629730000_agent_log_aggregation_reporter.sql',
      typeFile: 'agent-log-aggregation-reporter.ts', skillDir: 'log-aggregation-reporter',
      interfaces: ['LogAggregationReport', 'LogAggregationReportConfig', 'LogAggregationReportResult'],
      bk: 'log_aggregation_reporter', eks: ['lar.report_generated', 'lar.insight_found', 'lar.export_emitted'],
      subjects: ['sven.lar.report_generated', 'sven.lar.insight_found', 'sven.lar.export_emitted'],
      cases: ['lar_builder', 'lar_analyst', 'lar_reporter'],
    },
    {
      name: 'log_aggregation_optimizer', migration: '20260629740000_agent_log_aggregation_optimizer.sql',
      typeFile: 'agent-log-aggregation-optimizer.ts', skillDir: 'log-aggregation-optimizer',
      interfaces: ['LogAggregationOptPlan', 'LogAggregationOptConfig', 'LogAggregationOptResult'],
      bk: 'log_aggregation_optimizer', eks: ['lao.plan_created', 'lao.optimization_applied', 'lao.export_emitted'],
      subjects: ['sven.lao.plan_created', 'sven.lao.optimization_applied', 'sven.lao.export_emitted'],
      cases: ['lao_planner', 'lao_executor', 'lao_reporter'],
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
