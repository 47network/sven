import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1088-1092: Patch Management', () => {
  const verticals = [
    {
      name: 'patch_inventory_loader', migration: '20260627250000_agent_patch_inventory_loader.sql',
      typeFile: 'agent-patch-inventory-loader.ts', skillDir: 'patch-inventory-loader',
      interfaces: ['PatchInventoryLoaderConfig', 'LoadRequest', 'LoaderEvent'],
      bk: 'patch_inventory_loader', eks: ['pinl.request_received', 'pinl.inventory_loaded', 'pinl.summary_emitted', 'pinl.audit_recorded'],
      subjects: ['sven.pinl.request_received', 'sven.pinl.inventory_loaded', 'sven.pinl.summary_emitted', 'sven.pinl.audit_recorded'],
      cases: ['pinl_receive', 'pinl_load', 'pinl_emit', 'pinl_audit', 'pinl_report', 'pinl_monitor'],
    },
    {
      name: 'patch_applicability_evaluator', migration: '20260627260000_agent_patch_applicability_evaluator.sql',
      typeFile: 'agent-patch-applicability-evaluator.ts', skillDir: 'patch-applicability-evaluator',
      interfaces: ['PatchApplicabilityEvaluatorConfig', 'EvalRequest', 'EvaluatorEvent'],
      bk: 'patch_applicability_evaluator', eks: ['pape.request_received', 'pape.applicability_evaluated', 'pape.results_emitted', 'pape.audit_recorded'],
      subjects: ['sven.pape.request_received', 'sven.pape.applicability_evaluated', 'sven.pape.results_emitted', 'sven.pape.audit_recorded'],
      cases: ['pape_receive', 'pape_evaluate', 'pape_emit', 'pape_audit', 'pape_report', 'pape_monitor'],
    },
    {
      name: 'patch_rollout_dispatcher', migration: '20260627270000_agent_patch_rollout_dispatcher.sql',
      typeFile: 'agent-patch-rollout-dispatcher.ts', skillDir: 'patch-rollout-dispatcher',
      interfaces: ['PatchRolloutDispatcherConfig', 'RolloutRequest', 'DispatcherEvent'],
      bk: 'patch_rollout_dispatcher', eks: ['prdi.request_received', 'prdi.policy_evaluated', 'prdi.rollout_dispatched', 'prdi.audit_recorded'],
      subjects: ['sven.prdi.request_received', 'sven.prdi.policy_evaluated', 'sven.prdi.rollout_dispatched', 'sven.prdi.audit_recorded'],
      cases: ['prdi_receive', 'prdi_evaluate', 'prdi_dispatch', 'prdi_audit', 'prdi_report', 'prdi_monitor'],
    },
    {
      name: 'patch_verification_recorder', migration: '20260627280000_agent_patch_verification_recorder.sql',
      typeFile: 'agent-patch-verification-recorder.ts', skillDir: 'patch-verification-recorder',
      interfaces: ['PatchVerificationRecorderConfig', 'VerifyRecord', 'RecorderEvent'],
      bk: 'patch_verification_recorder', eks: ['pvre.record_received', 'pvre.fields_validated', 'pvre.verification_persisted', 'pvre.audit_recorded'],
      subjects: ['sven.pvre.record_received', 'sven.pvre.fields_validated', 'sven.pvre.verification_persisted', 'sven.pvre.audit_recorded'],
      cases: ['pvre_receive', 'pvre_validate', 'pvre_persist', 'pvre_audit', 'pvre_report', 'pvre_monitor'],
    },
    {
      name: 'patch_audit_logger', migration: '20260627290000_agent_patch_audit_logger.sql',
      typeFile: 'agent-patch-audit-logger.ts', skillDir: 'patch-audit-logger',
      interfaces: ['PatchAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'patch_audit_logger', eks: ['ptau.record_received', 'ptau.fields_validated', 'ptau.record_persisted', 'ptau.export_emitted'],
      subjects: ['sven.ptau.record_received', 'sven.ptau.fields_validated', 'sven.ptau.record_persisted', 'sven.ptau.export_emitted'],
      cases: ['ptau_receive', 'ptau_validate', 'ptau_persist', 'ptau_emit', 'ptau_report', 'ptau_monitor'],
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
