import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 118 — Container Registry', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617550000_agent_container_registry.sql'), 'utf-8');
  test('creates agent_container_registries table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_container_registries'));
  test('creates agent_container_images table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_container_images'));
  test('creates agent_image_vulnerabilities table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_image_vulnerabilities'));
  test('has auth_type column', () => expect(mig).toContain('auth_type'));
  test('has storage_backend column', () => expect(mig).toContain('storage_backend'));
  test('has digest column for images', () => expect(mig).toContain('digest'));
  test('has cve_id column for vulns', () => expect(mig).toContain('cve_id'));
  test('creates indexes', () => expect((mig.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 118 — Container Registry types', () => {
  const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-container-registry.ts'), 'utf-8');
  test('exports RegistryAuthType', () => expect(types).toContain("export type RegistryAuthType"));
  test('exports ContainerRegistry interface', () => expect(types).toContain("export interface ContainerRegistry"));
  test('exports ContainerImage interface', () => expect(types).toContain("export interface ContainerImage"));
  test('exports ImageVulnerability interface', () => expect(types).toContain("export interface ImageVulnerability"));
  test('exports ContainerRegistryStats', () => expect(types).toContain("export interface ContainerRegistryStats"));
  test('has VulnerabilitySeverity', () => expect(types).toContain("export type VulnerabilitySeverity"));
});

describe('Batch 118 — Container Registry SKILL.md', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-container-registry/SKILL.md'), 'utf-8');
  test('has name', () => expect(skill).toContain('name: agent-container-registry'));
  test('has triggers', () => expect(skill).toContain('registry_create'));
  test('has pricing', () => expect(skill).toContain('0.50'));
});

describe('Batch 119 — Service Mesh', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617560000_agent_service_mesh.sql'), 'utf-8');
  test('creates agent_mesh_services table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_mesh_services'));
  test('creates agent_mesh_routes table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_mesh_routes'));
  test('creates agent_mesh_policies table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_mesh_policies'));
  test('has protocol column', () => expect(mig).toContain('protocol'));
  test('has mtls_mode column', () => expect(mig).toContain('mtls_mode'));
  test('has circuit_breaker_threshold', () => expect(mig).toContain('circuit_breaker_threshold'));
  test('creates indexes', () => expect((mig.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 119 — Service Mesh types', () => {
  const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-service-mesh.ts'), 'utf-8');
  test('exports MeshProtocol', () => expect(types).toContain("export type MeshProtocol"));
  test('exports MeshService interface', () => expect(types).toContain("export interface MeshService"));
  test('exports MeshRoute interface', () => expect(types).toContain("export interface MeshRoute"));
  test('exports MeshPolicy interface', () => expect(types).toContain("export interface MeshPolicy"));
  test('exports ServiceMeshStats', () => expect(types).toContain("export interface ServiceMeshStats"));
});

describe('Batch 119 — Service Mesh SKILL.md', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-service-mesh/SKILL.md'), 'utf-8');
  test('has name', () => expect(skill).toContain('name: agent-service-mesh'));
  test('has triggers', () => expect(skill).toContain('mesh_register_service'));
  test('has pricing', () => expect(skill).toContain('0.75'));
});

describe('Batch 120 — Config Drift Detection', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617570000_agent_config_drift.sql'), 'utf-8');
  test('creates agent_config_baselines table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_config_baselines'));
  test('creates agent_config_drift_events table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_config_drift_events'));
  test('creates agent_config_scan_jobs table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_config_scan_jobs'));
  test('has baseline_config column', () => expect(mig).toContain('baseline_config'));
  test('has drift_type column', () => expect(mig).toContain('drift_type'));
  test('creates indexes', () => expect((mig.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 120 — Config Drift types', () => {
  const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-config-drift.ts'), 'utf-8');
  test('exports DriftResourceType', () => expect(types).toContain("export type DriftResourceType"));
  test('exports ConfigBaseline interface', () => expect(types).toContain("export interface ConfigBaseline"));
  test('exports ConfigDriftEvent interface', () => expect(types).toContain("export interface ConfigDriftEvent"));
  test('exports ConfigScanJob interface', () => expect(types).toContain("export interface ConfigScanJob"));
  test('has DriftSeverity', () => expect(types).toContain("export type DriftSeverity"));
});

describe('Batch 120 — Config Drift SKILL.md', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-config-drift/SKILL.md'), 'utf-8');
  test('has name', () => expect(skill).toContain('name: agent-config-drift'));
  test('has triggers', () => expect(skill).toContain('drift_create_baseline'));
  test('has pricing', () => expect(skill).toContain('1.00'));
});

describe('Batch 121 — Incident Escalation', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617580000_agent_incident_escalation.sql'), 'utf-8');
  test('creates agent_escalation_policies table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_escalation_policies'));
  test('creates agent_incidents table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_incidents'));
  test('creates agent_escalation_logs table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_escalation_logs'));
  test('has severity column', () => expect(mig).toContain('severity'));
  test('has escalation_level column', () => expect(mig).toContain('escalation_level'));
  test('creates indexes', () => expect((mig.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 121 — Incident Escalation types', () => {
  const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-incident-escalation.ts'), 'utf-8');
  test('exports IncidentSeverity', () => expect(types).toContain("export type IncidentSeverity"));
  test('exports EscalationPolicy interface', () => expect(types).toContain("export interface EscalationPolicy"));
  test('exports AgentIncident interface', () => expect(types).toContain("export interface AgentIncident"));
  test('exports EscalationLog interface', () => expect(types).toContain("export interface EscalationLog"));
  test('has EscalationAction', () => expect(types).toContain("export type EscalationAction"));
});

describe('Batch 121 — Incident Escalation SKILL.md', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-incident-escalation/SKILL.md'), 'utf-8');
  test('has name', () => expect(skill).toContain('name: agent-incident-escalation'));
  test('has triggers', () => expect(skill).toContain('incident_open'));
  test('has pricing', () => expect(skill).toContain('0.25'));
});

