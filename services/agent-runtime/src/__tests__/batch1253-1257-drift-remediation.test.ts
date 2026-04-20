import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Drift Remediation management verticals', () => {
  const verticals = [
    {
      name: 'drift_remediation', migration: '20260628900000_agent_drift_remediation.sql',
      typeFile: 'agent-drift-remediation.ts', skillDir: 'drift-remediation',
      interfaces: ['DriftRemediationPlan', 'DriftRemediationConfig', 'DriftRemediationResult'],
      bk: 'drift_remediation', eks: ['dr.plan_created', 'dr.config_updated', 'dr.export_emitted'],
      subjects: ['sven.dr.plan_created', 'sven.dr.config_updated', 'sven.dr.export_emitted'],
      cases: ['dr_planner', 'dr_executor', 'dr_reporter'],
    },
    {
      name: 'drift_remediation_monitor', migration: '20260628910000_agent_drift_remediation_monitor.sql',
      typeFile: 'agent-drift-remediation-monitor.ts', skillDir: 'drift-remediation-monitor',
      interfaces: ['DriftRemediationMonitorCheck', 'DriftRemediationMonitorConfig', 'DriftRemediationMonitorResult'],
      bk: 'drift_remediation_monitor', eks: ['drm.check_passed', 'drm.alert_raised', 'drm.export_emitted'],
      subjects: ['sven.drm.check_passed', 'sven.drm.alert_raised', 'sven.drm.export_emitted'],
      cases: ['drm_watcher', 'drm_alerter', 'drm_reporter'],
    },
    {
      name: 'drift_remediation_auditor', migration: '20260628920000_agent_drift_remediation_auditor.sql',
      typeFile: 'agent-drift-remediation-auditor.ts', skillDir: 'drift-remediation-auditor',
      interfaces: ['DriftRemediationAuditEntry', 'DriftRemediationAuditConfig', 'DriftRemediationAuditResult'],
      bk: 'drift_remediation_auditor', eks: ['dra.entry_logged', 'dra.violation_found', 'dra.export_emitted'],
      subjects: ['sven.dra.entry_logged', 'sven.dra.violation_found', 'sven.dra.export_emitted'],
      cases: ['dra_scanner', 'dra_enforcer', 'dra_reporter'],
    },
    {
      name: 'drift_remediation_reporter', migration: '20260628930000_agent_drift_remediation_reporter.sql',
      typeFile: 'agent-drift-remediation-reporter.ts', skillDir: 'drift-remediation-reporter',
      interfaces: ['DriftRemediationReport', 'DriftRemediationReportConfig', 'DriftRemediationReportResult'],
      bk: 'drift_remediation_reporter', eks: ['drr.report_generated', 'drr.insight_found', 'drr.export_emitted'],
      subjects: ['sven.drr.report_generated', 'sven.drr.insight_found', 'sven.drr.export_emitted'],
      cases: ['drr_builder', 'drr_analyst', 'drr_reporter'],
    },
    {
      name: 'drift_remediation_optimizer', migration: '20260628940000_agent_drift_remediation_optimizer.sql',
      typeFile: 'agent-drift-remediation-optimizer.ts', skillDir: 'drift-remediation-optimizer',
      interfaces: ['DriftRemediationOptPlan', 'DriftRemediationOptConfig', 'DriftRemediationOptResult'],
      bk: 'drift_remediation_optimizer', eks: ['dro.plan_created', 'dro.optimization_applied', 'dro.export_emitted'],
      subjects: ['sven.dro.plan_created', 'sven.dro.optimization_applied', 'sven.dro.export_emitted'],
      cases: ['dro_planner', 'dro_executor', 'dro_reporter'],
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
