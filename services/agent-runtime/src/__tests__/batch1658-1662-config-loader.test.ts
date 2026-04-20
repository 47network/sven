import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Config Loader verticals', () => {
  const verticals = [
    {
      name: 'config_loader', migration: '20260632950000_agent_config_loader.sql',
      typeFile: 'agent-config-loader.ts', skillDir: 'config-loader',
      interfaces: ['ConfigLoaderEntry', 'ConfigLoaderConfig', 'ConfigLoaderResult'],
      bk: 'config_loader', eks: ['cl.entry_created', 'cl.config_updated', 'cl.export_emitted'],
      subjects: ['sven.cl.entry_created', 'sven.cl.config_updated', 'sven.cl.export_emitted'],
      cases: ['cl_parser', 'cl_validator', 'cl_reporter'],
    },
    {
      name: 'config_loader_monitor', migration: '20260632960000_agent_config_loader_monitor.sql',
      typeFile: 'agent-config-loader-monitor.ts', skillDir: 'config-loader-monitor',
      interfaces: ['ConfigLoaderMonitorCheck', 'ConfigLoaderMonitorConfig', 'ConfigLoaderMonitorResult'],
      bk: 'config_loader_monitor', eks: ['clm.check_passed', 'clm.alert_raised', 'clm.export_emitted'],
      subjects: ['sven.clm.check_passed', 'sven.clm.alert_raised', 'sven.clm.export_emitted'],
      cases: ['clm_watcher', 'clm_alerter', 'clm_reporter'],
    },
    {
      name: 'config_loader_auditor', migration: '20260632970000_agent_config_loader_auditor.sql',
      typeFile: 'agent-config-loader-auditor.ts', skillDir: 'config-loader-auditor',
      interfaces: ['ConfigLoaderAuditEntry', 'ConfigLoaderAuditConfig', 'ConfigLoaderAuditResult'],
      bk: 'config_loader_auditor', eks: ['cla.entry_logged', 'cla.violation_found', 'cla.export_emitted'],
      subjects: ['sven.cla.entry_logged', 'sven.cla.violation_found', 'sven.cla.export_emitted'],
      cases: ['cla_scanner', 'cla_enforcer', 'cla_reporter'],
    },
    {
      name: 'config_loader_reporter', migration: '20260632980000_agent_config_loader_reporter.sql',
      typeFile: 'agent-config-loader-reporter.ts', skillDir: 'config-loader-reporter',
      interfaces: ['ConfigLoaderReport', 'ConfigLoaderReportConfig', 'ConfigLoaderReportResult'],
      bk: 'config_loader_reporter', eks: ['clr.report_generated', 'clr.insight_found', 'clr.export_emitted'],
      subjects: ['sven.clr.report_generated', 'sven.clr.insight_found', 'sven.clr.export_emitted'],
      cases: ['clr_builder', 'clr_analyst', 'clr_reporter'],
    },
    {
      name: 'config_loader_optimizer', migration: '20260632990000_agent_config_loader_optimizer.sql',
      typeFile: 'agent-config-loader-optimizer.ts', skillDir: 'config-loader-optimizer',
      interfaces: ['ConfigLoaderOptPlan', 'ConfigLoaderOptConfig', 'ConfigLoaderOptResult'],
      bk: 'config_loader_optimizer', eks: ['clo.plan_created', 'clo.optimization_applied', 'clo.export_emitted'],
      subjects: ['sven.clo.plan_created', 'sven.clo.optimization_applied', 'sven.clo.export_emitted'],
      cases: ['clo_planner', 'clo_executor', 'clo_reporter'],
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
