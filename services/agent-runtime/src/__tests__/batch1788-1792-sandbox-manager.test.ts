import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Sandbox Manager verticals', () => {
  const verticals = [
    {
      name: 'sandbox_manager', migration: '20260634250000_agent_sandbox_manager.sql',
      typeFile: 'agent-sandbox-manager.ts', skillDir: 'sandbox-manager',
      interfaces: ['SandboxManagerEntry', 'SandboxManagerConfig', 'SandboxManagerResult'],
      bk: 'sandbox_manager', eks: ['sm.entry_created', 'sm.config_updated', 'sm.export_emitted'],
      subjects: ['sven.sm.entry_created', 'sven.sm.config_updated', 'sven.sm.export_emitted'],
      cases: ['sm_creator', 'sm_controller', 'sm_reporter'],
    },
    {
      name: 'sandbox_manager_monitor', migration: '20260634260000_agent_sandbox_manager_monitor.sql',
      typeFile: 'agent-sandbox-manager-monitor.ts', skillDir: 'sandbox-manager-monitor',
      interfaces: ['SandboxManagerMonitorCheck', 'SandboxManagerMonitorConfig', 'SandboxManagerMonitorResult'],
      bk: 'sandbox_manager_monitor', eks: ['smm.check_passed', 'smm.alert_raised', 'smm.export_emitted'],
      subjects: ['sven.smm.check_passed', 'sven.smm.alert_raised', 'sven.smm.export_emitted'],
      cases: ['smm_watcher', 'smm_alerter', 'smm_reporter'],
    },
    {
      name: 'sandbox_manager_auditor', migration: '20260634270000_agent_sandbox_manager_auditor.sql',
      typeFile: 'agent-sandbox-manager-auditor.ts', skillDir: 'sandbox-manager-auditor',
      interfaces: ['SandboxManagerAuditEntry', 'SandboxManagerAuditConfig', 'SandboxManagerAuditResult'],
      bk: 'sandbox_manager_auditor', eks: ['sma.entry_logged', 'sma.violation_found', 'sma.export_emitted'],
      subjects: ['sven.sma.entry_logged', 'sven.sma.violation_found', 'sven.sma.export_emitted'],
      cases: ['sma_scanner', 'sma_enforcer', 'sma_reporter'],
    },
    {
      name: 'sandbox_manager_reporter', migration: '20260634280000_agent_sandbox_manager_reporter.sql',
      typeFile: 'agent-sandbox-manager-reporter.ts', skillDir: 'sandbox-manager-reporter',
      interfaces: ['SandboxManagerReport', 'SandboxManagerReportConfig', 'SandboxManagerReportResult'],
      bk: 'sandbox_manager_reporter', eks: ['smr.report_generated', 'smr.insight_found', 'smr.export_emitted'],
      subjects: ['sven.smr.report_generated', 'sven.smr.insight_found', 'sven.smr.export_emitted'],
      cases: ['smr_builder', 'smr_analyst', 'smr_reporter'],
    },
    {
      name: 'sandbox_manager_optimizer', migration: '20260634290000_agent_sandbox_manager_optimizer.sql',
      typeFile: 'agent-sandbox-manager-optimizer.ts', skillDir: 'sandbox-manager-optimizer',
      interfaces: ['SandboxManagerOptPlan', 'SandboxManagerOptConfig', 'SandboxManagerOptResult'],
      bk: 'sandbox_manager_optimizer', eks: ['smo.plan_created', 'smo.optimization_applied', 'smo.export_emitted'],
      subjects: ['sven.smo.plan_created', 'sven.smo.optimization_applied', 'sven.smo.export_emitted'],
      cases: ['smo_planner', 'smo_executor', 'smo_reporter'],
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
