import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Vitals Probe verticals', () => {
  const verticals = [
    {
      name: 'vitals_probe', migration: '20260632700000_agent_vitals_probe.sql',
      typeFile: 'agent-vitals-probe.ts', skillDir: 'vitals-probe',
      interfaces: ['VitalsProbeEntry', 'VitalsProbeConfig', 'VitalsProbeResult'],
      bk: 'vitals_probe', eks: ['vp.entry_created', 'vp.config_updated', 'vp.export_emitted'],
      subjects: ['sven.vp.entry_created', 'sven.vp.config_updated', 'sven.vp.export_emitted'],
      cases: ['vp_checker', 'vp_diagnostics', 'vp_reporter'],
    },
    {
      name: 'vitals_probe_monitor', migration: '20260632710000_agent_vitals_probe_monitor.sql',
      typeFile: 'agent-vitals-probe-monitor.ts', skillDir: 'vitals-probe-monitor',
      interfaces: ['VitalsProbeMonitorCheck', 'VitalsProbeMonitorConfig', 'VitalsProbeMonitorResult'],
      bk: 'vitals_probe_monitor', eks: ['vpm.check_passed', 'vpm.alert_raised', 'vpm.export_emitted'],
      subjects: ['sven.vpm.check_passed', 'sven.vpm.alert_raised', 'sven.vpm.export_emitted'],
      cases: ['vpm_watcher', 'vpm_alerter', 'vpm_reporter'],
    },
    {
      name: 'vitals_probe_auditor', migration: '20260632720000_agent_vitals_probe_auditor.sql',
      typeFile: 'agent-vitals-probe-auditor.ts', skillDir: 'vitals-probe-auditor',
      interfaces: ['VitalsProbeAuditEntry', 'VitalsProbeAuditConfig', 'VitalsProbeAuditResult'],
      bk: 'vitals_probe_auditor', eks: ['vpa.entry_logged', 'vpa.violation_found', 'vpa.export_emitted'],
      subjects: ['sven.vpa.entry_logged', 'sven.vpa.violation_found', 'sven.vpa.export_emitted'],
      cases: ['vpa_scanner', 'vpa_enforcer', 'vpa_reporter'],
    },
    {
      name: 'vitals_probe_reporter', migration: '20260632730000_agent_vitals_probe_reporter.sql',
      typeFile: 'agent-vitals-probe-reporter.ts', skillDir: 'vitals-probe-reporter',
      interfaces: ['VitalsProbeReport', 'VitalsProbeReportConfig', 'VitalsProbeReportResult'],
      bk: 'vitals_probe_reporter', eks: ['vpr.report_generated', 'vpr.insight_found', 'vpr.export_emitted'],
      subjects: ['sven.vpr.report_generated', 'sven.vpr.insight_found', 'sven.vpr.export_emitted'],
      cases: ['vpr_builder', 'vpr_analyst', 'vpr_reporter'],
    },
    {
      name: 'vitals_probe_optimizer', migration: '20260632740000_agent_vitals_probe_optimizer.sql',
      typeFile: 'agent-vitals-probe-optimizer.ts', skillDir: 'vitals-probe-optimizer',
      interfaces: ['VitalsProbeOptPlan', 'VitalsProbeOptConfig', 'VitalsProbeOptResult'],
      bk: 'vitals_probe_optimizer', eks: ['vpo.plan_created', 'vpo.optimization_applied', 'vpo.export_emitted'],
      subjects: ['sven.vpo.plan_created', 'sven.vpo.optimization_applied', 'sven.vpo.export_emitted'],
      cases: ['vpo_planner', 'vpo_executor', 'vpo_reporter'],
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
