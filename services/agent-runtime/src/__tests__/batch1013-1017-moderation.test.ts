import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1013-1017: Content Moderation', () => {
  const verticals = [
    {
      name: 'moderation_text_classifier', migration: '20260626500000_agent_moderation_text_classifier.sql',
      typeFile: 'agent-moderation-text-classifier.ts', skillDir: 'moderation-text-classifier',
      interfaces: ['ModerationTextClassifierConfig', 'TextItem', 'ClassifierEvent'],
      bk: 'moderation_text_classifier', eks: ['mtcf.item_received', 'mtcf.classified', 'mtcf.decision_emitted', 'mtcf.audit_recorded'],
      subjects: ['sven.mtcf.item_received', 'sven.mtcf.classified', 'sven.mtcf.decision_emitted', 'sven.mtcf.audit_recorded'],
      cases: ['mtcf_receive', 'mtcf_classify', 'mtcf_emit', 'mtcf_audit', 'mtcf_report', 'mtcf_monitor'],
    },
    {
      name: 'moderation_image_screener', migration: '20260626510000_agent_moderation_image_screener.sql',
      typeFile: 'agent-moderation-image-screener.ts', skillDir: 'moderation-image-screener',
      interfaces: ['ModerationImageScreenerConfig', 'ImageItem', 'ScreenerEvent'],
      bk: 'moderation_image_screener', eks: ['misc.item_received', 'misc.screened', 'misc.decision_emitted', 'misc.audit_recorded'],
      subjects: ['sven.misc.item_received', 'sven.misc.screened', 'sven.misc.decision_emitted', 'sven.misc.audit_recorded'],
      cases: ['misc_receive', 'misc_screen', 'misc_emit', 'misc_audit', 'misc_report', 'misc_monitor'],
    },
    {
      name: 'moderation_appeal_router', migration: '20260626520000_agent_moderation_appeal_router.sql',
      typeFile: 'agent-moderation-appeal-router.ts', skillDir: 'moderation-appeal-router',
      interfaces: ['ModerationAppealRouterConfig', 'AppealRequest', 'RouterEvent'],
      bk: 'moderation_appeal_router', eks: ['marr.request_received', 'marr.queue_resolved', 'marr.appeal_routed', 'marr.audit_recorded'],
      subjects: ['sven.marr.request_received', 'sven.marr.queue_resolved', 'sven.marr.appeal_routed', 'sven.marr.audit_recorded'],
      cases: ['marr_receive', 'marr_resolve', 'marr_route', 'marr_audit', 'marr_report', 'marr_monitor'],
    },
    {
      name: 'moderation_decision_logger', migration: '20260626530000_agent_moderation_decision_logger.sql',
      typeFile: 'agent-moderation-decision-logger.ts', skillDir: 'moderation-decision-logger',
      interfaces: ['ModerationDecisionLoggerConfig', 'DecisionRecord', 'LoggerEvent'],
      bk: 'moderation_decision_logger', eks: ['mdlg.record_received', 'mdlg.fields_validated', 'mdlg.decision_persisted', 'mdlg.export_emitted'],
      subjects: ['sven.mdlg.record_received', 'sven.mdlg.fields_validated', 'sven.mdlg.decision_persisted', 'sven.mdlg.export_emitted'],
      cases: ['mdlg_receive', 'mdlg_validate', 'mdlg_persist', 'mdlg_emit', 'mdlg_report', 'mdlg_monitor'],
    },
    {
      name: 'moderation_policy_updater', migration: '20260626540000_agent_moderation_policy_updater.sql',
      typeFile: 'agent-moderation-policy-updater.ts', skillDir: 'moderation-policy-updater',
      interfaces: ['ModerationPolicyUpdaterConfig', 'PolicyUpdate', 'UpdaterEvent'],
      bk: 'moderation_policy_updater', eks: ['mpud.update_received', 'mpud.policy_validated', 'mpud.policy_published', 'mpud.audit_recorded'],
      subjects: ['sven.mpud.update_received', 'sven.mpud.policy_validated', 'sven.mpud.policy_published', 'sven.mpud.audit_recorded'],
      cases: ['mpud_receive', 'mpud_validate', 'mpud_publish', 'mpud_audit', 'mpud_report', 'mpud_monitor'],
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
