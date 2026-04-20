import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Quota Limiter verticals', () => {
  const verticals = [
    {
      name: 'quota_limiter', migration: '20260631900000_agent_quota_limiter.sql',
      typeFile: 'agent-quota-limiter.ts', skillDir: 'quota-limiter',
      interfaces: ['QuotaLimiterEntry', 'QuotaLimiterConfig', 'QuotaLimiterResult'],
      bk: 'quota_limiter', eks: ['ql.entry_created', 'ql.config_updated', 'ql.export_emitted'],
      subjects: ['sven.ql.entry_created', 'sven.ql.config_updated', 'sven.ql.export_emitted'],
      cases: ['ql_enforcer', 'ql_tracker', 'ql_reporter'],
    },
    {
      name: 'quota_limiter_monitor', migration: '20260631910000_agent_quota_limiter_monitor.sql',
      typeFile: 'agent-quota-limiter-monitor.ts', skillDir: 'quota-limiter-monitor',
      interfaces: ['QuotaLimiterMonitorCheck', 'QuotaLimiterMonitorConfig', 'QuotaLimiterMonitorResult'],
      bk: 'quota_limiter_monitor', eks: ['qlm.check_passed', 'qlm.alert_raised', 'qlm.export_emitted'],
      subjects: ['sven.qlm.check_passed', 'sven.qlm.alert_raised', 'sven.qlm.export_emitted'],
      cases: ['qlm_watcher', 'qlm_alerter', 'qlm_reporter'],
    },
    {
      name: 'quota_limiter_auditor', migration: '20260631920000_agent_quota_limiter_auditor.sql',
      typeFile: 'agent-quota-limiter-auditor.ts', skillDir: 'quota-limiter-auditor',
      interfaces: ['QuotaLimiterAuditEntry', 'QuotaLimiterAuditConfig', 'QuotaLimiterAuditResult'],
      bk: 'quota_limiter_auditor', eks: ['qla.entry_logged', 'qla.violation_found', 'qla.export_emitted'],
      subjects: ['sven.qla.entry_logged', 'sven.qla.violation_found', 'sven.qla.export_emitted'],
      cases: ['qla_scanner', 'qla_enforcer', 'qla_reporter'],
    },
    {
      name: 'quota_limiter_reporter', migration: '20260631930000_agent_quota_limiter_reporter.sql',
      typeFile: 'agent-quota-limiter-reporter.ts', skillDir: 'quota-limiter-reporter',
      interfaces: ['QuotaLimiterReport', 'QuotaLimiterReportConfig', 'QuotaLimiterReportResult'],
      bk: 'quota_limiter_reporter', eks: ['qlr.report_generated', 'qlr.insight_found', 'qlr.export_emitted'],
      subjects: ['sven.qlr.report_generated', 'sven.qlr.insight_found', 'sven.qlr.export_emitted'],
      cases: ['qlr_builder', 'qlr_analyst', 'qlr_reporter'],
    },
    {
      name: 'quota_limiter_optimizer', migration: '20260631940000_agent_quota_limiter_optimizer.sql',
      typeFile: 'agent-quota-limiter-optimizer.ts', skillDir: 'quota-limiter-optimizer',
      interfaces: ['QuotaLimiterOptPlan', 'QuotaLimiterOptConfig', 'QuotaLimiterOptResult'],
      bk: 'quota_limiter_optimizer', eks: ['qlo.plan_created', 'qlo.optimization_applied', 'qlo.export_emitted'],
      subjects: ['sven.qlo.plan_created', 'sven.qlo.optimization_applied', 'sven.qlo.export_emitted'],
      cases: ['qlo_planner', 'qlo_executor', 'qlo_reporter'],
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
