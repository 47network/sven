import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Schema Checker verticals', () => {
  const verticals = [
    {
      name: 'schema_checker', migration: '20260631200000_agent_schema_checker.sql',
      typeFile: 'agent-schema-checker.ts', skillDir: 'schema-checker',
      interfaces: ['SchemaCheckerEntry', 'SchemaCheckerConfig', 'SchemaCheckerResult'],
      bk: 'schema_checker', eks: ['sc.entry_created', 'sc.config_updated', 'sc.export_emitted'],
      subjects: ['sven.sc.entry_created', 'sven.sc.config_updated', 'sven.sc.export_emitted'],
      cases: ['sc_validator', 'sc_differ', 'sc_reporter'],
    },
    {
      name: 'schema_checker_monitor', migration: '20260631210000_agent_schema_checker_monitor.sql',
      typeFile: 'agent-schema-checker-monitor.ts', skillDir: 'schema-checker-monitor',
      interfaces: ['SchemaCheckerMonitorCheck', 'SchemaCheckerMonitorConfig', 'SchemaCheckerMonitorResult'],
      bk: 'schema_checker_monitor', eks: ['scm.check_passed', 'scm.alert_raised', 'scm.export_emitted'],
      subjects: ['sven.scm.check_passed', 'sven.scm.alert_raised', 'sven.scm.export_emitted'],
      cases: ['scm_watcher', 'scm_alerter', 'scm_reporter'],
    },
    {
      name: 'schema_checker_auditor', migration: '20260631220000_agent_schema_checker_auditor.sql',
      typeFile: 'agent-schema-checker-auditor.ts', skillDir: 'schema-checker-auditor',
      interfaces: ['SchemaCheckerAuditEntry', 'SchemaCheckerAuditConfig', 'SchemaCheckerAuditResult'],
      bk: 'schema_checker_auditor', eks: ['sca.entry_logged', 'sca.violation_found', 'sca.export_emitted'],
      subjects: ['sven.sca.entry_logged', 'sven.sca.violation_found', 'sven.sca.export_emitted'],
      cases: ['sca_scanner', 'sca_enforcer', 'sca_reporter'],
    },
    {
      name: 'schema_checker_reporter', migration: '20260631230000_agent_schema_checker_reporter.sql',
      typeFile: 'agent-schema-checker-reporter.ts', skillDir: 'schema-checker-reporter',
      interfaces: ['SchemaCheckerReport', 'SchemaCheckerReportConfig', 'SchemaCheckerReportResult'],
      bk: 'schema_checker_reporter', eks: ['scr.report_generated', 'scr.insight_found', 'scr.export_emitted'],
      subjects: ['sven.scr.report_generated', 'sven.scr.insight_found', 'sven.scr.export_emitted'],
      cases: ['scr_builder', 'scr_analyst', 'scr_reporter'],
    },
    {
      name: 'schema_checker_optimizer', migration: '20260631240000_agent_schema_checker_optimizer.sql',
      typeFile: 'agent-schema-checker-optimizer.ts', skillDir: 'schema-checker-optimizer',
      interfaces: ['SchemaCheckerOptPlan', 'SchemaCheckerOptConfig', 'SchemaCheckerOptResult'],
      bk: 'schema_checker_optimizer', eks: ['sco2.plan_created', 'sco2.optimization_applied', 'sco2.export_emitted'],
      subjects: ['sven.sco2.plan_created', 'sven.sco2.optimization_applied', 'sven.sco2.export_emitted'],
      cases: ['sco2_planner', 'sco2_executor', 'sco2_reporter'],
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
