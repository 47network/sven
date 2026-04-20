import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Artifact Vault verticals', () => {
  const verticals = [
    {
      name: 'artifact_vault', migration: '20260633200000_agent_artifact_vault.sql',
      typeFile: 'agent-artifact-vault.ts', skillDir: 'artifact-vault',
      interfaces: ['ArtifactVaultEntry', 'ArtifactVaultConfig', 'ArtifactVaultResult'],
      bk: 'artifact_vault', eks: ['av.entry_created', 'av.config_updated', 'av.export_emitted'],
      subjects: ['sven.av.entry_created', 'sven.av.config_updated', 'sven.av.export_emitted'],
      cases: ['av_storer', 'av_retriever', 'av_reporter'],
    },
    {
      name: 'artifact_vault_monitor', migration: '20260633210000_agent_artifact_vault_monitor.sql',
      typeFile: 'agent-artifact-vault-monitor.ts', skillDir: 'artifact-vault-monitor',
      interfaces: ['ArtifactVaultMonitorCheck', 'ArtifactVaultMonitorConfig', 'ArtifactVaultMonitorResult'],
      bk: 'artifact_vault_monitor', eks: ['avm.check_passed', 'avm.alert_raised', 'avm.export_emitted'],
      subjects: ['sven.avm.check_passed', 'sven.avm.alert_raised', 'sven.avm.export_emitted'],
      cases: ['avm_watcher', 'avm_alerter', 'avm_reporter'],
    },
    {
      name: 'artifact_vault_auditor', migration: '20260633220000_agent_artifact_vault_auditor.sql',
      typeFile: 'agent-artifact-vault-auditor.ts', skillDir: 'artifact-vault-auditor',
      interfaces: ['ArtifactVaultAuditEntry', 'ArtifactVaultAuditConfig', 'ArtifactVaultAuditResult'],
      bk: 'artifact_vault_auditor', eks: ['ava.entry_logged', 'ava.violation_found', 'ava.export_emitted'],
      subjects: ['sven.ava.entry_logged', 'sven.ava.violation_found', 'sven.ava.export_emitted'],
      cases: ['ava_scanner', 'ava_enforcer', 'ava_reporter'],
    },
    {
      name: 'artifact_vault_reporter', migration: '20260633230000_agent_artifact_vault_reporter.sql',
      typeFile: 'agent-artifact-vault-reporter.ts', skillDir: 'artifact-vault-reporter',
      interfaces: ['ArtifactVaultReport', 'ArtifactVaultReportConfig', 'ArtifactVaultReportResult'],
      bk: 'artifact_vault_reporter', eks: ['avr.report_generated', 'avr.insight_found', 'avr.export_emitted'],
      subjects: ['sven.avr.report_generated', 'sven.avr.insight_found', 'sven.avr.export_emitted'],
      cases: ['avr_builder', 'avr_analyst', 'avr_reporter'],
    },
    {
      name: 'artifact_vault_optimizer', migration: '20260633240000_agent_artifact_vault_optimizer.sql',
      typeFile: 'agent-artifact-vault-optimizer.ts', skillDir: 'artifact-vault-optimizer',
      interfaces: ['ArtifactVaultOptPlan', 'ArtifactVaultOptConfig', 'ArtifactVaultOptResult'],
      bk: 'artifact_vault_optimizer', eks: ['avo.plan_created', 'avo.optimization_applied', 'avo.export_emitted'],
      subjects: ['sven.avo.plan_created', 'sven.avo.optimization_applied', 'sven.avo.export_emitted'],
      cases: ['avo_planner', 'avo_executor', 'avo_reporter'],
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
