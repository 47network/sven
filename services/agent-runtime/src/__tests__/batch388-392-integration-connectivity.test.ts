import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 388-392: Integration & Connectivity', () => {

  // ─── Batch 388: Integration Connector ───
  describe('Batch 388 — Integration Connector', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620250000_agent_integration_connector.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-integration-connector.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/integration-connector/SKILL.md');

    test('migration file exists', () => { expect(fs.existsSync(migrationPath)).toBe(true); });
    test('migration creates agent_integration_connector_configs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_integration_connector_configs');
    });
    test('migration creates agent_integrations', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_integrations');
    });
    test('migration creates agent_integration_logs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_integration_logs');
    });
    test('types file exists', () => { expect(fs.existsSync(typesPath)).toBe(true); });
    test('types exports IntegrationConnectorConfig', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('IntegrationConnectorConfig');
    });
    test('types exports IntegrationStatus', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('IntegrationStatus');
    });
    test('types exports AuthType', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('AuthType');
    });
    test('SKILL.md exists', () => { expect(fs.existsSync(skillPath)).toBe(true); });
    test('SKILL.md has Actions section', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('## Actions');
    });
    test('SKILL.md has create-integration action', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('create-integration');
    });
  });

  // ─── Batch 389: Service Mesh Manager ───
  describe('Batch 389 — Service Mesh Manager', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620260000_agent_service_mesh_manager.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-service-mesh-manager.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/service-mesh-manager/SKILL.md');

    test('migration file exists', () => { expect(fs.existsSync(migrationPath)).toBe(true); });
    test('migration creates agent_service_mesh_manager_configs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_service_mesh_manager_configs');
    });
    test('migration creates agent_mesh_services', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_mesh_services');
    });
    test('migration creates agent_mesh_routes', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_mesh_routes');
    });
    test('types file exists', () => { expect(fs.existsSync(typesPath)).toBe(true); });
    test('types exports ServiceMeshManagerConfig', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('ServiceMeshManagerConfig');
    });
    test('types exports DiscoveryMode', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('DiscoveryMode');
    });
    test('SKILL.md exists', () => { expect(fs.existsSync(skillPath)).toBe(true); });
    test('SKILL.md has Actions section', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('## Actions');
    });
    test('SKILL.md has register-service action', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('register-service');
    });
  });

  // ─── Batch 390: Data Sync Engine ───
  describe('Batch 390 — Data Sync Engine', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620270000_agent_data_sync_engine.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-data-sync-engine.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/data-sync-engine/SKILL.md');

    test('migration file exists', () => { expect(fs.existsSync(migrationPath)).toBe(true); });
    test('migration creates agent_data_sync_engine_configs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_data_sync_engine_configs');
    });
    test('migration creates agent_sync_connections', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_sync_connections');
    });
    test('migration creates agent_sync_runs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_sync_runs');
    });
    test('types file exists', () => { expect(fs.existsSync(typesPath)).toBe(true); });
    test('types exports DataSyncEngineConfig', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('DataSyncEngineConfig');
    });
    test('types exports SyncMode', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('SyncMode');
    });
    test('SKILL.md exists', () => { expect(fs.existsSync(skillPath)).toBe(true); });
    test('SKILL.md has Actions section', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('## Actions');
    });
  });

  // ─── Batch 391: Webhook Orchestrator ───
  describe('Batch 391 — Webhook Orchestrator', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620280000_agent_webhook_orchestrator.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-webhook-orchestrator.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/webhook-orchestrator/SKILL.md');

    test('migration file exists', () => { expect(fs.existsSync(migrationPath)).toBe(true); });
    test('migration creates agent_webhook_orchestrator_configs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_webhook_orchestrator_configs');
    });
    test('migration creates agent_webhook_endpoints', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_webhook_endpoints');
    });
    test('migration creates agent_webhook_deliveries', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_webhook_deliveries');
    });
    test('types file exists', () => { expect(fs.existsSync(typesPath)).toBe(true); });
    test('types exports WebhookOrchestratorConfig', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('WebhookOrchestratorConfig');
    });
    test('types exports WebhookDeliveryStatus', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('WebhookDeliveryStatus');
    });
    test('SKILL.md exists', () => { expect(fs.existsSync(skillPath)).toBe(true); });
    test('SKILL.md has Actions section', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('## Actions');
    });
  });

  // ─── Batch 392: Protocol Adapter ───
  describe('Batch 392 — Protocol Adapter', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260620290000_agent_protocol_adapter.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-protocol-adapter.ts');
    const skillPath = path.join(ROOT, 'skills/autonomous-economy/protocol-adapter/SKILL.md');

    test('migration file exists', () => { expect(fs.existsSync(migrationPath)).toBe(true); });
    test('migration creates agent_protocol_adapter_configs', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_protocol_adapter_configs');
    });
    test('migration creates agent_protocol_mappings', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_protocol_mappings');
    });
    test('migration creates agent_protocol_conversions', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_protocol_conversions');
    });
    test('types file exists', () => { expect(fs.existsSync(typesPath)).toBe(true); });
    test('types exports ProtocolAdapterConfig', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('ProtocolAdapterConfig');
    });
    test('types exports ProtocolType', () => {
      const code = fs.readFileSync(typesPath, 'utf-8');
      expect(code).toContain('ProtocolType');
    });
    test('SKILL.md exists', () => { expect(fs.existsSync(skillPath)).toBe(true); });
    test('SKILL.md has Actions section', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('## Actions');
    });
  });

  // ─── Cross-cutting: Barrel exports ───
  describe('Barrel exports', () => {
    const indexPath = path.join(ROOT, 'packages/shared/src/index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    const exports = [
      'agent-integration-connector', 'agent-service-mesh-manager',
      'agent-data-sync-engine', 'agent-webhook-orchestrator', 'agent-protocol-adapter'
    ];
    exports.forEach(name => {
      test(`exports ${name}`, () => { expect(indexContent).toContain(`from './${name}'`); });
    });
  });

  // ─── Cross-cutting: Eidolon types.ts ───
  describe('Eidolon types.ts wiring', () => {
    const typesPath = path.join(ROOT, 'services/sven-eidolon/src/types.ts');
    const content = fs.readFileSync(typesPath, 'utf-8');

    const bks = ['integration_connector', 'service_mesh_manager', 'data_sync_engine', 'webhook_orchestrator', 'protocol_adapter'];
    bks.forEach(bk => {
      test(`BK contains '${bk}'`, () => { expect(content).toContain(`'${bk}'`); });
    });

    const eks = ['itcn.integration_created', 'smsh.service_registered', 'dsyn.sync_started', 'whkr.endpoint_created', 'prad.mapping_created'];
    eks.forEach(ek => {
      test(`EK contains '${ek}'`, () => { expect(content).toContain(`'${ek}'`); });
    });

    bks.forEach(bk => {
      test(`districtFor has case '${bk}'`, () => { expect(content).toContain(`case '${bk}':`); });
    });
  });

  // ─── Cross-cutting: SUBJECT_MAP ───
  describe('SUBJECT_MAP entries', () => {
    const ebPath = path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts');
    const content = fs.readFileSync(ebPath, 'utf-8');
    const subjects = [
      'sven.itcn.integration_created', 'sven.itcn.connection_tested', 'sven.itcn.credentials_rotated', 'sven.itcn.health_checked',
      'sven.smsh.service_registered', 'sven.smsh.route_created', 'sven.smsh.circuit_opened', 'sven.smsh.traffic_shifted',
      'sven.dsyn.connection_created', 'sven.dsyn.sync_started', 'sven.dsyn.sync_completed', 'sven.dsyn.sync_failed',
      'sven.whkr.endpoint_created', 'sven.whkr.webhook_sent', 'sven.whkr.delivery_failed', 'sven.whkr.retry_scheduled',
      'sven.prad.mapping_created', 'sven.prad.request_converted', 'sven.prad.conversion_failed', 'sven.prad.rules_updated'
    ];
    subjects.forEach(subj => {
      test(`has subject '${subj}'`, () => { expect(content).toContain(`'${subj}'`); });
    });
  });

  // ─── Cross-cutting: Task executor ───
  describe('Task executor switch cases', () => {
    const tePath = path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts');
    const content = fs.readFileSync(tePath, 'utf-8');
    const cases = [
      'itcn_create_integration', 'itcn_test_connection', 'itcn_list_integrations', 'itcn_get_logs', 'itcn_update_credentials', 'itcn_health_check',
      'smsh_register_service', 'smsh_create_route', 'smsh_check_mesh_health', 'smsh_configure_circuit_breaker', 'smsh_update_traffic_weight', 'smsh_list_services',
      'dsyn_create_connection', 'dsyn_start_sync', 'dsyn_get_sync_status', 'dsyn_list_connections', 'dsyn_configure_mapping', 'dsyn_get_run_history',
      'whkr_create_endpoint', 'whkr_send_webhook', 'whkr_list_endpoints', 'whkr_get_deliveries', 'whkr_retry_failed', 'whkr_update_endpoint',
      'prad_create_mapping', 'prad_convert_request', 'prad_list_mappings', 'prad_test_mapping', 'prad_get_conversion_log', 'prad_update_rules'
    ];
    cases.forEach(c => {
      test(`has case '${c}'`, () => { expect(content).toContain(`case '${c}'`); });
    });
  });

  // ─── Cross-cutting: .gitattributes ───
  describe('.gitattributes privacy filters', () => {
    const gaPath = path.join(ROOT, '.gitattributes');
    const content = fs.readFileSync(gaPath, 'utf-8');
    const files = [
      'agent_integration_connector.sql', 'agent_service_mesh_manager.sql', 'agent_data_sync_engine.sql',
      'agent_webhook_orchestrator.sql', 'agent_protocol_adapter.sql',
      'agent-integration-connector.ts', 'agent-service-mesh-manager.ts', 'agent-data-sync-engine.ts',
      'agent-webhook-orchestrator.ts', 'agent-protocol-adapter.ts',
      'integration-connector/SKILL.md', 'service-mesh-manager/SKILL.md', 'data-sync-engine/SKILL.md',
      'webhook-orchestrator/SKILL.md', 'protocol-adapter/SKILL.md'
    ];
    files.forEach(f => {
      test(`guards ${f}`, () => { expect(content).toContain(f); });
    });
  });
});
