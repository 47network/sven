import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('API Spec Builder verticals', () => {
  const verticals = [
    {
      name: 'api_spec_builder', migration: '20260633900000_agent_api_spec_builder.sql',
      typeFile: 'agent-api-spec-builder.ts', skillDir: 'api-spec-builder',
      interfaces: ['ApiSpecBuilderEntry', 'ApiSpecBuilderConfig', 'ApiSpecBuilderResult'],
      bk: 'api_spec_builder', eks: ['asb.entry_created', 'asb.config_updated', 'asb.export_emitted'],
      subjects: ['sven.asb.entry_created', 'sven.asb.config_updated', 'sven.asb.export_emitted'],
      cases: ['asb_parser', 'asb_generator', 'asb_reporter'],
    },
    {
      name: 'api_spec_builder_monitor', migration: '20260633910000_agent_api_spec_builder_monitor.sql',
      typeFile: 'agent-api-spec-builder-monitor.ts', skillDir: 'api-spec-builder-monitor',
      interfaces: ['ApiSpecBuilderMonitorCheck', 'ApiSpecBuilderMonitorConfig', 'ApiSpecBuilderMonitorResult'],
      bk: 'api_spec_builder_monitor', eks: ['asbm.check_passed', 'asbm.alert_raised', 'asbm.export_emitted'],
      subjects: ['sven.asbm.check_passed', 'sven.asbm.alert_raised', 'sven.asbm.export_emitted'],
      cases: ['asbm_watcher', 'asbm_alerter', 'asbm_reporter'],
    },
    {
      name: 'api_spec_builder_auditor', migration: '20260633920000_agent_api_spec_builder_auditor.sql',
      typeFile: 'agent-api-spec-builder-auditor.ts', skillDir: 'api-spec-builder-auditor',
      interfaces: ['ApiSpecBuilderAuditEntry', 'ApiSpecBuilderAuditConfig', 'ApiSpecBuilderAuditResult'],
      bk: 'api_spec_builder_auditor', eks: ['asba.entry_logged', 'asba.violation_found', 'asba.export_emitted'],
      subjects: ['sven.asba.entry_logged', 'sven.asba.violation_found', 'sven.asba.export_emitted'],
      cases: ['asba_scanner', 'asba_enforcer', 'asba_reporter'],
    },
    {
      name: 'api_spec_builder_reporter', migration: '20260633930000_agent_api_spec_builder_reporter.sql',
      typeFile: 'agent-api-spec-builder-reporter.ts', skillDir: 'api-spec-builder-reporter',
      interfaces: ['ApiSpecBuilderReport', 'ApiSpecBuilderReportConfig', 'ApiSpecBuilderReportResult'],
      bk: 'api_spec_builder_reporter', eks: ['asbr.report_generated', 'asbr.insight_found', 'asbr.export_emitted'],
      subjects: ['sven.asbr.report_generated', 'sven.asbr.insight_found', 'sven.asbr.export_emitted'],
      cases: ['asbr_builder', 'asbr_analyst', 'asbr_reporter'],
    },
    {
      name: 'api_spec_builder_optimizer', migration: '20260633940000_agent_api_spec_builder_optimizer.sql',
      typeFile: 'agent-api-spec-builder-optimizer.ts', skillDir: 'api-spec-builder-optimizer',
      interfaces: ['ApiSpecBuilderOptPlan', 'ApiSpecBuilderOptConfig', 'ApiSpecBuilderOptResult'],
      bk: 'api_spec_builder_optimizer', eks: ['asbo.plan_created', 'asbo.optimization_applied', 'asbo.export_emitted'],
      subjects: ['sven.asbo.plan_created', 'sven.asbo.optimization_applied', 'sven.asbo.export_emitted'],
      cases: ['asbo_planner', 'asbo_executor', 'asbo_reporter'],
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
