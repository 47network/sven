import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 623-627: Data Governance', () => {
  const verticals = [
    {
      name: 'schema_linter', migration: '20260622600000_agent_schema_linter.sql',
      typeFile: 'agent-schema-linter.ts', skillDir: 'schema-linter',
      interfaces: ['SchemaLinterConfig', 'LintResult', 'LinterEvent'],
      bk: 'schema_linter', eks: ['sclr.schema_linted', 'sclr.violation_found', 'sclr.rule_updated', 'sclr.baseline_set'],
      subjects: ['sven.sclr.schema_linted', 'sven.sclr.violation_found', 'sven.sclr.rule_updated', 'sven.sclr.baseline_set'],
      cases: ['sclr_lint', 'sclr_violation', 'sclr_rule', 'sclr_baseline', 'sclr_report', 'sclr_monitor'],
    },
    {
      name: 'quality_scorer', migration: '20260622610000_agent_quality_scorer.sql',
      typeFile: 'agent-quality-scorer.ts', skillDir: 'quality-scorer',
      interfaces: ['QualityScorerConfig', 'ScoreCard', 'ScoringEvent'],
      bk: 'quality_scorer', eks: ['qlsc.score_computed', 'qlsc.threshold_breached', 'qlsc.trend_detected', 'qlsc.grade_assigned'],
      subjects: ['sven.qlsc.score_computed', 'sven.qlsc.threshold_breached', 'sven.qlsc.trend_detected', 'sven.qlsc.grade_assigned'],
      cases: ['qlsc_compute', 'qlsc_breach', 'qlsc_trend', 'qlsc_grade', 'qlsc_report', 'qlsc_monitor'],
    },
    {
      name: 'retention_enforcer', migration: '20260622620000_agent_retention_enforcer.sql',
      typeFile: 'agent-retention-enforcer.ts', skillDir: 'retention-enforcer',
      interfaces: ['RetentionEnforcerConfig', 'RetentionPolicy', 'EnforcerEvent'],
      bk: 'retention_enforcer', eks: ['rten.policy_applied', 'rten.data_purged', 'rten.exception_granted', 'rten.compliance_verified'],
      subjects: ['sven.rten.policy_applied', 'sven.rten.data_purged', 'sven.rten.exception_granted', 'sven.rten.compliance_verified'],
      cases: ['rten_apply', 'rten_purge', 'rten_exception', 'rten_verify', 'rten_report', 'rten_monitor'],
    },
    {
      name: 'column_profiler', migration: '20260622630000_agent_column_profiler.sql',
      typeFile: 'agent-column-profiler.ts', skillDir: 'column-profiler',
      interfaces: ['ColumnProfilerConfig', 'ColumnProfile', 'ProfileEvent'],
      bk: 'column_profiler', eks: ['clpr.profile_computed', 'clpr.anomaly_detected', 'clpr.distribution_shifted', 'clpr.cardinality_changed'],
      subjects: ['sven.clpr.profile_computed', 'sven.clpr.anomaly_detected', 'sven.clpr.distribution_shifted', 'sven.clpr.cardinality_changed'],
      cases: ['clpr_compute', 'clpr_anomaly', 'clpr_shift', 'clpr_cardinality', 'clpr_report', 'clpr_monitor'],
    },
    {
      name: 'pii_scanner', migration: '20260622640000_agent_pii_scanner.sql',
      typeFile: 'agent-pii-scanner.ts', skillDir: 'pii-scanner',
      interfaces: ['PiiScannerConfig', 'PiiMatch', 'ScanEvent'],
      bk: 'pii_scanner', eks: ['piis.pii_detected', 'piis.scan_completed', 'piis.classification_updated', 'piis.redaction_applied'],
      subjects: ['sven.piis.pii_detected', 'sven.piis.scan_completed', 'sven.piis.classification_updated', 'sven.piis.redaction_applied'],
      cases: ['piis_detect', 'piis_complete', 'piis_classify', 'piis_redact', 'piis_report', 'piis_monitor'],
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
