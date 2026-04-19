import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 658-662: Database Operations', () => {
  const verticals = [
    {
      name: 'deadlock_resolver', migration: '20260622950000_agent_deadlock_resolver.sql',
      typeFile: 'agent-deadlock-resolver.ts', skillDir: 'deadlock-resolver',
      interfaces: ['DeadlockResolverConfig', 'DeadlockEvent', 'ResolverAction'],
      bk: 'deadlock_resolver', eks: ['dlrs.deadlock_detected', 'dlrs.victim_chosen', 'dlrs.lock_released', 'dlrs.prevention_applied'],
      subjects: ['sven.dlrs.deadlock_detected', 'sven.dlrs.victim_chosen', 'sven.dlrs.lock_released', 'sven.dlrs.prevention_applied'],
      cases: ['dlrs_detect', 'dlrs_victim', 'dlrs_release', 'dlrs_prevent', 'dlrs_report', 'dlrs_monitor'],
    },
    {
      name: 'wal_archiver', migration: '20260622960000_agent_wal_archiver.sql',
      typeFile: 'agent-wal-archiver.ts', skillDir: 'wal-archiver',
      interfaces: ['WalArchiverConfig', 'ArchiveSegment', 'ArchiverEvent'],
      bk: 'wal_archiver', eks: ['wlar.segment_archived', 'wlar.retention_enforced', 'wlar.restore_point_created', 'wlar.lag_detected'],
      subjects: ['sven.wlar.segment_archived', 'sven.wlar.retention_enforced', 'sven.wlar.restore_point_created', 'sven.wlar.lag_detected'],
      cases: ['wlar_archive', 'wlar_retain', 'wlar_restore', 'wlar_lag', 'wlar_report', 'wlar_monitor'],
    },
    {
      name: 'replica_lag_checker', migration: '20260622970000_agent_replica_lag_checker.sql',
      typeFile: 'agent-replica-lag-checker.ts', skillDir: 'replica-lag-checker',
      interfaces: ['ReplicaLagCheckerConfig', 'LagMeasurement', 'CheckerEvent'],
      bk: 'replica_lag_checker', eks: ['rlck.lag_measured', 'rlck.threshold_exceeded', 'rlck.replica_promoted', 'rlck.sync_restored'],
      subjects: ['sven.rlck.lag_measured', 'sven.rlck.threshold_exceeded', 'sven.rlck.replica_promoted', 'sven.rlck.sync_restored'],
      cases: ['rlck_measure', 'rlck_threshold', 'rlck_promote', 'rlck_sync', 'rlck_report', 'rlck_monitor'],
    },
    {
      name: 'tablespace_manager', migration: '20260622980000_agent_tablespace_manager.sql',
      typeFile: 'agent-tablespace-manager.ts', skillDir: 'tablespace-manager',
      interfaces: ['TablespaceManagerConfig', 'TablespaceAllocation', 'ManagerEvent'],
      bk: 'tablespace_manager', eks: ['tbsm.space_allocated', 'tbsm.quota_enforced', 'tbsm.expansion_triggered', 'tbsm.cleanup_completed'],
      subjects: ['sven.tbsm.space_allocated', 'sven.tbsm.quota_enforced', 'sven.tbsm.expansion_triggered', 'sven.tbsm.cleanup_completed'],
      cases: ['tbsm_allocate', 'tbsm_quota', 'tbsm_expand', 'tbsm_cleanup', 'tbsm_report', 'tbsm_monitor'],
    },
    {
      name: 'cursor_optimizer', migration: '20260622990000_agent_cursor_optimizer.sql',
      typeFile: 'agent-cursor-optimizer.ts', skillDir: 'cursor-optimizer',
      interfaces: ['CursorOptimizerConfig', 'OptimizationResult', 'OptimizerEvent'],
      bk: 'cursor_optimizer', eks: ['copt.cursor_optimized', 'copt.plan_cached', 'copt.regression_detected', 'copt.hint_applied'],
      subjects: ['sven.copt.cursor_optimized', 'sven.copt.plan_cached', 'sven.copt.regression_detected', 'sven.copt.hint_applied'],
      cases: ['copt_optimize', 'copt_cache', 'copt_regress', 'copt_hint', 'copt_report', 'copt_monitor'],
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
