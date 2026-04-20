import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Metric Collection verticals', () => {
  const verticals = [
    {
      name: 'metric_collection', migration: '20260629750000_agent_metric_collection.sql',
      typeFile: 'agent-metric-collection.ts', skillDir: 'metric-collection',
      interfaces: ['MetricCollectionEntry', 'MetricCollectionConfig', 'MetricCollectionResult'],
      bk: 'metric_collection', eks: ['mc.entry_created', 'mc.config_updated', 'mc.export_emitted'],
      subjects: ['sven.mc.entry_created', 'sven.mc.config_updated', 'sven.mc.export_emitted'],
      cases: ['mc_collector', 'mc_ingester', 'mc_reporter'],
    },
    {
      name: 'metric_collection_monitor', migration: '20260629760000_agent_metric_collection_monitor.sql',
      typeFile: 'agent-metric-collection-monitor.ts', skillDir: 'metric-collection-monitor',
      interfaces: ['MetricCollectionMonitorCheck', 'MetricCollectionMonitorConfig', 'MetricCollectionMonitorResult'],
      bk: 'metric_collection_monitor', eks: ['mcm.check_passed', 'mcm.alert_raised', 'mcm.export_emitted'],
      subjects: ['sven.mcm.check_passed', 'sven.mcm.alert_raised', 'sven.mcm.export_emitted'],
      cases: ['mcm_watcher', 'mcm_alerter', 'mcm_reporter'],
    },
    {
      name: 'metric_collection_auditor', migration: '20260629770000_agent_metric_collection_auditor.sql',
      typeFile: 'agent-metric-collection-auditor.ts', skillDir: 'metric-collection-auditor',
      interfaces: ['MetricCollectionAuditEntry', 'MetricCollectionAuditConfig', 'MetricCollectionAuditResult'],
      bk: 'metric_collection_auditor', eks: ['mca.entry_logged', 'mca.violation_found', 'mca.export_emitted'],
      subjects: ['sven.mca.entry_logged', 'sven.mca.violation_found', 'sven.mca.export_emitted'],
      cases: ['mca_scanner', 'mca_enforcer', 'mca_reporter'],
    },
    {
      name: 'metric_collection_reporter', migration: '20260629780000_agent_metric_collection_reporter.sql',
      typeFile: 'agent-metric-collection-reporter.ts', skillDir: 'metric-collection-reporter',
      interfaces: ['MetricCollectionReport', 'MetricCollectionReportConfig', 'MetricCollectionReportResult'],
      bk: 'metric_collection_reporter', eks: ['mcr.report_generated', 'mcr.insight_found', 'mcr.export_emitted'],
      subjects: ['sven.mcr.report_generated', 'sven.mcr.insight_found', 'sven.mcr.export_emitted'],
      cases: ['mcr_builder', 'mcr_analyst', 'mcr_reporter'],
    },
    {
      name: 'metric_collection_optimizer', migration: '20260629790000_agent_metric_collection_optimizer.sql',
      typeFile: 'agent-metric-collection-optimizer.ts', skillDir: 'metric-collection-optimizer',
      interfaces: ['MetricCollectionOptPlan', 'MetricCollectionOptConfig', 'MetricCollectionOptResult'],
      bk: 'metric_collection_optimizer', eks: ['mco.plan_created', 'mco.optimization_applied', 'mco.export_emitted'],
      subjects: ['sven.mco.plan_created', 'sven.mco.optimization_applied', 'sven.mco.export_emitted'],
      cases: ['mco_planner', 'mco_executor', 'mco_reporter'],
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
