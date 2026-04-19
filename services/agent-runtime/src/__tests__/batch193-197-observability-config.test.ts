import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 193-197: Observability & Configuration', () => {

  // ─── Batch 193: Log Aggregator ───
  describe('Log Aggregator Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618300000_agent_log_aggregator.sql'), 'utf-8');
    it('creates agent_log_sources table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_sources'));
    it('creates agent_log_entries table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_entries'));
    it('creates agent_log_pipelines table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_log_pipelines'));
    it('has source_type check', () => expect(sql).toContain("('application','system','container','network','security','audit')"));
    it('has log level check', () => expect(sql).toContain("('trace','debug','info','warn','error','fatal')"));
    it('has format check', () => expect(sql).toContain("('json','syslog','clf','csv','plaintext','logfmt')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_log_sources_agent');
      expect(sql).toContain('idx_agent_log_entries_source');
      expect(sql).toContain('idx_agent_log_pipelines_agent');
    });
  });

  describe('Log Aggregator Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-log-aggregator.ts'), 'utf-8');
    it('exports LogSourceType', () => expect(ts).toContain('export type LogSourceType'));
    it('exports LogSourceStatus', () => expect(ts).toContain('export type LogSourceStatus'));
    it('exports LogFormat', () => expect(ts).toContain('export type LogFormat'));
    it('exports LogLevel', () => expect(ts).toContain('export type LogLevel'));
    it('exports LogPipelineStatus', () => expect(ts).toContain('export type LogPipelineStatus'));
    it('exports LogSource interface', () => expect(ts).toContain('export interface LogSource'));
    it('exports LogEntry interface', () => expect(ts).toContain('export interface LogEntry'));
    it('exports LogPipeline interface', () => expect(ts).toContain('export interface LogPipeline'));
  });

  describe('Log Aggregator SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-log-aggregator/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references logging', () => expect(md.toLowerCase()).toContain('log'));
  });

  // ─── Batch 194: Metric Collector ───
  describe('Metric Collector Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618310000_agent_metric_collector.sql'), 'utf-8');
    it('creates agent_metric_sources table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_metric_sources'));
    it('creates agent_metric_series table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_metric_series'));
    it('creates agent_metric_alerts table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_metric_alerts'));
    it('has source_type check', () => expect(sql).toContain("('prometheus','statsd','opentelemetry','cloudwatch','custom','graphite')"));
    it('has metric_type check', () => expect(sql).toContain("('counter','gauge','histogram','summary','distribution')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_metric_sources_agent');
      expect(sql).toContain('idx_agent_metric_series_source');
      expect(sql).toContain('idx_agent_metric_alerts_agent');
    });
  });

  describe('Metric Collector Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-metric-collector.ts'), 'utf-8');
    it('exports MetricSourceType', () => expect(ts).toContain('export type MetricSourceType'));
    it('exports MetricSourceStatus', () => expect(ts).toContain('export type MetricSourceStatus'));
    it('exports MetricType', () => expect(ts).toContain('export type MetricType'));
    it('exports MetricAlertSeverity', () => expect(ts).toContain('export type MetricAlertSeverity'));
    it('exports MetricAlertStatus', () => expect(ts).toContain('export type MetricAlertStatus'));
    it('exports MetricSource interface', () => expect(ts).toContain('export interface MetricSource'));
    it('exports MetricSeries interface', () => expect(ts).toContain('export interface MetricSeries'));
    it('exports MetricAlert interface', () => expect(ts).toContain('export interface MetricAlert'));
  });

  describe('Metric Collector SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-metric-collector/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references metrics', () => expect(md.toLowerCase()).toContain('metric'));
  });

  // ─── Batch 195: Alert Dispatcher ───
  describe('Alert Dispatcher Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618320000_agent_alert_dispatcher.sql'), 'utf-8');
    it('creates agent_alert_channels table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_alert_channels'));
    it('creates agent_alert_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_alert_rules'));
    it('creates agent_alert_incidents table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_alert_incidents'));
    it('has channel_type check', () => expect(sql).toContain("('email','slack','webhook','pagerduty','discord','sms','teams')"));
    it('has incident_status check', () => expect(sql).toContain("('firing','acknowledged','resolved','escalated','suppressed')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_alert_channels_agent');
      expect(sql).toContain('idx_agent_alert_rules_agent');
      expect(sql).toContain('idx_agent_alert_incidents_rule');
    });
  });

  describe('Alert Dispatcher Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-alert-dispatcher.ts'), 'utf-8');
    it('exports AlertChannelType', () => expect(ts).toContain('export type AlertChannelType'));
    it('exports AlertChannelStatus', () => expect(ts).toContain('export type AlertChannelStatus'));
    it('exports AlertRuleSeverity', () => expect(ts).toContain('export type AlertRuleSeverity'));
    it('exports AlertRuleStatus', () => expect(ts).toContain('export type AlertRuleStatus'));
    it('exports AlertIncidentStatus', () => expect(ts).toContain('export type AlertIncidentStatus'));
    it('exports AlertChannel interface', () => expect(ts).toContain('export interface AlertChannel'));
    it('exports AlertRule interface', () => expect(ts).toContain('export interface AlertRule'));
    it('exports AlertIncident interface', () => expect(ts).toContain('export interface AlertIncident'));
  });

  describe('Alert Dispatcher SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-alert-dispatcher/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references alert', () => expect(md.toLowerCase()).toContain('alert'));
  });

  // ─── Batch 196: Trace Analyzer ───
  describe('Trace Analyzer Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618330000_agent_trace_analyzer.sql'), 'utf-8');
    it('creates agent_trace_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_trace_configs'));
    it('creates agent_trace_spans table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_trace_spans'));
    it('creates agent_trace_analyses table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_trace_analyses'));
    it('has propagation_type check', () => expect(sql).toContain("('w3c','b3','jaeger','zipkin','xray','custom')"));
    it('has span_kind check', () => expect(sql).toContain("('server','client','producer','consumer','internal')"));
    it('has analysis_type check', () => expect(sql).toContain("('latency','error_rate','throughput','dependency','anomaly','bottleneck')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_trace_configs_agent');
      expect(sql).toContain('idx_agent_trace_spans_config');
      expect(sql).toContain('idx_agent_trace_analyses_agent');
    });
  });

  describe('Trace Analyzer Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-trace-analyzer.ts'), 'utf-8');
    it('exports TracePropagationType', () => expect(ts).toContain('export type TracePropagationType'));
    it('exports TraceConfigStatus', () => expect(ts).toContain('export type TraceConfigStatus'));
    it('exports TraceSpanKind', () => expect(ts).toContain('export type TraceSpanKind'));
    it('exports TraceSpanStatus', () => expect(ts).toContain('export type TraceSpanStatus'));
    it('exports TraceAnalysisType', () => expect(ts).toContain('export type TraceAnalysisType'));
    it('exports TraceAnalysisStatus', () => expect(ts).toContain('export type TraceAnalysisStatus'));
    it('exports TraceConfig interface', () => expect(ts).toContain('export interface TraceConfig'));
    it('exports TraceSpan interface', () => expect(ts).toContain('export interface TraceSpan'));
    it('exports TraceAnalysis interface', () => expect(ts).toContain('export interface TraceAnalysis'));
  });

  describe('Trace Analyzer SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-trace-analyzer/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references trace', () => expect(md.toLowerCase()).toContain('trace'));
  });

  // ─── Batch 197: Config Validator ───
  describe('Config Validator Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618340000_agent_config_validator.sql'), 'utf-8');
    it('creates agent_config_schemas table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_config_schemas'));
    it('creates agent_config_validations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_config_validations'));
    it('creates agent_config_drifts table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_config_drifts'));
    it('has schema_type check', () => expect(sql).toContain("('json_schema','yaml','toml','ini','env','hcl')"));
    it('has validation_result check', () => expect(sql).toContain("('valid','invalid','warning','error','skipped')"));
    it('has drift_type check', () => expect(sql).toContain("('added','removed','modified','type_change','value_drift','permission')"));
    it('has indexes', () => {
      expect(sql).toContain('idx_agent_config_schemas_agent');
      expect(sql).toContain('idx_agent_config_validations_schema');
      expect(sql).toContain('idx_agent_config_drifts_agent');
    });
  });

  describe('Config Validator Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-config-validator.ts'), 'utf-8');
    it('exports ConfigSchemaType', () => expect(ts).toContain('export type ConfigSchemaType'));
    it('exports ConfigSchemaStatus', () => expect(ts).toContain('export type ConfigSchemaStatus'));
    it('exports ConfigValidationResult', () => expect(ts).toContain('export type ConfigValidationResult'));
    it('exports ConfigDriftType', () => expect(ts).toContain('export type ConfigDriftType'));
    it('exports ConfigDriftSeverity', () => expect(ts).toContain('export type ConfigDriftSeverity'));
    it('exports ConfigSchema interface', () => expect(ts).toContain('export interface ConfigSchema'));
    it('exports ConfigValidation interface', () => expect(ts).toContain('export interface ConfigValidation'));
    it('exports ConfigDrift interface', () => expect(ts).toContain('export interface ConfigDrift'));
  });

  describe('Config Validator SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-config-validator/SKILL.md'), 'utf-8');
    it('has name field', () => expect(md).toContain('name:'));
    it('has description', () => expect(md).toContain('description:'));
    it('has Actions section', () => expect(md).toContain('## Actions'));
    it('references config', () => expect(md.toLowerCase()).toContain('config'));
  });

  // ─── Cross-Batch: Barrel Exports ───
  describe('Barrel Exports (index.ts)', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-log-aggregator', () => expect(idx).toContain("from './agent-log-aggregator.js'"));
    it('exports agent-metric-collector', () => expect(idx).toContain("from './agent-metric-collector.js'"));
    it('exports agent-alert-dispatcher', () => expect(idx).toContain("from './agent-alert-dispatcher.js'"));
    it('exports agent-trace-analyzer', () => expect(idx).toContain("from './agent-trace-analyzer.js'"));
    it('exports agent-config-validator', () => expect(idx).toContain("from './agent-config-validator.js'"));
  });

  // ─── Cross-Batch: Eidolon ───
  describe('Eidolon BuildingKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has log_aggregator BK', () => expect(types).toContain("'log_aggregator'"));
    it('has metric_collector BK', () => expect(types).toContain("'metric_collector'"));
    it('has alert_dispatcher BK', () => expect(types).toContain("'alert_dispatcher'"));
    it('has trace_analyzer BK', () => expect(types).toContain("'trace_analyzer'"));
    it('has config_validator BK', () => expect(types).toContain("'config_validator'"));
  });

  describe('Eidolon EventKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has log.source_registered EK', () => expect(types).toContain("'log.source_registered'"));
    it('has log.entry_ingested EK', () => expect(types).toContain("'log.entry_ingested'"));
    it('has log.pipeline_created EK', () => expect(types).toContain("'log.pipeline_created'"));
    it('has log.anomaly_detected EK', () => expect(types).toContain("'log.anomaly_detected'"));
    it('has metric.source_added EK', () => expect(types).toContain("'metric.source_added'"));
    it('has metric.threshold_breached EK', () => expect(types).toContain("'metric.threshold_breached'"));
    it('has metric.alert_fired EK', () => expect(types).toContain("'metric.alert_fired'"));
    it('has metric.trend_detected EK', () => expect(types).toContain("'metric.trend_detected'"));
    it('has alert.channel_configured EK', () => expect(types).toContain("'alert.channel_configured'"));
    it('has alert.dispatched EK', () => expect(types).toContain("'alert.dispatched'"));
    it('has alert.acknowledged EK', () => expect(types).toContain("'alert.acknowledged'"));
    it('has alert.incident_resolved EK', () => expect(types).toContain("'alert.incident_resolved'"));
    it('has trace.config_created EK', () => expect(types).toContain("'trace.config_created'"));
    it('has trace.span_collected EK', () => expect(types).toContain("'trace.span_collected'"));
    it('has trace.analysis_completed EK', () => expect(types).toContain("'trace.analysis_completed'"));
    it('has trace.bottleneck_found EK', () => expect(types).toContain("'trace.bottleneck_found'"));
    it('has config.schema_created EK', () => expect(types).toContain("'config.schema_created'"));
    it('has config.validation_passed EK', () => expect(types).toContain("'config.validation_passed'"));
    it('has config.drift_detected EK', () => expect(types).toContain("'config.drift_detected'"));
    it('has config.compliance_failed EK', () => expect(types).toContain("'config.compliance_failed'"));
  });

  describe('Eidolon districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps log_aggregator to a district', () => expect(types).toContain("case 'log_aggregator':"));
    it('maps metric_collector to a district', () => expect(types).toContain("case 'metric_collector':"));
    it('maps alert_dispatcher to a district', () => expect(types).toContain("case 'alert_dispatcher':"));
    it('maps trace_analyzer to a district', () => expect(types).toContain("case 'trace_analyzer':"));
    it('maps config_validator to a district', () => expect(types).toContain("case 'config_validator':"));
  });

  // ─── Cross-Batch: Event Bus ───
  describe('Event Bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.log.source_registered', () => expect(eb).toContain("'sven.log.source_registered'"));
    it('has sven.log.entry_ingested', () => expect(eb).toContain("'sven.log.entry_ingested'"));
    it('has sven.log.pipeline_created', () => expect(eb).toContain("'sven.log.pipeline_created'"));
    it('has sven.log.anomaly_detected', () => expect(eb).toContain("'sven.log.anomaly_detected'"));
    it('has sven.metric.source_added', () => expect(eb).toContain("'sven.metric.source_added'"));
    it('has sven.metric.threshold_breached', () => expect(eb).toContain("'sven.metric.threshold_breached'"));
    it('has sven.metric.alert_fired', () => expect(eb).toContain("'sven.metric.alert_fired'"));
    it('has sven.metric.trend_detected', () => expect(eb).toContain("'sven.metric.trend_detected'"));
    it('has sven.alert.channel_configured', () => expect(eb).toContain("'sven.alert.channel_configured'"));
    it('has sven.alert.dispatched', () => expect(eb).toContain("'sven.alert.dispatched'"));
    it('has sven.alert.acknowledged', () => expect(eb).toContain("'sven.alert.acknowledged'"));
    it('has sven.alert.incident_resolved', () => expect(eb).toContain("'sven.alert.incident_resolved'"));
    it('has sven.trace.config_created', () => expect(eb).toContain("'sven.trace.config_created'"));
    it('has sven.trace.span_collected', () => expect(eb).toContain("'sven.trace.span_collected'"));
    it('has sven.trace.analysis_completed', () => expect(eb).toContain("'sven.trace.analysis_completed'"));
    it('has sven.trace.bottleneck_found', () => expect(eb).toContain("'sven.trace.bottleneck_found'"));
    it('has sven.config.schema_created', () => expect(eb).toContain("'sven.config.schema_created'"));
    it('has sven.config.validation_passed', () => expect(eb).toContain("'sven.config.validation_passed'"));
    it('has sven.config.drift_detected', () => expect(eb).toContain("'sven.config.drift_detected'"));
    it('has sven.config.compliance_failed', () => expect(eb).toContain("'sven.config.compliance_failed'"));
  });

  // ─── Cross-Batch: Task Executor ───
  describe('Task Executor Switch Cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'log_create_source', 'log_create_pipeline', 'log_query',
      'log_analyze_patterns', 'log_manage_retention', 'log_export',
      'metric_add_source', 'metric_query', 'metric_create_alert',
      'metric_analyze_trends', 'metric_manage_dashboards', 'metric_export',
      'alert_add_channel', 'alert_create_rule', 'alert_dispatch',
      'alert_manage_incidents', 'alert_configure_escalation', 'alert_mute',
      'trace_configure', 'trace_query', 'trace_analyze_latency',
      'trace_dependency_map', 'trace_detect_anomalies', 'trace_export',
      'config_create_schema', 'config_validate', 'config_detect_drift',
      'config_enforce_compliance', 'config_audit_changes', 'config_generate_template',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task Executor Handler Methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleLogCreateSource', 'handleLogCreatePipeline', 'handleLogQuery',
      'handleLogAnalyzePatterns', 'handleLogManageRetention', 'handleLogExport',
      'handleMetricAddSource', 'handleMetricQuery', 'handleMetricCreateAlert',
      'handleMetricAnalyzeTrends', 'handleMetricManageDashboards', 'handleMetricExport',
      'handleAlertAddChannel', 'handleAlertCreateRule', 'handleAlertDispatch',
      'handleAlertManageIncidents', 'handleAlertConfigureEscalation', 'handleAlertMute',
      'handleTraceConfigure', 'handleTraceQuery', 'handleTraceAnalyzeLatency',
      'handleTraceDependencyMap', 'handleTraceDetectAnomalies', 'handleTraceExport',
      'handleConfigCreateSchema', 'handleConfigValidate', 'handleConfigDetectDrift',
      'handleConfigEnforceCompliance', 'handleConfigAuditChanges', 'handleConfigGenerateTemplate',
    ];
    for (const h of handlers) {
      it(`has method ${h}`, () => expect(te).toContain(`${h}(task`));
    }
  });

  // ─── Cross-Batch: .gitattributes ───
  describe('.gitattributes Privacy Filters', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters log-aggregator migration', () => expect(ga).toContain('20260618300000_agent_log_aggregator.sql'));
    it('filters log-aggregator types', () => expect(ga).toContain('agent-log-aggregator.ts'));
    it('filters log-aggregator SKILL', () => expect(ga).toContain('agent-log-aggregator/SKILL.md'));
    it('filters metric-collector migration', () => expect(ga).toContain('20260618310000_agent_metric_collector.sql'));
    it('filters metric-collector types', () => expect(ga).toContain('agent-metric-collector.ts'));
    it('filters metric-collector SKILL', () => expect(ga).toContain('agent-metric-collector/SKILL.md'));
    it('filters alert-dispatcher migration', () => expect(ga).toContain('20260618320000_agent_alert_dispatcher.sql'));
    it('filters alert-dispatcher types', () => expect(ga).toContain('agent-alert-dispatcher.ts'));
    it('filters alert-dispatcher SKILL', () => expect(ga).toContain('agent-alert-dispatcher/SKILL.md'));
    it('filters trace-analyzer migration', () => expect(ga).toContain('20260618330000_agent_trace_analyzer.sql'));
    it('filters trace-analyzer types', () => expect(ga).toContain('agent-trace-analyzer.ts'));
    it('filters trace-analyzer SKILL', () => expect(ga).toContain('agent-trace-analyzer/SKILL.md'));
    it('filters config-validator migration', () => expect(ga).toContain('20260618340000_agent_config_validator.sql'));
    it('filters config-validator types', () => expect(ga).toContain('agent-config-validator.ts'));
    it('filters config-validator SKILL', () => expect(ga).toContain('agent-config-validator/SKILL.md'));
  });
});
