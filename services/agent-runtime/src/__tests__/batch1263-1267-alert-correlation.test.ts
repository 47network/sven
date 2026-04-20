import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Alert Correlation management verticals', () => {
  const verticals = [
    {
      name: 'alert_correlation', migration: '20260629000000_agent_alert_correlation.sql',
      typeFile: 'agent-alert-correlation.ts', skillDir: 'alert-correlation',
      interfaces: ['AlertCorrelationRule', 'AlertCorrelationConfig', 'AlertCorrelationResult'],
      bk: 'alert_correlation', eks: ['alc.rule_created', 'alc.config_updated', 'alc.export_emitted'],
      subjects: ['sven.alc.rule_created', 'sven.alc.config_updated', 'sven.alc.export_emitted'],
      cases: ['alc_planner', 'alc_correlator', 'alc_reporter'],
    },
    {
      name: 'alert_correlation_monitor', migration: '20260629010000_agent_alert_correlation_monitor.sql',
      typeFile: 'agent-alert-correlation-monitor.ts', skillDir: 'alert-correlation-monitor',
      interfaces: ['AlertCorrelationMonitorCheck', 'AlertCorrelationMonitorConfig', 'AlertCorrelationMonitorResult'],
      bk: 'alert_correlation_monitor', eks: ['alcm.check_passed', 'alcm.alert_raised', 'alcm.export_emitted'],
      subjects: ['sven.alcm.check_passed', 'sven.alcm.alert_raised', 'sven.alcm.export_emitted'],
      cases: ['alcm_watcher', 'alcm_alerter', 'alcm_reporter'],
    },
    {
      name: 'alert_correlation_auditor', migration: '20260629020000_agent_alert_correlation_auditor.sql',
      typeFile: 'agent-alert-correlation-auditor.ts', skillDir: 'alert-correlation-auditor',
      interfaces: ['AlertCorrelationAuditEntry', 'AlertCorrelationAuditConfig', 'AlertCorrelationAuditResult'],
      bk: 'alert_correlation_auditor', eks: ['alca.entry_logged', 'alca.violation_found', 'alca.export_emitted'],
      subjects: ['sven.alca.entry_logged', 'sven.alca.violation_found', 'sven.alca.export_emitted'],
      cases: ['alca_scanner', 'alca_enforcer', 'alca_reporter'],
    },
    {
      name: 'alert_correlation_reporter', migration: '20260629030000_agent_alert_correlation_reporter.sql',
      typeFile: 'agent-alert-correlation-reporter.ts', skillDir: 'alert-correlation-reporter',
      interfaces: ['AlertCorrelationReport', 'AlertCorrelationReportConfig', 'AlertCorrelationReportResult'],
      bk: 'alert_correlation_reporter', eks: ['alcr.report_generated', 'alcr.insight_found', 'alcr.export_emitted'],
      subjects: ['sven.alcr.report_generated', 'sven.alcr.insight_found', 'sven.alcr.export_emitted'],
      cases: ['alcr_builder', 'alcr_analyst', 'alcr_reporter'],
    },
    {
      name: 'alert_correlation_optimizer', migration: '20260629040000_agent_alert_correlation_optimizer.sql',
      typeFile: 'agent-alert-correlation-optimizer.ts', skillDir: 'alert-correlation-optimizer',
      interfaces: ['AlertCorrelationOptPlan', 'AlertCorrelationOptConfig', 'AlertCorrelationOptResult'],
      bk: 'alert_correlation_optimizer', eks: ['alco.plan_created', 'alco.optimization_applied', 'alco.export_emitted'],
      subjects: ['sven.alco.plan_created', 'sven.alco.optimization_applied', 'sven.alco.export_emitted'],
      cases: ['alco_planner', 'alco_executor', 'alco_reporter'],
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
