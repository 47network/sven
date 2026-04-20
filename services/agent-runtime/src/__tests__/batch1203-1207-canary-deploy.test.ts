import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Canary Deploy management verticals', () => {
  const verticals = [
    {
      name: 'canary_deploy', migration: '20260628400000_agent_canary_deploy.sql',
      typeFile: 'agent-canary-deploy.ts', skillDir: 'canary-deploy',
      interfaces: ['CanaryDeployPlan', 'CanaryDeployConfig', 'CanaryDeployResult'],
      bk: 'canary_deploy', eks: ['cd.plan_created', 'cd.config_updated', 'cd.export_emitted'],
      subjects: ['sven.cd.plan_created', 'sven.cd.config_updated', 'sven.cd.export_emitted'],
      cases: ['cd_planner', 'cd_executor', 'cd_reporter'],
    },
    {
      name: 'canary_deploy_monitor', migration: '20260628410000_agent_canary_deploy_monitor.sql',
      typeFile: 'agent-canary-deploy-monitor.ts', skillDir: 'canary-deploy-monitor',
      interfaces: ['CanaryDeployMonitorCheck', 'CanaryDeployMonitorConfig', 'CanaryDeployMonitorResult'],
      bk: 'canary_deploy_monitor', eks: ['cdm.check_passed', 'cdm.alert_raised', 'cdm.export_emitted'],
      subjects: ['sven.cdm.check_passed', 'sven.cdm.alert_raised', 'sven.cdm.export_emitted'],
      cases: ['cdm_watcher', 'cdm_alerter', 'cdm_reporter'],
    },
    {
      name: 'canary_deploy_auditor', migration: '20260628420000_agent_canary_deploy_auditor.sql',
      typeFile: 'agent-canary-deploy-auditor.ts', skillDir: 'canary-deploy-auditor',
      interfaces: ['CanaryDeployAuditEntry', 'CanaryDeployAuditConfig', 'CanaryDeployAuditResult'],
      bk: 'canary_deploy_auditor', eks: ['cda.entry_logged', 'cda.violation_found', 'cda.export_emitted'],
      subjects: ['sven.cda.entry_logged', 'sven.cda.violation_found', 'sven.cda.export_emitted'],
      cases: ['cda_scanner', 'cda_enforcer', 'cda_reporter'],
    },
    {
      name: 'canary_deploy_reporter', migration: '20260628430000_agent_canary_deploy_reporter.sql',
      typeFile: 'agent-canary-deploy-reporter.ts', skillDir: 'canary-deploy-reporter',
      interfaces: ['CanaryDeployReport', 'CanaryDeployReportConfig', 'CanaryDeployReportResult'],
      bk: 'canary_deploy_reporter', eks: ['cdr.report_generated', 'cdr.insight_found', 'cdr.export_emitted'],
      subjects: ['sven.cdr.report_generated', 'sven.cdr.insight_found', 'sven.cdr.export_emitted'],
      cases: ['cdr_builder', 'cdr_analyst', 'cdr_reporter'],
    },
    {
      name: 'canary_deploy_optimizer', migration: '20260628440000_agent_canary_deploy_optimizer.sql',
      typeFile: 'agent-canary-deploy-optimizer.ts', skillDir: 'canary-deploy-optimizer',
      interfaces: ['CanaryDeployOptPlan', 'CanaryDeployOptConfig', 'CanaryDeployOptResult'],
      bk: 'canary_deploy_optimizer', eks: ['cdo.plan_created', 'cdo.optimization_applied', 'cdo.export_emitted'],
      subjects: ['sven.cdo.plan_created', 'sven.cdo.optimization_applied', 'sven.cdo.export_emitted'],
      cases: ['cdo_planner', 'cdo_executor', 'cdo_reporter'],
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
