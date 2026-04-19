import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 963-967: Document Store', () => {
  const verticals = [
    {
      name: 'docstore_writer', migration: '20260626000000_agent_docstore_writer.sql',
      typeFile: 'agent-docstore-writer.ts', skillDir: 'docstore-writer',
      interfaces: ['DocstoreWriterConfig', 'DocBatch', 'WriterEvent'],
      bk: 'docstore_writer', eks: ['dswr.batch_received', 'dswr.docs_validated', 'dswr.docs_persisted', 'dswr.audit_recorded'],
      subjects: ['sven.dswr.batch_received', 'sven.dswr.docs_validated', 'sven.dswr.docs_persisted', 'sven.dswr.audit_recorded'],
      cases: ['dswr_receive', 'dswr_validate', 'dswr_persist', 'dswr_audit', 'dswr_report', 'dswr_monitor'],
    },
    {
      name: 'docstore_indexer', migration: '20260626010000_agent_docstore_indexer.sql',
      typeFile: 'agent-docstore-indexer.ts', skillDir: 'docstore-indexer',
      interfaces: ['DocstoreIndexerConfig', 'IndexJob', 'IndexerEvent'],
      bk: 'docstore_indexer', eks: ['dsix.job_received', 'dsix.docs_analyzed', 'dsix.index_updated', 'dsix.audit_recorded'],
      subjects: ['sven.dsix.job_received', 'sven.dsix.docs_analyzed', 'sven.dsix.index_updated', 'sven.dsix.audit_recorded'],
      cases: ['dsix_receive', 'dsix_analyze', 'dsix_update', 'dsix_audit', 'dsix_report', 'dsix_monitor'],
    },
    {
      name: 'docstore_query_executor', migration: '20260626020000_agent_docstore_query_executor.sql',
      typeFile: 'agent-docstore-query-executor.ts', skillDir: 'docstore-query-executor',
      interfaces: ['DocstoreQueryExecutorConfig', 'QueryRequest', 'ExecutorEvent'],
      bk: 'docstore_query_executor', eks: ['dsqe.request_received', 'dsqe.plan_constructed', 'dsqe.query_executed', 'dsqe.results_returned'],
      subjects: ['sven.dsqe.request_received', 'sven.dsqe.plan_constructed', 'sven.dsqe.query_executed', 'sven.dsqe.results_returned'],
      cases: ['dsqe_receive', 'dsqe_construct', 'dsqe_execute', 'dsqe_return', 'dsqe_report', 'dsqe_monitor'],
    },
    {
      name: 'docstore_compactor', migration: '20260626030000_agent_docstore_compactor.sql',
      typeFile: 'agent-docstore-compactor.ts', skillDir: 'docstore-compactor',
      interfaces: ['DocstoreCompactorConfig', 'CompactionJob', 'CompactorEvent'],
      bk: 'docstore_compactor', eks: ['dscm.job_received', 'dscm.segments_scanned', 'dscm.segments_merged', 'dscm.manifest_committed'],
      subjects: ['sven.dscm.job_received', 'sven.dscm.segments_scanned', 'sven.dscm.segments_merged', 'sven.dscm.manifest_committed'],
      cases: ['dscm_receive', 'dscm_scan', 'dscm_merge', 'dscm_commit', 'dscm_report', 'dscm_monitor'],
    },
    {
      name: 'docstore_replicator', migration: '20260626040000_agent_docstore_replicator.sql',
      typeFile: 'agent-docstore-replicator.ts', skillDir: 'docstore-replicator',
      interfaces: ['DocstoreReplicatorConfig', 'ReplicationStream', 'ReplicatorEvent'],
      bk: 'docstore_replicator', eks: ['dsrp.stream_received', 'dsrp.changes_applied', 'dsrp.lag_reported', 'dsrp.audit_recorded'],
      subjects: ['sven.dsrp.stream_received', 'sven.dsrp.changes_applied', 'sven.dsrp.lag_reported', 'sven.dsrp.audit_recorded'],
      cases: ['dsrp_receive', 'dsrp_apply', 'dsrp_report_lag', 'dsrp_audit', 'dsrp_report', 'dsrp_monitor'],
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
