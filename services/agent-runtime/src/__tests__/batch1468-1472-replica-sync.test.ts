import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Replica Sync verticals', () => {
  const verticals = [
    {
      name: 'replica_sync', migration: '20260631050000_agent_replica_sync.sql',
      typeFile: 'agent-replica-sync.ts', skillDir: 'replica-sync',
      interfaces: ['ReplicaSyncEntry', 'ReplicaSyncConfig', 'ReplicaSyncResult'],
      bk: 'replica_sync', eks: ['rs.entry_created', 'rs.config_updated', 'rs.export_emitted'],
      subjects: ['sven.rs.entry_created', 'sven.rs.config_updated', 'sven.rs.export_emitted'],
      cases: ['rs_replicator', 'rs_validator', 'rs_reporter'],
    },
    {
      name: 'replica_sync_monitor', migration: '20260631060000_agent_replica_sync_monitor.sql',
      typeFile: 'agent-replica-sync-monitor.ts', skillDir: 'replica-sync-monitor',
      interfaces: ['ReplicaSyncMonitorCheck', 'ReplicaSyncMonitorConfig', 'ReplicaSyncMonitorResult'],
      bk: 'replica_sync_monitor', eks: ['rsm.check_passed', 'rsm.alert_raised', 'rsm.export_emitted'],
      subjects: ['sven.rsm.check_passed', 'sven.rsm.alert_raised', 'sven.rsm.export_emitted'],
      cases: ['rsm_watcher', 'rsm_alerter', 'rsm_reporter'],
    },
    {
      name: 'replica_sync_auditor', migration: '20260631070000_agent_replica_sync_auditor.sql',
      typeFile: 'agent-replica-sync-auditor.ts', skillDir: 'replica-sync-auditor',
      interfaces: ['ReplicaSyncAuditEntry', 'ReplicaSyncAuditConfig', 'ReplicaSyncAuditResult'],
      bk: 'replica_sync_auditor', eks: ['rsa.entry_logged', 'rsa.violation_found', 'rsa.export_emitted'],
      subjects: ['sven.rsa.entry_logged', 'sven.rsa.violation_found', 'sven.rsa.export_emitted'],
      cases: ['rsa_scanner', 'rsa_enforcer', 'rsa_reporter'],
    },
    {
      name: 'replica_sync_reporter', migration: '20260631080000_agent_replica_sync_reporter.sql',
      typeFile: 'agent-replica-sync-reporter.ts', skillDir: 'replica-sync-reporter',
      interfaces: ['ReplicaSyncReport', 'ReplicaSyncReportConfig', 'ReplicaSyncReportResult'],
      bk: 'replica_sync_reporter', eks: ['rsr.report_generated', 'rsr.insight_found', 'rsr.export_emitted'],
      subjects: ['sven.rsr.report_generated', 'sven.rsr.insight_found', 'sven.rsr.export_emitted'],
      cases: ['rsr_builder', 'rsr_analyst', 'rsr_reporter'],
    },
    {
      name: 'replica_sync_optimizer', migration: '20260631090000_agent_replica_sync_optimizer.sql',
      typeFile: 'agent-replica-sync-optimizer.ts', skillDir: 'replica-sync-optimizer',
      interfaces: ['ReplicaSyncOptPlan', 'ReplicaSyncOptConfig', 'ReplicaSyncOptResult'],
      bk: 'replica_sync_optimizer', eks: ['rso.plan_created', 'rso.optimization_applied', 'rso.export_emitted'],
      subjects: ['sven.rso.plan_created', 'sven.rso.optimization_applied', 'sven.rso.export_emitted'],
      cases: ['rso_planner', 'rso_executor', 'rso_reporter'],
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
