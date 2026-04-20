import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 663-667: Compliance & Audit', () => {
  const verticals = [
    {
      name: 'regulation_tracker', migration: '20260623000000_agent_regulation_tracker.sql',
      typeFile: 'agent-regulation-tracker.ts', skillDir: 'regulation-tracker',
      interfaces: ['RegulationTrackerConfig', 'RegulatoryUpdate', 'TrackerEvent'],
      bk: 'regulation_tracker', eks: ['rgtr.regulation_detected', 'rgtr.deadline_approaching', 'rgtr.compliance_gap_found', 'rgtr.update_applied'],
      subjects: ['sven.rgtr.regulation_detected', 'sven.rgtr.deadline_approaching', 'sven.rgtr.compliance_gap_found', 'sven.rgtr.update_applied'],
      cases: ['rgtr_detect', 'rgtr_deadline', 'rgtr_gap', 'rgtr_update', 'rgtr_report', 'rgtr_monitor'],
    },
    {
      name: 'gdpr_validator', migration: '20260623010000_agent_gdpr_validator.sql',
      typeFile: 'agent-gdpr-validator.ts', skillDir: 'gdpr-validator',
      interfaces: ['GdprValidatorConfig', 'ValidationResult', 'ValidatorEvent'],
      bk: 'gdpr_validator', eks: ['gdpv.data_mapped', 'gdpv.consent_verified', 'gdpv.breach_detected', 'gdpv.erasure_completed'],
      subjects: ['sven.gdpv.data_mapped', 'sven.gdpv.consent_verified', 'sven.gdpv.breach_detected', 'sven.gdpv.erasure_completed'],
      cases: ['gdpv_map', 'gdpv_consent', 'gdpv_breach', 'gdpv_erasure', 'gdpv_report', 'gdpv_monitor'],
    },
    {
      name: 'sox_auditor', migration: '20260623020000_agent_sox_auditor.sql',
      typeFile: 'agent-sox-auditor.ts', skillDir: 'sox-auditor',
      interfaces: ['SoxAuditorConfig', 'AuditFinding', 'AuditorEvent'],
      bk: 'sox_auditor', eks: ['soxa.control_tested', 'soxa.deficiency_found', 'soxa.evidence_collected', 'soxa.report_generated'],
      subjects: ['sven.soxa.control_tested', 'sven.soxa.deficiency_found', 'sven.soxa.evidence_collected', 'sven.soxa.report_generated'],
      cases: ['soxa_test', 'soxa_deficiency', 'soxa_evidence', 'soxa_generate', 'soxa_report', 'soxa_monitor'],
    },
    {
      name: 'data_retention_officer', migration: '20260623030000_agent_data_retention_officer.sql',
      typeFile: 'agent-data-retention-officer.ts', skillDir: 'data-retention-officer',
      interfaces: ['DataRetentionOfficerConfig', 'RetentionPolicy', 'OfficerEvent'],
      bk: 'data_retention_officer', eks: ['drof.policy_applied', 'drof.data_purged', 'drof.hold_placed', 'drof.exception_granted'],
      subjects: ['sven.drof.policy_applied', 'sven.drof.data_purged', 'sven.drof.hold_placed', 'sven.drof.exception_granted'],
      cases: ['drof_apply', 'drof_purge', 'drof_hold', 'drof_exception', 'drof_report', 'drof_monitor'],
    },
    {
      name: 'pci_checker', migration: '20260623040000_agent_pci_checker.sql',
      typeFile: 'agent-pci-checker.ts', skillDir: 'pci-checker',
      interfaces: ['PciCheckerConfig', 'ComplianceCheck', 'CheckerEvent'],
      bk: 'pci_checker', eks: ['pcic.scan_completed', 'pcic.vulnerability_found', 'pcic.remediation_verified', 'pcic.certification_updated'],
      subjects: ['sven.pcic.scan_completed', 'sven.pcic.vulnerability_found', 'sven.pcic.remediation_verified', 'sven.pcic.certification_updated'],
      cases: ['pcic_scan', 'pcic_vulnerability', 'pcic_remediate', 'pcic_certify', 'pcic_report', 'pcic_monitor'],
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
