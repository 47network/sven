import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Query Inspector verticals', () => {
  const verticals = [
    {
      name: 'query_inspector', migration: '20260631350000_agent_query_inspector.sql',
      typeFile: 'agent-query-inspector.ts', skillDir: 'query-inspector',
      interfaces: ['QueryInspectorEntry', 'QueryInspectorConfig', 'QueryInspectorResult'],
      bk: 'query_inspector', eks: ['qi.entry_created', 'qi.config_updated', 'qi.export_emitted'],
      subjects: ['sven.qi.entry_created', 'sven.qi.config_updated', 'sven.qi.export_emitted'],
      cases: ['qi_analyzer', 'qi_optimizer', 'qi_reporter'],
    },
    {
      name: 'query_inspector_monitor', migration: '20260631360000_agent_query_inspector_monitor.sql',
      typeFile: 'agent-query-inspector-monitor.ts', skillDir: 'query-inspector-monitor',
      interfaces: ['QueryInspectorMonitorCheck', 'QueryInspectorMonitorConfig', 'QueryInspectorMonitorResult'],
      bk: 'query_inspector_monitor', eks: ['qim.check_passed', 'qim.alert_raised', 'qim.export_emitted'],
      subjects: ['sven.qim.check_passed', 'sven.qim.alert_raised', 'sven.qim.export_emitted'],
      cases: ['qim_watcher', 'qim_alerter', 'qim_reporter'],
    },
    {
      name: 'query_inspector_auditor', migration: '20260631370000_agent_query_inspector_auditor.sql',
      typeFile: 'agent-query-inspector-auditor.ts', skillDir: 'query-inspector-auditor',
      interfaces: ['QueryInspectorAuditEntry', 'QueryInspectorAuditConfig', 'QueryInspectorAuditResult'],
      bk: 'query_inspector_auditor', eks: ['qia.entry_logged', 'qia.violation_found', 'qia.export_emitted'],
      subjects: ['sven.qia.entry_logged', 'sven.qia.violation_found', 'sven.qia.export_emitted'],
      cases: ['qia_scanner', 'qia_enforcer', 'qia_reporter'],
    },
    {
      name: 'query_inspector_reporter', migration: '20260631380000_agent_query_inspector_reporter.sql',
      typeFile: 'agent-query-inspector-reporter.ts', skillDir: 'query-inspector-reporter',
      interfaces: ['QueryInspectorReport', 'QueryInspectorReportConfig', 'QueryInspectorReportResult'],
      bk: 'query_inspector_reporter', eks: ['qir.report_generated', 'qir.insight_found', 'qir.export_emitted'],
      subjects: ['sven.qir.report_generated', 'sven.qir.insight_found', 'sven.qir.export_emitted'],
      cases: ['qir_builder', 'qir_analyst', 'qir_reporter'],
    },
    {
      name: 'query_inspector_optimizer', migration: '20260631390000_agent_query_inspector_optimizer.sql',
      typeFile: 'agent-query-inspector-optimizer.ts', skillDir: 'query-inspector-optimizer',
      interfaces: ['QueryInspectorOptPlan', 'QueryInspectorOptConfig', 'QueryInspectorOptResult'],
      bk: 'query_inspector_optimizer', eks: ['qio.plan_created', 'qio.optimization_applied', 'qio.export_emitted'],
      subjects: ['sven.qio.plan_created', 'sven.qio.optimization_applied', 'sven.qio.export_emitted'],
      cases: ['qio_planner', 'qio_executor', 'qio_reporter'],
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
