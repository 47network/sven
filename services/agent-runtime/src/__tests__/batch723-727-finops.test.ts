import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 723-727: FinOps', () => {
  const verticals = [
    {
      name: 'license_compliance_auditor', migration: '20260623600000_agent_license_compliance_auditor.sql',
      typeFile: 'agent-license-compliance-auditor.ts', skillDir: 'license-compliance-auditor',
      interfaces: ['LicenseComplianceAuditorConfig', 'LicenseAudit', 'AuditorEvent'],
      bk: 'license_compliance_auditor', eks: ['lcau.scan_completed', 'lcau.violation_found', 'lcau.expiration_alerted', 'lcau.report_published'],
      subjects: ['sven.lcau.scan_completed', 'sven.lcau.violation_found', 'sven.lcau.expiration_alerted', 'sven.lcau.report_published'],
      cases: ['lcau_scan', 'lcau_find', 'lcau_alert', 'lcau_publish', 'lcau_report', 'lcau_monitor'],
    },
    {
      name: 'cost_anomaly_detector', migration: '20260623610000_agent_cost_anomaly_detector.sql',
      typeFile: 'agent-cost-anomaly-detector.ts', skillDir: 'cost-anomaly-detector',
      interfaces: ['CostAnomalyDetectorConfig', 'CostAnomaly', 'DetectorEvent'],
      bk: 'cost_anomaly_detector', eks: ['cadt.anomaly_detected', 'cadt.baseline_updated', 'cadt.root_cause_identified', 'cadt.alert_triggered'],
      subjects: ['sven.cadt.anomaly_detected', 'sven.cadt.baseline_updated', 'sven.cadt.root_cause_identified', 'sven.cadt.alert_triggered'],
      cases: ['cadt_detect', 'cadt_update', 'cadt_identify', 'cadt_trigger', 'cadt_report', 'cadt_monitor'],
    },
    {
      name: 'budget_enforcer', migration: '20260623620000_agent_budget_enforcer.sql',
      typeFile: 'agent-budget-enforcer.ts', skillDir: 'budget-enforcer',
      interfaces: ['BudgetEnforcerConfig', 'Budget', 'EnforcerEvent'],
      bk: 'budget_enforcer', eks: ['bdef.budget_set', 'bdef.threshold_crossed', 'bdef.action_taken', 'bdef.period_reset'],
      subjects: ['sven.bdef.budget_set', 'sven.bdef.threshold_crossed', 'sven.bdef.action_taken', 'sven.bdef.period_reset'],
      cases: ['bdef_set', 'bdef_cross', 'bdef_act', 'bdef_reset', 'bdef_report', 'bdef_monitor'],
    },
    {
      name: 'cloud_billing_optimizer', migration: '20260623630000_agent_cloud_billing_optimizer.sql',
      typeFile: 'agent-cloud-billing-optimizer.ts', skillDir: 'cloud-billing-optimizer',
      interfaces: ['CloudBillingOptimizerConfig', 'OptimizationRecommendation', 'OptimizerEvent'],
      bk: 'cloud_billing_optimizer', eks: ['cbop.recommendation_generated', 'cbop.savings_calculated', 'cbop.action_applied', 'cbop.report_delivered'],
      subjects: ['sven.cbop.recommendation_generated', 'sven.cbop.savings_calculated', 'sven.cbop.action_applied', 'sven.cbop.report_delivered'],
      cases: ['cbop_generate', 'cbop_calculate', 'cbop_apply', 'cbop_deliver', 'cbop_report', 'cbop_monitor'],
    },
    {
      name: 'reservation_planner', migration: '20260623640000_agent_reservation_planner.sql',
      typeFile: 'agent-reservation-planner.ts', skillDir: 'reservation-planner',
      interfaces: ['ReservationPlannerConfig', 'ReservationPlan', 'PlannerEvent'],
      bk: 'reservation_planner', eks: ['rspl.usage_analyzed', 'rspl.commitment_recommended', 'rspl.purchase_executed', 'rspl.coverage_optimized'],
      subjects: ['sven.rspl.usage_analyzed', 'sven.rspl.commitment_recommended', 'sven.rspl.purchase_executed', 'sven.rspl.coverage_optimized'],
      cases: ['rspl_analyze', 'rspl_recommend', 'rspl_execute', 'rspl_optimize', 'rspl_report', 'rspl_monitor'],
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
