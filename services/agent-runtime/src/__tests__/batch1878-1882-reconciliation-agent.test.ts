import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Reconciliation Agent verticals', () => {
  const verticals = [
    {
      name: 'reconciliation_agent', migration: '20260635150000_agent_reconciliation_agent.sql',
      typeFile: 'agent-reconciliation-agent.ts', skillDir: 'reconciliation-agent',
      interfaces: ['ReconciliationAgentEntry', 'ReconciliationAgentConfig', 'ReconciliationAgentResult'],
      bk: 'reconciliation_agent', eks: ['ra.entry_created', 'ra.config_updated', 'ra.export_emitted'],
      subjects: ['sven.ra.entry_created', 'sven.ra.config_updated', 'sven.ra.export_emitted'],
      cases: ['ra_matcher', 'ra_resolver', 'ra_reporter'],
    },
    {
      name: 'reconciliation_agent_monitor', migration: '20260635160000_agent_reconciliation_agent_monitor.sql',
      typeFile: 'agent-reconciliation-agent-monitor.ts', skillDir: 'reconciliation-agent-monitor',
      interfaces: ['ReconciliationAgentMonitorCheck', 'ReconciliationAgentMonitorConfig', 'ReconciliationAgentMonitorResult'],
      bk: 'reconciliation_agent_monitor', eks: ['ram.check_passed', 'ram.alert_raised', 'ram.export_emitted'],
      subjects: ['sven.ram.check_passed', 'sven.ram.alert_raised', 'sven.ram.export_emitted'],
      cases: ['ram_watcher', 'ram_alerter', 'ram_reporter'],
    },
    {
      name: 'reconciliation_agent_auditor', migration: '20260635170000_agent_reconciliation_agent_auditor.sql',
      typeFile: 'agent-reconciliation-agent-auditor.ts', skillDir: 'reconciliation-agent-auditor',
      interfaces: ['ReconciliationAgentAuditEntry', 'ReconciliationAgentAuditConfig', 'ReconciliationAgentAuditResult'],
      bk: 'reconciliation_agent_auditor', eks: ['raa.entry_logged', 'raa.violation_found', 'raa.export_emitted'],
      subjects: ['sven.raa.entry_logged', 'sven.raa.violation_found', 'sven.raa.export_emitted'],
      cases: ['raa_scanner', 'raa_enforcer', 'raa_reporter'],
    },
    {
      name: 'reconciliation_agent_reporter', migration: '20260635180000_agent_reconciliation_agent_reporter.sql',
      typeFile: 'agent-reconciliation-agent-reporter.ts', skillDir: 'reconciliation-agent-reporter',
      interfaces: ['ReconciliationAgentReport', 'ReconciliationAgentReportConfig', 'ReconciliationAgentReportResult'],
      bk: 'reconciliation_agent_reporter', eks: ['rar.report_generated', 'rar.insight_found', 'rar.export_emitted'],
      subjects: ['sven.rar.report_generated', 'sven.rar.insight_found', 'sven.rar.export_emitted'],
      cases: ['rar_builder', 'rar_analyst', 'rar_reporter'],
    },
    {
      name: 'reconciliation_agent_optimizer', migration: '20260635190000_agent_reconciliation_agent_optimizer.sql',
      typeFile: 'agent-reconciliation-agent-optimizer.ts', skillDir: 'reconciliation-agent-optimizer',
      interfaces: ['ReconciliationAgentOptPlan', 'ReconciliationAgentOptConfig', 'ReconciliationAgentOptResult'],
      bk: 'reconciliation_agent_optimizer', eks: ['rao.plan_created', 'rao.optimization_applied', 'rao.export_emitted'],
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
