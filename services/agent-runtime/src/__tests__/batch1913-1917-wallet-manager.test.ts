import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Wallet Manager verticals', () => {
  const verticals = [
    {
      name: 'wallet_manager', migration: '20260635500000_agent_wallet_manager.sql',
      typeFile: 'agent-wallet-manager.ts', skillDir: 'wallet-manager',
      interfaces: ['WalletManagerEntry', 'WalletManagerConfig', 'WalletManagerResult'],
      bk: 'wallet_manager', eks: ['wm.entry_created', 'wm.config_updated', 'wm.export_emitted'],
      subjects: ['sven.wm.entry_created', 'sven.wm.config_updated', 'sven.wm.export_emitted'],
      cases: ['wm_creator', 'wm_transactor', 'wm_reporter'],
    },
    {
      name: 'wallet_manager_monitor', migration: '20260635510000_agent_wallet_manager_monitor.sql',
      typeFile: 'agent-wallet-manager-monitor.ts', skillDir: 'wallet-manager-monitor',
      interfaces: ['WalletManagerMonitorCheck', 'WalletManagerMonitorConfig', 'WalletManagerMonitorResult'],
      bk: 'wallet_manager_monitor', eks: ['wmm.check_passed', 'wmm.alert_raised', 'wmm.export_emitted'],
      subjects: ['sven.wmm.check_passed', 'sven.wmm.alert_raised', 'sven.wmm.export_emitted'],
      cases: ['wmm_watcher', 'wmm_alerter', 'wmm_reporter'],
    },
    {
      name: 'wallet_manager_auditor', migration: '20260635520000_agent_wallet_manager_auditor.sql',
      typeFile: 'agent-wallet-manager-auditor.ts', skillDir: 'wallet-manager-auditor',
      interfaces: ['WalletManagerAuditEntry', 'WalletManagerAuditConfig', 'WalletManagerAuditResult'],
      bk: 'wallet_manager_auditor', eks: ['wma.entry_logged', 'wma.violation_found', 'wma.export_emitted'],
      subjects: ['sven.wma.entry_logged', 'sven.wma.violation_found', 'sven.wma.export_emitted'],
      cases: ['wma_scanner', 'wma_enforcer', 'wma_reporter'],
    },
    {
      name: 'wallet_manager_reporter', migration: '20260635530000_agent_wallet_manager_reporter.sql',
      typeFile: 'agent-wallet-manager-reporter.ts', skillDir: 'wallet-manager-reporter',
      interfaces: ['WalletManagerReport', 'WalletManagerReportConfig', 'WalletManagerReportResult'],
      bk: 'wallet_manager_reporter', eks: ['wmr.report_generated', 'wmr.insight_found', 'wmr.export_emitted'],
      subjects: ['sven.wmr.report_generated', 'sven.wmr.insight_found', 'sven.wmr.export_emitted'],
      cases: ['wmr_builder', 'wmr_analyst', 'wmr_reporter'],
    },
    {
      name: 'wallet_manager_optimizer', migration: '20260635540000_agent_wallet_manager_optimizer.sql',
      typeFile: 'agent-wallet-manager-optimizer.ts', skillDir: 'wallet-manager-optimizer',
      interfaces: ['WalletManagerOptPlan', 'WalletManagerOptConfig', 'WalletManagerOptResult'],
      bk: 'wallet_manager_optimizer', eks: ['wmo.plan_created', 'wmo.optimization_applied', 'wmo.export_emitted'],
      subjects: ['sven.wmo.plan_created', 'sven.wmo.optimization_applied', 'sven.wmo.export_emitted'],
      cases: ['wmo_planner', 'wmo_executor', 'wmo_reporter'],
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
