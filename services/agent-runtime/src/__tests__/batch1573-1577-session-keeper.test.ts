import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Session Keeper verticals', () => {
  const verticals = [
    {
      name: 'session_keeper', migration: '20260632100000_agent_session_keeper.sql',
      typeFile: 'agent-session-keeper.ts', skillDir: 'session-keeper',
      interfaces: ['SessionKeeperEntry', 'SessionKeeperConfig', 'SessionKeeperResult'],
      bk: 'session_keeper', eks: ['sk.entry_created', 'sk.config_updated', 'sk.export_emitted'],
      subjects: ['sven.sk.entry_created', 'sven.sk.config_updated', 'sven.sk.export_emitted'],
      cases: ['sk_manager', 'sk_cleaner', 'sk_reporter'],
    },
    {
      name: 'session_keeper_monitor', migration: '20260632110000_agent_session_keeper_monitor.sql',
      typeFile: 'agent-session-keeper-monitor.ts', skillDir: 'session-keeper-monitor',
      interfaces: ['SessionKeeperMonitorCheck', 'SessionKeeperMonitorConfig', 'SessionKeeperMonitorResult'],
      bk: 'session_keeper_monitor', eks: ['skm.check_passed', 'skm.alert_raised', 'skm.export_emitted'],
      subjects: ['sven.skm.check_passed', 'sven.skm.alert_raised', 'sven.skm.export_emitted'],
      cases: ['skm_watcher', 'skm_alerter', 'skm_reporter'],
    },
    {
      name: 'session_keeper_auditor', migration: '20260632120000_agent_session_keeper_auditor.sql',
      typeFile: 'agent-session-keeper-auditor.ts', skillDir: 'session-keeper-auditor',
      interfaces: ['SessionKeeperAuditEntry', 'SessionKeeperAuditConfig', 'SessionKeeperAuditResult'],
      bk: 'session_keeper_auditor', eks: ['ska.entry_logged', 'ska.violation_found', 'ska.export_emitted'],
      subjects: ['sven.ska.entry_logged', 'sven.ska.violation_found', 'sven.ska.export_emitted'],
      cases: ['ska_scanner', 'ska_enforcer', 'ska_reporter'],
    },
    {
      name: 'session_keeper_reporter', migration: '20260632130000_agent_session_keeper_reporter.sql',
      typeFile: 'agent-session-keeper-reporter.ts', skillDir: 'session-keeper-reporter',
      interfaces: ['SessionKeeperReport', 'SessionKeeperReportConfig', 'SessionKeeperReportResult'],
      bk: 'session_keeper_reporter', eks: ['skr.report_generated', 'skr.insight_found', 'skr.export_emitted'],
      subjects: ['sven.skr.report_generated', 'sven.skr.insight_found', 'sven.skr.export_emitted'],
      cases: ['skr_builder', 'skr_analyst', 'skr_reporter'],
    },
    {
      name: 'session_keeper_optimizer', migration: '20260632140000_agent_session_keeper_optimizer.sql',
      typeFile: 'agent-session-keeper-optimizer.ts', skillDir: 'session-keeper-optimizer',
      interfaces: ['SessionKeeperOptPlan', 'SessionKeeperOptConfig', 'SessionKeeperOptResult'],
      bk: 'session_keeper_optimizer', eks: ['sko.plan_created', 'sko.optimization_applied', 'sko.export_emitted'],
      subjects: ['sven.sko.plan_created', 'sven.sko.optimization_applied', 'sven.sko.export_emitted'],
      cases: ['sko_planner', 'sko_executor', 'sko_reporter'],
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
