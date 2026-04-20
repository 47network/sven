import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 323-327: Observability & Monitoring', () => {

  const migrations = [
    { file: '20260619600000_agent_log_streamer.sql', tables: ['agent_log_streamer_configs', 'agent_log_streams', 'agent_log_alerts'] },
    { file: '20260619610000_agent_metrics_hub.sql', tables: ['agent_metrics_hub_configs', 'agent_metric_series', 'agent_metric_rules'] },
    { file: '20260619620000_agent_event_correlator.sql', tables: ['agent_event_correlator_configs', 'agent_correlation_patterns', 'agent_correlation_incidents'] },
    { file: '20260619630000_agent_trace_collector.sql', tables: ['agent_trace_collector_configs', 'agent_trace_spans', 'agent_trace_analyses'] },
    { file: '20260619640000_agent_dashboard_builder.sql', tables: ['agent_dashboard_builder_configs', 'agent_dashboard_panels', 'agent_dashboard_snapshots'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true);
      });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
    }
  });

  const typeFiles = [
    { file: 'agent-log-streamer.ts', exports: ['LogFormat', 'StreamStatus', 'LogSeverity'] },
    { file: 'agent-metrics-hub.ts', exports: ['MetricType', 'ExportFormat', 'ComparisonOp'] },
    { file: 'agent-event-correlator.ts', exports: ['CorrelationStatus', 'PatternSeverity', 'ConfidenceLevel'] },
    { file: 'agent-trace-collector.ts', exports: ['TraceFormat', 'PropagationFormat', 'SpanStatus'] },
    { file: 'agent-dashboard-builder.ts', exports: ['DashboardTheme', 'PanelType', 'LayoutType'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true);
      });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => {
          const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8');
          expect(content).toContain(exp);
        });
      }
    }
  });

  describe('Barrel exports in index.ts', () => {
    const indexContent = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    for (const b of ['agent-log-streamer', 'agent-metrics-hub', 'agent-event-correlator', 'agent-trace-collector', 'agent-dashboard-builder']) {
      it(`exports ${b}`, () => { expect(indexContent).toContain(b); });
    }
  });

  const skills = [
    { dir: 'log-streamer', price: '11.99', archetype: 'engineer' },
    { dir: 'metrics-hub', price: '14.99', archetype: 'engineer' },
    { dir: 'event-correlator', price: '19.99', archetype: 'analyst' },
    { dir: 'trace-collector', price: '16.99', archetype: 'engineer' },
    { dir: 'dashboard-builder', price: '22.99', archetype: 'designer' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const p = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => { expect(fs.existsSync(p)).toBe(true); });
      it(`${s.dir}/SKILL.md has correct price`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.price); });
      it(`${s.dir}/SKILL.md has correct archetype`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.archetype); });
      it(`${s.dir}/SKILL.md has Actions section`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain('## Actions'); });
    }
  });

  describe('Eidolon types.ts', () => {
    const typesContent = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['log_streamer', 'metrics_hub', 'event_correlator', 'trace_collector', 'dashboard_builder']) {
      it(`has BK '${bk}'`, () => { expect(typesContent).toContain(`'${bk}'`); });
    }
    for (const ek of ['lgst.stream_created', 'mhub.metric_registered', 'evcr.pattern_detected', 'trcl.trace_collected', 'dshb.panel_created']) {
      it(`has EK '${ek}'`, () => { expect(typesContent).toContain(`'${ek}'`); });
    }
    for (const bk of ['log_streamer', 'metrics_hub', 'event_correlator', 'trace_collector', 'dashboard_builder']) {
      it(`has districtFor case '${bk}'`, () => { expect(typesContent).toContain(`case '${bk}':`); });
    }
  });

  describe('Event bus SUBJECT_MAP', () => {
    const busContent = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.lgst.stream_created', 'sven.lgst.alert_triggered', 'sven.lgst.logs_exported', 'sven.lgst.retention_rotated',
      'sven.mhub.metric_registered', 'sven.mhub.alert_fired', 'sven.mhub.metrics_exported', 'sven.mhub.window_aggregated',
      'sven.evcr.pattern_detected', 'sven.evcr.incident_created', 'sven.evcr.root_cause_found', 'sven.evcr.incident_resolved',
      'sven.trcl.trace_collected', 'sven.trcl.bottleneck_found', 'sven.trcl.service_mapped', 'sven.trcl.traces_exported',
      'sven.dshb.panel_created', 'sven.dshb.snapshot_taken', 'sven.dshb.dashboard_shared', 'sven.dshb.template_imported',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(busContent).toContain(`'${s}'`); });
    }
  });

  describe('Task executor', () => {
    const execContent = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'lgst_create_stream', 'lgst_configure_alerts', 'lgst_search_logs', 'lgst_export_logs', 'lgst_stream_stats', 'lgst_rotate_retention',
      'mhub_register_metric', 'mhub_record_value', 'mhub_create_alert_rule', 'mhub_query_metrics', 'mhub_export_metrics', 'mhub_aggregate_window',
      'evcr_create_pattern', 'evcr_detect_correlations', 'evcr_investigate_incident', 'evcr_learn_patterns', 'evcr_resolve_incident', 'evcr_export_patterns',
      'trcl_collect_traces', 'trcl_analyze_trace', 'trcl_find_bottlenecks', 'trcl_service_map', 'trcl_compare_traces', 'trcl_export_traces',
      'dshb_create_panel', 'dshb_configure_layout', 'dshb_create_snapshot', 'dshb_set_refresh', 'dshb_share_dashboard', 'dshb_import_template',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(execContent).toContain(`case '${c}'`); });
    }
    for (const h of ['handleLgstCreateStream', 'handleMhubRegisterMetric', 'handleEvcrCreatePattern', 'handleTrclCollectTraces', 'handleDshbCreatePanel']) {
      it(`has handler ${h}`, () => { expect(execContent).toContain(h); });
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    for (const e of [
      'agent_log_streamer.sql', 'agent_metrics_hub.sql', 'agent_event_correlator.sql', 'agent_trace_collector.sql', 'agent_dashboard_builder.sql',
      'agent-log-streamer.ts', 'agent-metrics-hub.ts', 'agent-event-correlator.ts', 'agent-trace-collector.ts', 'agent-dashboard-builder.ts',
      'log-streamer/SKILL.md', 'metrics-hub/SKILL.md', 'event-correlator/SKILL.md', 'trace-collector/SKILL.md', 'dashboard-builder/SKILL.md',
    ]) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});