describe('Batch 122 — Capacity Forecasting', () => {
  const mig = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617590000_agent_capacity_forecasting.sql'), 'utf-8');
  test('creates agent_capacity_models table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_capacity_models'));
  test('creates agent_capacity_forecasts table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_capacity_forecasts'));
  test('creates agent_capacity_alerts table', () => expect(mig).toContain('CREATE TABLE IF NOT EXISTS agent_capacity_alerts'));
  test('has model_type column', () => expect(mig).toContain('model_type'));
  test('has forecast_horizon_days', () => expect(mig).toContain('forecast_horizon_days'));
  test('creates indexes', () => expect((mig.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(4));
});

describe('Batch 122 — Capacity Forecasting types', () => {
  const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-capacity-forecasting.ts'), 'utf-8');
  test('exports ForecastResourceType', () => expect(types).toContain("export type ForecastResourceType"));
  test('exports CapacityModel interface', () => expect(types).toContain("export interface CapacityModel"));
  test('exports CapacityForecast interface', () => expect(types).toContain("export interface CapacityForecast"));
  test('exports CapacityAlert interface', () => expect(types).toContain("export interface CapacityAlert"));
  test('has CapacityAlertType', () => expect(types).toContain("export type CapacityAlertType"));
});

describe('Batch 122 — Capacity Forecasting SKILL.md', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-capacity-forecasting/SKILL.md'), 'utf-8');
  test('has name', () => expect(skill).toContain('name: agent-capacity-forecasting'));
  test('has triggers', () => expect(skill).toContain('capacity_create_model'));
  test('has pricing', () => expect(skill).toContain('2.00'));
});

describe('Eidolon wiring — Batches 118-122', () => {
  const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
  test('has container_yard BK', () => expect(types).toContain("'container_yard'"));
  test('has mesh_nexus BK', () => expect(types).toContain("'mesh_nexus'"));
  test('has drift_scanner BK', () => expect(types).toContain("'drift_scanner'"));
  test('has escalation_tower BK', () => expect(types).toContain("'escalation_tower'"));
  test('has forecast_engine BK', () => expect(types).toContain("'forecast_engine'"));
  test('has container_registry EK', () => expect(types).toContain("'container_registry.create'"));
  test('has service_mesh EK', () => expect(types).toContain("'service_mesh.register'"));
  test('has config_drift EK', () => expect(types).toContain("'config_drift.create_baseline'"));
  test('has incident EK', () => expect(types).toContain("'incident.open'"));
  test('has capacity EK', () => expect(types).toContain("'capacity.create_model'"));
});

describe('Event-bus wiring — Batches 118-122', () => {
  const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
  test('has container_registry subjects', () => expect(bus).toContain("'sven.container_registry.create'"));
  test('has service_mesh subjects', () => expect(bus).toContain("'sven.service_mesh.register'"));
  test('has config_drift subjects', () => expect(bus).toContain("'sven.config_drift.create_baseline'"));
  test('has incident subjects', () => expect(bus).toContain("'sven.incident.open'"));
  test('has capacity subjects', () => expect(bus).toContain("'sven.capacity.create_model'"));
});

describe('Task executor wiring — Batches 118-122', () => {
  const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
  test('has registry_create case', () => expect(te).toContain("case 'registry_create':"));
  test('has mesh_register_service case', () => expect(te).toContain("case 'mesh_register_service':"));
  test('has drift_create_baseline case', () => expect(te).toContain("case 'drift_create_baseline':"));
  test('has incident_open case', () => expect(te).toContain("case 'incident_open':"));
  test('has capacity_create_model case', () => expect(te).toContain("case 'capacity_create_model':"));
  test('has handleRegistryCreate handler', () => expect(te).toContain('handleRegistryCreate'));
  test('has handleMeshRegisterService handler', () => expect(te).toContain('handleMeshRegisterService'));
  test('has handleDriftCreateBaseline handler', () => expect(te).toContain('handleDriftCreateBaseline'));
  test('has handleIncidentOpen handler', () => expect(te).toContain('handleIncidentOpen'));
  test('has handleCapacityCreateModel handler', () => expect(te).toContain('handleCapacityCreateModel'));
});

describe('Shared exports — Batches 118-122', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
  test('exports container-registry', () => expect(idx).toContain("'./agent-container-registry.js'"));
  test('exports service-mesh', () => expect(idx).toContain("'./agent-service-mesh.js'"));
  test('exports config-drift', () => expect(idx).toContain("'./agent-config-drift.js'"));
  test('exports incident-escalation', () => expect(idx).toContain("'./agent-incident-escalation.js'"));
  test('exports capacity-forecasting', () => expect(idx).toContain("'./agent-capacity-forecasting.js'"));
});

describe('.gitattributes — Batches 118-122', () => {
  const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
  test('has container-registry entries', () => expect(ga).toContain('agent-container-registry'));
  test('has service-mesh entries', () => expect(ga).toContain('agent-service-mesh'));
  test('has config-drift entries', () => expect(ga).toContain('agent-config-drift'));
  test('has incident-escalation entries', () => expect(ga).toContain('agent-incident-escalation'));
  test('has capacity-forecasting entries', () => expect(ga).toContain('agent-capacity-forecasting'));
});
