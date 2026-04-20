import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Graceful Shutdown verticals', () => {
  const verticals = [
    {
      name: 'graceful_shutdown', migration: '20260632850000_agent_graceful_shutdown.sql',
      typeFile: 'agent-graceful-shutdown.ts', skillDir: 'graceful-shutdown',
      interfaces: ['GracefulShutdownEntry', 'GracefulShutdownConfig', 'GracefulShutdownResult'],
      bk: 'graceful_shutdown', eks: ['gs.entry_created', 'gs.config_updated', 'gs.export_emitted'],
      subjects: ['sven.gs.entry_created', 'sven.gs.config_updated', 'sven.gs.export_emitted'],
      cases: ['gs_orchestrator', 'gs_drainer', 'gs_reporter'],
    },
    {
      name: 'graceful_shutdown_monitor', migration: '20260632860000_agent_graceful_shutdown_monitor.sql',
      typeFile: 'agent-graceful-shutdown-monitor.ts', skillDir: 'graceful-shutdown-monitor',
      interfaces: ['GracefulShutdownMonitorCheck', 'GracefulShutdownMonitorConfig', 'GracefulShutdownMonitorResult'],
      bk: 'graceful_shutdown_monitor', eks: ['gsm.check_passed', 'gsm.alert_raised', 'gsm.export_emitted'],
      subjects: ['sven.gsm.check_passed', 'sven.gsm.alert_raised', 'sven.gsm.export_emitted'],
      cases: ['gsm_watcher', 'gsm_alerter', 'gsm_reporter'],
    },
    {
      name: 'graceful_shutdown_auditor', migration: '20260632870000_agent_graceful_shutdown_auditor.sql',
      typeFile: 'agent-graceful-shutdown-auditor.ts', skillDir: 'graceful-shutdown-auditor',
      interfaces: ['GracefulShutdownAuditEntry', 'GracefulShutdownAuditConfig', 'GracefulShutdownAuditResult'],
      bk: 'graceful_shutdown_auditor', eks: ['gsa.entry_logged', 'gsa.violation_found', 'gsa.export_emitted'],
      subjects: ['sven.gsa.entry_logged', 'sven.gsa.violation_found', 'sven.gsa.export_emitted'],
      cases: ['gsa_scanner', 'gsa_enforcer', 'gsa_reporter'],
    },
    {
      name: 'graceful_shutdown_reporter', migration: '20260632880000_agent_graceful_shutdown_reporter.sql',
      typeFile: 'agent-graceful-shutdown-reporter.ts', skillDir: 'graceful-shutdown-reporter',
      interfaces: ['GracefulShutdownReport', 'GracefulShutdownReportConfig', 'GracefulShutdownReportResult'],
      bk: 'graceful_shutdown_reporter', eks: ['gsr.report_generated', 'gsr.insight_found', 'gsr.export_emitted'],
      subjects: ['sven.gsr.report_generated', 'sven.gsr.insight_found', 'sven.gsr.export_emitted'],
      cases: ['gsr_builder', 'gsr_analyst', 'gsr_reporter'],
    },
    {
      name: 'graceful_shutdown_optimizer', migration: '20260632890000_agent_graceful_shutdown_optimizer.sql',
      typeFile: 'agent-graceful-shutdown-optimizer.ts', skillDir: 'graceful-shutdown-optimizer',
      interfaces: ['GracefulShutdownOptPlan', 'GracefulShutdownOptConfig', 'GracefulShutdownOptResult'],
      bk: 'graceful_shutdown_optimizer', eks: ['gso.plan_created', 'gso.optimization_applied', 'gso.export_emitted'],
      subjects: ['sven.gso.plan_created', 'sven.gso.optimization_applied', 'sven.gso.export_emitted'],
      cases: ['gso_planner', 'gso_executor', 'gso_reporter'],
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
