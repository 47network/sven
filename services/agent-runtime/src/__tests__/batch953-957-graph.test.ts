import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 953-957: Graph Database', () => {
  const verticals = [
    {
      name: 'graph_node_writer', migration: '20260625900000_agent_graph_node_writer.sql',
      typeFile: 'agent-graph-node-writer.ts', skillDir: 'graph-node-writer',
      interfaces: ['GraphNodeWriterConfig', 'NodeBatch', 'WriterEvent'],
      bk: 'graph_node_writer', eks: ['gnwr.batch_received', 'gnwr.nodes_validated', 'gnwr.nodes_persisted', 'gnwr.audit_recorded'],
      subjects: ['sven.gnwr.batch_received', 'sven.gnwr.nodes_validated', 'sven.gnwr.nodes_persisted', 'sven.gnwr.audit_recorded'],
      cases: ['gnwr_receive', 'gnwr_validate', 'gnwr_persist', 'gnwr_audit', 'gnwr_report', 'gnwr_monitor'],
    },
    {
      name: 'graph_edge_writer', migration: '20260625910000_agent_graph_edge_writer.sql',
      typeFile: 'agent-graph-edge-writer.ts', skillDir: 'graph-edge-writer',
      interfaces: ['GraphEdgeWriterConfig', 'EdgeBatch', 'WriterEvent'],
      bk: 'graph_edge_writer', eks: ['gewr.batch_received', 'gewr.endpoints_validated', 'gewr.edges_persisted', 'gewr.audit_recorded'],
      subjects: ['sven.gewr.batch_received', 'sven.gewr.endpoints_validated', 'sven.gewr.edges_persisted', 'sven.gewr.audit_recorded'],
      cases: ['gewr_receive', 'gewr_validate', 'gewr_persist', 'gewr_audit', 'gewr_report', 'gewr_monitor'],
    },
    {
      name: 'graph_traversal_executor', migration: '20260625920000_agent_graph_traversal_executor.sql',
      typeFile: 'agent-graph-traversal-executor.ts', skillDir: 'graph-traversal-executor',
      interfaces: ['GraphTraversalExecutorConfig', 'TraversalRequest', 'ExecutorEvent'],
      bk: 'graph_traversal_executor', eks: ['gtxe.request_received', 'gtxe.plan_constructed', 'gtxe.traversal_executed', 'gtxe.results_returned'],
      subjects: ['sven.gtxe.request_received', 'sven.gtxe.plan_constructed', 'sven.gtxe.traversal_executed', 'sven.gtxe.results_returned'],
      cases: ['gtxe_receive', 'gtxe_construct', 'gtxe_execute', 'gtxe_return', 'gtxe_report', 'gtxe_monitor'],
    },
    {
      name: 'graph_consistency_validator', migration: '20260625930000_agent_graph_consistency_validator.sql',
      typeFile: 'agent-graph-consistency-validator.ts', skillDir: 'graph-consistency-validator',
      interfaces: ['GraphConsistencyValidatorConfig', 'ConsistencyScan', 'ValidatorEvent'],
      bk: 'graph_consistency_validator', eks: ['gcsv.scan_scheduled', 'gcsv.invariants_checked', 'gcsv.violations_flagged', 'gcsv.report_emitted'],
      subjects: ['sven.gcsv.scan_scheduled', 'sven.gcsv.invariants_checked', 'sven.gcsv.violations_flagged', 'sven.gcsv.report_emitted'],
      cases: ['gcsv_schedule', 'gcsv_check', 'gcsv_flag', 'gcsv_emit', 'gcsv_report', 'gcsv_monitor'],
    },
    {
      name: 'graph_pattern_matcher', migration: '20260625940000_agent_graph_pattern_matcher.sql',
      typeFile: 'agent-graph-pattern-matcher.ts', skillDir: 'graph-pattern-matcher',
      interfaces: ['GraphPatternMatcherConfig', 'PatternQuery', 'MatcherEvent'],
      bk: 'graph_pattern_matcher', eks: ['gpmt.query_received', 'gpmt.pattern_compiled', 'gpmt.matches_collected', 'gpmt.results_returned'],
      subjects: ['sven.gpmt.query_received', 'sven.gpmt.pattern_compiled', 'sven.gpmt.matches_collected', 'sven.gpmt.results_returned'],
      cases: ['gpmt_receive', 'gpmt_compile', 'gpmt_collect', 'gpmt_return', 'gpmt_report', 'gpmt_monitor'],
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
