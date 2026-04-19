import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 313-317: Search & Analytics', () => {

  // ── Migration SQL ────────────────────────────────────────────────
  const migrations = [
    { file: '20260619500000_agent_search_indexer.sql', tables: ['agent_search_idx_configs', 'agent_search_indexes', 'agent_search_queries'] },
    { file: '20260619510000_agent_analytics_engine.sql', tables: ['agent_analytics_configs', 'agent_analytics_datasets', 'agent_analytics_queries'] },
    { file: '20260619520000_agent_data_lakehouse.sql', tables: ['agent_lakehouse_configs', 'agent_lakehouse_tables', 'agent_lakehouse_snapshots'] },
    { file: '20260619530000_agent_etl_pipeline.sql', tables: ['agent_etl_configs', 'agent_etl_jobs', 'agent_etl_runs'] },
    { file: '20260619540000_agent_report_generator.sql', tables: ['agent_report_configs', 'agent_report_templates', 'agent_report_outputs'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', m.file);
        expect(fs.existsSync(p)).toBe(true);
      });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
    }
  });

  // ── Shared Types ─────────────────────────────────────────────────
  const typeFiles = [
    { file: 'agent-search-indexer.ts', exports: ['SearchEngine', 'IndexStatus'] },
    { file: 'agent-analytics-engine.ts', exports: ['AnalyticsEngineType'] },
    { file: 'agent-data-lakehouse.ts', exports: ['LakehouseFormat'] },
    { file: 'agent-etl-pipeline.ts', exports: ['EtlFramework', 'EtlJobStatus'] },
    { file: 'agent-report-generator.ts', exports: ['ReportFormat'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true);
      });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => {
          const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8');
          expect(content).toContain(exp);
        });
      }
    }
  });

  // ── Barrel exports ───────────────────────────────────────────────
  describe('Barrel exports in index.ts', () => {
    const indexContent = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    const barrels = ['agent-search-indexer', 'agent-analytics-engine', 'agent-data-lakehouse', 'agent-etl-pipeline', 'agent-report-generator'];
    for (const b of barrels) {
      it(`exports ${b}`, () => {
        expect(indexContent).toContain(b);
      });
    }
  });

  // ── SKILL.md files ───────────────────────────────────────────────
  const skills = [
    { dir: 'search-indexer', price: '14.99', archetype: 'engineer' },
    { dir: 'analytics-engine', price: '17.99', archetype: 'analyst' },
    { dir: 'data-lakehouse', price: '19.99', archetype: 'engineer' },
    { dir: 'etl-pipeline', price: '15.99', archetype: 'engineer' },
    { dir: 'report-generator', price: '11.99', archetype: 'analyst' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const skillPath = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => {
        expect(fs.existsSync(skillPath)).toBe(true);
      });
      it(`${s.dir}/SKILL.md has correct price`, () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).toContain(s.price);
      });
      it(`${s.dir}/SKILL.md has correct archetype`, () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).toContain(s.archetype);
      });
      it(`${s.dir}/SKILL.md has Actions section`, () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).toContain('## Actions');
      });
    }
  });

  // ── Eidolon types.ts ─────────────────────────────────────────────
  describe('Eidolon types.ts', () => {
    const typesContent = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['search_indexer', 'analytics_engine', 'data_lakehouse', 'etl_pipeline', 'report_generator'];
    for (const bk of bks) {
      it(`has BK '${bk}'`, () => { expect(typesContent).toContain(`'${bk}'`); });
    }
    const eks = ['sidx.index_created', 'anle.dataset_created', 'dlkh.table_created', 'etlp.job_started', 'rgen.report_generated'];
    for (const ek of eks) {
      it(`has EK '${ek}'`, () => { expect(typesContent).toContain(`'${ek}'`); });
    }
    for (const bk of bks) {
      it(`has districtFor case '${bk}'`, () => {
        expect(typesContent).toContain(`case '${bk}':`);
      });
    }
  });

  // ── Event bus SUBJECT_MAP ────────────────────────────────────────
  describe('Event bus SUBJECT_MAP', () => {
    const busContent = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.sidx.index_created', 'sven.sidx.docs_indexed', 'sven.sidx.query_executed', 'sven.sidx.index_optimized',
      'sven.anle.dataset_created', 'sven.anle.query_executed', 'sven.anle.data_ingested', 'sven.anle.cache_hit',
      'sven.dlkh.table_created', 'sven.dlkh.snapshot_taken', 'sven.dlkh.compaction_completed', 'sven.dlkh.data_loaded',
      'sven.etlp.job_started', 'sven.etlp.job_completed', 'sven.etlp.job_failed', 'sven.etlp.rows_processed',
      'sven.rgen.report_generated', 'sven.rgen.template_created', 'sven.rgen.report_scheduled', 'sven.rgen.report_exported',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(busContent).toContain(`'${s}'`); });
    }
  });

  // ── Task executor ────────────────────────────────────────────────
  describe('Task executor', () => {
    const execContent = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'sidx_create_index', 'sidx_index_docs', 'sidx_execute_query', 'sidx_optimize_index', 'sidx_update_mapping', 'sidx_delete_index',
      'anle_create_dataset', 'anle_execute_query', 'anle_ingest_data', 'anle_cache_hit', 'anle_export_results', 'anle_refresh_view',
      'dlkh_create_table', 'dlkh_take_snapshot', 'dlkh_run_compaction', 'dlkh_load_data', 'dlkh_optimize_files', 'dlkh_export_data',
      'etlp_start_job', 'etlp_complete_transform', 'etlp_complete_load', 'etlp_fail_job', 'etlp_retry_job', 'etlp_export_logs',
      'rgen_generate_report', 'rgen_create_template', 'rgen_schedule_report', 'rgen_export_report', 'rgen_deliver_report', 'rgen_archive_report',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(execContent).toContain(`case '${c}'`); });
    }
    const handlers = [
      'handleSidxCreateIndex', 'handleAnleCreateDataset', 'handleDlkhCreateTable', 'handleEtlpStartJob', 'handleRgenGenerateReport',
    ];
    for (const h of handlers) {
      it(`has handler ${h}`, () => { expect(execContent).toContain(h); });
    }
  });

  // ── .gitattributes ───────────────────────────────────────────────
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const entries = [
      'agent_search_indexer.sql', 'agent_analytics_engine.sql', 'agent_data_lakehouse.sql',
      'agent_etl_pipeline.sql', 'agent_report_generator.sql',
      'agent-search-indexer.ts', 'agent-analytics-engine.ts', 'agent-data-lakehouse.ts',
      'agent-etl-pipeline.ts', 'agent-report-generator.ts',
      'search-indexer/SKILL.md', 'analytics-engine/SKILL.md', 'data-lakehouse/SKILL.md',
      'etl-pipeline/SKILL.md', 'report-generator/SKILL.md',
    ];
    for (const e of entries) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});
