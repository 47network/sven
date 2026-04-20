import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1008-1012: Personalization', () => {
  const verticals = [
    {
      name: 'personalization_profile_builder', migration: '20260626450000_agent_personalization_profile_builder.sql',
      typeFile: 'agent-personalization-profile-builder.ts', skillDir: 'personalization-profile-builder',
      interfaces: ['PersonalizationProfileBuilderConfig', 'ProfileBatch', 'BuilderEvent'],
      bk: 'personalization_profile_builder', eks: ['ppbd.batch_received', 'ppbd.signals_aggregated', 'ppbd.profile_persisted', 'ppbd.audit_recorded'],
      subjects: ['sven.ppbd.batch_received', 'sven.ppbd.signals_aggregated', 'sven.ppbd.profile_persisted', 'sven.ppbd.audit_recorded'],
      cases: ['ppbd_receive', 'ppbd_aggregate', 'ppbd_persist', 'ppbd_audit', 'ppbd_report', 'ppbd_monitor'],
    },
    {
      name: 'personalization_segment_resolver', migration: '20260626460000_agent_personalization_segment_resolver.sql',
      typeFile: 'agent-personalization-segment-resolver.ts', skillDir: 'personalization-segment-resolver',
      interfaces: ['PersonalizationSegmentResolverConfig', 'SegmentRequest', 'ResolverEvent'],
      bk: 'personalization_segment_resolver', eks: ['psrr.request_received', 'psrr.profile_loaded', 'psrr.segments_returned', 'psrr.audit_recorded'],
      subjects: ['sven.psrr.request_received', 'sven.psrr.profile_loaded', 'sven.psrr.segments_returned', 'sven.psrr.audit_recorded'],
      cases: ['psrr_receive', 'psrr_load', 'psrr_return', 'psrr_audit', 'psrr_report', 'psrr_monitor'],
    },
    {
      name: 'personalization_content_selector', migration: '20260626470000_agent_personalization_content_selector.sql',
      typeFile: 'agent-personalization-content-selector.ts', skillDir: 'personalization-content-selector',
      interfaces: ['PersonalizationContentSelectorConfig', 'SelectionRequest', 'SelectorEvent'],
      bk: 'personalization_content_selector', eks: ['pcsl.request_received', 'pcsl.candidates_filtered', 'pcsl.content_selected', 'pcsl.audit_recorded'],
      subjects: ['sven.pcsl.request_received', 'sven.pcsl.candidates_filtered', 'sven.pcsl.content_selected', 'sven.pcsl.audit_recorded'],
      cases: ['pcsl_receive', 'pcsl_filter', 'pcsl_select', 'pcsl_audit', 'pcsl_report', 'pcsl_monitor'],
    },
    {
      name: 'personalization_consent_gate', migration: '20260626480000_agent_personalization_consent_gate.sql',
      typeFile: 'agent-personalization-consent-gate.ts', skillDir: 'personalization-consent-gate',
      interfaces: ['PersonalizationConsentGateConfig', 'ConsentCheck', 'GateEvent'],
      bk: 'personalization_consent_gate', eks: ['pcgt.check_received', 'pcgt.consent_evaluated', 'pcgt.decision_returned', 'pcgt.audit_recorded'],
      subjects: ['sven.pcgt.check_received', 'sven.pcgt.consent_evaluated', 'sven.pcgt.decision_returned', 'sven.pcgt.audit_recorded'],
      cases: ['pcgt_receive', 'pcgt_evaluate', 'pcgt_return', 'pcgt_audit', 'pcgt_report', 'pcgt_monitor'],
    },
    {
      name: 'personalization_audit_logger', migration: '20260626490000_agent_personalization_audit_logger.sql',
      typeFile: 'agent-personalization-audit-logger.ts', skillDir: 'personalization-audit-logger',
      interfaces: ['PersonalizationAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'personalization_audit_logger', eks: ['palg.record_received', 'palg.fields_validated', 'palg.record_persisted', 'palg.export_emitted'],
      subjects: ['sven.palg.record_received', 'sven.palg.fields_validated', 'sven.palg.record_persisted', 'sven.palg.export_emitted'],
      cases: ['palg_receive', 'palg_validate', 'palg_persist', 'palg_emit', 'palg_report', 'palg_monitor'],
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
