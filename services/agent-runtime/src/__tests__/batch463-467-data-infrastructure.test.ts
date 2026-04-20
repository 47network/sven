import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

const VERTICALS = [
  {
    name: 'data_replicator',
    migration: '20260621000000_agent_data_replicator.sql',
    table: 'agent_data_replicator_configs',
    typeFile: 'agent-data-replicator.ts',
    interfaces: ['DataReplicatorConfig', 'ReplicationStatus', 'ReplicationConflict'],
    skillDir: 'data-replicator',
    bk: 'data_replicator',
    ekPrefix: 'drep',
    eks: ['drep.sync_completed', 'drep.conflict_detected', 'drep.lag_warning', 'drep.failover_triggered'],
    subjects: ['sven.drep.sync_completed', 'sven.drep.conflict_detected', 'sven.drep.lag_warning', 'sven.drep.failover_triggered'],
    cases: ['drep_setup', 'drep_monitor', 'drep_conflict', 'drep_failover', 'drep_status', 'drep_sync'],
  },
  {
    name: 'data_partitioner',
    migration: '20260621010000_agent_data_partitioner.sql',
    table: 'agent_data_partitioner_configs',
    typeFile: 'agent-data-partitioner.ts',
    interfaces: ['DataPartitionerConfig', 'PartitionInfo', 'PartitionPlan'],
    skillDir: 'data-partitioner',
    bk: 'data_partitioner',
    ekPrefix: 'dpar',
    eks: ['dpar.partition_created', 'dpar.rebalance_completed', 'dpar.pruning_completed', 'dpar.plan_generated'],
    subjects: ['sven.dpar.partition_created', 'sven.dpar.rebalance_completed', 'sven.dpar.pruning_completed', 'sven.dpar.plan_generated'],
    cases: ['dpar_plan', 'dpar_create', 'dpar_rebalance', 'dpar_prune', 'dpar_status', 'dpar_list'],
  },
  {
    name: 'data_archiver',
    migration: '20260621020000_agent_data_archiver.sql',
    table: 'agent_data_archiver_configs',
    typeFile: 'agent-data-archiver.ts',
    interfaces: ['DataArchiverConfig', 'ArchiveJob', 'ArchivePolicy'],
    skillDir: 'data-archiver',
    bk: 'data_archiver',
    ekPrefix: 'darc',
    eks: ['darc.archive_completed', 'darc.restore_completed', 'darc.retention_enforced', 'darc.verification_passed'],
    subjects: ['sven.darc.archive_completed', 'sven.darc.restore_completed', 'sven.darc.retention_enforced', 'sven.darc.verification_passed'],
    cases: ['darc_archive', 'darc_verify', 'darc_restore', 'darc_retention', 'darc_status', 'darc_list'],
  },
  {
    name: 'table_optimizer',
    migration: '20260621030000_agent_table_optimizer.sql',
    table: 'agent_table_optimizer_configs',
    typeFile: 'agent-table-optimizer.ts',
    interfaces: ['TableOptimizerConfig', 'TableHealth', 'OptimizationRecommendation'],
    skillDir: 'table-optimizer',
    bk: 'table_optimizer',
    ekPrefix: 'tbop',
    eks: ['tbop.health_checked', 'tbop.vacuum_completed', 'tbop.index_recommended', 'tbop.defrag_completed'],
    subjects: ['sven.tbop.health_checked', 'sven.tbop.vacuum_completed', 'sven.tbop.index_recommended', 'sven.tbop.defrag_completed'],
    cases: ['tbop_health', 'tbop_vacuum', 'tbop_index', 'tbop_defrag', 'tbop_recommend', 'tbop_report'],
  },
  {
    name: 'query_analyzer',
    migration: '20260621040000_agent_query_analyzer.sql',
    table: 'agent_query_analyzer_configs',
    typeFile: 'agent-query-analyzer.ts',
    interfaces: ['QueryAnalyzerConfig', 'SlowQueryReport', 'QueryPlan'],
    skillDir: 'query-analyzer',
    bk: 'query_analyzer',
    ekPrefix: 'qanl',
    eks: ['qanl.slow_query_found', 'qanl.plan_analyzed', 'qanl.index_suggested', 'qanl.query_optimized'],
    subjects: ['sven.qanl.slow_query_found', 'sven.qanl.plan_analyzed', 'sven.qanl.index_suggested', 'sven.qanl.query_optimized'],
    cases: ['qanl_slow', 'qanl_plan', 'qanl_index', 'qanl_optimize', 'qanl_report', 'qanl_monitor'],
  },
];

describe('Batches 463-467 — Data Infrastructure', () => {
  VERTICALS.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });

      test('migration creates correct table', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(v.table);
        expect(sql).toContain('agent_id');
        expect(sql).toContain('enabled');
      });

      test('migration has indexes', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE INDEX');
      });

      test('type file exists', () => {
        const p = path.join(REPO, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(p)).toBe(true);
      });

      test('type file exports all interfaces', () => {
        const p = path.join(REPO, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(p, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });

      test('barrel export exists', () => {
        const barrel = fs.readFileSync(path.join(REPO, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(barrel).toContain(`export * from './${modName}'`);
      });

      test('SKILL.md exists', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });

      test('SKILL.md has actions section', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });

      test('SKILL.md has price', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('price:');
      });

      test('BK registered', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });

      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });

      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });

      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((sub) => {
          expect(eb).toContain(`'${sub}'`);
        });
      });

      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(REPO, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => {
          expect(te).toContain(`case '${c}'`);
        });
      });
    });
  });
});
