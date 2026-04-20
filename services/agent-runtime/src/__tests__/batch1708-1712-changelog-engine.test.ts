import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Changelog Engine verticals', () => {
  const verticals = [
    {
      name: 'changelog_engine', migration: '20260633450000_agent_changelog_engine.sql',
      typeFile: 'agent-changelog-engine.ts', skillDir: 'changelog-engine',
      interfaces: ['ChangelogEngineEntry', 'ChangelogEngineConfig', 'ChangelogEngineResult'],
      bk: 'changelog_engine', eks: ['ce.entry_created', 'ce.config_updated', 'ce.export_emitted'],
      subjects: ['sven.ce.entry_created', 'sven.ce.config_updated', 'sven.ce.export_emitted'],
      cases: ['ce_parser', 'ce_formatter', 'ce_reporter'],
    },
    {
      name: 'changelog_engine_monitor', migration: '20260633460000_agent_changelog_engine_monitor.sql',
      typeFile: 'agent-changelog-engine-monitor.ts', skillDir: 'changelog-engine-monitor',
      interfaces: ['ChangelogEngineMonitorCheck', 'ChangelogEngineMonitorConfig', 'ChangelogEngineMonitorResult'],
      bk: 'changelog_engine_monitor', eks: ['cem.check_passed', 'cem.alert_raised', 'cem.export_emitted'],
      subjects: ['sven.cem.check_passed', 'sven.cem.alert_raised', 'sven.cem.export_emitted'],
      cases: ['cem_watcher', 'cem_alerter', 'cem_reporter'],
    },
    {
      name: 'changelog_engine_auditor', migration: '20260633470000_agent_changelog_engine_auditor.sql',
      typeFile: 'agent-changelog-engine-auditor.ts', skillDir: 'changelog-engine-auditor',
      interfaces: ['ChangelogEngineAuditEntry', 'ChangelogEngineAuditConfig', 'ChangelogEngineAuditResult'],
      bk: 'changelog_engine_auditor', eks: ['cea2.entry_logged', 'cea2.violation_found', 'cea2.export_emitted'],
      subjects: ['sven.cea2.entry_logged', 'sven.cea2.violation_found', 'sven.cea2.export_emitted'],
      cases: ['cea2_scanner', 'cea2_enforcer', 'cea2_reporter'],
    },
    {
      name: 'changelog_engine_reporter', migration: '20260633480000_agent_changelog_engine_reporter.sql',
      typeFile: 'agent-changelog-engine-reporter.ts', skillDir: 'changelog-engine-reporter',
      interfaces: ['ChangelogEngineReport', 'ChangelogEngineReportConfig', 'ChangelogEngineReportResult'],
      bk: 'changelog_engine_reporter', eks: ['cer.report_generated', 'cer.insight_found', 'cer.export_emitted'],
      subjects: ['sven.cer.report_generated', 'sven.cer.insight_found', 'sven.cer.export_emitted'],
      cases: ['cer_builder', 'cer_analyst', 'cer_reporter'],
    },
    {
      name: 'changelog_engine_optimizer', migration: '20260633490000_agent_changelog_engine_optimizer.sql',
      typeFile: 'agent-changelog-engine-optimizer.ts', skillDir: 'changelog-engine-optimizer',
      interfaces: ['ChangelogEngineOptPlan', 'ChangelogEngineOptConfig', 'ChangelogEngineOptResult'],
      bk: 'changelog_engine_optimizer', eks: ['ceo.plan_created', 'ceo.optimization_applied', 'ceo.export_emitted'],
      subjects: ['sven.ceo.plan_created', 'sven.ceo.optimization_applied', 'sven.ceo.export_emitted'],
      cases: ['ceo_planner', 'ceo_executor', 'ceo_reporter'],
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
