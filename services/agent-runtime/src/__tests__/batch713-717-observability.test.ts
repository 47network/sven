import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 713-717: Observability', () => {
  const verticals = [
    {
      name: 'dashboard_generator', migration: '20260623500000_agent_dashboard_generator.sql',
      typeFile: 'agent-dashboard-generator.ts', skillDir: 'dashboard-generator',
      interfaces: ['DashboardGeneratorConfig', 'Dashboard', 'GeneratorEvent'],
      bk: 'dashboard_generator', eks: ['dbgn.dashboard_created', 'dbgn.panel_added', 'dbgn.template_applied', 'dbgn.export_completed'],
      subjects: ['sven.dbgn.dashboard_created', 'sven.dbgn.panel_added', 'sven.dbgn.template_applied', 'sven.dbgn.export_completed'],
      cases: ['dbgn_create', 'dbgn_add', 'dbgn_apply', 'dbgn_export', 'dbgn_report', 'dbgn_monitor'],
    },
    {
      name: 'slo_calculator', migration: '20260623510000_agent_slo_calculator.sql',
      typeFile: 'agent-slo-calculator.ts', skillDir: 'slo-calculator',
      interfaces: ['SloCalculatorConfig', 'SloDefinition', 'CalculatorEvent'],
      bk: 'slo_calculator', eks: ['slcl.slo_calculated', 'slcl.error_budget_consumed', 'slcl.burn_rate_alerted', 'slcl.window_rolled'],
      subjects: ['sven.slcl.slo_calculated', 'sven.slcl.error_budget_consumed', 'sven.slcl.burn_rate_alerted', 'sven.slcl.window_rolled'],
      cases: ['slcl_calculate', 'slcl_consume', 'slcl_alert', 'slcl_roll', 'slcl_report', 'slcl_monitor'],
    },
    {
      name: 'log_pipeline_router', migration: '20260623520000_agent_log_pipeline_router.sql',
      typeFile: 'agent-log-pipeline-router.ts', skillDir: 'log-pipeline-router',
      interfaces: ['LogPipelineRouterConfig', 'LogRoute', 'RouterEvent'],
      bk: 'log_pipeline_router', eks: ['lpro.route_added', 'lpro.log_filtered', 'lpro.log_enriched', 'lpro.sink_dispatched'],
      subjects: ['sven.lpro.route_added', 'sven.lpro.log_filtered', 'sven.lpro.log_enriched', 'sven.lpro.sink_dispatched'],
      cases: ['lpro_add', 'lpro_filter', 'lpro_enrich', 'lpro_dispatch', 'lpro_report', 'lpro_monitor'],
    },
    {
      name: 'metric_correlator', migration: '20260623530000_agent_metric_correlator.sql',
      typeFile: 'agent-metric-correlator.ts', skillDir: 'metric-correlator',
      interfaces: ['MetricCorrelatorConfig', 'Correlation', 'CorrelatorEvent'],
      bk: 'metric_correlator', eks: ['mtcr.correlation_detected', 'mtcr.causality_inferred', 'mtcr.pattern_learned', 'mtcr.alert_grouped'],
      subjects: ['sven.mtcr.correlation_detected', 'sven.mtcr.causality_inferred', 'sven.mtcr.pattern_learned', 'sven.mtcr.alert_grouped'],
      cases: ['mtcr_detect', 'mtcr_infer', 'mtcr_learn', 'mtcr_group', 'mtcr_report', 'mtcr_monitor'],
    },
    {
      name: 'trace_sampler_v2', migration: '20260623540000_agent_trace_sampler_v2.sql',
      typeFile: 'agent-trace-sampler-v2.ts', skillDir: 'trace-sampler-v2',
      interfaces: ['TraceSamplerV2Config', 'SamplingDecision', 'SamplerEvent'],
      bk: 'trace_sampler_v2', eks: ['tsv2.decision_made', 'tsv2.tail_evaluated', 'tsv2.priority_assigned', 'tsv2.budget_enforced'],
      subjects: ['sven.tsv2.decision_made', 'sven.tsv2.tail_evaluated', 'sven.tsv2.priority_assigned', 'sven.tsv2.budget_enforced'],
      cases: ['tsv2_decide', 'tsv2_evaluate', 'tsv2_assign', 'tsv2_enforce', 'tsv2_report', 'tsv2_monitor'],
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
