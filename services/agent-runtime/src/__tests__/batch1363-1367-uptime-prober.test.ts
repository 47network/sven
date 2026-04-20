import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Uptime Prober verticals', () => {
  const verticals = [
    {
      name: 'uptime_prober', migration: '20260630000000_agent_uptime_prober.sql',
      typeFile: 'agent-uptime-prober.ts', skillDir: 'uptime-prober',
      interfaces: ['UptimeProberEntry', 'UptimeProberConfig', 'UptimeProberResult'],
      bk: 'uptime_prober', eks: ['up.entry_created', 'up.config_updated', 'up.export_emitted'],
      subjects: ['sven.up.entry_created', 'sven.up.config_updated', 'sven.up.export_emitted'],
      cases: ['up_checker', 'up_scheduler', 'up_reporter'],
    },
    {
      name: 'uptime_prober_monitor', migration: '20260630010000_agent_uptime_prober_monitor.sql',
      typeFile: 'agent-uptime-prober-monitor.ts', skillDir: 'uptime-prober-monitor',
      interfaces: ['UptimeProberMonitorCheck', 'UptimeProberMonitorConfig', 'UptimeProberMonitorResult'],
      bk: 'uptime_prober_monitor', eks: ['upm.check_passed', 'upm.alert_raised', 'upm.export_emitted'],
      subjects: ['sven.upm.check_passed', 'sven.upm.alert_raised', 'sven.upm.export_emitted'],
      cases: ['upm_watcher', 'upm_alerter', 'upm_reporter'],
    },
    {
      name: 'uptime_prober_auditor', migration: '20260630020000_agent_uptime_prober_auditor.sql',
      typeFile: 'agent-uptime-prober-auditor.ts', skillDir: 'uptime-prober-auditor',
      interfaces: ['UptimeProberAuditEntry', 'UptimeProberAuditConfig', 'UptimeProberAuditResult'],
      bk: 'uptime_prober_auditor', eks: ['upa.entry_logged', 'upa.violation_found', 'upa.export_emitted'],
      subjects: ['sven.upa.entry_logged', 'sven.upa.violation_found', 'sven.upa.export_emitted'],
      cases: ['upa_scanner', 'upa_enforcer', 'upa_reporter'],
    },
    {
      name: 'uptime_prober_reporter', migration: '20260630030000_agent_uptime_prober_reporter.sql',
      typeFile: 'agent-uptime-prober-reporter.ts', skillDir: 'uptime-prober-reporter',
      interfaces: ['UptimeProberReport', 'UptimeProberReportConfig', 'UptimeProberReportResult'],
      bk: 'uptime_prober_reporter', eks: ['upr.report_generated', 'upr.insight_found', 'upr.export_emitted'],
      subjects: ['sven.upr.report_generated', 'sven.upr.insight_found', 'sven.upr.export_emitted'],
      cases: ['upr_builder', 'upr_analyst', 'upr_reporter'],
    },
    {
      name: 'uptime_prober_optimizer', migration: '20260630040000_agent_uptime_prober_optimizer.sql',
      typeFile: 'agent-uptime-prober-optimizer.ts', skillDir: 'uptime-prober-optimizer',
      interfaces: ['UptimeProberOptPlan', 'UptimeProberOptConfig', 'UptimeProberOptResult'],
      bk: 'uptime_prober_optimizer', eks: ['upo.plan_created', 'upo.optimization_applied', 'upo.export_emitted'],
      subjects: ['sven.upo.plan_created', 'sven.upo.optimization_applied', 'sven.upo.export_emitted'],
      cases: ['upo_planner', 'upo_executor', 'upo_reporter'],
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
