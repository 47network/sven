import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Health Probe management verticals', () => {
  const verticals = [
    {
      name: 'health_probe', migration: '20260628350000_agent_health_probe.sql',
      typeFile: 'agent-health-probe.ts', skillDir: 'health-probe',
      interfaces: ['HealthProbeCheck', 'HealthProbeConfig', 'HealthProbeResult'],
      bk: 'health_probe', eks: ['hp.check_passed', 'hp.config_updated', 'hp.export_emitted'],
      subjects: ['sven.hp.check_passed', 'sven.hp.config_updated', 'sven.hp.export_emitted'],
      cases: ['hp_checker', 'hp_scheduler', 'hp_reporter'],
    },
    {
      name: 'health_probe_monitor', migration: '20260628360000_agent_health_probe_monitor.sql',
      typeFile: 'agent-health-probe-monitor.ts', skillDir: 'health-probe-monitor',
      interfaces: ['HealthProbeMonitorCheck', 'HealthProbeMonitorConfig', 'HealthProbeMonitorResult'],
      bk: 'health_probe_monitor', eks: ['hpm.check_passed', 'hpm.alert_raised', 'hpm.export_emitted'],
      subjects: ['sven.hpm.check_passed', 'sven.hpm.alert_raised', 'sven.hpm.export_emitted'],
      cases: ['hpm_watcher', 'hpm_alerter', 'hpm_reporter'],
    },
    {
      name: 'health_probe_auditor', migration: '20260628370000_agent_health_probe_auditor.sql',
      typeFile: 'agent-health-probe-auditor.ts', skillDir: 'health-probe-auditor',
      interfaces: ['HealthProbeAuditEntry', 'HealthProbeAuditConfig', 'HealthProbeAuditResult'],
      bk: 'health_probe_auditor', eks: ['hpa.entry_logged', 'hpa.violation_found', 'hpa.export_emitted'],
      subjects: ['sven.hpa.entry_logged', 'sven.hpa.violation_found', 'sven.hpa.export_emitted'],
      cases: ['hpa_scanner', 'hpa_enforcer', 'hpa_reporter'],
    },
    {
      name: 'health_probe_reporter', migration: '20260628380000_agent_health_probe_reporter.sql',
      typeFile: 'agent-health-probe-reporter.ts', skillDir: 'health-probe-reporter',
      interfaces: ['HealthProbeReport', 'HealthProbeReportConfig', 'HealthProbeReportResult'],
      bk: 'health_probe_reporter', eks: ['hpr.report_generated', 'hpr.insight_found', 'hpr.export_emitted'],
      subjects: ['sven.hpr.report_generated', 'sven.hpr.insight_found', 'sven.hpr.export_emitted'],
      cases: ['hpr_builder', 'hpr_analyst', 'hpr_reporter'],
    },
    {
      name: 'health_probe_optimizer', migration: '20260628390000_agent_health_probe_optimizer.sql',
      typeFile: 'agent-health-probe-optimizer.ts', skillDir: 'health-probe-optimizer',
      interfaces: ['HealthProbeOptPlan', 'HealthProbeOptConfig', 'HealthProbeOptResult'],
      bk: 'health_probe_optimizer', eks: ['hpo.plan_created', 'hpo.optimization_applied', 'hpo.export_emitted'],
      subjects: ['sven.hpo.plan_created', 'sven.hpo.optimization_applied', 'sven.hpo.export_emitted'],
      cases: ['hpo_planner', 'hpo_executor', 'hpo_reporter'],
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
