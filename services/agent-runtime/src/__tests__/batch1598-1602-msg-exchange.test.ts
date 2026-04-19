import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Msg Exchange verticals', () => {
  const verticals = [
    {
      name: 'msg_exchange', migration: '20260632350000_agent_msg_exchange.sql',
      typeFile: 'agent-msg-exchange.ts', skillDir: 'msg-exchange',
      interfaces: ['MsgExchangeEntry', 'MsgExchangeConfig', 'MsgExchangeResult'],
      bk: 'msg_exchange', eks: ['me.entry_created', 'me.config_updated', 'me.export_emitted'],
      subjects: ['sven.me.entry_created', 'sven.me.config_updated', 'sven.me.export_emitted'],
      cases: ['me_router', 'me_queuer', 'me_reporter'],
    },
    {
      name: 'msg_exchange_monitor', migration: '20260632360000_agent_msg_exchange_monitor.sql',
      typeFile: 'agent-msg-exchange-monitor.ts', skillDir: 'msg-exchange-monitor',
      interfaces: ['MsgExchangeMonitorCheck', 'MsgExchangeMonitorConfig', 'MsgExchangeMonitorResult'],
      bk: 'msg_exchange_monitor', eks: ['mem.check_passed', 'mem.alert_raised', 'mem.export_emitted'],
      subjects: ['sven.mem.check_passed', 'sven.mem.alert_raised', 'sven.mem.export_emitted'],
      cases: ['mem_watcher', 'mem_alerter', 'mem_reporter'],
    },
    {
      name: 'msg_exchange_auditor', migration: '20260632370000_agent_msg_exchange_auditor.sql',
      typeFile: 'agent-msg-exchange-auditor.ts', skillDir: 'msg-exchange-auditor',
      interfaces: ['MsgExchangeAuditEntry', 'MsgExchangeAuditConfig', 'MsgExchangeAuditResult'],
      bk: 'msg_exchange_auditor', eks: ['mea.entry_logged', 'mea.violation_found', 'mea.export_emitted'],
      subjects: ['sven.mea.entry_logged', 'sven.mea.violation_found', 'sven.mea.export_emitted'],
      cases: ['mea_scanner', 'mea_enforcer', 'mea_reporter'],
    },
    {
      name: 'msg_exchange_reporter', migration: '20260632380000_agent_msg_exchange_reporter.sql',
      typeFile: 'agent-msg-exchange-reporter.ts', skillDir: 'msg-exchange-reporter',
      interfaces: ['MsgExchangeReport', 'MsgExchangeReportConfig', 'MsgExchangeReportResult'],
      bk: 'msg_exchange_reporter', eks: ['mer.report_generated', 'mer.insight_found', 'mer.export_emitted'],
      subjects: ['sven.mer.report_generated', 'sven.mer.insight_found', 'sven.mer.export_emitted'],
      cases: ['mer_builder', 'mer_analyst', 'mer_reporter'],
    },
    {
      name: 'msg_exchange_optimizer', migration: '20260632390000_agent_msg_exchange_optimizer.sql',
      typeFile: 'agent-msg-exchange-optimizer.ts', skillDir: 'msg-exchange-optimizer',
      interfaces: ['MsgExchangeOptPlan', 'MsgExchangeOptConfig', 'MsgExchangeOptResult'],
      bk: 'msg_exchange_optimizer', eks: ['meo.plan_created', 'meo.optimization_applied', 'meo.export_emitted'],
      subjects: ['sven.meo.plan_created', 'sven.meo.optimization_applied', 'sven.meo.export_emitted'],
      cases: ['meo_planner', 'meo_executor', 'meo_reporter'],
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
