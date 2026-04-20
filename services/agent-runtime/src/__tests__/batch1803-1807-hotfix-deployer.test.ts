import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Hotfix Deployer verticals', () => {
  const verticals = [
    {
      name: 'hotfix_deployer', migration: '20260634400000_agent_hotfix_deployer.sql',
      typeFile: 'agent-hotfix-deployer.ts', skillDir: 'hotfix-deployer',
      interfaces: ['HotfixDeployerEntry', 'HotfixDeployerConfig', 'HotfixDeployerResult'],
      bk: 'hotfix_deployer', eks: ['hd.entry_created', 'hd.config_updated', 'hd.export_emitted'],
      subjects: ['sven.hd.entry_created', 'sven.hd.config_updated', 'sven.hd.export_emitted'],
      cases: ['hd_builder', 'hd_pusher', 'hd_reporter'],
    },
    {
      name: 'hotfix_deployer_monitor', migration: '20260634410000_agent_hotfix_deployer_monitor.sql',
      typeFile: 'agent-hotfix-deployer-monitor.ts', skillDir: 'hotfix-deployer-monitor',
      interfaces: ['HotfixDeployerMonitorCheck', 'HotfixDeployerMonitorConfig', 'HotfixDeployerMonitorResult'],
      bk: 'hotfix_deployer_monitor', eks: ['hdm.check_passed', 'hdm.alert_raised', 'hdm.export_emitted'],
      subjects: ['sven.hdm.check_passed', 'sven.hdm.alert_raised', 'sven.hdm.export_emitted'],
      cases: ['hdm_watcher', 'hdm_alerter', 'hdm_reporter'],
    },
    {
      name: 'hotfix_deployer_auditor', migration: '20260634420000_agent_hotfix_deployer_auditor.sql',
      typeFile: 'agent-hotfix-deployer-auditor.ts', skillDir: 'hotfix-deployer-auditor',
      interfaces: ['HotfixDeployerAuditEntry', 'HotfixDeployerAuditConfig', 'HotfixDeployerAuditResult'],
      bk: 'hotfix_deployer_auditor', eks: ['hda.entry_logged', 'hda.violation_found', 'hda.export_emitted'],
      subjects: ['sven.hda.entry_logged', 'sven.hda.violation_found', 'sven.hda.export_emitted'],
      cases: ['hda_scanner', 'hda_enforcer', 'hda_reporter'],
    },
    {
      name: 'hotfix_deployer_reporter', migration: '20260634430000_agent_hotfix_deployer_reporter.sql',
      typeFile: 'agent-hotfix-deployer-reporter.ts', skillDir: 'hotfix-deployer-reporter',
      interfaces: ['HotfixDeployerReport', 'HotfixDeployerReportConfig', 'HotfixDeployerReportResult'],
      bk: 'hotfix_deployer_reporter', eks: ['hdr.report_generated', 'hdr.insight_found', 'hdr.export_emitted'],
      subjects: ['sven.hdr.report_generated', 'sven.hdr.insight_found', 'sven.hdr.export_emitted'],
      cases: ['hdr_builder', 'hdr_analyst', 'hdr_reporter'],
    },
    {
      name: 'hotfix_deployer_optimizer', migration: '20260634440000_agent_hotfix_deployer_optimizer.sql',
      typeFile: 'agent-hotfix-deployer-optimizer.ts', skillDir: 'hotfix-deployer-optimizer',
      interfaces: ['HotfixDeployerOptPlan', 'HotfixDeployerOptConfig', 'HotfixDeployerOptResult'],
      bk: 'hotfix_deployer_optimizer', eks: ['hdo.plan_created', 'hdo.optimization_applied', 'hdo.export_emitted'],
      subjects: ['sven.hdo.plan_created', 'sven.hdo.optimization_applied', 'sven.hdo.export_emitted'],
      cases: ['hdo_planner', 'hdo_executor', 'hdo_reporter'],
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
