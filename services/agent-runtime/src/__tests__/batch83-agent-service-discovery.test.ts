import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 83 — Agent Service Discovery', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617200000_agent_service_discovery.sql'), 'utf-8');
    it('creates service_registry table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_registry'));
    it('creates service_health_checks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_health_checks'));
    it('creates service_endpoints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_endpoints'));
    it('creates service_dependencies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_dependencies'));
    it('creates discovery_events table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS discovery_events'));
    it('has at least 19 indexes', () => expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(19));
    it('has service_type CHECK', () => expect(sql).toContain("'api','worker','scheduler','gateway','adapter','processor','monitor','custom'"));
    it('has protocol CHECK', () => expect(sql).toContain("'http','https','grpc','ws','wss','tcp','nats'"));
    it('has check_type CHECK', () => expect(sql).toContain("'http','tcp','script','heartbeat','grpc'"));
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-service-discovery.ts'), 'utf-8');
    it('exports ServiceType', () => expect(src).toContain('export type ServiceType'));
    it('exports ServiceStatus', () => expect(src).toContain('export type ServiceStatus'));
    it('exports HealthCheckType', () => expect(src).toContain('export type HealthCheckType'));
    it('exports HealthCheckStatus', () => expect(src).toContain('export type HealthCheckStatus'));
    it('exports DependencyType', () => expect(src).toContain('export type DependencyType'));
    it('exports ServiceRegistryEntry interface', () => expect(src).toContain('export interface ServiceRegistryEntry'));
    it('exports ServiceHealthCheck interface', () => expect(src).toContain('export interface ServiceHealthCheck'));
    it('exports ServiceEndpoint interface', () => expect(src).toContain('export interface ServiceEndpoint'));
    it('exports ServiceDependency interface', () => expect(src).toContain('export interface ServiceDependency'));
    it('exports DiscoveryEvent interface', () => expect(src).toContain('export interface DiscoveryEvent'));
    it('exports isServiceHealthy helper', () => expect(src).toContain('export function isServiceHealthy'));
    it('exports serviceUptime helper', () => expect(src).toContain('export function serviceUptime'));
    it('exports healthyServiceCount helper', () => expect(src).toContain('export function healthyServiceCount'));
    it('ServiceType has 8 values', () => {
      const m = src.match(/export type ServiceType = ([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m[1].match(/'/g) || []).length / 2;
      expect(count).toBe(8);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-service-discovery', () => expect(idx).toContain('./agent-service-discovery'));
    it('has at least 108 lines', () => expect(idx.split('\n').length).toBeGreaterThanOrEqual(108));
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-service-discovery/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => expect(skill).toMatch(/skill:\s*agent-service-discovery/));
    it('has architect archetype', () => expect(skill).toMatch(/archetype:\s*architect/));
    it('has discovery_register action', () => expect(skill).toContain('discovery_register'));
    it('has discovery_deregister action', () => expect(skill).toContain('discovery_deregister'));
    it('has discovery_health_check action', () => expect(skill).toContain('discovery_health_check'));
    it('has discovery_find action', () => expect(skill).toContain('discovery_find'));
    it('has discovery_endpoints action', () => expect(skill).toContain('discovery_endpoints'));
    it('has discovery_dependencies action', () => expect(skill).toContain('discovery_dependencies'));
    it('has discovery_report action', () => expect(skill).toContain('discovery_report'));
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has discovery_beacon building kind', () => expect(types).toContain("'discovery_beacon'"));
    it('has 66 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      expect((block[0].match(/\|/g) || []).length).toBe(66);
    });
    it('has 280 event kinds', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      expect((block[0].match(/\|/g) || []).length).toBe(280);
    });
    it('has discovery.service_registered event', () => expect(types).toContain("'discovery.service_registered'"));
    it('has discovery.health_changed event', () => expect(types).toContain("'discovery.health_changed'"));
    it('has discovery.endpoint_cataloged event', () => expect(types).toContain("'discovery.endpoint_cataloged'"));
    it('has discovery.dependency_mapped event', () => expect(types).toContain("'discovery.dependency_mapped'"));
    it('districtFor maps discovery_beacon', () => expect(types).toContain("case 'discovery_beacon':"));
    it('has 66 districtFor cases', () => {
      const fn = types.match(/function districtFor[\s\S]*?^}/m);
      expect(fn).toBeTruthy();
      expect((fn[0].match(/case '/g) || []).length).toBe(66);
    });
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.discovery.service_registered', () => expect(bus).toContain("'sven.discovery.service_registered'"));
    it('has sven.discovery.health_changed', () => expect(bus).toContain("'sven.discovery.health_changed'"));
    it('has sven.discovery.endpoint_cataloged', () => expect(bus).toContain("'sven.discovery.endpoint_cataloged'"));
    it('has sven.discovery.dependency_mapped', () => expect(bus).toContain("'sven.discovery.dependency_mapped'"));
    it('has 279 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(279);
    });
  });

  describe('Task executor', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has discovery_register switch case', () => expect(tex).toContain("case 'discovery_register'"));
    it('has discovery_deregister switch case', () => expect(tex).toContain("case 'discovery_deregister'"));
    it('has discovery_health_check switch case', () => expect(tex).toContain("case 'discovery_health_check'"));
    it('has discovery_find switch case', () => expect(tex).toContain("case 'discovery_find'"));
    it('has discovery_endpoints switch case', () => expect(tex).toContain("case 'discovery_endpoints'"));
    it('has discovery_dependencies switch case', () => expect(tex).toContain("case 'discovery_dependencies'"));
    it('has discovery_report switch case', () => expect(tex).toContain("case 'discovery_report'"));
    it('has 362 switch cases', () => expect((tex.match(/case '/g) || []).length).toBe(362));
    it('has 358 handler methods', () => expect((tex.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(358));
    it('handleDiscoveryRegister returns status', () => expect(tex).toContain("handler: 'discovery_register'"));
    it('handleDiscoveryFind returns services', () => expect(tex).toContain("handler: 'discovery_find'"));
    it('handleDiscoveryReport returns analytics', () => expect(tex).toContain("handler: 'discovery_report'"));
  });

  describe('Privacy filtering', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters migration', () => expect(ga).toContain('20260617200000_agent_service_discovery.sql'));
    it('filters shared types', () => expect(ga).toContain('agent-service-discovery.ts'));
    it('filters skill', () => expect(ga).toContain('agent-service-discovery/SKILL.md'));
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 83', () => expect(cl).toContain('Batch 83'));
    it('mentions Service Discovery', () => expect(cl).toContain('Service Discovery'));
  });

  describe('Migration count', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 69 migrations', () => expect(files.length).toBe(69));
  });
});
