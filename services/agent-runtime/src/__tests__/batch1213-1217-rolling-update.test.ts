import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Rolling Update management verticals', () => {
  const verticals = [
    {
      name: 'rolling_update', migration: '20260628500000_agent_rolling_update.sql',
      typeFile: 'agent-rolling-update.ts', skillDir: 'rolling-update',
      interfaces: ['RollingUpdatePlan', 'RollingUpdateConfig', 'RollingUpdateResult'],
      bk: 'rolling_update', eks: ['ru.plan_created', 'ru.config_updated', 'ru.export_emitted'],
      subjects: ['sven.ru.plan_created', 'sven.ru.config_updated', 'sven.ru.export_emitted'],
      cases: ['ru_planner', 'ru_executor', 'ru_reporter'],
    },
    {
      name: 'rolling_update_monitor', migration: '20260628510000_agent_rolling_update_monitor.sql',
      typeFile: 'agent-rolling-update-monitor.ts', skillDir: 'rolling-update-monitor',
      interfaces: ['RollingUpdateMonitorCheck', 'RollingUpdateMonitorConfig', 'RollingUpdateMonitorResult'],
      bk: 'rolling_update_monitor', eks: ['rum.check_passed', 'rum.alert_raised', 'rum.export_emitted'],
      subjects: ['sven.rum.check_passed', 'sven.rum.alert_raised', 'sven.rum.export_emitted'],
      cases: ['rum_watcher', 'rum_alerter', 'rum_reporter'],
    },
    {
      name: 'rolling_update_auditor', migration: '20260628520000_agent_rolling_update_auditor.sql',
      typeFile: 'agent-rolling-update-auditor.ts', skillDir: 'rolling-update-auditor',
      interfaces: ['RollingUpdateAuditEntry', 'RollingUpdateAuditConfig', 'RollingUpdateAuditResult'],
      bk: 'rolling_update_auditor', eks: ['rua.entry_logged', 'rua.violation_found', 'rua.export_emitted'],
      subjects: ['sven.rua.entry_logged', 'sven.rua.violation_found', 'sven.rua.export_emitted'],
      cases: ['rua_scanner', 'rua_enforcer', 'rua_reporter'],
    },
    {
      name: 'rolling_update_reporter', migration: '20260628530000_agent_rolling_update_reporter.sql',
      typeFile: 'agent-rolling-update-reporter.ts', skillDir: 'rolling-update-reporter',
      interfaces: ['RollingUpdateReport', 'RollingUpdateReportConfig', 'RollingUpdateReportResult'],
      bk: 'rolling_update_reporter', eks: ['rur.report_generated', 'rur.insight_found', 'rur.export_emitted'],
      subjects: ['sven.rur.report_generated', 'sven.rur.insight_found', 'sven.rur.export_emitted'],
      cases: ['rur_builder', 'rur_analyst', 'rur_reporter'],
    },
    {
      name: 'rolling_update_optimizer', migration: '20260628540000_agent_rolling_update_optimizer.sql',
      typeFile: 'agent-rolling-update-optimizer.ts', skillDir: 'rolling-update-optimizer',
      interfaces: ['RollingUpdateOptPlan', 'RollingUpdateOptConfig', 'RollingUpdateOptResult'],
      bk: 'rolling_update_optimizer', eks: ['ruo.plan_created', 'ruo.optimization_applied', 'ruo.export_emitted'],
      subjects: ['sven.ruo.plan_created', 'sven.ruo.optimization_applied', 'sven.ruo.export_emitted'],
      cases: ['ruo_planner', 'ruo_executor', 'ruo_reporter'],
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
