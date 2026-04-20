import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 878-882: Product Catalog', () => {
  const verticals = [
    {
      name: 'catalog_product_indexer', migration: '20260625150000_agent_catalog_product_indexer.sql',
      typeFile: 'agent-catalog-product-indexer.ts', skillDir: 'catalog-product-indexer',
      interfaces: ['CatalogProductIndexerConfig', 'IndexJob', 'IndexerEvent'],
      bk: 'catalog_product_indexer', eks: ['cpix.job_received', 'cpix.documents_built', 'cpix.index_updated', 'cpix.commit_finalized'],
      subjects: ['sven.cpix.job_received', 'sven.cpix.documents_built', 'sven.cpix.index_updated', 'sven.cpix.commit_finalized'],
      cases: ['cpix_receive', 'cpix_build', 'cpix_update', 'cpix_finalize', 'cpix_report', 'cpix_monitor'],
    },
    {
      name: 'catalog_variant_resolver', migration: '20260625160000_agent_catalog_variant_resolver.sql',
      typeFile: 'agent-catalog-variant-resolver.ts', skillDir: 'catalog-variant-resolver',
      interfaces: ['CatalogVariantResolverConfig', 'VariantQuery', 'ResolverEvent'],
      bk: 'catalog_variant_resolver', eks: ['cvre.query_received', 'cvre.options_matched', 'cvre.variant_selected', 'cvre.result_returned'],
      subjects: ['sven.cvre.query_received', 'sven.cvre.options_matched', 'sven.cvre.variant_selected', 'sven.cvre.result_returned'],
      cases: ['cvre_receive', 'cvre_match', 'cvre_select', 'cvre_return', 'cvre_report', 'cvre_monitor'],
    },
    {
      name: 'catalog_facet_aggregator', migration: '20260625170000_agent_catalog_facet_aggregator.sql',
      typeFile: 'agent-catalog-facet-aggregator.ts', skillDir: 'catalog-facet-aggregator',
      interfaces: ['CatalogFacetAggregatorConfig', 'FacetQuery', 'AggregatorEvent'],
      bk: 'catalog_facet_aggregator', eks: ['cfag.query_received', 'cfag.facets_computed', 'cfag.counts_aggregated', 'cfag.result_returned'],
      subjects: ['sven.cfag.query_received', 'sven.cfag.facets_computed', 'sven.cfag.counts_aggregated', 'sven.cfag.result_returned'],
      cases: ['cfag_receive', 'cfag_compute', 'cfag_aggregate', 'cfag_return', 'cfag_report', 'cfag_monitor'],
    },
    {
      name: 'catalog_availability_sync', migration: '20260625180000_agent_catalog_availability_sync.sql',
      typeFile: 'agent-catalog-availability-sync.ts', skillDir: 'catalog-availability-sync',
      interfaces: ['CatalogAvailabilitySyncConfig', 'AvailabilityUpdate', 'SyncEvent'],
      bk: 'catalog_availability_sync', eks: ['cavs.update_received', 'cavs.diff_computed', 'cavs.records_persisted', 'cavs.notifications_dispatched'],
      subjects: ['sven.cavs.update_received', 'sven.cavs.diff_computed', 'sven.cavs.records_persisted', 'sven.cavs.notifications_dispatched'],
      cases: ['cavs_receive', 'cavs_compute', 'cavs_persist', 'cavs_dispatch', 'cavs_report', 'cavs_monitor'],
    },
    {
      name: 'catalog_pricing_publisher', migration: '20260625190000_agent_catalog_pricing_publisher.sql',
      typeFile: 'agent-catalog-pricing-publisher.ts', skillDir: 'catalog-pricing-publisher',
      interfaces: ['CatalogPricingPublisherConfig', 'PricingUpdate', 'PublisherEvent'],
      bk: 'catalog_pricing_publisher', eks: ['cppb.update_received', 'cppb.changes_validated', 'cppb.records_persisted', 'cppb.events_published'],
      subjects: ['sven.cppb.update_received', 'sven.cppb.changes_validated', 'sven.cppb.records_persisted', 'sven.cppb.events_published'],
      cases: ['cppb_receive', 'cppb_validate', 'cppb_persist', 'cppb_publish', 'cppb_report', 'cppb_monitor'],
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
