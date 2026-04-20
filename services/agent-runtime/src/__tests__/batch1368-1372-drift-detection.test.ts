import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Drift Detection verticals', () => {
  const verticals = [
    {
      name: 'drift_detection', migration: '20260630050000_agent_drift_detection.sql',
      typeFile: 'agent-drift-detection.ts', skillDir: 'drift-detection',
      interfaces: ['DriftDetectionEntry', 'DriftDetectionConfig', 'DriftDetectionResult'],
      bk: 'drift_detection', eks: ['dd.entry_created', 'dd.config_updated', 'dd.export_emitted'],
      subjects: ['sven.dd.entry_created', 'sven.dd.config_updated', 'sven.dd.export_emitted'],
      cases: ['dd_scanner', 'dd_remediator', 'dd_reporter'],
    },
    {
      name: 'drift_detection_monitor', migration: '20260630060000_agent_drift_detection_monitor.sql',
      typeFile: 'agent-drift-detection-monitor.ts', skillDir: 'drift-detection-monitor',
      interfaces: ['DriftDetectionMonitorCheck', 'DriftDetectionMonitorConfig', 'DriftDetectionMonitorResult'],
      bk: 'drift_detection_monitor', eks: ['ddm.check_passed', 'ddm.alert_raised', 'ddm.export_emitted'],
      subjects: ['sven.ddm.check_passed', 'sven.ddm.alert_raised', 'sven.ddm.export_emitted'],
      cases: ['ddm_watcher', 'ddm_alerter', 'ddm_reporter'],
    },
    {
      name: 'drift_detection_auditor', migration: '20260630070000_agent_drift_detection_auditor.sql',
      typeFile: 'agent-drift-detection-auditor.ts', skillDir: 'drift-detection-auditor',
      interfaces: ['DriftDetectionAuditEntry', 'DriftDetectionAuditConfig', 'DriftDetectionAuditResult'],
      bk: 'drift_detection_auditor', eks: ['dda.entry_logged', 'dda.violation_found', 'dda.export_emitted'],
      subjects: ['sven.dda.entry_logged', 'sven.dda.violation_found', 'sven.dda.export_emitted'],
      cases: ['dda_scanner', 'dda_enforcer', 'dda_reporter'],
    },
    {
      name: 'drift_detection_reporter', migration: '20260630080000_agent_drift_detection_reporter.sql',
      typeFile: 'agent-drift-detection-reporter.ts', skillDir: 'drift-detection-reporter',
      interfaces: ['DriftDetectionReport', 'DriftDetectionReportConfig', 'DriftDetectionReportResult'],
      bk: 'drift_detection_reporter', eks: ['ddr.report_generated', 'ddr.insight_found', 'ddr.export_emitted'],
      subjects: ['sven.ddr.report_generated', 'sven.ddr.insight_found', 'sven.ddr.export_emitted'],
      cases: ['ddr_builder', 'ddr_analyst', 'ddr_reporter'],
    },
    {
      name: 'drift_detection_optimizer', migration: '20260630090000_agent_drift_detection_optimizer.sql',
      typeFile: 'agent-drift-detection-optimizer.ts', skillDir: 'drift-detection-optimizer',
      interfaces: ['DriftDetectionOptPlan', 'DriftDetectionOptConfig', 'DriftDetectionOptResult'],
      bk: 'drift_detection_optimizer', eks: ['ddo.plan_created', 'ddo.optimization_applied', 'ddo.export_emitted'],
      subjects: ['sven.ddo.plan_created', 'sven.ddo.optimization_applied', 'sven.ddo.export_emitted'],
      cases: ['ddo_planner', 'ddo_executor', 'ddo_reporter'],
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
