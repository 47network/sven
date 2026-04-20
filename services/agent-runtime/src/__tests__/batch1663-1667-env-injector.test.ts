import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Env Injector verticals', () => {
  const verticals = [
    {
      name: 'env_injector', migration: '20260633000000_agent_env_injector.sql',
      typeFile: 'agent-env-injector.ts', skillDir: 'env-injector',
      interfaces: ['EnvInjectorEntry', 'EnvInjectorConfig', 'EnvInjectorResult'],
      bk: 'env_injector', eks: ['ei.entry_created', 'ei.config_updated', 'ei.export_emitted'],
      subjects: ['sven.ei.entry_created', 'sven.ei.config_updated', 'sven.ei.export_emitted'],
      cases: ['ei_injector', 'ei_resolver', 'ei_reporter'],
    },
    {
      name: 'env_injector_monitor', migration: '20260633010000_agent_env_injector_monitor.sql',
      typeFile: 'agent-env-injector-monitor.ts', skillDir: 'env-injector-monitor',
      interfaces: ['EnvInjectorMonitorCheck', 'EnvInjectorMonitorConfig', 'EnvInjectorMonitorResult'],
      bk: 'env_injector_monitor', eks: ['eim.check_passed', 'eim.alert_raised', 'eim.export_emitted'],
      subjects: ['sven.eim.check_passed', 'sven.eim.alert_raised', 'sven.eim.export_emitted'],
      cases: ['eim_watcher', 'eim_alerter', 'eim_reporter'],
    },
    {
      name: 'env_injector_auditor', migration: '20260633020000_agent_env_injector_auditor.sql',
      typeFile: 'agent-env-injector-auditor.ts', skillDir: 'env-injector-auditor',
      interfaces: ['EnvInjectorAuditEntry', 'EnvInjectorAuditConfig', 'EnvInjectorAuditResult'],
      bk: 'env_injector_auditor', eks: ['eia.entry_logged', 'eia.violation_found', 'eia.export_emitted'],
      subjects: ['sven.eia.entry_logged', 'sven.eia.violation_found', 'sven.eia.export_emitted'],
      cases: ['eia_scanner', 'eia_enforcer', 'eia_reporter'],
    },
    {
      name: 'env_injector_reporter', migration: '20260633030000_agent_env_injector_reporter.sql',
      typeFile: 'agent-env-injector-reporter.ts', skillDir: 'env-injector-reporter',
      interfaces: ['EnvInjectorReport', 'EnvInjectorReportConfig', 'EnvInjectorReportResult'],
      bk: 'env_injector_reporter', eks: ['eir.report_generated', 'eir.insight_found', 'eir.export_emitted'],
      subjects: ['sven.eir.report_generated', 'sven.eir.insight_found', 'sven.eir.export_emitted'],
      cases: ['eir_builder', 'eir_analyst', 'eir_reporter'],
    },
    {
      name: 'env_injector_optimizer', migration: '20260633040000_agent_env_injector_optimizer.sql',
      typeFile: 'agent-env-injector-optimizer.ts', skillDir: 'env-injector-optimizer',
      interfaces: ['EnvInjectorOptPlan', 'EnvInjectorOptConfig', 'EnvInjectorOptResult'],
      bk: 'env_injector_optimizer', eks: ['eio.plan_created', 'eio.optimization_applied', 'eio.export_emitted'],
      subjects: ['sven.eio.plan_created', 'sven.eio.optimization_applied', 'sven.eio.export_emitted'],
      cases: ['eio_planner', 'eio_executor', 'eio_reporter'],
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
