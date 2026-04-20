import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Access Review verticals', () => {
  const verticals = [
    {
      name: 'access_review', migration: '20260630150000_agent_access_review.sql',
      typeFile: 'agent-access-review.ts', skillDir: 'access-review',
      interfaces: ['AccessReviewEntry', 'AccessReviewConfig', 'AccessReviewResult'],
      bk: 'access_review', eks: ['arv.entry_created', 'arv.config_updated', 'arv.export_emitted'],
      subjects: ['sven.arv.entry_created', 'sven.arv.config_updated', 'sven.arv.export_emitted'],
      cases: ['arv_reviewer', 'arv_enforcer', 'arv_reporter'],
    },
    {
      name: 'access_review_monitor', migration: '20260630160000_agent_access_review_monitor.sql',
      typeFile: 'agent-access-review-monitor.ts', skillDir: 'access-review-monitor',
      interfaces: ['AccessReviewMonitorCheck', 'AccessReviewMonitorConfig', 'AccessReviewMonitorResult'],
      bk: 'access_review_monitor', eks: ['arvm.check_passed', 'arvm.alert_raised', 'arvm.export_emitted'],
      subjects: ['sven.arvm.check_passed', 'sven.arvm.alert_raised', 'sven.arvm.export_emitted'],
      cases: ['arvm_watcher', 'arvm_alerter', 'arvm_reporter'],
    },
    {
      name: 'access_review_auditor', migration: '20260630170000_agent_access_review_auditor.sql',
      typeFile: 'agent-access-review-auditor.ts', skillDir: 'access-review-auditor',
      interfaces: ['AccessReviewAuditEntry', 'AccessReviewAuditConfig', 'AccessReviewAuditResult'],
      bk: 'access_review_auditor', eks: ['arva.entry_logged', 'arva.violation_found', 'arva.export_emitted'],
      subjects: ['sven.arva.entry_logged', 'sven.arva.violation_found', 'sven.arva.export_emitted'],
      cases: ['arva_scanner', 'arva_enforcer', 'arva_reporter'],
    },
    {
      name: 'access_review_reporter', migration: '20260630180000_agent_access_review_reporter.sql',
      typeFile: 'agent-access-review-reporter.ts', skillDir: 'access-review-reporter',
      interfaces: ['AccessReviewReport', 'AccessReviewReportConfig', 'AccessReviewReportResult'],
      bk: 'access_review_reporter', eks: ['arvr.report_generated', 'arvr.insight_found', 'arvr.export_emitted'],
      subjects: ['sven.arvr.report_generated', 'sven.arvr.insight_found', 'sven.arvr.export_emitted'],
      cases: ['arvr_builder', 'arvr_analyst', 'arvr_reporter'],
    },
    {
      name: 'access_review_optimizer', migration: '20260630190000_agent_access_review_optimizer.sql',
      typeFile: 'agent-access-review-optimizer.ts', skillDir: 'access-review-optimizer',
      interfaces: ['AccessReviewOptPlan', 'AccessReviewOptConfig', 'AccessReviewOptResult'],
      bk: 'access_review_optimizer', eks: ['arvo.plan_created', 'arvo.optimization_applied', 'arvo.export_emitted'],
      subjects: ['sven.arvo.plan_created', 'sven.arvo.optimization_applied', 'sven.arvo.export_emitted'],
      cases: ['arvo_planner', 'arvo_executor', 'arvo_reporter'],
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
