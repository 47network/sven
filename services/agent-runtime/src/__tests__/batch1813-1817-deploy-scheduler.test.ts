import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Deploy Scheduler verticals', () => {
  const verticals = [
    {
      name: 'deploy_scheduler', migration: '20260634500000_agent_deploy_scheduler.sql',
      typeFile: 'agent-deploy-scheduler.ts', skillDir: 'deploy-scheduler',
      interfaces: ['DeploySchedulerEntry', 'DeploySchedulerConfig', 'DeploySchedulerResult'],
      bk: 'deploy_scheduler', eks: ['ds.entry_created', 'ds.config_updated', 'ds.export_emitted'],
      subjects: ['sven.ds.entry_created', 'sven.ds.config_updated', 'sven.ds.export_emitted'],
      cases: ['ds_planner', 'ds_executor', 'ds_reporter'],
    },
    {
      name: 'deploy_scheduler_monitor', migration: '20260634510000_agent_deploy_scheduler_monitor.sql',
      typeFile: 'agent-deploy-scheduler-monitor.ts', skillDir: 'deploy-scheduler-monitor',
      interfaces: ['DeploySchedulerMonitorCheck', 'DeploySchedulerMonitorConfig', 'DeploySchedulerMonitorResult'],
      bk: 'deploy_scheduler_monitor', eks: ['dsm.check_passed', 'dsm.alert_raised', 'dsm.export_emitted'],
      subjects: ['sven.dsm.check_passed', 'sven.dsm.alert_raised', 'sven.dsm.export_emitted'],
      cases: ['dsm_watcher', 'dsm_alerter', 'dsm_reporter'],
    },
    {
      name: 'deploy_scheduler_auditor', migration: '20260634520000_agent_deploy_scheduler_auditor.sql',
      typeFile: 'agent-deploy-scheduler-auditor.ts', skillDir: 'deploy-scheduler-auditor',
      interfaces: ['DeploySchedulerAuditEntry', 'DeploySchedulerAuditConfig', 'DeploySchedulerAuditResult'],
      bk: 'deploy_scheduler_auditor', eks: ['dsa.entry_logged', 'dsa.violation_found', 'dsa.export_emitted'],
      subjects: ['sven.dsa.entry_logged', 'sven.dsa.violation_found', 'sven.dsa.export_emitted'],
      cases: ['dsa_scanner', 'dsa_enforcer', 'dsa_reporter'],
    },
    {
      name: 'deploy_scheduler_reporter', migration: '20260634530000_agent_deploy_scheduler_reporter.sql',
      typeFile: 'agent-deploy-scheduler-reporter.ts', skillDir: 'deploy-scheduler-reporter',
      interfaces: ['DeploySchedulerReport', 'DeploySchedulerReportConfig', 'DeploySchedulerReportResult'],
      bk: 'deploy_scheduler_reporter', eks: ['dsr.report_generated', 'dsr.insight_found', 'dsr.export_emitted'],
      subjects: ['sven.dsr.report_generated', 'sven.dsr.insight_found', 'sven.dsr.export_emitted'],
      cases: ['dsr_builder', 'dsr_analyst', 'dsr_reporter'],
    },
    {
      name: 'deploy_scheduler_optimizer', migration: '20260634540000_agent_deploy_scheduler_optimizer.sql',
      typeFile: 'agent-deploy-scheduler-optimizer.ts', skillDir: 'deploy-scheduler-optimizer',
      interfaces: ['DeploySchedulerOptPlan', 'DeploySchedulerOptConfig', 'DeploySchedulerOptResult'],
      bk: 'deploy_scheduler_optimizer', eks: ['dso.plan_created', 'dso.optimization_applied', 'dso.export_emitted'],
      subjects: ['sven.dso.plan_created', 'sven.dso.optimization_applied', 'sven.dso.export_emitted'],
      cases: ['dso_planner', 'dso_executor', 'dso_reporter'],
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
