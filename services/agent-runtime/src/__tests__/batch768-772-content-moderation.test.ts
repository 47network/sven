import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 768-772: Content Moderation & Trust', () => {
  const verticals = [
    {
      name: 'content_moderation_pipeline', migration: '20260624050000_agent_content_moderation_pipeline.sql',
      typeFile: 'agent-content-moderation-pipeline.ts', skillDir: 'content-moderation-pipeline',
      interfaces: ['ContentModerationPipelineConfig', 'ModerationCase', 'PipelineEvent'],
      bk: 'content_moderation_pipeline', eks: ['cmpl.case_received', 'cmpl.policy_evaluated', 'cmpl.action_decided', 'cmpl.appeal_routed'],
      subjects: ['sven.cmpl.case_received', 'sven.cmpl.policy_evaluated', 'sven.cmpl.action_decided', 'sven.cmpl.appeal_routed'],
      cases: ['cmpl_receive', 'cmpl_evaluate', 'cmpl_decide', 'cmpl_route', 'cmpl_report', 'cmpl_monitor'],
    },
    {
      name: 'image_classifier', migration: '20260624060000_agent_image_classifier.sql',
      typeFile: 'agent-image-classifier.ts', skillDir: 'image-classifier',
      interfaces: ['ImageClassifierConfig', 'ImageClassification', 'ClassifierEvent'],
      bk: 'image_classifier', eks: ['imcl.image_received', 'imcl.features_extracted', 'imcl.label_assigned', 'imcl.confidence_scored'],
      subjects: ['sven.imcl.image_received', 'sven.imcl.features_extracted', 'sven.imcl.label_assigned', 'sven.imcl.confidence_scored'],
      cases: ['imcl_receive', 'imcl_extract', 'imcl_assign', 'imcl_score', 'imcl_report', 'imcl_monitor'],
    },
    {
      name: 'toxicity_detector', migration: '20260624070000_agent_toxicity_detector.sql',
      typeFile: 'agent-toxicity-detector.ts', skillDir: 'toxicity-detector',
      interfaces: ['ToxicityDetectorConfig', 'ToxicityVerdict', 'DetectorEvent'],
      bk: 'toxicity_detector', eks: ['toxd.text_analyzed', 'toxd.score_computed', 'toxd.threshold_crossed', 'toxd.action_recommended'],
      subjects: ['sven.toxd.text_analyzed', 'sven.toxd.score_computed', 'sven.toxd.threshold_crossed', 'sven.toxd.action_recommended'],
      cases: ['toxd_analyze', 'toxd_compute', 'toxd_cross', 'toxd_recommend', 'toxd_report', 'toxd_monitor'],
    },
    {
      name: 'spam_filter_engine', migration: '20260624080000_agent_spam_filter_engine.sql',
      typeFile: 'agent-spam-filter-engine.ts', skillDir: 'spam-filter-engine',
      interfaces: ['SpamFilterEngineConfig', 'SpamVerdict', 'EngineEvent'],
      bk: 'spam_filter_engine', eks: ['spfe.message_scanned', 'spfe.spam_classified', 'spfe.sender_reputation_updated', 'spfe.feedback_processed'],
      subjects: ['sven.spfe.message_scanned', 'sven.spfe.spam_classified', 'sven.spfe.sender_reputation_updated', 'sven.spfe.feedback_processed'],
      cases: ['spfe_scan', 'spfe_classify', 'spfe_update', 'spfe_process', 'spfe_report', 'spfe_monitor'],
    },
    {
      name: 'pii_redactor', migration: '20260624090000_agent_pii_redactor.sql',
      typeFile: 'agent-pii-redactor.ts', skillDir: 'pii-redactor',
      interfaces: ['PiiRedactorConfig', 'RedactionJob', 'RedactorEvent'],
      bk: 'pii_redactor', eks: ['piir.payload_scanned', 'piir.pii_detected', 'piir.field_redacted', 'piir.audit_recorded'],
      subjects: ['sven.piir.payload_scanned', 'sven.piir.pii_detected', 'sven.piir.field_redacted', 'sven.piir.audit_recorded'],
      cases: ['piir_scan', 'piir_detect', 'piir_redact', 'piir_record', 'piir_report', 'piir_monitor'],
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
