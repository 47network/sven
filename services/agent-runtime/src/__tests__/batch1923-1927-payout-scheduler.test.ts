import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Payout Scheduler verticals', () => {
  const verticals = [
    {
      name: 'payout_scheduler', migration: '20260635600000_agent_payout_scheduler.sql',
      typeFile: 'agent-payout-scheduler.ts', skillDir: 'payout-scheduler',
      interfaces: ['PayoutSchedulerEntry', 'PayoutSchedulerConfig', 'PayoutSchedulerResult'],
      bk: 'payout_scheduler', eks: ['ps.entry_created', 'ps.config_updated', 'ps.export_emitted'],
      subjects: ['sven.ps.entry_created', 'sven.ps.config_updated', 'sven.ps.export_emitted'],
      cases: ['ps_scheduler', 'ps_distributor', 'ps_reporter'],
    },
    {
      name: 'payout_scheduler_monitor', migration: '20260635610000_agent_payout_scheduler_monitor.sql',
      typeFile: 'agent-payout-scheduler-monitor.ts', skillDir: 'payout-scheduler-monitor',
      interfaces: ['PayoutSchedulerMonitorCheck', 'PayoutSchedulerMonitorConfig', 'PayoutSchedulerMonitorResult'],
      bk: 'payout_scheduler_monitor', eks: ['psm.check_passed', 'psm.alert_raised', 'psm.export_emitted'],
      subjects: ['sven.psm.check_passed', 'sven.psm.alert_raised', 'sven.psm.export_emitted'],
      cases: ['psm_watcher', 'psm_alerter', 'psm_reporter'],
    },
    {
      name: 'payout_scheduler_auditor', migration: '20260635620000_agent_payout_scheduler_auditor.sql',
      typeFile: 'agent-payout-scheduler-auditor.ts', skillDir: 'payout-scheduler-auditor',
      interfaces: ['PayoutSchedulerAuditEntry', 'PayoutSchedulerAuditConfig', 'PayoutSchedulerAuditResult'],
      bk: 'payout_scheduler_auditor', eks: ['psa.entry_logged', 'psa.violation_found', 'psa.export_emitted'],
      subjects: ['sven.psa.entry_logged', 'sven.psa.violation_found', 'sven.psa.export_emitted'],
      cases: ['psa_scanner', 'psa_enforcer', 'psa_reporter'],
    },
    {
      name: 'payout_scheduler_reporter', migration: '20260635630000_agent_payout_scheduler_reporter.sql',
      typeFile: 'agent-payout-scheduler-reporter.ts', skillDir: 'payout-scheduler-reporter',
      interfaces: ['PayoutSchedulerReport', 'PayoutSchedulerReportConfig', 'PayoutSchedulerReportResult'],
      bk: 'payout_scheduler_reporter', eks: ['psr.report_generated', 'psr.insight_found', 'psr.export_emitted'],
      subjects: ['sven.psr.report_generated', 'sven.psr.insight_found', 'sven.psr.export_emitted'],
      cases: ['psr_builder', 'psr_analyst', 'psr_reporter'],
    },
    {
      name: 'payout_scheduler_optimizer', migration: '20260635640000_agent_payout_scheduler_optimizer.sql',
      typeFile: 'agent-payout-scheduler-optimizer.ts', skillDir: 'payout-scheduler-optimizer',
      interfaces: ['PayoutSchedulerOptPlan', 'PayoutSchedulerOptConfig', 'PayoutSchedulerOptResult'],
      bk: 'payout_scheduler_optimizer', eks: ['pso.plan_created', 'pso.optimization_applied', 'pso.export_emitted'],
      subjects: ['sven.pso.plan_created', 'sven.pso.optimization_applied', 'sven.pso.export_emitted'],
      cases: ['pso_planner', 'pso_executor', 'pso_reporter'],
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
