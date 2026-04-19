import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 888-892: SEO & Discovery', () => {
  const verticals = [
    {
      name: 'seo_sitemap_generator', migration: '20260625250000_agent_seo_sitemap_generator.sql',
      typeFile: 'agent-seo-sitemap-generator.ts', skillDir: 'seo-sitemap-generator',
      interfaces: ['SeoSitemapGeneratorConfig', 'SitemapJob', 'GeneratorEvent'],
      bk: 'seo_sitemap_generator', eks: ['ssmg.job_received', 'ssmg.urls_collected', 'ssmg.sitemap_built', 'ssmg.sitemap_published'],
      subjects: ['sven.ssmg.job_received', 'sven.ssmg.urls_collected', 'sven.ssmg.sitemap_built', 'sven.ssmg.sitemap_published'],
      cases: ['ssmg_receive', 'ssmg_collect', 'ssmg_build', 'ssmg_publish', 'ssmg_report', 'ssmg_monitor'],
    },
    {
      name: 'seo_metadata_curator', migration: '20260625260000_agent_seo_metadata_curator.sql',
      typeFile: 'agent-seo-metadata-curator.ts', skillDir: 'seo-metadata-curator',
      interfaces: ['SeoMetadataCuratorConfig', 'MetadataRecord', 'CuratorEvent'],
      bk: 'seo_metadata_curator', eks: ['smdc.record_received', 'smdc.fields_normalized', 'smdc.metadata_persisted', 'smdc.preview_emitted'],
      subjects: ['sven.smdc.record_received', 'sven.smdc.fields_normalized', 'sven.smdc.metadata_persisted', 'sven.smdc.preview_emitted'],
      cases: ['smdc_receive', 'smdc_normalize', 'smdc_persist', 'smdc_emit', 'smdc_report', 'smdc_monitor'],
    },
    {
      name: 'seo_canonical_resolver', migration: '20260625270000_agent_seo_canonical_resolver.sql',
      typeFile: 'agent-seo-canonical-resolver.ts', skillDir: 'seo-canonical-resolver',
      interfaces: ['SeoCanonicalResolverConfig', 'CanonicalRequest', 'ResolverEvent'],
      bk: 'seo_canonical_resolver', eks: ['scnr.request_received', 'scnr.candidates_evaluated', 'scnr.canonical_selected', 'scnr.result_returned'],
      subjects: ['sven.scnr.request_received', 'sven.scnr.candidates_evaluated', 'sven.scnr.canonical_selected', 'sven.scnr.result_returned'],
      cases: ['scnr_receive', 'scnr_evaluate', 'scnr_select', 'scnr_return', 'scnr_report', 'scnr_monitor'],
    },
    {
      name: 'seo_redirect_manager', migration: '20260625280000_agent_seo_redirect_manager.sql',
      typeFile: 'agent-seo-redirect-manager.ts', skillDir: 'seo-redirect-manager',
      interfaces: ['SeoRedirectManagerConfig', 'RedirectRule', 'ManagerEvent'],
      bk: 'seo_redirect_manager', eks: ['srdm.rule_received', 'srdm.loop_checked', 'srdm.rule_persisted', 'srdm.cache_invalidated'],
      subjects: ['sven.srdm.rule_received', 'sven.srdm.loop_checked', 'sven.srdm.rule_persisted', 'sven.srdm.cache_invalidated'],
      cases: ['srdm_receive', 'srdm_check', 'srdm_persist', 'srdm_invalidate', 'srdm_report', 'srdm_monitor'],
    },
    {
      name: 'seo_structured_data_emitter', migration: '20260625290000_agent_seo_structured_data_emitter.sql',
      typeFile: 'agent-seo-structured-data-emitter.ts', skillDir: 'seo-structured-data-emitter',
      interfaces: ['SeoStructuredDataEmitterConfig', 'StructuredPayload', 'EmitterEvent'],
      bk: 'seo_structured_data_emitter', eks: ['ssde.payload_received', 'ssde.schema_validated', 'ssde.json_ld_emitted', 'ssde.usage_recorded'],
      subjects: ['sven.ssde.payload_received', 'sven.ssde.schema_validated', 'sven.ssde.json_ld_emitted', 'sven.ssde.usage_recorded'],
      cases: ['ssde_receive', 'ssde_validate', 'ssde_emit', 'ssde_record', 'ssde_report', 'ssde_monitor'],
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
