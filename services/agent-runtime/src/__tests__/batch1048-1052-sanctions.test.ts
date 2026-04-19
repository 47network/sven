import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1048-1052: Sanctions Screening', () => {
  const verticals = [
    {
      name: 'sanctions_list_loader', migration: '20260626850000_agent_sanctions_list_loader.sql',
      typeFile: 'agent-sanctions-list-loader.ts', skillDir: 'sanctions-list-loader',
      interfaces: ['SanctionsListLoaderConfig', 'ListBundle', 'LoaderEvent'],
      bk: 'sanctions_list_loader', eks: ['snll.bundle_received', 'snll.list_validated', 'snll.bundle_published', 'snll.audit_recorded'],
      subjects: ['sven.snll.bundle_received', 'sven.snll.list_validated', 'sven.snll.bundle_published', 'sven.snll.audit_recorded'],
      cases: ['snll_receive', 'snll_validate', 'snll_publish', 'snll_audit', 'snll_report', 'snll_monitor'],
    },
    {
      name: 'sanctions_name_screener', migration: '20260626860000_agent_sanctions_name_screener.sql',
      typeFile: 'agent-sanctions-name-screener.ts', skillDir: 'sanctions-name-screener',
      interfaces: ['SanctionsNameScreenerConfig', 'ScreenRequest', 'ScreenerEvent'],
      bk: 'sanctions_name_screener', eks: ['snns.request_received', 'snns.list_loaded', 'snns.matches_emitted', 'snns.audit_recorded'],
      subjects: ['sven.snns.request_received', 'sven.snns.list_loaded', 'sven.snns.matches_emitted', 'sven.snns.audit_recorded'],
      cases: ['snns_receive', 'snns_load', 'snns_emit', 'snns_audit', 'snns_report', 'snns_monitor'],
    },
    {
      name: 'sanctions_match_resolver', migration: '20260626870000_agent_sanctions_match_resolver.sql',
      typeFile: 'agent-sanctions-match-resolver.ts', skillDir: 'sanctions-match-resolver',
      interfaces: ['SanctionsMatchResolverConfig', 'MatchReview', 'ResolverEvent'],
      bk: 'sanctions_match_resolver', eks: ['snmr.review_received', 'snmr.match_resolved', 'snmr.decision_emitted', 'snmr.audit_recorded'],
      subjects: ['sven.snmr.review_received', 'sven.snmr.match_resolved', 'sven.snmr.decision_emitted', 'sven.snmr.audit_recorded'],
      cases: ['snmr_receive', 'snmr_resolve', 'snmr_emit', 'snmr_audit', 'snmr_report', 'snmr_monitor'],
    },
    {
      name: 'sanctions_decision_recorder', migration: '20260626880000_agent_sanctions_decision_recorder.sql',
      typeFile: 'agent-sanctions-decision-recorder.ts', skillDir: 'sanctions-decision-recorder',
      interfaces: ['SanctionsDecisionRecorderConfig', 'DecisionRecord', 'RecorderEvent'],
      bk: 'sanctions_decision_recorder', eks: ['sndr.record_received', 'sndr.fields_validated', 'sndr.decision_persisted', 'sndr.audit_recorded'],
      subjects: ['sven.sndr.record_received', 'sven.sndr.fields_validated', 'sven.sndr.decision_persisted', 'sven.sndr.audit_recorded'],
      cases: ['sndr_receive', 'sndr_validate', 'sndr_persist', 'sndr_audit', 'sndr_report', 'sndr_monitor'],
    },
    {
      name: 'sanctions_audit_logger', migration: '20260626890000_agent_sanctions_audit_logger.sql',
      typeFile: 'agent-sanctions-audit-logger.ts', skillDir: 'sanctions-audit-logger',
      interfaces: ['SanctionsAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'sanctions_audit_logger', eks: ['snau.record_received', 'snau.fields_validated', 'snau.record_persisted', 'snau.export_emitted'],
      subjects: ['sven.snau.record_received', 'sven.snau.fields_validated', 'sven.snau.record_persisted', 'sven.snau.export_emitted'],
      cases: ['snau_receive', 'snau_validate', 'snau_persist', 'snau_emit', 'snau_report', 'snau_monitor'],
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
