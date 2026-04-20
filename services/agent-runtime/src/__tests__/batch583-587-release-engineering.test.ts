import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 583-587: Release Engineering', () => {
  const verticals = [
    {
      name: 'version_tagger', migration: '20260622200000_agent_version_tagger.sql',
      typeFile: 'agent-version-tagger.ts', skillDir: 'version-tagger',
      interfaces: ['VersionTaggerConfig', 'TagEvent', 'VersionBump'],
      bk: 'version_tagger', eks: ['vstg.tag_created', 'vstg.bump_calculated', 'vstg.release_tagged', 'vstg.conflict_detected'],
      subjects: ['sven.vstg.tag_created', 'sven.vstg.bump_calculated', 'sven.vstg.release_tagged', 'sven.vstg.conflict_detected'],
      cases: ['vstg_tag', 'vstg_bump', 'vstg_release', 'vstg_conflict', 'vstg_report', 'vstg_monitor'],
    },
    {
      name: 'release_gater', migration: '20260622210000_agent_release_gater.sql',
      typeFile: 'agent-release-gater.ts', skillDir: 'release-gater',
      interfaces: ['ReleaseGaterConfig', 'GateCheck', 'ReleaseDecision'],
      bk: 'release_gater', eks: ['rlgt.gate_checked', 'rlgt.release_approved', 'rlgt.release_blocked', 'rlgt.override_granted'],
      subjects: ['sven.rlgt.gate_checked', 'sven.rlgt.release_approved', 'sven.rlgt.release_blocked', 'sven.rlgt.override_granted'],
      cases: ['rlgt_check', 'rlgt_approve', 'rlgt_block', 'rlgt_override', 'rlgt_report', 'rlgt_monitor'],
    },
    {
      name: 'changelog_compiler', migration: '20260622220000_agent_changelog_compiler.sql',
      typeFile: 'agent-changelog-compiler.ts', skillDir: 'changelog-compiler',
      interfaces: ['ChangelogCompilerConfig', 'ChangeEntry', 'CompiledChangelog'],
      bk: 'changelog_compiler', eks: ['clcm.entries_collected', 'clcm.changelog_compiled', 'clcm.format_validated', 'clcm.publish_triggered'],
      subjects: ['sven.clcm.entries_collected', 'sven.clcm.changelog_compiled', 'sven.clcm.format_validated', 'sven.clcm.publish_triggered'],
      cases: ['clcm_collect', 'clcm_compile', 'clcm_validate', 'clcm_publish', 'clcm_report', 'clcm_monitor'],
    },
    {
      name: 'artifact_signer', migration: '20260622230000_agent_artifact_signer.sql',
      typeFile: 'agent-artifact-signer.ts', skillDir: 'artifact-signer',
      interfaces: ['ArtifactSignerConfig', 'SignatureResult', 'VerificationResult'],
      bk: 'artifact_signer', eks: ['arsg.artifact_signed', 'arsg.signature_verified', 'arsg.key_rotated', 'arsg.verification_failed'],
      subjects: ['sven.arsg.artifact_signed', 'sven.arsg.signature_verified', 'sven.arsg.key_rotated', 'sven.arsg.verification_failed'],
      cases: ['arsg_sign', 'arsg_verify', 'arsg_rotate', 'arsg_fail', 'arsg_report', 'arsg_monitor'],
    },
    {
      name: 'license_auditor', migration: '20260622240000_agent_license_auditor.sql',
      typeFile: 'agent-license-auditor.ts', skillDir: 'license-auditor',
      interfaces: ['LicenseAuditorConfig', 'LicenseScan', 'ComplianceReport'],
      bk: 'license_auditor', eks: ['lcad.scan_completed', 'lcad.violation_found', 'lcad.report_generated', 'lcad.exception_granted'],
      subjects: ['sven.lcad.scan_completed', 'sven.lcad.violation_found', 'sven.lcad.report_generated', 'sven.lcad.exception_granted'],
      cases: ['lcad_scan', 'lcad_violation', 'lcad_generate', 'lcad_exception', 'lcad_report', 'lcad_monitor'],
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
