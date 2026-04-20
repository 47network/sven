import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Doc Generator verticals', () => {
  const verticals = [
    {
      name: 'doc_generator', migration: '20260633850000_agent_doc_generator.sql',
      typeFile: 'agent-doc-generator.ts', skillDir: 'doc-generator',
      interfaces: ['DocGeneratorEntry', 'DocGeneratorConfig', 'DocGeneratorResult'],
      bk: 'doc_generator', eks: ['dg.entry_created', 'dg.config_updated', 'dg.export_emitted'],
      subjects: ['sven.dg.entry_created', 'sven.dg.config_updated', 'sven.dg.export_emitted'],
      cases: ['dg_parser', 'dg_builder', 'dg_reporter'],
    },
    {
      name: 'doc_generator_monitor', migration: '20260633860000_agent_doc_generator_monitor.sql',
      typeFile: 'agent-doc-generator-monitor.ts', skillDir: 'doc-generator-monitor',
      interfaces: ['DocGeneratorMonitorCheck', 'DocGeneratorMonitorConfig', 'DocGeneratorMonitorResult'],
      bk: 'doc_generator_monitor', eks: ['dgm.check_passed', 'dgm.alert_raised', 'dgm.export_emitted'],
      subjects: ['sven.dgm.check_passed', 'sven.dgm.alert_raised', 'sven.dgm.export_emitted'],
      cases: ['dgm_watcher', 'dgm_alerter', 'dgm_reporter'],
    },
    {
      name: 'doc_generator_auditor', migration: '20260633870000_agent_doc_generator_auditor.sql',
      typeFile: 'agent-doc-generator-auditor.ts', skillDir: 'doc-generator-auditor',
      interfaces: ['DocGeneratorAuditEntry', 'DocGeneratorAuditConfig', 'DocGeneratorAuditResult'],
      bk: 'doc_generator_auditor', eks: ['dga.entry_logged', 'dga.violation_found', 'dga.export_emitted'],
      subjects: ['sven.dga.entry_logged', 'sven.dga.violation_found', 'sven.dga.export_emitted'],
      cases: ['dga_scanner', 'dga_enforcer', 'dga_reporter'],
    },
    {
      name: 'doc_generator_reporter', migration: '20260633880000_agent_doc_generator_reporter.sql',
      typeFile: 'agent-doc-generator-reporter.ts', skillDir: 'doc-generator-reporter',
      interfaces: ['DocGeneratorReport', 'DocGeneratorReportConfig', 'DocGeneratorReportResult'],
      bk: 'doc_generator_reporter', eks: ['dgr.report_generated', 'dgr.insight_found', 'dgr.export_emitted'],
      subjects: ['sven.dgr.report_generated', 'sven.dgr.insight_found', 'sven.dgr.export_emitted'],
      cases: ['dgr_builder', 'dgr_analyst', 'dgr_reporter'],
    },
    {
      name: 'doc_generator_optimizer', migration: '20260633890000_agent_doc_generator_optimizer.sql',
      typeFile: 'agent-doc-generator-optimizer.ts', skillDir: 'doc-generator-optimizer',
      interfaces: ['DocGeneratorOptPlan', 'DocGeneratorOptConfig', 'DocGeneratorOptResult'],
      bk: 'doc_generator_optimizer', eks: ['dgo.plan_created', 'dgo.optimization_applied', 'dgo.export_emitted'],
      subjects: ['sven.dgo.plan_created', 'sven.dgo.optimization_applied', 'sven.dgo.export_emitted'],
      cases: ['dgo_planner', 'dgo_executor', 'dgo_reporter'],
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
