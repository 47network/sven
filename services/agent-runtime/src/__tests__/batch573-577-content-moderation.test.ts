import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 573-577: Content Moderation & Safety', () => {
  const verticals = [
    {
      name: 'toxicity_scanner', migration: '20260622100000_agent_toxicity_scanner.sql',
      typeFile: 'agent-toxicity-scanner.ts', skillDir: 'toxicity-scanner',
      interfaces: ['ToxicityScannerConfig', 'ToxicityResult', 'ContentSample'],
      bk: 'toxicity_scanner', eks: ['txsc.scan_completed', 'txsc.toxic_detected', 'txsc.content_cleared', 'txsc.escalation_triggered'],
      subjects: ['sven.txsc.scan_completed', 'sven.txsc.toxic_detected', 'sven.txsc.content_cleared', 'sven.txsc.escalation_triggered'],
      cases: ['txsc_scan', 'txsc_detect', 'txsc_clear', 'txsc_escalate', 'txsc_report', 'txsc_monitor'],
    },
    {
      name: 'spam_classifier', migration: '20260622110000_agent_spam_classifier.sql',
      typeFile: 'agent-spam-classifier.ts', skillDir: 'spam-classifier',
      interfaces: ['SpamClassifierConfig', 'ClassificationResult', 'SpamSignal'],
      bk: 'spam_classifier', eks: ['spmc.classification_done', 'spmc.spam_detected', 'spmc.false_positive', 'spmc.model_updated'],
      subjects: ['sven.spmc.classification_done', 'sven.spmc.spam_detected', 'sven.spmc.false_positive', 'sven.spmc.model_updated'],
      cases: ['spmc_classify', 'spmc_detect', 'spmc_falsepos', 'spmc_update', 'spmc_report', 'spmc_monitor'],
    },
    {
      name: 'nsfw_detector', migration: '20260622120000_agent_nsfw_detector.sql',
      typeFile: 'agent-nsfw-detector.ts', skillDir: 'nsfw-detector',
      interfaces: ['NsfwDetectorConfig', 'DetectionResult', 'MediaScan'],
      bk: 'nsfw_detector', eks: ['nsfw.scan_completed', 'nsfw.content_flagged', 'nsfw.content_approved', 'nsfw.review_requested'],
      subjects: ['sven.nsfw.scan_completed', 'sven.nsfw.content_flagged', 'sven.nsfw.content_approved', 'sven.nsfw.review_requested'],
      cases: ['nsfw_scan', 'nsfw_flag', 'nsfw_approve', 'nsfw_review', 'nsfw_report', 'nsfw_monitor'],
    },
    {
      name: 'bias_auditor', migration: '20260622130000_agent_bias_auditor.sql',
      typeFile: 'agent-bias-auditor.ts', skillDir: 'bias-auditor',
      interfaces: ['BiasAuditorConfig', 'AuditResult', 'BiasMetric'],
      bk: 'bias_auditor', eks: ['bsad.audit_completed', 'bsad.bias_detected', 'bsad.mitigation_suggested', 'bsad.compliance_verified'],
      subjects: ['sven.bsad.audit_completed', 'sven.bsad.bias_detected', 'sven.bsad.mitigation_suggested', 'sven.bsad.compliance_verified'],
      cases: ['bsad_audit', 'bsad_detect', 'bsad_mitigate', 'bsad_verify', 'bsad_report', 'bsad_monitor'],
    },
    {
      name: 'content_fingerprinter', migration: '20260622140000_agent_content_fingerprinter.sql',
      typeFile: 'agent-content-fingerprinter.ts', skillDir: 'content-fingerprinter',
      interfaces: ['ContentFingerprinterConfig', 'Fingerprint', 'DuplicateMatch'],
      bk: 'content_fingerprinter', eks: ['cfpr.fingerprint_created', 'cfpr.duplicate_found', 'cfpr.near_match_detected', 'cfpr.index_updated'],
      subjects: ['sven.cfpr.fingerprint_created', 'sven.cfpr.duplicate_found', 'sven.cfpr.near_match_detected', 'sven.cfpr.index_updated'],
      cases: ['cfpr_fingerprint', 'cfpr_duplicate', 'cfpr_nearmatch', 'cfpr_index', 'cfpr_report', 'cfpr_monitor'],
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
