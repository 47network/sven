import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Blue-Green Deploy management verticals', () => {
  const verticals = [
    {
      name: 'blue_green_deploy', migration: '20260628450000_agent_blue_green_deploy.sql',
      typeFile: 'agent-blue-green-deploy.ts', skillDir: 'blue-green-deploy',
      interfaces: ['BlueGreenDeployPlan', 'BlueGreenDeployConfig', 'BlueGreenDeployResult'],
      bk: 'blue_green_deploy', eks: ['bgd.plan_created', 'bgd.config_updated', 'bgd.export_emitted'],
      subjects: ['sven.bgd.plan_created', 'sven.bgd.config_updated', 'sven.bgd.export_emitted'],
      cases: ['bgd_planner', 'bgd_executor', 'bgd_reporter'],
    },
    {
      name: 'blue_green_deploy_monitor', migration: '20260628460000_agent_blue_green_deploy_monitor.sql',
      typeFile: 'agent-blue-green-deploy-monitor.ts', skillDir: 'blue-green-deploy-monitor',
      interfaces: ['BlueGreenDeployMonitorCheck', 'BlueGreenDeployMonitorConfig', 'BlueGreenDeployMonitorResult'],
      bk: 'blue_green_deploy_monitor', eks: ['bgdm.check_passed', 'bgdm.alert_raised', 'bgdm.export_emitted'],
      subjects: ['sven.bgdm.check_passed', 'sven.bgdm.alert_raised', 'sven.bgdm.export_emitted'],
      cases: ['bgdm_watcher', 'bgdm_alerter', 'bgdm_reporter'],
    },
    {
      name: 'blue_green_deploy_auditor', migration: '20260628470000_agent_blue_green_deploy_auditor.sql',
      typeFile: 'agent-blue-green-deploy-auditor.ts', skillDir: 'blue-green-deploy-auditor',
      interfaces: ['BlueGreenDeployAuditEntry', 'BlueGreenDeployAuditConfig', 'BlueGreenDeployAuditResult'],
      bk: 'blue_green_deploy_auditor', eks: ['bgda.entry_logged', 'bgda.violation_found', 'bgda.export_emitted'],
      subjects: ['sven.bgda.entry_logged', 'sven.bgda.violation_found', 'sven.bgda.export_emitted'],
      cases: ['bgda_scanner', 'bgda_enforcer', 'bgda_reporter'],
    },
    {
      name: 'blue_green_deploy_reporter', migration: '20260628480000_agent_blue_green_deploy_reporter.sql',
      typeFile: 'agent-blue-green-deploy-reporter.ts', skillDir: 'blue-green-deploy-reporter',
      interfaces: ['BlueGreenDeployReport', 'BlueGreenDeployReportConfig', 'BlueGreenDeployReportResult'],
      bk: 'blue_green_deploy_reporter', eks: ['bgdr.report_generated', 'bgdr.insight_found', 'bgdr.export_emitted'],
      subjects: ['sven.bgdr.report_generated', 'sven.bgdr.insight_found', 'sven.bgdr.export_emitted'],
      cases: ['bgdr_builder', 'bgdr_analyst', 'bgdr_reporter'],
    },
    {
      name: 'blue_green_deploy_optimizer', migration: '20260628490000_agent_blue_green_deploy_optimizer.sql',
      typeFile: 'agent-blue-green-deploy-optimizer.ts', skillDir: 'blue-green-deploy-optimizer',
      interfaces: ['BlueGreenDeployOptPlan', 'BlueGreenDeployOptConfig', 'BlueGreenDeployOptResult'],
      bk: 'blue_green_deploy_optimizer', eks: ['bgdo.plan_created', 'bgdo.optimization_applied', 'bgdo.export_emitted'],
      subjects: ['sven.bgdo.plan_created', 'sven.bgdo.optimization_applied', 'sven.bgdo.export_emitted'],
      cases: ['bgdo_planner', 'bgdo_executor', 'bgdo_reporter'],
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
