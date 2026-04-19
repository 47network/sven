import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 368-372 — Observability & Monitoring', () => {
  const verticals = [
    {
      batch: 368,
      name: 'metric_aggregator',
      migration: '20260620050000_agent_metric_aggregator.sql',
      tables: ['agent_metric_aggregator_configs', 'agent_metrics', 'agent_metric_rollups'],
      typeFile: 'agent-metric-aggregator.ts',
      types: ['AggregationInterval', 'MetricType', 'RollupPeriod', 'MetricUnit', 'MetricAggregatorConfig', 'AgentMetric', 'MetricRollup'],
      skillDir: 'metric-aggregator',
      skillPrice: '14.99',
      skillArchetype: 'analyst',
      bk: 'metric_aggregator',
      ekPrefix: 'mtag',
      eks: ['mtag.metric_recorded', 'mtag.metric_flushed', 'mtag.rollup_created', 'mtag.metrics_exported'],
      subjects: ['sven.mtag.metric_recorded', 'sven.mtag.metric_flushed', 'sven.mtag.rollup_created', 'sven.mtag.metrics_exported'],
      switchCases: ['mtag_record_metric', 'mtag_batch_record', 'mtag_query_metrics', 'mtag_create_rollup', 'mtag_list_metrics', 'mtag_export_metrics'],
      handlers: ['handleMtagRecordMetric', 'handleMtagBatchRecord', 'handleMtagQueryMetrics', 'handleMtagCreateRollup', 'handleMtagListMetrics', 'handleMtagExportMetrics'],
    },
    {
      batch: 369,
      name: 'alert_correlator',
      migration: '20260620060000_agent_alert_correlator.sql',
      tables: ['agent_alert_correlator_configs', 'agent_alerts', 'agent_alert_correlations'],
      typeFile: 'agent-alert-correlator.ts',
      types: ['CorrelationWindow', 'AlertSeverity', 'AlertStatus', 'CorrelationType', 'AlertCorrelatorConfig', 'AgentAlert', 'AlertCorrelation'],
      skillDir: 'alert-correlator',
      skillPrice: '17.99',
      skillArchetype: 'analyst',
      bk: 'alert_correlator',
      ekPrefix: 'alcr',
      eks: ['alcr.alert_fired', 'alcr.alert_correlated', 'alcr.alert_resolved', 'alcr.alert_silenced'],
      subjects: ['sven.alcr.alert_fired', 'sven.alcr.alert_correlated', 'sven.alcr.alert_resolved', 'sven.alcr.alert_silenced'],
      switchCases: ['alcr_fire_alert', 'alcr_correlate_alerts', 'alcr_acknowledge_alert', 'alcr_resolve_alert', 'alcr_silence_alerts', 'alcr_get_correlations'],
      handlers: ['handleAlcrFireAlert', 'handleAlcrCorrelateAlerts', 'handleAlcrAcknowledgeAlert', 'handleAlcrResolveAlert', 'handleAlcrSilenceAlerts', 'handleAlcrGetCorrelations'],
    },
    {
      batch: 370,
      name: 'sla_tracker',
      migration: '20260620070000_agent_sla_tracker.sql',
      tables: ['agent_sla_tracker_configs', 'agent_sla_objectives', 'agent_sla_violations'],
      typeFile: 'agent-sla-tracker.ts',
      types: ['SliType', 'SlaStatus', 'ViolationType', 'MeasurementWindow', 'SlaTrackerConfig', 'SlaObjective', 'SlaViolation'],
      skillDir: 'sla-tracker',
      skillPrice: '19.99',
      skillArchetype: 'analyst',
      bk: 'sla_tracker',
      ekPrefix: 'sltr',
      eks: ['sltr.objective_created', 'sltr.measurement_recorded', 'sltr.budget_depleted', 'sltr.violation_detected'],
      subjects: ['sven.sltr.objective_created', 'sven.sltr.measurement_recorded', 'sven.sltr.budget_depleted', 'sven.sltr.violation_detected'],
      switchCases: ['sltr_create_objective', 'sltr_record_measurement', 'sltr_check_budget', 'sltr_detect_violations', 'sltr_calculate_burn_rate', 'sltr_generate_report'],
      handlers: ['handleSltrCreateObjective', 'handleSltrRecordMeasurement', 'handleSltrCheckBudget', 'handleSltrDetectViolations', 'handleSltrCalculateBurnRate', 'handleSltrGenerateReport'],
    },
    {
      batch: 371,
      name: 'log_analyzer',
      migration: '20260620080000_agent_log_analyzer.sql',
      tables: ['agent_log_analyzer_configs', 'agent_log_analyses', 'agent_log_patterns'],
      typeFile: 'agent-log-analyzer.ts',
      types: ['LogSource', 'AnalysisStatus', 'PatternType', 'LogSeverity', 'LogAnalyzerConfig', 'LogAnalysis', 'LogPattern'],
      skillDir: 'log-analyzer',
      skillPrice: '16.99',
      skillArchetype: 'analyst',
      bk: 'log_analyzer',
      ekPrefix: 'lgan',
      eks: ['lgan.analysis_started', 'lgan.analysis_completed', 'lgan.pattern_detected', 'lgan.anomaly_found'],
      subjects: ['sven.lgan.analysis_started', 'sven.lgan.analysis_completed', 'sven.lgan.pattern_detected', 'sven.lgan.anomaly_found'],
      switchCases: ['lgan_start_analysis', 'lgan_detect_patterns', 'lgan_find_anomalies', 'lgan_correlate_logs', 'lgan_search_logs', 'lgan_generate_report'],
      handlers: ['handleLganStartAnalysis', 'handleLganDetectPatterns', 'handleLganFindAnomalies', 'handleLganCorrelateLogs', 'handleLganSearchLogs', 'handleLganGenerateReport'],
    },
    {
      batch: 372,
      name: 'performance_profiler',
      migration: '20260620090000_agent_performance_profiler.sql',
      tables: ['agent_performance_profiler_configs', 'agent_profiling_sessions', 'agent_performance_hotspots'],
      typeFile: 'agent-performance-profiler.ts',
      types: ['ProfilingMode', 'ProfilingType', 'SessionStatus', 'HotspotCategory', 'PerformanceProfilerConfig', 'ProfilingSession', 'PerformanceHotspot'],
      skillDir: 'performance-profiler',
      skillPrice: '21.99',
      skillArchetype: 'engineer',
      bk: 'performance_profiler',
      ekPrefix: 'pfpr',
      eks: ['pfpr.session_started', 'pfpr.session_completed', 'pfpr.hotspot_found', 'pfpr.flamegraph_generated'],
      subjects: ['sven.pfpr.session_started', 'sven.pfpr.session_completed', 'sven.pfpr.hotspot_found', 'sven.pfpr.flamegraph_generated'],
      switchCases: ['pfpr_start_profiling', 'pfpr_stop_profiling', 'pfpr_find_hotspots', 'pfpr_generate_flamegraph', 'pfpr_compare_sessions', 'pfpr_recommend_optimizations'],
      handlers: ['handlePfprStartProfiling', 'handlePfprStopProfiling', 'handlePfprFindHotspots', 'handlePfprGenerateFlamegraph', 'handlePfprCompareSessions', 'handlePfprRecommendOptimizations'],
    },
  ];

  // ── Migration SQL ──
  describe('Migration SQL files', () => {
    verticals.forEach((v) => {
      describe(`Batch ${v.batch} — ${v.name}`, () => {
        const migPath = path.join(ROOT, 'services', 'gateway-api', 'migrations', v.migration);

        it('migration file exists', () => {
          expect(fs.existsSync(migPath)).toBe(true);
        });

        it('contains CREATE TABLE statements', () => {
          const sql = fs.readFileSync(migPath, 'utf-8');
          v.tables.forEach((t) => {
            expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
          });
        });

        it('contains indexes', () => {
          const sql = fs.readFileSync(migPath, 'utf-8');
          expect(sql).toContain('CREATE INDEX');
        });
      });
    });
  });

  // ── Shared TypeScript types ──
  describe('Shared TypeScript types', () => {
    verticals.forEach((v) => {
      describe(`Batch ${v.batch} — ${v.name}`, () => {
        const typePath = path.join(ROOT, 'packages', 'shared', 'src', v.typeFile);

        it('type file exists', () => {
          expect(fs.existsSync(typePath)).toBe(true);
        });

        it('exports expected types', () => {
          const src = fs.readFileSync(typePath, 'utf-8');
          v.types.forEach((t) => {
            expect(src).toContain(t);
          });
        });
      });
    });
  });

  // ── Barrel exports ──
  describe('Barrel exports', () => {
    const indexPath = path.join(ROOT, 'packages', 'shared', 'src', 'index.ts');
    const indexSrc = fs.readFileSync(indexPath, 'utf-8');

    verticals.forEach((v) => {
      it(`exports ${v.typeFile}`, () => {
        expect(indexSrc).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
    });
  });

  // ── SKILL.md files ──
  describe('SKILL.md files', () => {
    verticals.forEach((v) => {
      describe(`Batch ${v.batch} — ${v.name}`, () => {
        const skillPath = path.join(ROOT, 'skills', 'autonomous-economy', v.skillDir, 'SKILL.md');

        it('SKILL.md exists', () => {
          expect(fs.existsSync(skillPath)).toBe(true);
        });

        it('contains correct price', () => {
          const content = fs.readFileSync(skillPath, 'utf-8');
          expect(content).toContain(v.skillPrice);
        });

        it('contains correct archetype', () => {
          const content = fs.readFileSync(skillPath, 'utf-8');
          expect(content).toContain(v.skillArchetype);
        });

        it('contains ## Actions', () => {
          const content = fs.readFileSync(skillPath, 'utf-8');
          expect(content).toContain('## Actions');
        });
      });
    });
  });

  // ── Eidolon BK ──
  describe('Eidolon BK (BuildingKind)', () => {
    const typesPath = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
    const typesSrc = fs.readFileSync(typesPath, 'utf-8');

    verticals.forEach((v) => {
      it(`contains '${v.bk}'`, () => {
        expect(typesSrc).toContain(`'${v.bk}'`);
      });
    });
  });

  // ── Eidolon EK ──
  describe('Eidolon EK (EventKind)', () => {
    const typesPath = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
    const typesSrc = fs.readFileSync(typesPath, 'utf-8');

    verticals.forEach((v) => {
      v.eks.forEach((ek) => {
        it(`contains '${ek}'`, () => {
          expect(typesSrc).toContain(`'${ek}'`);
        });
      });
    });
  });

  // ── districtFor ──
  describe('districtFor cases', () => {
    const typesPath = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
    const typesSrc = fs.readFileSync(typesPath, 'utf-8');

    verticals.forEach((v) => {
      it(`has case '${v.name}'`, () => {
        expect(typesSrc).toContain(`case '${v.name}':`);
      });
    });
  });

  // ── SUBJECT_MAP ──
  describe('SUBJECT_MAP entries', () => {
    const ebPath = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts');
    const ebSrc = fs.readFileSync(ebPath, 'utf-8');

    verticals.forEach((v) => {
      v.subjects.forEach((s) => {
        it(`contains '${s}'`, () => {
          expect(ebSrc).toContain(`'${s}'`);
        });
      });
    });
  });

  // ── Task executor switch cases ──
  describe('Task executor switch cases', () => {
    const tePath = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
    const teSrc = fs.readFileSync(tePath, 'utf-8');

    verticals.forEach((v) => {
      v.switchCases.forEach((sc) => {
        it(`contains case '${sc}'`, () => {
          expect(teSrc).toContain(`case '${sc}'`);
        });
      });
    });
  });

  // ── Task executor handler methods ──
  describe('Task executor handler methods', () => {
    const tePath = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
    const teSrc = fs.readFileSync(tePath, 'utf-8');

    verticals.forEach((v) => {
      v.handlers.forEach((h) => {
        it(`contains ${h}`, () => {
          expect(teSrc).toContain(h);
        });
      });
    });
  });

  // ── .gitattributes ──
  describe('.gitattributes entries', () => {
    const gaPath = path.join(ROOT, '.gitattributes');
    const gaSrc = fs.readFileSync(gaPath, 'utf-8');

    verticals.forEach((v) => {
      it(`has migration entry for ${v.name}`, () => {
        expect(gaSrc).toContain(v.migration);
      });

      it(`has type entry for ${v.name}`, () => {
        expect(gaSrc).toContain(v.typeFile);
      });

      it(`has skill entry for ${v.name}`, () => {
        expect(gaSrc).toContain(`skills/autonomous-economy/${v.skillDir}/**`);
      });
    });
  });
});
