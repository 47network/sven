import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Anomaly Spotter verticals', () => {
  const verticals = [
    {
      name: 'anomaly_spotter', migration: '20260631600000_agent_anomaly_spotter.sql',
      typeFile: 'agent-anomaly-spotter.ts', skillDir: 'anomaly-spotter',
      interfaces: ['AnomalySpotterEntry', 'AnomalySpotterConfig', 'AnomalySpotterResult'],
      bk: 'anomaly_spotter', eks: ['as.entry_created', 'as.config_updated', 'as.export_emitted'],
      subjects: ['sven.as.entry_created', 'sven.as.config_updated', 'sven.as.export_emitted'],
      cases: ['as_detector', 'as_classifier', 'as_reporter'],
    },
    {
      name: 'anomaly_spotter_monitor', migration: '20260631610000_agent_anomaly_spotter_monitor.sql',
      typeFile: 'agent-anomaly-spotter-monitor.ts', skillDir: 'anomaly-spotter-monitor',
      interfaces: ['AnomalySpotterMonitorCheck', 'AnomalySpotterMonitorConfig', 'AnomalySpotterMonitorResult'],
      bk: 'anomaly_spotter_monitor', eks: ['asm.check_passed', 'asm.alert_raised', 'asm.export_emitted'],
      subjects: ['sven.asm.check_passed', 'sven.asm.alert_raised', 'sven.asm.export_emitted'],
      cases: ['asm_watcher', 'asm_alerter', 'asm_reporter'],
    },
    {
      name: 'anomaly_spotter_auditor', migration: '20260631620000_agent_anomaly_spotter_auditor.sql',
      typeFile: 'agent-anomaly-spotter-auditor.ts', skillDir: 'anomaly-spotter-auditor',
      interfaces: ['AnomalySpotterAuditEntry', 'AnomalySpotterAuditConfig', 'AnomalySpotterAuditResult'],
      bk: 'anomaly_spotter_auditor', eks: ['asa.entry_logged', 'asa.violation_found', 'asa.export_emitted'],
      subjects: ['sven.asa.entry_logged', 'sven.asa.violation_found', 'sven.asa.export_emitted'],
      cases: ['asa_scanner', 'asa_enforcer', 'asa_reporter'],
    },
    {
      name: 'anomaly_spotter_reporter', migration: '20260631630000_agent_anomaly_spotter_reporter.sql',
      typeFile: 'agent-anomaly-spotter-reporter.ts', skillDir: 'anomaly-spotter-reporter',
      interfaces: ['AnomalySpotterReport', 'AnomalySpotterReportConfig', 'AnomalySpotterReportResult'],
      bk: 'anomaly_spotter_reporter', eks: ['asr.report_generated', 'asr.insight_found', 'asr.export_emitted'],
      subjects: ['sven.asr.report_generated', 'sven.asr.insight_found', 'sven.asr.export_emitted'],
      cases: ['asr_builder', 'asr_analyst', 'asr_reporter'],
    },
    {
      name: 'anomaly_spotter_optimizer', migration: '20260631640000_agent_anomaly_spotter_optimizer.sql',
      typeFile: 'agent-anomaly-spotter-optimizer.ts', skillDir: 'anomaly-spotter-optimizer',
      interfaces: ['AnomalySpotterOptPlan', 'AnomalySpotterOptConfig', 'AnomalySpotterOptResult'],
      bk: 'anomaly_spotter_optimizer', eks: ['aso.plan_created', 'aso.optimization_applied', 'aso.export_emitted'],
      subjects: ['sven.aso.plan_created', 'sven.aso.optimization_applied', 'sven.aso.export_emitted'],
      cases: ['aso_planner', 'aso_executor', 'aso_reporter'],
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
