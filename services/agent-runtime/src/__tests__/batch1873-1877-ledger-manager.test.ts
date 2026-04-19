import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Ledger Manager verticals', () => {
  const verticals = [
    {
      name: 'ledger_manager', migration: '20260635100000_agent_ledger_manager.sql',
      typeFile: 'agent-ledger-manager.ts', skillDir: 'ledger-manager',
      interfaces: ['LedgerManagerEntry', 'LedgerManagerConfig', 'LedgerManagerResult'],
      bk: 'ledger_manager', eks: ['lm.entry_created', 'lm.config_updated', 'lm.export_emitted'],
      subjects: ['sven.lm.entry_created', 'sven.lm.config_updated', 'sven.lm.export_emitted'],
      cases: ['lm_recorder', 'lm_balancer', 'lm_reporter'],
    },
    {
      name: 'ledger_manager_monitor', migration: '20260635110000_agent_ledger_manager_monitor.sql',
      typeFile: 'agent-ledger-manager-monitor.ts', skillDir: 'ledger-manager-monitor',
      interfaces: ['LedgerManagerMonitorCheck', 'LedgerManagerMonitorConfig', 'LedgerManagerMonitorResult'],
      bk: 'ledger_manager_monitor', eks: ['lmm.check_passed', 'lmm.alert_raised', 'lmm.export_emitted'],
      subjects: ['sven.lmm.check_passed', 'sven.lmm.alert_raised', 'sven.lmm.export_emitted'],
      cases: ['lmm_watcher', 'lmm_alerter', 'lmm_reporter'],
    },
    {
      name: 'ledger_manager_auditor', migration: '20260635120000_agent_ledger_manager_auditor.sql',
      typeFile: 'agent-ledger-manager-auditor.ts', skillDir: 'ledger-manager-auditor',
      interfaces: ['LedgerManagerAuditEntry', 'LedgerManagerAuditConfig', 'LedgerManagerAuditResult'],
      bk: 'ledger_manager_auditor', eks: ['lma.entry_logged', 'lma.violation_found', 'lma.export_emitted'],
      subjects: ['sven.lma.entry_logged', 'sven.lma.violation_found', 'sven.lma.export_emitted'],
      cases: ['lma_scanner', 'lma_enforcer', 'lma_reporter'],
    },
    {
      name: 'ledger_manager_reporter', migration: '20260635130000_agent_ledger_manager_reporter.sql',
      typeFile: 'agent-ledger-manager-reporter.ts', skillDir: 'ledger-manager-reporter',
      interfaces: ['LedgerManagerReport', 'LedgerManagerReportConfig', 'LedgerManagerReportResult'],
      bk: 'ledger_manager_reporter', eks: ['lmr.report_generated', 'lmr.insight_found', 'lmr.export_emitted'],
      subjects: ['sven.lmr.report_generated', 'sven.lmr.insight_found', 'sven.lmr.export_emitted'],
      cases: ['lmr_builder', 'lmr_analyst', 'lmr_reporter'],
    },
    {
      name: 'ledger_manager_optimizer', migration: '20260635140000_agent_ledger_manager_optimizer.sql',
      typeFile: 'agent-ledger-manager-optimizer.ts', skillDir: 'ledger-manager-optimizer',
      interfaces: ['LedgerManagerOptPlan', 'LedgerManagerOptConfig', 'LedgerManagerOptResult'],
      bk: 'ledger_manager_optimizer', eks: ['lmo.plan_created', 'lmo.optimization_applied', 'lmo.export_emitted'],
      subjects: ['sven.lmo.plan_created', 'sven.lmo.optimization_applied', 'sven.lmo.export_emitted'],
      cases: ['lmo_planner', 'lmo_executor', 'lmo_reporter'],
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
