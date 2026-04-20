import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Style Formatter verticals', () => {
  const verticals = [
    {
      name: 'style_formatter', migration: '20260633800000_agent_style_formatter.sql',
      typeFile: 'agent-style-formatter.ts', skillDir: 'style-formatter',
      interfaces: ['StyleFormatterEntry', 'StyleFormatterConfig', 'StyleFormatterResult'],
      bk: 'style_formatter', eks: ['sf.entry_created', 'sf.config_updated', 'sf.export_emitted'],
      subjects: ['sven.sf.entry_created', 'sven.sf.config_updated', 'sven.sf.export_emitted'],
      cases: ['sf_parser', 'sf_transformer', 'sf_reporter'],
    },
    {
      name: 'style_formatter_monitor', migration: '20260633810000_agent_style_formatter_monitor.sql',
      typeFile: 'agent-style-formatter-monitor.ts', skillDir: 'style-formatter-monitor',
      interfaces: ['StyleFormatterMonitorCheck', 'StyleFormatterMonitorConfig', 'StyleFormatterMonitorResult'],
      bk: 'style_formatter_monitor', eks: ['sfm.check_passed', 'sfm.alert_raised', 'sfm.export_emitted'],
      subjects: ['sven.sfm.check_passed', 'sven.sfm.alert_raised', 'sven.sfm.export_emitted'],
      cases: ['sfm_watcher', 'sfm_alerter', 'sfm_reporter'],
    },
    {
      name: 'style_formatter_auditor', migration: '20260633820000_agent_style_formatter_auditor.sql',
      typeFile: 'agent-style-formatter-auditor.ts', skillDir: 'style-formatter-auditor',
      interfaces: ['StyleFormatterAuditEntry', 'StyleFormatterAuditConfig', 'StyleFormatterAuditResult'],
      bk: 'style_formatter_auditor', eks: ['sfa.entry_logged', 'sfa.violation_found', 'sfa.export_emitted'],
      subjects: ['sven.sfa.entry_logged', 'sven.sfa.violation_found', 'sven.sfa.export_emitted'],
      cases: ['sfa_scanner', 'sfa_enforcer', 'sfa_reporter'],
    },
    {
      name: 'style_formatter_reporter', migration: '20260633830000_agent_style_formatter_reporter.sql',
      typeFile: 'agent-style-formatter-reporter.ts', skillDir: 'style-formatter-reporter',
      interfaces: ['StyleFormatterReport', 'StyleFormatterReportConfig', 'StyleFormatterReportResult'],
      bk: 'style_formatter_reporter', eks: ['sfr.report_generated', 'sfr.insight_found', 'sfr.export_emitted'],
      subjects: ['sven.sfr.report_generated', 'sven.sfr.insight_found', 'sven.sfr.export_emitted'],
      cases: ['sfr_builder', 'sfr_analyst', 'sfr_reporter'],
    },
    {
      name: 'style_formatter_optimizer', migration: '20260633840000_agent_style_formatter_optimizer.sql',
      typeFile: 'agent-style-formatter-optimizer.ts', skillDir: 'style-formatter-optimizer',
      interfaces: ['StyleFormatterOptPlan', 'StyleFormatterOptConfig', 'StyleFormatterOptResult'],
      bk: 'style_formatter_optimizer', eks: ['sfo.plan_created', 'sfo.optimization_applied', 'sfo.export_emitted'],
      subjects: ['sven.sfo.plan_created', 'sven.sfo.optimization_applied', 'sven.sfo.export_emitted'],
      cases: ['sfo_planner', 'sfo_executor', 'sfo_reporter'],
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
