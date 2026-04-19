import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Runbook Automation management verticals', () => {
  const verticals = [
    {
      name: 'runbook_automation', migration: '20260629050000_agent_runbook_automation.sql',
      typeFile: 'agent-runbook-automation.ts', skillDir: 'runbook-automation',
      interfaces: ['RunbookAutomationPlan', 'RunbookAutomationConfig', 'RunbookAutomationResult'],
      bk: 'runbook_automation', eks: ['ra.plan_created', 'ra.config_updated', 'ra.export_emitted'],
      subjects: ['sven.ra.plan_created', 'sven.ra.config_updated', 'sven.ra.export_emitted'],
      cases: ['ra_planner', 'ra_executor', 'ra_reporter'],
    },
    {
      name: 'runbook_automation_monitor', migration: '20260629060000_agent_runbook_automation_monitor.sql',
      typeFile: 'agent-runbook-automation-monitor.ts', skillDir: 'runbook-automation-monitor',
      interfaces: ['RunbookAutomationMonitorCheck', 'RunbookAutomationMonitorConfig', 'RunbookAutomationMonitorResult'],
      bk: 'runbook_automation_monitor', eks: ['ram.check_passed', 'ram.alert_raised', 'ram.export_emitted'],
      subjects: ['sven.ram.check_passed', 'sven.ram.alert_raised', 'sven.ram.export_emitted'],
      cases: ['ram_watcher', 'ram_alerter', 'ram_reporter'],
    },
    {
      name: 'runbook_automation_auditor', migration: '20260629070000_agent_runbook_automation_auditor.sql',
      typeFile: 'agent-runbook-automation-auditor.ts', skillDir: 'runbook-automation-auditor',
      interfaces: ['RunbookAutomationAuditEntry', 'RunbookAutomationAuditConfig', 'RunbookAutomationAuditResult'],
      bk: 'runbook_automation_auditor', eks: ['raa.entry_logged', 'raa.violation_found', 'raa.export_emitted'],
      subjects: ['sven.raa.entry_logged', 'sven.raa.violation_found', 'sven.raa.export_emitted'],
      cases: ['raa_scanner', 'raa_enforcer', 'raa_reporter'],
    },
    {
      name: 'runbook_automation_reporter', migration: '20260629080000_agent_runbook_automation_reporter.sql',
      typeFile: 'agent-runbook-automation-reporter.ts', skillDir: 'runbook-automation-reporter',
      interfaces: ['RunbookAutomationReport', 'RunbookAutomationReportConfig', 'RunbookAutomationReportResult'],
      bk: 'runbook_automation_reporter', eks: ['rar.report_generated', 'rar.insight_found', 'rar.export_emitted'],
      subjects: ['sven.rar.report_generated', 'sven.rar.insight_found', 'sven.rar.export_emitted'],
      cases: ['rar_builder', 'rar_analyst', 'rar_reporter'],
    },
    {
      name: 'runbook_automation_optimizer', migration: '20260629090000_agent_runbook_automation_optimizer.sql',
      typeFile: 'agent-runbook-automation-optimizer.ts', skillDir: 'runbook-automation-optimizer',
      interfaces: ['RunbookAutomationOptPlan', 'RunbookAutomationOptConfig', 'RunbookAutomationOptResult'],
      bk: 'runbook_automation_optimizer', eks: ['rao.plan_created', 'rao.optimization_applied', 'rao.export_emitted'],
      subjects: ['sven.rao.plan_created', 'sven.rao.optimization_applied', 'sven.rao.export_emitted'],
      cases: ['rao_planner', 'rao_executor', 'rao_reporter'],
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
