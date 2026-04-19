import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 198-202: Service Infrastructure', () => {

  // ── Batch 198: Service Registry ───────────────────────────
  describe('Batch 198: Service Registry Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618350000_agent_service_registry.sql'), 'utf-8');
    it('creates agent_service_instances table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_service_instances'));
    it('creates agent_service_health_checks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_service_health_checks'));
    it('creates agent_service_endpoints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_service_endpoints'));
    it('has protocol CHECK constraint', () => expect(sql).toContain("'http','https','grpc','tcp','udp','ws','wss'"));
    it('has health_status CHECK constraint', () => expect(sql).toContain("'healthy','unhealthy','degraded','unknown','draining'"));
    it('has check_type CHECK constraint', () => expect(sql).toContain("'http','tcp','grpc','script','ttl'"));
    it('has method CHECK constraint', () => expect(sql).toContain("'GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'"));
    it('creates indexes', () => {
      expect(sql).toContain('idx_service_instances_agent');
      expect(sql).toContain('idx_service_instances_name');
      expect(sql).toContain('idx_service_instances_health');
    });
  });

  describe('Batch 198: Service Registry Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-service-registry.ts'), 'utf-8');
    it('exports ServiceInstance', () => expect(ts).toContain('export interface ServiceInstance'));
    it('exports ServiceHealthCheck', () => expect(ts).toContain('export interface ServiceHealthCheck'));
    it('exports ServiceEndpoint', () => expect(ts).toContain('export interface ServiceEndpoint'));
    it('exports ServiceProtocol type', () => expect(ts).toContain('export type ServiceProtocol'));
    it('exports ServiceHealthStatus type', () => expect(ts).toContain('export type ServiceHealthStatus'));
    it('exports HealthCheckType type', () => expect(ts).toContain('export type HealthCheckType'));
    it('exports HttpMethodType type', () => expect(ts).toContain('export type HttpMethodType'));
    it('exports ServiceRegistryEvent type', () => expect(ts).toContain('export type ServiceRegistryEvent'));
  });

  describe('Batch 198: Service Registry SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-service-registry/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: agent-service-registry'));
    it('has actions heading', () => expect(md).toContain('## Actions'));
    it('has register-service action', () => expect(md).toContain('register-service'));
    it('has discover-services action', () => expect(md).toContain('discover-services'));
    it('has check-health action', () => expect(md).toContain('check-health'));
  });

  describe('Batch 198: Service Registry Barrel Export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports service-registry module', () => expect(idx).toContain("from './agent-service-registry.js'"));
  });

  // ── Batch 199: Ingress Controller ────────────────────────
  describe('Batch 199: Ingress Controller Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618360000_agent_ingress_controller.sql'), 'utf-8');
    it('creates agent_ingress_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ingress_rules'));
    it('creates agent_ingress_certificates table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ingress_certificates'));
    it('creates agent_ingress_access_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ingress_access_logs'));
    it('has auth_mode CHECK', () => expect(sql).toContain("'none','basic','bearer','oauth2','mtls','api_key'"));
    it('has cert_type CHECK', () => expect(sql).toContain("'lets_encrypt','self_signed','custom','managed'"));
    it('has cert status CHECK', () => expect(sql).toContain("'pending','active','expired','revoked','failed'"));
    it('creates indexes', () => {
      expect(sql).toContain('idx_ingress_rules_agent');
      expect(sql).toContain('idx_ingress_certs_domain');
      expect(sql).toContain('idx_ingress_logs_time');
    });
  });

  describe('Batch 199: Ingress Controller Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-ingress-controller.ts'), 'utf-8');
    it('exports IngressRule', () => expect(ts).toContain('export interface IngressRule'));
    it('exports IngressCertificate', () => expect(ts).toContain('export interface IngressCertificate'));
    it('exports IngressAccessLog', () => expect(ts).toContain('export interface IngressAccessLog'));
    it('exports IngressAuthMode type', () => expect(ts).toContain('export type IngressAuthMode'));
    it('exports IngressCertType type', () => expect(ts).toContain('export type IngressCertType'));
    it('exports IngressControllerEvent type', () => expect(ts).toContain('export type IngressControllerEvent'));
  });

  describe('Batch 199: Ingress Controller SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-ingress-controller/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: agent-ingress-controller'));
    it('has actions heading', () => expect(md).toContain('## Actions'));
    it('has create-rule action', () => expect(md).toContain('create-rule'));
    it('has issue-certificate action', () => expect(md).toContain('issue-certificate'));
    it('has set-rate-limit action', () => expect(md).toContain('set-rate-limit'));
  });

  describe('Batch 199: Ingress Controller Barrel Export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports ingress-controller module', () => expect(idx).toContain("from './agent-ingress-controller.js'"));
  });

  // ── Batch 200: Fault Injector ────────────────────────────
  describe('Batch 200: Fault Injector Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618370000_agent_fault_injector.sql'), 'utf-8');
    it('creates agent_fault_experiments table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_fault_experiments'));
    it('creates agent_fault_observations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_fault_observations'));
    it('creates agent_fault_reports table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_fault_reports'));
    it('has fault_type CHECK', () => expect(sql).toContain("'latency','error','abort','throttle','corrupt','partition','cpu_stress','memory_stress'"));
    it('has severity CHECK', () => expect(sql).toContain("'low','medium','high','critical'"));
    it('has experiment status CHECK', () => expect(sql).toContain("'draft','scheduled','running','completed','aborted','failed'"));
    it('has resilience_score constraint', () => expect(sql).toContain('resilience_score >= 0'));
    it('creates indexes', () => {
      expect(sql).toContain('idx_fault_experiments_agent');
      expect(sql).toContain('idx_fault_observations_exp');
      expect(sql).toContain('idx_fault_reports_exp');
    });
  });

  describe('Batch 200: Fault Injector Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-fault-injector.ts'), 'utf-8');
    it('exports FaultExperiment', () => expect(ts).toContain('export interface FaultExperiment'));
    it('exports FaultObservation', () => expect(ts).toContain('export interface FaultObservation'));
    it('exports FaultReport', () => expect(ts).toContain('export interface FaultReport'));
    it('exports FaultType type', () => expect(ts).toContain('export type FaultType'));
    it('exports FaultSeverity type', () => expect(ts).toContain('export type FaultSeverity'));
    it('exports FaultExperimentStatus type', () => expect(ts).toContain('export type FaultExperimentStatus'));
    it('exports FaultInjectorEvent type', () => expect(ts).toContain('export type FaultInjectorEvent'));
  });

  describe('Batch 200: Fault Injector SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-fault-injector/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: agent-fault-injector'));
    it('has actions heading', () => expect(md).toContain('## Actions'));
    it('has create-experiment action', () => expect(md).toContain('create-experiment'));
    it('has generate-report action', () => expect(md).toContain('generate-report'));
    it('has schedule-experiment action', () => expect(md).toContain('schedule-experiment'));
  });

  describe('Batch 200: Fault Injector Barrel Export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports fault-injector module', () => expect(idx).toContain("from './agent-fault-injector.js'"));
  });

  // ── Batch 201: Connection Pool ───────────────────────────
  describe('Batch 201: Connection Pool Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618380000_agent_connection_pool.sql'), 'utf-8');
    it('creates agent_connection_pools table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_connection_pools'));
    it('creates agent_connection_events table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_connection_events'));
    it('creates agent_connection_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_connection_metrics'));
    it('has target_type CHECK', () => expect(sql).toContain("'postgresql','mysql','redis','mongodb','http','grpc','amqp','nats'"));
    it('has pool status CHECK', () => expect(sql).toContain("'active','draining','paused','error','closed'"));
    it('has event_type CHECK', () => expect(sql).toContain("'created','destroyed','acquired','released','timeout','error','health_check'"));
    it('creates indexes', () => {
      expect(sql).toContain('idx_conn_pools_agent');
      expect(sql).toContain('idx_conn_events_pool');
      expect(sql).toContain('idx_conn_metrics_pool');
    });
  });

  describe('Batch 201: Connection Pool Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-connection-pool.ts'), 'utf-8');
    it('exports ConnectionPool', () => expect(ts).toContain('export interface ConnectionPool'));
    it('exports ConnectionEvent', () => expect(ts).toContain('export interface ConnectionEvent'));
    it('exports ConnectionMetric', () => expect(ts).toContain('export interface ConnectionMetric'));
    it('exports ConnectionTargetType', () => expect(ts).toContain('export type ConnectionTargetType'));
    it('exports ConnectionPoolStatus', () => expect(ts).toContain('export type ConnectionPoolStatus'));
    it('exports ConnectionEventType', () => expect(ts).toContain('export type ConnectionEventType'));
    it('exports ConnectionPoolEvent', () => expect(ts).toContain('export type ConnectionPoolEvent'));
  });

  describe('Batch 201: Connection Pool SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-connection-pool/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: agent-connection-pool'));
    it('has actions heading', () => expect(md).toContain('## Actions'));
    it('has create-pool action', () => expect(md).toContain('create-pool'));
    it('has drain-pool action', () => expect(md).toContain('drain-pool'));
    it('has health-check action', () => expect(md).toContain('health-check'));
  });

  describe('Batch 201: Connection Pool Barrel Export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports connection-pool module', () => expect(idx).toContain("from './agent-connection-pool.js'"));
  });

  // ── Batch 202: Retry Handler ─────────────────────────────
  describe('Batch 202: Retry Handler Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618390000_agent_retry_handler.sql'), 'utf-8');
    it('creates agent_retry_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_retry_policies'));
    it('creates agent_retry_attempts table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_retry_attempts'));
    it('creates agent_dead_letter_queue table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_dead_letter_queue'));
    it('has backoff_strategy CHECK', () => expect(sql).toContain("'fixed','linear','exponential','jitter','fibonacci'"));
    it('has default retry_on_status', () => expect(sql).toContain('{500,502,503,504}'));
    it('creates indexes', () => {
      expect(sql).toContain('idx_retry_policies_agent');
      expect(sql).toContain('idx_retry_attempts_policy');
      expect(sql).toContain('idx_dlq_policy');
      expect(sql).toContain('idx_dlq_reprocessed');
    });
  });

  describe('Batch 202: Retry Handler Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-retry-handler.ts'), 'utf-8');
    it('exports RetryPolicy', () => expect(ts).toContain('export interface RetryPolicy'));
    it('exports RetryAttempt', () => expect(ts).toContain('export interface RetryAttempt'));
    it('exports DeadLetterEntry', () => expect(ts).toContain('export interface DeadLetterEntry'));
    it('exports BackoffStrategy type', () => expect(ts).toContain('export type BackoffStrategy'));
    it('exports RetryHandlerEvent type', () => expect(ts).toContain('export type RetryHandlerEvent'));
  });

  describe('Batch 202: Retry Handler SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-retry-handler/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: agent-retry-handler'));
    it('has actions heading', () => expect(md).toContain('## Actions'));
    it('has create-policy action', () => expect(md).toContain('create-policy'));
    it('has reprocess-dlq action', () => expect(md).toContain('reprocess-dlq'));
    it('has get-stats action', () => expect(md).toContain('get-stats'));
  });

  describe('Batch 202: Retry Handler Barrel Export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports retry-handler module', () => expect(idx).toContain("from './agent-retry-handler.js'"));
  });

  // ── Cross-batch: Eidolon Wiring ──────────────────────────
  describe('Eidolon BK/EK/districtFor Wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has service_registry BK', () => expect(types).toContain("'service_registry'"));
    it('has ingress_controller BK', () => expect(types).toContain("'ingress_controller'"));
    it('has fault_injector BK', () => expect(types).toContain("'fault_injector'"));
    it('has connection_pool BK', () => expect(types).toContain("'connection_pool'"));
    it('has retry_handler BK', () => expect(types).toContain("'retry_handler'"));

    it('has registry EK values', () => {
      expect(types).toContain("'registry.service_registered'");
      expect(types).toContain("'registry.service_deregistered'");
      expect(types).toContain("'registry.health_changed'");
      expect(types).toContain("'registry.endpoint_added'");
    });

    it('has ingress EK values', () => {
      expect(types).toContain("'ingress.rule_created'");
      expect(types).toContain("'ingress.cert_issued'");
      expect(types).toContain("'ingress.traffic_spike'");
      expect(types).toContain("'ingress.rate_limited'");
    });

    it('has fault EK values', () => {
      expect(types).toContain("'fault.experiment_started'");
      expect(types).toContain("'fault.experiment_completed'");
      expect(types).toContain("'fault.observation_recorded'");
      expect(types).toContain("'fault.report_generated'");
    });

    it('has pool EK values', () => {
      expect(types).toContain("'pool.created'");
      expect(types).toContain("'pool.exhausted'");
      expect(types).toContain("'pool.health_degraded'");
      expect(types).toContain("'pool.connection_error'");
    });

    it('has retry EK values', () => {
      expect(types).toContain("'retry.policy_created'");
      expect(types).toContain("'retry.attempt_failed'");
      expect(types).toContain("'retry.exhausted'");
      expect(types).toContain("'retry.dlq_entry_added'");
    });

    it('has districtFor cases for all 5', () => {
      expect(types).toContain("case 'service_registry':");
      expect(types).toContain("case 'ingress_controller':");
      expect(types).toContain("case 'fault_injector':");
      expect(types).toContain("case 'connection_pool':");
      expect(types).toContain("case 'retry_handler':");
    });
  });

  // ── Cross-batch: Event Bus ───────────────────────────────
  describe('Event Bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');

    it('has registry subjects', () => {
      expect(eb).toContain("'sven.registry.service_registered'");
      expect(eb).toContain("'sven.registry.service_deregistered'");
      expect(eb).toContain("'sven.registry.health_changed'");
      expect(eb).toContain("'sven.registry.endpoint_added'");
    });

    it('has ingress subjects', () => {
      expect(eb).toContain("'sven.ingress.rule_created'");
      expect(eb).toContain("'sven.ingress.cert_issued'");
      expect(eb).toContain("'sven.ingress.traffic_spike'");
      expect(eb).toContain("'sven.ingress.rate_limited'");
    });

    it('has fault subjects', () => {
      expect(eb).toContain("'sven.fault.experiment_started'");
      expect(eb).toContain("'sven.fault.experiment_completed'");
      expect(eb).toContain("'sven.fault.observation_recorded'");
      expect(eb).toContain("'sven.fault.report_generated'");
    });

    it('has pool subjects', () => {
      expect(eb).toContain("'sven.pool.created'");
      expect(eb).toContain("'sven.pool.exhausted'");
      expect(eb).toContain("'sven.pool.health_degraded'");
      expect(eb).toContain("'sven.pool.connection_error'");
    });

    it('has retry subjects', () => {
      expect(eb).toContain("'sven.retry.policy_created'");
      expect(eb).toContain("'sven.retry.attempt_failed'");
      expect(eb).toContain("'sven.retry.exhausted'");
      expect(eb).toContain("'sven.retry.dlq_entry_added'");
    });
  });

  // ── Cross-batch: Task Executor ───────────────────────────
  describe('Task Executor Switch Cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    const cases = [
      'registry_register_service', 'registry_deregister_service', 'registry_discover',
      'registry_health_check', 'registry_list_endpoints', 'registry_update_metadata',
      'ingress_create_rule', 'ingress_update_rule', 'ingress_issue_cert',
      'ingress_view_logs', 'ingress_configure_cors', 'ingress_set_rate_limit',
      'fault_create_experiment', 'fault_run_experiment', 'fault_abort_experiment',
      'fault_observe_metrics', 'fault_generate_report', 'fault_schedule',
      'pool_create', 'pool_resize', 'pool_drain',
      'pool_view_metrics', 'pool_health_check', 'pool_list',
      'retry_create_policy', 'retry_update_policy', 'retry_view_attempts',
      'retry_reprocess_dlq', 'retry_purge_dlq', 'retry_get_stats',
    ];

    cases.forEach(c => {
      it(`has case '${c}'`, () => expect(te).toContain(`case '${c}'`));
    });
  });

  describe('Task Executor Handler Methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    const handlers = [
      'handleRegistryRegisterService', 'handleRegistryDeregisterService', 'handleRegistryDiscover',
      'handleRegistryHealthCheck', 'handleRegistryListEndpoints', 'handleRegistryUpdateMetadata',
      'handleIngressCreateRule', 'handleIngressUpdateRule', 'handleIngressIssueCert',
      'handleIngressViewLogs', 'handleIngressConfigureCors', 'handleIngressSetRateLimit',
      'handleFaultCreateExperiment', 'handleFaultRunExperiment', 'handleFaultAbortExperiment',
      'handleFaultObserveMetrics', 'handleFaultGenerateReport', 'handleFaultSchedule',
      'handlePoolCreate', 'handlePoolResize', 'handlePoolDrain',
      'handlePoolViewMetrics', 'handlePoolHealthCheck', 'handlePoolList',
      'handleRetryCreatePolicy', 'handleRetryUpdatePolicy', 'handleRetryViewAttempts',
      'handleRetryReprocessDlq', 'handleRetryPurgeDlq', 'handleRetryGetStats',
    ];

    handlers.forEach(h => {
      it(`has handler ${h}`, () => expect(te).toContain(h));
    });
  });

  // ── Cross-batch: .gitattributes ──────────────────────────
  describe('.gitattributes Privacy Filters', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('has service-registry entries', () => {
      expect(ga).toContain('agent_service_registry.sql filter=sven-private');
      expect(ga).toContain('agent-service-registry.ts filter=sven-private');
      expect(ga).toContain('agent-service-registry/SKILL.md filter=sven-private');
    });

    it('has ingress-controller entries', () => {
      expect(ga).toContain('agent_ingress_controller.sql filter=sven-private');
      expect(ga).toContain('agent-ingress-controller.ts filter=sven-private');
      expect(ga).toContain('agent-ingress-controller/SKILL.md filter=sven-private');
    });

    it('has fault-injector entries', () => {
      expect(ga).toContain('agent_fault_injector.sql filter=sven-private');
      expect(ga).toContain('agent-fault-injector.ts filter=sven-private');
      expect(ga).toContain('agent-fault-injector/SKILL.md filter=sven-private');
    });

    it('has connection-pool entries', () => {
      expect(ga).toContain('agent_connection_pool.sql filter=sven-private');
      expect(ga).toContain('agent-connection-pool.ts filter=sven-private');
      expect(ga).toContain('agent-connection-pool/SKILL.md filter=sven-private');
    });

    it('has retry-handler entries', () => {
      expect(ga).toContain('agent_retry_handler.sql filter=sven-private');
      expect(ga).toContain('agent-retry-handler.ts filter=sven-private');
      expect(ga).toContain('agent-retry-handler/SKILL.md filter=sven-private');
    });
  });
});
