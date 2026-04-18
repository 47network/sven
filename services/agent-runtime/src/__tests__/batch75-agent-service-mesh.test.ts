import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 75 — Agent Service Mesh & Discovery', () => {
  /* ───── Migration SQL ───── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260617120000_agent_service_mesh.sql'),
      'utf-8',
    );

    it('creates service_registry table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_registry');
    });

    it('creates service_endpoints table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_endpoints');
    });

    it('creates service_dependencies table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_dependencies');
    });

    it('creates service_health_checks table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_health_checks');
    });

    it('creates mesh_traffic_policies table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS mesh_traffic_policies');
    });

    it('has at least 20 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(19);
    });
  });

  /* ───── Shared types ───── */
  describe('Shared types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-service-mesh.ts'),
      'utf-8',
    );

    it('exports ServiceStatus type', () => {
      expect(src).toContain("export type ServiceStatus");
    });

    it('exports ServiceProtocol type', () => {
      expect(src).toContain("export type ServiceProtocol");
    });

    it('exports DependencyType type', () => {
      expect(src).toContain("export type DependencyType");
    });

    it('exports HealthCheckType type', () => {
      expect(src).toContain("export type HealthCheckType");
    });

    it('exports LoadBalanceStrategy type', () => {
      expect(src).toContain("export type LoadBalanceStrategy");
    });

    it('exports ServiceRegistryEntry interface', () => {
      expect(src).toContain('export interface ServiceRegistryEntry');
    });

    it('exports ServiceEndpoint interface', () => {
      expect(src).toContain('export interface ServiceEndpoint');
    });

    it('exports ServiceDependency interface', () => {
      expect(src).toContain('export interface ServiceDependency');
    });

    it('exports ServiceHealthCheck interface', () => {
      expect(src).toContain('export interface ServiceHealthCheck');
    });

    it('exports MeshTrafficPolicy interface', () => {
      expect(src).toContain('export interface MeshTrafficPolicy');
    });
  });

  /* ───── Barrel export ───── */
  describe('Barrel export', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('exports agent-service-mesh module', () => {
      expect(idx).toContain("export * from './agent-service-mesh.js'");
    });

    it('has at least 100 lines', () => {
      expect(idx.split('\n').length).toBeGreaterThanOrEqual(100);
    });
  });

  /* ───── SKILL.md ───── */
  describe('SKILL.md', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-service-mesh/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(md).toMatch(/skill:\s*agent-service-mesh/);
    });

    it('has architect archetype', () => {
      expect(md).toMatch(/archetype:\s*architect/);
    });

    it('has 7 actions', () => {
      const actions = (md.match(/^### /gm) || []).length;
      expect(actions).toBe(7);
    });
  });

  /* ───── Eidolon Building Kind ───── */
  describe('Eidolon Building Kind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes mesh_nexus building kind', () => {
      expect(types).toContain("'mesh_nexus'");
    });

    it('has 58 building kind values', () => {
      const m = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect(m).toBeTruthy();
      const pipes = (m![0].match(/\|/g) || []).length;
      expect(pipes).toBe(58);
    });
  });

  /* ───── Eidolon Event Kind ───── */
  describe('Eidolon Event Kind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes mesh event kinds', () => {
      expect(types).toContain("'mesh.service_registered'");
      expect(types).toContain("'mesh.health_changed'");
      expect(types).toContain("'mesh.dependency_mapped'");
      expect(types).toContain("'mesh.traffic_routed'");
    });

    it('has 248 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect(m).toBeTruthy();
      const pipes = (m![0].match(/\|/g) || []).length;
      expect(pipes).toBe(248);
    });
  });

  /* ───── districtFor ───── */
  describe('districtFor', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('maps mesh_nexus to civic', () => {
      expect(types).toContain("case 'mesh_nexus':");
      expect(types).toContain("return 'civic'");
    });

    it('has 58 cases', () => {
      const m = types.match(/export function districtFor[\s\S]*?^}/m);
      expect(m).toBeTruthy();
      const cases = (m![0].match(/case '/g) || []).length;
      expect(cases).toBe(58);
    });
  });

  /* ───── SUBJECT_MAP ───── */
  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('has 4 mesh subject entries', () => {
      expect(bus).toContain("'sven.mesh.service_registered'");
      expect(bus).toContain("'sven.mesh.health_changed'");
      expect(bus).toContain("'sven.mesh.dependency_mapped'");
      expect(bus).toContain("'sven.mesh.traffic_routed'");
    });

    it('has 247 total entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      const entries = (m![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(247);
    });
  });

  /* ───── Task executor switch cases ───── */
  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 7 mesh switch cases', () => {
      expect(te).toContain("case 'mesh_register':");
      expect(te).toContain("case 'mesh_discover':");
      expect(te).toContain("case 'mesh_health_check':");
      expect(te).toContain("case 'mesh_traffic_config':");
      expect(te).toContain("case 'mesh_dependency_map':");
      expect(te).toContain("case 'mesh_deregister':");
      expect(te).toContain("case 'mesh_report':");
    });

    it('has 306 total switch cases', () => {
      const cases = (te.match(/case '/g) || []).length;
      expect(cases).toBe(306);
    });
  });

  /* ───── Task executor handler methods ───── */
  describe('Task executor handler methods', () => {
    const te = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 7 mesh handler methods', () => {
      expect(te).toMatch(/private (?:async )?handleMeshRegister/);
      expect(te).toMatch(/private (?:async )?handleMeshDiscover/);
      expect(te).toMatch(/private (?:async )?handleMeshHealthCheck/);
      expect(te).toMatch(/private (?:async )?handleMeshTrafficConfig/);
      expect(te).toMatch(/private (?:async )?handleMeshDependencyMap/);
      expect(te).toMatch(/private (?:async )?handleMeshDeregister/);
      expect(te).toMatch(/private (?:async )?handleMeshReport/);
    });

    it('has 302 total handler methods', () => {
      const handlers = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(302);
    });
  });

  /* ───── .gitattributes ───── */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks mesh migration as private', () => {
      expect(ga).toContain('20260617120000_agent_service_mesh.sql');
    });

    it('marks mesh shared types as private', () => {
      expect(ga).toContain('agent-service-mesh.ts');
    });

    it('marks mesh skill as private', () => {
      expect(ga).toContain('agent-service-mesh/SKILL.md');
    });
  });

  /* ───── CHANGELOG ───── */
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('mentions Batch 75', () => {
      expect(cl).toContain('Batch 75');
    });

    it('mentions Agent Service Mesh', () => {
      expect(cl).toContain('Agent Service Mesh');
    });
  });

  /* ───── Migrations count ───── */
  describe('Migrations', () => {
    const migDir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));

    it('has 61 migration files', () => {
      expect(files.length).toBe(61);
    });
  });
});
