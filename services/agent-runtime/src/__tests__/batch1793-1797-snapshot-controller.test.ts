import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Snapshot Controller verticals', () => {
  const verticals = [
    {
      name: 'snapshot_controller', migration: '20260634300000_agent_snapshot_controller.sql',
      typeFile: 'agent-snapshot-controller.ts', skillDir: 'snapshot-controller',
      interfaces: ['SnapshotControllerEntry', 'SnapshotControllerConfig', 'SnapshotControllerResult'],
      bk: 'snapshot_controller', eks: ['sc.entry_created', 'sc.config_updated', 'sc.export_emitted'],
      subjects: ['sven.sc.entry_created', 'sven.sc.config_updated', 'sven.sc.export_emitted'],
      cases: ['sc_capturer', 'sc_restorer', 'sc_reporter'],
    },
    {
      name: 'snapshot_controller_monitor', migration: '20260634310000_agent_snapshot_controller_monitor.sql',
      typeFile: 'agent-snapshot-controller-monitor.ts', skillDir: 'snapshot-controller-monitor',
      interfaces: ['SnapshotControllerMonitorCheck', 'SnapshotControllerMonitorConfig', 'SnapshotControllerMonitorResult'],
      bk: 'snapshot_controller_monitor', eks: ['scm.check_passed', 'scm.alert_raised', 'scm.export_emitted'],
      subjects: ['sven.scm.check_passed', 'sven.scm.alert_raised', 'sven.scm.export_emitted'],
      cases: ['scm_watcher', 'scm_alerter', 'scm_reporter'],
    },
    {
      name: 'snapshot_controller_auditor', migration: '20260634320000_agent_snapshot_controller_auditor.sql',
      typeFile: 'agent-snapshot-controller-auditor.ts', skillDir: 'snapshot-controller-auditor',
      interfaces: ['SnapshotControllerAuditEntry', 'SnapshotControllerAuditConfig', 'SnapshotControllerAuditResult'],
      bk: 'snapshot_controller_auditor', eks: ['sca.entry_logged', 'sca.violation_found', 'sca.export_emitted'],
      subjects: ['sven.sca.entry_logged', 'sven.sca.violation_found', 'sven.sca.export_emitted'],
      cases: ['sca_scanner', 'sca_enforcer', 'sca_reporter'],
    },
    {
      name: 'snapshot_controller_reporter', migration: '20260634330000_agent_snapshot_controller_reporter.sql',
      typeFile: 'agent-snapshot-controller-reporter.ts', skillDir: 'snapshot-controller-reporter',
      interfaces: ['SnapshotControllerReport', 'SnapshotControllerReportConfig', 'SnapshotControllerReportResult'],
      bk: 'snapshot_controller_reporter', eks: ['scr.report_generated', 'scr.insight_found', 'scr.export_emitted'],
      subjects: ['sven.scr.report_generated', 'sven.scr.insight_found', 'sven.scr.export_emitted'],
      cases: ['scr_builder', 'scr_analyst', 'scr_reporter'],
    },
    {
      name: 'snapshot_controller_optimizer', migration: '20260634340000_agent_snapshot_controller_optimizer.sql',
      typeFile: 'agent-snapshot-controller-optimizer.ts', skillDir: 'snapshot-controller-optimizer',
      interfaces: ['SnapshotControllerOptPlan', 'SnapshotControllerOptConfig', 'SnapshotControllerOptResult'],
      bk: 'snapshot_controller_optimizer', eks: ['sco.plan_created', 'sco.optimization_applied', 'sco.export_emitted'],
      subjects: ['sven.sco.plan_created', 'sven.sco.optimization_applied', 'sven.sco.export_emitted'],
      cases: ['sco_planner', 'sco_executor', 'sco_reporter'],
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
