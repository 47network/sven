import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Config Drift management verticals', () => {
  const verticals = [
    {
      name: 'config_drift', migration: '20260628600000_agent_config_drift.sql',
      typeFile: 'agent-config-drift.ts', skillDir: 'config-drift',
      interfaces: ['ConfigDriftEntry', 'ConfigDriftConfig', 'ConfigDriftResult'],
      bk: 'config_drift', eks: ['cfd.entry_detected', 'cfd.config_updated', 'cfd.export_emitted'],
      subjects: ['sven.cfd.entry_detected', 'sven.cfd.config_updated', 'sven.cfd.export_emitted'],
      cases: ['cfd_detector', 'cfd_reconciler', 'cfd_reporter'],
    },
    {
      name: 'config_drift_monitor', migration: '20260628610000_agent_config_drift_monitor.sql',
      typeFile: 'agent-config-drift-monitor.ts', skillDir: 'config-drift-monitor',
      interfaces: ['ConfigDriftMonitorCheck', 'ConfigDriftMonitorConfig', 'ConfigDriftMonitorResult'],
      bk: 'config_drift_monitor', eks: ['cfdm.check_passed', 'cfdm.alert_raised', 'cfdm.export_emitted'],
      subjects: ['sven.cfdm.check_passed', 'sven.cfdm.alert_raised', 'sven.cfdm.export_emitted'],
      cases: ['cfdm_watcher', 'cfdm_alerter', 'cfdm_reporter'],
    },
    {
      name: 'config_drift_auditor', migration: '20260628620000_agent_config_drift_auditor.sql',
      typeFile: 'agent-config-drift-auditor.ts', skillDir: 'config-drift-auditor',
      interfaces: ['ConfigDriftAuditEntry', 'ConfigDriftAuditConfig', 'ConfigDriftAuditResult'],
      bk: 'config_drift_auditor', eks: ['cfda.entry_logged', 'cfda.violation_found', 'cfda.export_emitted'],
      subjects: ['sven.cfda.entry_logged', 'sven.cfda.violation_found', 'sven.cfda.export_emitted'],
      cases: ['cfda_scanner', 'cfda_enforcer', 'cfda_reporter'],
    },
    {
      name: 'config_drift_reporter', migration: '20260628630000_agent_config_drift_reporter.sql',
      typeFile: 'agent-config-drift-reporter.ts', skillDir: 'config-drift-reporter',
      interfaces: ['ConfigDriftReport', 'ConfigDriftReportConfig', 'ConfigDriftReportResult'],
      bk: 'config_drift_reporter', eks: ['cfdr.report_generated', 'cfdr.insight_found', 'cfdr.export_emitted'],
      subjects: ['sven.cfdr.report_generated', 'sven.cfdr.insight_found', 'sven.cfdr.export_emitted'],
      cases: ['cfdr_builder', 'cfdr_analyst', 'cfdr_reporter'],
    },
    {
      name: 'config_drift_optimizer', migration: '20260628640000_agent_config_drift_optimizer.sql',
      typeFile: 'agent-config-drift-optimizer.ts', skillDir: 'config-drift-optimizer',
      interfaces: ['ConfigDriftOptPlan', 'ConfigDriftOptConfig', 'ConfigDriftOptResult'],
      bk: 'config_drift_optimizer', eks: ['cfdo.plan_created', 'cfdo.optimization_applied', 'cfdo.export_emitted'],
      subjects: ['sven.cfdo.plan_created', 'sven.cfdo.optimization_applied', 'sven.cfdo.export_emitted'],
      cases: ['cfdo_planner', 'cfdo_executor', 'cfdo_reporter'],
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
