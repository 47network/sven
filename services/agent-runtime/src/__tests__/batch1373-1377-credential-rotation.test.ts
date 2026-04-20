import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Credential Rotation verticals', () => {
  const verticals = [
    {
      name: 'credential_rotation', migration: '20260630100000_agent_credential_rotation.sql',
      typeFile: 'agent-credential-rotation.ts', skillDir: 'credential-rotation',
      interfaces: ['CredentialRotationEntry', 'CredentialRotationConfig', 'CredentialRotationResult'],
      bk: 'credential_rotation', eks: ['cr.entry_created', 'cr.config_updated', 'cr.export_emitted'],
      subjects: ['sven.cr.entry_created', 'sven.cr.config_updated', 'sven.cr.export_emitted'],
      cases: ['cr_rotator', 'cr_validator', 'cr_reporter'],
    },
    {
      name: 'credential_rotation_monitor', migration: '20260630110000_agent_credential_rotation_monitor.sql',
      typeFile: 'agent-credential-rotation-monitor.ts', skillDir: 'credential-rotation-monitor',
      interfaces: ['CredentialRotationMonitorCheck', 'CredentialRotationMonitorConfig', 'CredentialRotationMonitorResult'],
      bk: 'credential_rotation_monitor', eks: ['crm.check_passed', 'crm.alert_raised', 'crm.export_emitted'],
      subjects: ['sven.crm.check_passed', 'sven.crm.alert_raised', 'sven.crm.export_emitted'],
      cases: ['crm_watcher', 'crm_alerter', 'crm_reporter'],
    },
    {
      name: 'credential_rotation_auditor', migration: '20260630120000_agent_credential_rotation_auditor.sql',
      typeFile: 'agent-credential-rotation-auditor.ts', skillDir: 'credential-rotation-auditor',
      interfaces: ['CredentialRotationAuditEntry', 'CredentialRotationAuditConfig', 'CredentialRotationAuditResult'],
      bk: 'credential_rotation_auditor', eks: ['cra.entry_logged', 'cra.violation_found', 'cra.export_emitted'],
      subjects: ['sven.cra.entry_logged', 'sven.cra.violation_found', 'sven.cra.export_emitted'],
      cases: ['cra_scanner', 'cra_enforcer', 'cra_reporter'],
    },
    {
      name: 'credential_rotation_reporter', migration: '20260630130000_agent_credential_rotation_reporter.sql',
      typeFile: 'agent-credential-rotation-reporter.ts', skillDir: 'credential-rotation-reporter',
      interfaces: ['CredentialRotationReport', 'CredentialRotationReportConfig', 'CredentialRotationReportResult'],
      bk: 'credential_rotation_reporter', eks: ['crr.report_generated', 'crr.insight_found', 'crr.export_emitted'],
      subjects: ['sven.crr.report_generated', 'sven.crr.insight_found', 'sven.crr.export_emitted'],
      cases: ['crr_builder', 'crr_analyst', 'crr_reporter'],
    },
    {
      name: 'credential_rotation_optimizer', migration: '20260630140000_agent_credential_rotation_optimizer.sql',
      typeFile: 'agent-credential-rotation-optimizer.ts', skillDir: 'credential-rotation-optimizer',
      interfaces: ['CredentialRotationOptPlan', 'CredentialRotationOptConfig', 'CredentialRotationOptResult'],
      bk: 'credential_rotation_optimizer', eks: ['cro.plan_created', 'cro.optimization_applied', 'cro.export_emitted'],
      subjects: ['sven.cro.plan_created', 'sven.cro.optimization_applied', 'sven.cro.export_emitted'],
      cases: ['cro_planner', 'cro_executor', 'cro_reporter'],
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
