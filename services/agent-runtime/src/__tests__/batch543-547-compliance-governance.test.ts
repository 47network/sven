import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 543-547: Compliance & Governance', () => {
  const verticals = [
    {
      name: 'audit_trail_writer', migration: '20260621800000_agent_audit_trail_writer.sql',
      typeFile: 'agent-audit-trail-writer.ts', skillDir: 'audit-trail-writer',
      interfaces: ['AuditTrailWriterConfig', 'AuditEntry', 'TrailPolicy'],
      bk: 'audit_trail_writer', eks: ['atwr.entry_recorded', 'atwr.trail_rotated', 'atwr.tamper_detected', 'atwr.export_completed'],
      subjects: ['sven.atwr.entry_recorded', 'sven.atwr.trail_rotated', 'sven.atwr.tamper_detected', 'sven.atwr.export_completed'],
      cases: ['atwr_record', 'atwr_rotate', 'atwr_detect', 'atwr_export', 'atwr_report', 'atwr_monitor'],
    },
    {
      name: 'governance_auditor', migration: '20260621810000_agent_governance_auditor.sql',
      typeFile: 'agent-governance-auditor.ts', skillDir: 'governance-auditor',
      interfaces: ['GovernanceAuditorConfig', 'GovernanceReport', 'AuditFinding'],
      bk: 'governance_auditor', eks: ['gvad.audit_started', 'gvad.finding_reported', 'gvad.remediation_required', 'gvad.audit_closed'],
      subjects: ['sven.gvad.audit_started', 'sven.gvad.finding_reported', 'sven.gvad.remediation_required', 'sven.gvad.audit_closed'],
      cases: ['gvad_start', 'gvad_find', 'gvad_remediate', 'gvad_close', 'gvad_report', 'gvad_monitor'],
    },
    {
      name: 'regulation_scanner', migration: '20260621820000_agent_regulation_scanner.sql',
      typeFile: 'agent-regulation-scanner.ts', skillDir: 'regulation-scanner',
      interfaces: ['RegulationScannerConfig', 'ScanResult', 'RegulationRule'],
      bk: 'regulation_scanner', eks: ['rgsc.scan_initiated', 'rgsc.violation_found', 'rgsc.scan_completed', 'rgsc.rule_updated'],
      subjects: ['sven.rgsc.scan_initiated', 'sven.rgsc.violation_found', 'sven.rgsc.scan_completed', 'sven.rgsc.rule_updated'],
      cases: ['rgsc_scan', 'rgsc_violate', 'rgsc_complete', 'rgsc_update', 'rgsc_report', 'rgsc_monitor'],
    },
    {
      name: 'consent_manager', migration: '20260621830000_agent_consent_manager.sql',
      typeFile: 'agent-consent-manager.ts', skillDir: 'consent-manager',
      interfaces: ['ConsentManagerConfig', 'ConsentRecord', 'ConsentPreference'],
      bk: 'consent_manager', eks: ['csmg.consent_granted', 'csmg.consent_revoked', 'csmg.preference_updated', 'csmg.audit_requested'],
      subjects: ['sven.csmg.consent_granted', 'sven.csmg.consent_revoked', 'sven.csmg.preference_updated', 'sven.csmg.audit_requested'],
      cases: ['csmg_grant', 'csmg_revoke', 'csmg_update', 'csmg_audit', 'csmg_report', 'csmg_monitor'],
    },
    {
      name: 'retention_scheduler', migration: '20260621840000_agent_retention_scheduler.sql',
      typeFile: 'agent-retention-scheduler.ts', skillDir: 'retention-scheduler',
      interfaces: ['RetentionSchedulerConfig', 'RetentionPolicy', 'PurgeRecord'],
      bk: 'retention_scheduler', eks: ['rtsc.policy_applied', 'rtsc.data_purged', 'rtsc.retention_extended', 'rtsc.schedule_updated'],
      subjects: ['sven.rtsc.policy_applied', 'sven.rtsc.data_purged', 'sven.rtsc.retention_extended', 'sven.rtsc.schedule_updated'],
      cases: ['rtsc_apply', 'rtsc_purge', 'rtsc_extend', 'rtsc_schedule', 'rtsc_report', 'rtsc_monitor'],
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
