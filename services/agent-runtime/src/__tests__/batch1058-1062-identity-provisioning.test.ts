import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1058-1062: Identity Provisioning', () => {
  const verticals = [
    {
      name: 'identity_provisioning_creator', migration: '20260626950000_agent_identity_provisioning_creator.sql',
      typeFile: 'agent-identity-provisioning-creator.ts', skillDir: 'identity-provisioning-creator',
      interfaces: ['IdentityProvisioningCreatorConfig', 'CreateRequest', 'CreatorEvent'],
      bk: 'identity_provisioning_creator', eks: ['ipcr.request_received', 'ipcr.fields_validated', 'ipcr.identity_created', 'ipcr.audit_recorded'],
      subjects: ['sven.ipcr.request_received', 'sven.ipcr.fields_validated', 'sven.ipcr.identity_created', 'sven.ipcr.audit_recorded'],
      cases: ['ipcr_receive', 'ipcr_validate', 'ipcr_create', 'ipcr_audit', 'ipcr_report', 'ipcr_monitor'],
    },
    {
      name: 'identity_provisioning_updater', migration: '20260626960000_agent_identity_provisioning_updater.sql',
      typeFile: 'agent-identity-provisioning-updater.ts', skillDir: 'identity-provisioning-updater',
      interfaces: ['IdentityProvisioningUpdaterConfig', 'UpdateRequest', 'UpdaterEvent'],
      bk: 'identity_provisioning_updater', eks: ['ipud.request_received', 'ipud.fields_validated', 'ipud.identity_updated', 'ipud.audit_recorded'],
      subjects: ['sven.ipud.request_received', 'sven.ipud.fields_validated', 'sven.ipud.identity_updated', 'sven.ipud.audit_recorded'],
      cases: ['ipud_receive', 'ipud_validate', 'ipud_update', 'ipud_audit', 'ipud_report', 'ipud_monitor'],
    },
    {
      name: 'identity_provisioning_deactivator', migration: '20260626970000_agent_identity_provisioning_deactivator.sql',
      typeFile: 'agent-identity-provisioning-deactivator.ts', skillDir: 'identity-provisioning-deactivator',
      interfaces: ['IdentityProvisioningDeactivatorConfig', 'DeactivateRequest', 'DeactivatorEvent'],
      bk: 'identity_provisioning_deactivator', eks: ['ipde.request_received', 'ipde.policy_evaluated', 'ipde.identity_deactivated', 'ipde.audit_recorded'],
      subjects: ['sven.ipde.request_received', 'sven.ipde.policy_evaluated', 'sven.ipde.identity_deactivated', 'sven.ipde.audit_recorded'],
      cases: ['ipde_receive', 'ipde_evaluate', 'ipde_deactivate', 'ipde_audit', 'ipde_report', 'ipde_monitor'],
    },
    {
      name: 'identity_provisioning_recertifier', migration: '20260626980000_agent_identity_provisioning_recertifier.sql',
      typeFile: 'agent-identity-provisioning-recertifier.ts', skillDir: 'identity-provisioning-recertifier',
      interfaces: ['IdentityProvisioningRecertifierConfig', 'RecertRequest', 'RecertifierEvent'],
      bk: 'identity_provisioning_recertifier', eks: ['iprc.request_received', 'iprc.entitlements_loaded', 'iprc.recertification_recorded', 'iprc.audit_recorded'],
      subjects: ['sven.iprc.request_received', 'sven.iprc.entitlements_loaded', 'sven.iprc.recertification_recorded', 'sven.iprc.audit_recorded'],
      cases: ['iprc_receive', 'iprc_load', 'iprc_record', 'iprc_audit', 'iprc_report', 'iprc_monitor'],
    },
    {
      name: 'identity_provisioning_audit_logger', migration: '20260626990000_agent_identity_provisioning_audit_logger.sql',
      typeFile: 'agent-identity-provisioning-audit-logger.ts', skillDir: 'identity-provisioning-audit-logger',
      interfaces: ['IdentityProvisioningAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'identity_provisioning_audit_logger', eks: ['ipau.record_received', 'ipau.fields_validated', 'ipau.record_persisted', 'ipau.export_emitted'],
      subjects: ['sven.ipau.record_received', 'sven.ipau.fields_validated', 'sven.ipau.record_persisted', 'sven.ipau.export_emitted'],
      cases: ['ipau_receive', 'ipau_validate', 'ipau_persist', 'ipau_emit', 'ipau_report', 'ipau_monitor'],
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
