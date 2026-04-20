import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 933-937: Database Operations', () => {
  const verticals = [
    {
      name: 'db_connection_pool_warden', migration: '20260625700000_agent_db_connection_pool_warden.sql',
      typeFile: 'agent-db-connection-pool-warden.ts', skillDir: 'db-connection-pool-warden',
      interfaces: ['DbConnectionPoolWardenConfig', 'PoolSnapshot', 'WardenEvent'],
      bk: 'db_connection_pool_warden', eks: ['dcpw.snapshot_taken', 'dcpw.thresholds_evaluated', 'dcpw.adjustments_applied', 'dcpw.audit_recorded'],
      subjects: ['sven.dcpw.snapshot_taken', 'sven.dcpw.thresholds_evaluated', 'sven.dcpw.adjustments_applied', 'sven.dcpw.audit_recorded'],
      cases: ['dcpw_snapshot', 'dcpw_evaluate', 'dcpw_adjust', 'dcpw_audit', 'dcpw_report', 'dcpw_monitor'],
    },
    {
      name: 'db_query_optimizer', migration: '20260625710000_agent_db_query_optimizer.sql',
      typeFile: 'agent-db-query-optimizer.ts', skillDir: 'db-query-optimizer',
      interfaces: ['DbQueryOptimizerConfig', 'QueryProfile', 'OptimizerEvent'],
      bk: 'db_query_optimizer', eks: ['dqop.profile_received', 'dqop.plan_compared', 'dqop.recommendation_emitted', 'dqop.audit_recorded'],
      subjects: ['sven.dqop.profile_received', 'sven.dqop.plan_compared', 'sven.dqop.recommendation_emitted', 'sven.dqop.audit_recorded'],
      cases: ['dqop_receive', 'dqop_compare', 'dqop_emit', 'dqop_audit', 'dqop_report', 'dqop_monitor'],
    },
    {
      name: 'db_index_advisor', migration: '20260625720000_agent_db_index_advisor.sql',
      typeFile: 'agent-db-index-advisor.ts', skillDir: 'db-index-advisor',
      interfaces: ['DbIndexAdvisorConfig', 'IndexCandidate', 'AdvisorEvent'],
      bk: 'db_index_advisor', eks: ['diad.workload_received', 'diad.candidates_evaluated', 'diad.recommendations_emitted', 'diad.audit_recorded'],
      subjects: ['sven.diad.workload_received', 'sven.diad.candidates_evaluated', 'sven.diad.recommendations_emitted', 'sven.diad.audit_recorded'],
      cases: ['diad_receive', 'diad_evaluate', 'diad_emit', 'diad_audit', 'diad_report', 'diad_monitor'],
    },
    {
      name: 'db_replication_lag_monitor', migration: '20260625730000_agent_db_replication_lag_monitor.sql',
      typeFile: 'agent-db-replication-lag-monitor.ts', skillDir: 'db-replication-lag-monitor',
      interfaces: ['DbReplicationLagMonitorConfig', 'LagSample', 'MonitorEvent'],
      bk: 'db_replication_lag_monitor', eks: ['drlm.sample_taken', 'drlm.lag_computed', 'drlm.thresholds_evaluated', 'drlm.alerts_emitted'],
      subjects: ['sven.drlm.sample_taken', 'sven.drlm.lag_computed', 'sven.drlm.thresholds_evaluated', 'sven.drlm.alerts_emitted'],
      cases: ['drlm_sample', 'drlm_compute', 'drlm_evaluate', 'drlm_emit', 'drlm_report', 'drlm_monitor'],
    },
    {
      name: 'db_failover_arbiter', migration: '20260625740000_agent_db_failover_arbiter.sql',
      typeFile: 'agent-db-failover-arbiter.ts', skillDir: 'db-failover-arbiter',
      interfaces: ['DbFailoverArbiterConfig', 'FailoverDecision', 'ArbiterEvent'],
      bk: 'db_failover_arbiter', eks: ['dfar.signal_received', 'dfar.quorum_evaluated', 'dfar.failover_executed', 'dfar.audit_recorded'],
      subjects: ['sven.dfar.signal_received', 'sven.dfar.quorum_evaluated', 'sven.dfar.failover_executed', 'sven.dfar.audit_recorded'],
      cases: ['dfar_receive', 'dfar_evaluate', 'dfar_execute', 'dfar_audit', 'dfar_report', 'dfar_monitor'],
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
