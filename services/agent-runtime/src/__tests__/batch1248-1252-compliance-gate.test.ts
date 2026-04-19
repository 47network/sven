import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Compliance Gate management verticals', () => {
  const verticals = [
    {
      name: 'compliance_gate', migration: '20260628850000_agent_compliance_gate.sql',
      typeFile: 'agent-compliance-gate.ts', skillDir: 'compliance-gate',
      interfaces: ['ComplianceGateRule', 'ComplianceGateConfig', 'ComplianceGateResult'],
      bk: 'compliance_gate', eks: ['cg.rule_created', 'cg.config_updated', 'cg.export_emitted'],
      subjects: ['sven.cg.rule_created', 'sven.cg.config_updated', 'sven.cg.export_emitted'],
      cases: ['cg_planner', 'cg_enforcer', 'cg_reporter'],
    },
    {
      name: 'compliance_gate_monitor', migration: '20260628860000_agent_compliance_gate_monitor.sql',
      typeFile: 'agent-compliance-gate-monitor.ts', skillDir: 'compliance-gate-monitor',
      interfaces: ['ComplianceGateMonitorCheck', 'ComplianceGateMonitorConfig', 'ComplianceGateMonitorResult'],
      bk: 'compliance_gate_monitor', eks: ['cgm.check_passed', 'cgm.alert_raised', 'cgm.export_emitted'],
      subjects: ['sven.cgm.check_passed', 'sven.cgm.alert_raised', 'sven.cgm.export_emitted'],
      cases: ['cgm_watcher', 'cgm_alerter', 'cgm_reporter'],
    },
    {
      name: 'compliance_gate_auditor', migration: '20260628870000_agent_compliance_gate_auditor.sql',
      typeFile: 'agent-compliance-gate-auditor.ts', skillDir: 'compliance-gate-auditor',
      interfaces: ['ComplianceGateAuditEntry', 'ComplianceGateAuditConfig', 'ComplianceGateAuditResult'],
      bk: 'compliance_gate_auditor', eks: ['cga.entry_logged', 'cga.violation_found', 'cga.export_emitted'],
      subjects: ['sven.cga.entry_logged', 'sven.cga.violation_found', 'sven.cga.export_emitted'],
      cases: ['cga_scanner', 'cga_enforcer', 'cga_reporter'],
    },
    {
      name: 'compliance_gate_reporter', migration: '20260628880000_agent_compliance_gate_reporter.sql',
      typeFile: 'agent-compliance-gate-reporter.ts', skillDir: 'compliance-gate-reporter',
      interfaces: ['ComplianceGateReport', 'ComplianceGateReportConfig', 'ComplianceGateReportResult'],
      bk: 'compliance_gate_reporter', eks: ['cgr.report_generated', 'cgr.insight_found', 'cgr.export_emitted'],
      subjects: ['sven.cgr.report_generated', 'sven.cgr.insight_found', 'sven.cgr.export_emitted'],
      cases: ['cgr_builder', 'cgr_analyst', 'cgr_reporter'],
    },
    {
      name: 'compliance_gate_optimizer', migration: '20260628890000_agent_compliance_gate_optimizer.sql',
      typeFile: 'agent-compliance-gate-optimizer.ts', skillDir: 'compliance-gate-optimizer',
      interfaces: ['ComplianceGateOptPlan', 'ComplianceGateOptConfig', 'ComplianceGateOptResult'],
      bk: 'compliance_gate_optimizer', eks: ['cgo.plan_created', 'cgo.optimization_applied', 'cgo.export_emitted'],
      subjects: ['sven.cgo.plan_created', 'sven.cgo.optimization_applied', 'sven.cgo.export_emitted'],
      cases: ['cgo_planner', 'cgo_executor', 'cgo_reporter'],
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
