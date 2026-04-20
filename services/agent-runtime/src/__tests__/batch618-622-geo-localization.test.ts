import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 618-622: Geo & Localization', () => {
  const verticals = [
    {
      name: 'geo_fencer', migration: '20260622550000_agent_geo_fencer.sql',
      typeFile: 'agent-geo-fencer.ts', skillDir: 'geo-fencer',
      interfaces: ['GeoFencerConfig', 'GeoFence', 'FenceEvent'],
      bk: 'geo_fencer', eks: ['gofc.fence_created', 'gofc.boundary_crossed', 'gofc.zone_activated', 'gofc.violation_detected'],
      subjects: ['sven.gofc.fence_created', 'sven.gofc.boundary_crossed', 'sven.gofc.zone_activated', 'sven.gofc.violation_detected'],
      cases: ['gofc_create', 'gofc_cross', 'gofc_activate', 'gofc_violate', 'gofc_report', 'gofc_monitor'],
    },
    {
      name: 'locale_adapter', migration: '20260622560000_agent_locale_adapter.sql',
      typeFile: 'agent-locale-adapter.ts', skillDir: 'locale-adapter',
      interfaces: ['LocaleAdapterConfig', 'LocaleBundle', 'AdapterEvent'],
      bk: 'locale_adapter', eks: ['lcad.locale_loaded', 'lcad.translation_applied', 'lcad.fallback_used', 'lcad.bundle_updated'],
      subjects: ['sven.lcad.locale_loaded', 'sven.lcad.translation_applied', 'sven.lcad.fallback_used', 'sven.lcad.bundle_updated'],
      cases: ['lcad_load', 'lcad_translate', 'lcad_fallback', 'lcad_bundle', 'lcad_report', 'lcad_monitor'],
    },
    {
      name: 'timezone_syncer', migration: '20260622570000_agent_timezone_syncer.sql',
      typeFile: 'agent-timezone-syncer.ts', skillDir: 'timezone-syncer',
      interfaces: ['TimezoneSyncerConfig', 'TimezoneMap', 'SyncEvent'],
      bk: 'timezone_syncer', eks: ['tzsy.timezone_resolved', 'tzsy.dst_transition', 'tzsy.offset_updated', 'tzsy.anomaly_detected'],
      subjects: ['sven.tzsy.timezone_resolved', 'sven.tzsy.dst_transition', 'sven.tzsy.offset_updated', 'sven.tzsy.anomaly_detected'],
      cases: ['tzsy_resolve', 'tzsy_transition', 'tzsy_offset', 'tzsy_anomaly', 'tzsy_report', 'tzsy_monitor'],
    },
    {
      name: 'region_router', migration: '20260622580000_agent_region_router.sql',
      typeFile: 'agent-region-router.ts', skillDir: 'region-router',
      interfaces: ['RegionRouterConfig', 'RegionPolicy', 'RoutingEvent'],
      bk: 'region_router', eks: ['rgrt.region_selected', 'rgrt.failover_triggered', 'rgrt.affinity_updated', 'rgrt.compliance_checked'],
      subjects: ['sven.rgrt.region_selected', 'sven.rgrt.failover_triggered', 'sven.rgrt.affinity_updated', 'sven.rgrt.compliance_checked'],
      cases: ['rgrt_select', 'rgrt_failover', 'rgrt_affinity', 'rgrt_compliance', 'rgrt_report', 'rgrt_monitor'],
    },
    {
      name: 'latency_mapper', migration: '20260622590000_agent_latency_mapper.sql',
      typeFile: 'agent-latency-mapper.ts', skillDir: 'latency-mapper',
      interfaces: ['LatencyMapperConfig', 'LatencyMap', 'MappingEvent'],
      bk: 'latency_mapper', eks: ['ltmp.latency_measured', 'ltmp.route_optimized', 'ltmp.threshold_breached', 'ltmp.map_refreshed'],
      subjects: ['sven.ltmp.latency_measured', 'sven.ltmp.route_optimized', 'sven.ltmp.threshold_breached', 'sven.ltmp.map_refreshed'],
      cases: ['ltmp_measure', 'ltmp_optimize', 'ltmp_breach', 'ltmp_refresh', 'ltmp_report', 'ltmp_monitor'],
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
