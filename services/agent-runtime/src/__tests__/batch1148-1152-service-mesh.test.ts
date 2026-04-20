import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Service Mesh management verticals', () => {
  const verticals = [
    {
      name: 'service_mesh_configurator', migration: '20260627850000_agent_service_mesh_configurator.sql',
      typeFile: 'agent-service-mesh-configurator.ts', skillDir: 'service-mesh-configurator',
      interfaces: ['MeshConfig', 'MeshConfigResult', 'ProxySettings'],
      bk: 'service_mesh_configurator', eks: ['smc.config_applied', 'smc.proxy_updated', 'smc.export_emitted'],
      subjects: ['sven.smc.config_applied', 'sven.smc.proxy_updated', 'sven.smc.export_emitted'],
      cases: ['smc_reporter'],
    },
    {
      name: 'service_mesh_traffic_shaper', migration: '20260627860000_agent_service_mesh_traffic_shaper.sql',
      typeFile: 'agent-service-mesh-traffic-shaper.ts', skillDir: 'service-mesh-traffic-shaper',
      interfaces: ['TrafficConfig', 'TrafficShapeResult', 'RoutingPolicy'],
      bk: 'service_mesh_traffic_shaper', eks: ['smts.rules_applied', 'smts.traffic_shifted', 'smts.export_emitted'],
      subjects: ['sven.smts.rules_applied', 'sven.smts.traffic_shifted', 'sven.smts.export_emitted'],
      cases: ['smts_reporter'],
    },
    {
      name: 'service_mesh_policy_enforcer', migration: '20260627870000_agent_service_mesh_policy_enforcer.sql',
      typeFile: 'agent-service-mesh-policy-enforcer.ts', skillDir: 'service-mesh-policy-enforcer',
      interfaces: ['MeshPolicyConfig', 'PolicyEnforcementResult', 'MtlsStatus'],
      bk: 'service_mesh_policy_enforcer', eks: ['smpe.policy_applied', 'smpe.violation_detected', 'smpe.export_emitted'],
      subjects: ['sven.smpe.policy_applied', 'sven.smpe.violation_detected', 'sven.smpe.export_emitted'],
      cases: ['smpe_reporter'],
    },
    {
      name: 'service_mesh_observability_agent', migration: '20260627880000_agent_service_mesh_observability_agent.sql',
      typeFile: 'agent-service-mesh-observability-agent.ts', skillDir: 'service-mesh-observability-agent',
      interfaces: ['ObservabilityConfig', 'TraceCollectionResult', 'MeshMetrics'],
      bk: 'service_mesh_observability_agent', eks: ['smoa.tracing_started', 'smoa.metrics_collected', 'smoa.export_emitted'],
      subjects: ['sven.smoa.tracing_started', 'sven.smoa.metrics_collected', 'sven.smoa.export_emitted'],
      cases: ['smoa_reporter'],
    },
    {
      name: 'service_mesh_auditor', migration: '20260627890000_agent_service_mesh_auditor.sql',
      typeFile: 'agent-service-mesh-auditor.ts', skillDir: 'service-mesh-auditor',
      interfaces: ['MeshAuditConfig', 'MeshAuditResult', 'MeshComplianceReport'],
      bk: 'service_mesh_auditor', eks: ['sma.audit_started', 'sma.findings_reported', 'sma.export_emitted'],
      subjects: ['sven.sma.audit_started', 'sven.sma.findings_reported', 'sven.sma.export_emitted'],
      cases: ['sma_reporter'],
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
