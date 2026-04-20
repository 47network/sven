import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'services', 'gateway-api', 'migrations');
const SHARED = path.join(ROOT, 'packages', 'shared', 'src');
const SKILLS = path.join(ROOT, 'skills', 'autonomous-economy');
const TYPES = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
const EVBUS = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts');
const TASK_EXEC = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
const GITATTR = path.join(ROOT, '.gitattributes');

describe('Batches 293-297: Database Administration Tools', () => {
  describe('Migrations', () => {
    const migs = [
      { file: '20260619300000_agent_schema_migrator.sql', tables: ['agent_schema_mig_configs', 'agent_schema_migrations', 'agent_schema_diffs'] },
      { file: '20260619310000_agent_query_tuner.sql', tables: ['agent_query_tuner_configs', 'agent_query_analyses', 'agent_query_indexes'] },
      { file: '20260619320000_agent_backup_scheduler.sql', tables: ['agent_backup_sched_configs', 'agent_backup_runs', 'agent_backup_restores'] },
      { file: '20260619330000_agent_replication_manager.sql', tables: ['agent_repl_mgr_configs', 'agent_repl_nodes', 'agent_repl_failovers'] },
      { file: '20260619340000_agent_pool_manager.sql', tables: ['agent_pool_mgr_configs', 'agent_pool_connections', 'agent_pool_stats'] },
    ];
    for (const m of migs) {
      it(`creates ${m.file}`, () => {
        const sql = fs.readFileSync(path.join(MIGRATIONS, m.file), 'utf-8');
        for (const t of m.tables) expect(sql).toContain(t);
      });
    }
  });

  describe('Shared types', () => {
    const types = [
      { file: 'agent-schema-migrator.ts', exports: ['MigrationDirection', 'MigrationState', 'AgentSchemaMigConfig'] },
      { file: 'agent-query-tuner.ts', exports: ['IndexType', 'QueryAnalysisState', 'AgentQueryTunerConfig'] },
      { file: 'agent-backup-scheduler.ts', exports: ['BackupType', 'BackupState', 'AgentBackupSchedConfig'] },
      { file: 'agent-replication-manager.ts', exports: ['ReplicationType', 'NodeRole', 'AgentReplMgrConfig'] },
      { file: 'agent-pool-manager.ts', exports: ['PoolMode', 'ConnectionState', 'AgentPoolMgrConfig'] },
    ];
    for (const t of types) {
      it(`exports from ${t.file}`, () => {
        const src = fs.readFileSync(path.join(SHARED, t.file), 'utf-8');
        for (const e of t.exports) expect(src).toContain(e);
      });
    }
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(SHARED, 'index.ts'), 'utf-8');
    for (const m of ['agent-schema-migrator', 'agent-query-tuner', 'agent-backup-scheduler', 'agent-replication-manager', 'agent-pool-manager']) {
      it(`re-exports ${m}`, () => expect(idx).toContain(m));
    }
  });

  describe('SKILL.md files', () => {
    const skills = [
      { dir: 'schema-migrator', name: 'schema-migrator', price: '15.99' },
      { dir: 'query-tuner', name: 'query-tuner', price: '16.99' },
      { dir: 'backup-scheduler', name: 'backup-scheduler', price: '12.99' },
      { dir: 'replication-manager', name: 'replication-manager', price: '18.99' },
      { dir: 'pool-manager', name: 'pool-manager', price: '11.99' },
    ];
    for (const s of skills) {
      it(`has ${s.dir}/SKILL.md with correct metadata`, () => {
        const md = fs.readFileSync(path.join(SKILLS, s.dir, 'SKILL.md'), 'utf-8');
        expect(md).toContain(`name: ${s.name}`);
        expect(md).toContain(`price: ${s.price}`);
        expect(md).toContain('## Actions');
      });
    }
  });

  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const bk of ['schema_migrator', 'query_tuner', 'backup_scheduler', 'replication_manager', 'pool_manager']) {
      it(`has '${bk}'`, () => expect(types).toContain(`'${bk}'`));
    }
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const ek of ['smig.migration_applied', 'qtun.query_analyzed', 'bsched.backup_completed', 'rplmgr.node_added', 'plmgr.pool_configured']) {
      it(`has '${ek}'`, () => expect(types).toContain(`'${ek}'`));
    }
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(EVBUS, 'utf-8');
    for (const s of ['sven.smig.migration_applied', 'sven.qtun.query_analyzed', 'sven.bsched.backup_completed', 'sven.rplmgr.node_added', 'sven.plmgr.pool_configured']) {
      it(`maps '${s}'`, () => expect(bus).toContain(`'${s}'`));
    }
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const c of ['smig_configure', 'qtun_analyze_query', 'bsched_run_backup', 'rplmgr_add_node', 'plmgr_configure', 'plmgr_export_report']) {
      it(`routes '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task executor handlers', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const h of ['handleSmigConfigure', 'handleQtunAnalyzeQuery', 'handleBschedRunBackup', 'handleRplmgrAddNode', 'handlePlmgrConfigure']) {
      it(`has handler ${h}`, () => expect(te).toContain(`${h}(`));
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(GITATTR, 'utf-8');
    for (const f of ['agent-schema-migrator', 'agent-query-tuner', 'agent-backup-scheduler', 'agent-replication-manager', 'agent-pool-manager']) {
      it(`filters ${f}`, () => expect(ga).toContain(f));
    }
  });
});
