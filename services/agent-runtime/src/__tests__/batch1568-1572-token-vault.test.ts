import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Token Vault verticals', () => {
  const verticals = [
    {
      name: 'token_vault', migration: '20260632050000_agent_token_vault.sql',
      typeFile: 'agent-token-vault.ts', skillDir: 'token-vault',
      interfaces: ['TokenVaultEntry', 'TokenVaultConfig', 'TokenVaultResult'],
      bk: 'token_vault', eks: ['tv.entry_created', 'tv.config_updated', 'tv.export_emitted'],
      subjects: ['sven.tv.entry_created', 'sven.tv.config_updated', 'sven.tv.export_emitted'],
      cases: ['tv_issuer', 'tv_revoker', 'tv_reporter'],
    },
    {
      name: 'token_vault_monitor', migration: '20260632060000_agent_token_vault_monitor.sql',
      typeFile: 'agent-token-vault-monitor.ts', skillDir: 'token-vault-monitor',
      interfaces: ['TokenVaultMonitorCheck', 'TokenVaultMonitorConfig', 'TokenVaultMonitorResult'],
      bk: 'token_vault_monitor', eks: ['tvm.check_passed', 'tvm.alert_raised', 'tvm.export_emitted'],
      subjects: ['sven.tvm.check_passed', 'sven.tvm.alert_raised', 'sven.tvm.export_emitted'],
      cases: ['tvm_watcher', 'tvm_alerter', 'tvm_reporter'],
    },
    {
      name: 'token_vault_auditor', migration: '20260632070000_agent_token_vault_auditor.sql',
      typeFile: 'agent-token-vault-auditor.ts', skillDir: 'token-vault-auditor',
      interfaces: ['TokenVaultAuditEntry', 'TokenVaultAuditConfig', 'TokenVaultAuditResult'],
      bk: 'token_vault_auditor', eks: ['tva.entry_logged', 'tva.violation_found', 'tva.export_emitted'],
      subjects: ['sven.tva.entry_logged', 'sven.tva.violation_found', 'sven.tva.export_emitted'],
      cases: ['tva_scanner', 'tva_enforcer', 'tva_reporter'],
    },
    {
      name: 'token_vault_reporter', migration: '20260632080000_agent_token_vault_reporter.sql',
      typeFile: 'agent-token-vault-reporter.ts', skillDir: 'token-vault-reporter',
      interfaces: ['TokenVaultReport', 'TokenVaultReportConfig', 'TokenVaultReportResult'],
      bk: 'token_vault_reporter', eks: ['tvr.report_generated', 'tvr.insight_found', 'tvr.export_emitted'],
      subjects: ['sven.tvr.report_generated', 'sven.tvr.insight_found', 'sven.tvr.export_emitted'],
      cases: ['tvr_builder', 'tvr_analyst', 'tvr_reporter'],
    },
    {
      name: 'token_vault_optimizer', migration: '20260632090000_agent_token_vault_optimizer.sql',
      typeFile: 'agent-token-vault-optimizer.ts', skillDir: 'token-vault-optimizer',
      interfaces: ['TokenVaultOptPlan', 'TokenVaultOptConfig', 'TokenVaultOptResult'],
      bk: 'token_vault_optimizer', eks: ['tvo.plan_created', 'tvo.optimization_applied', 'tvo.export_emitted'],
      subjects: ['sven.tvo.plan_created', 'sven.tvo.optimization_applied', 'sven.tvo.export_emitted'],
      cases: ['tvo_planner', 'tvo_executor', 'tvo_reporter'],
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
