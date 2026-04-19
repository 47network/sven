import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 968-972: Vector DB', () => {
  const verticals = [
    {
      name: 'vectordb_embed_writer', migration: '20260626050000_agent_vectordb_embed_writer.sql',
      typeFile: 'agent-vectordb-embed-writer.ts', skillDir: 'vectordb-embed-writer',
      interfaces: ['VectordbEmbedWriterConfig', 'EmbedBatch', 'WriterEvent'],
      bk: 'vectordb_embed_writer', eks: ['vdew.batch_received', 'vdew.vectors_validated', 'vdew.vectors_persisted', 'vdew.audit_recorded'],
      subjects: ['sven.vdew.batch_received', 'sven.vdew.vectors_validated', 'sven.vdew.vectors_persisted', 'sven.vdew.audit_recorded'],
      cases: ['vdew_receive', 'vdew_validate', 'vdew_persist', 'vdew_audit', 'vdew_report', 'vdew_monitor'],
    },
    {
      name: 'vectordb_index_builder', migration: '20260626060000_agent_vectordb_index_builder.sql',
      typeFile: 'agent-vectordb-index-builder.ts', skillDir: 'vectordb-index-builder',
      interfaces: ['VectordbIndexBuilderConfig', 'IndexBuildJob', 'BuilderEvent'],
      bk: 'vectordb_index_builder', eks: ['vdib.job_received', 'vdib.vectors_loaded', 'vdib.index_built', 'vdib.audit_recorded'],
      subjects: ['sven.vdib.job_received', 'sven.vdib.vectors_loaded', 'sven.vdib.index_built', 'sven.vdib.audit_recorded'],
      cases: ['vdib_receive', 'vdib_load', 'vdib_build', 'vdib_audit', 'vdib_report', 'vdib_monitor'],
    },
    {
      name: 'vectordb_similarity_searcher', migration: '20260626070000_agent_vectordb_similarity_searcher.sql',
      typeFile: 'agent-vectordb-similarity-searcher.ts', skillDir: 'vectordb-similarity-searcher',
      interfaces: ['VectordbSimilaritySearcherConfig', 'SearchRequest', 'SearcherEvent'],
      bk: 'vectordb_similarity_searcher', eks: ['vdss.request_received', 'vdss.query_normalized', 'vdss.search_executed', 'vdss.results_returned'],
      subjects: ['sven.vdss.request_received', 'sven.vdss.query_normalized', 'sven.vdss.search_executed', 'sven.vdss.results_returned'],
      cases: ['vdss_receive', 'vdss_normalize', 'vdss_execute', 'vdss_return', 'vdss_report', 'vdss_monitor'],
    },
    {
      name: 'vectordb_recall_evaluator', migration: '20260626080000_agent_vectordb_recall_evaluator.sql',
      typeFile: 'agent-vectordb-recall-evaluator.ts', skillDir: 'vectordb-recall-evaluator',
      interfaces: ['VectordbRecallEvaluatorConfig', 'RecallScan', 'EvaluatorEvent'],
      bk: 'vectordb_recall_evaluator', eks: ['vdre.scan_scheduled', 'vdre.queries_executed', 'vdre.recall_computed', 'vdre.report_emitted'],
      subjects: ['sven.vdre.scan_scheduled', 'sven.vdre.queries_executed', 'sven.vdre.recall_computed', 'sven.vdre.report_emitted'],
      cases: ['vdre_schedule', 'vdre_execute', 'vdre_compute', 'vdre_emit', 'vdre_report', 'vdre_monitor'],
    },
    {
      name: 'vectordb_quantization_runner', migration: '20260626090000_agent_vectordb_quantization_runner.sql',
      typeFile: 'agent-vectordb-quantization-runner.ts', skillDir: 'vectordb-quantization-runner',
      interfaces: ['VectordbQuantizationRunnerConfig', 'QuantizationJob', 'RunnerEvent'],
      bk: 'vectordb_quantization_runner', eks: ['vdqr.job_received', 'vdqr.vectors_quantized', 'vdqr.index_published', 'vdqr.audit_recorded'],
      subjects: ['sven.vdqr.job_received', 'sven.vdqr.vectors_quantized', 'sven.vdqr.index_published', 'sven.vdqr.audit_recorded'],
      cases: ['vdqr_receive', 'vdqr_quantize', 'vdqr_publish', 'vdqr_audit', 'vdqr_report', 'vdqr_monitor'],
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
