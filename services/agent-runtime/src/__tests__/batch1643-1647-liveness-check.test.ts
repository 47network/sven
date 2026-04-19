import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Liveness Check verticals', () => {
  const verticals = [
    {
      name: 'liveness_check', migration: '20260632800000_agent_liveness_check.sql',
      typeFile: 'agent-liveness-check.ts', skillDir: 'liveness-check',
      interfaces: ['LivenessCheckEntry', 'LivenessCheckConfig', 'LivenessCheckResult'],
      bk: 'liveness_check', eks: ['lc.entry_created', 'lc.config_updated', 'lc.export_emitted'],
      subjects: ['sven.lc.entry_created', 'sven.lc.config_updated', 'sven.lc.export_emitted'],
      cases: ['lc_verifier', 'lc_pinger', 'lc_reporter'],
    },
    {
      name: 'liveness_check_monitor', migration: '20260632810000_agent_liveness_check_monitor.sql',
      typeFile: 'agent-liveness-check-monitor.ts', skillDir: 'liveness-check-monitor',
      interfaces: ['LivenessCheckMonitorCheck', 'LivenessCheckMonitorConfig', 'LivenessCheckMonitorResult'],
      bk: 'liveness_check_monitor', eks: ['lcm.check_passed', 'lcm.alert_raised', 'lcm.export_emitted'],
      subjects: ['sven.lcm.check_passed', 'sven.lcm.alert_raised', 'sven.lcm.export_emitted'],
      cases: ['lcm_watcher', 'lcm_alerter', 'lcm_reporter'],
    },
    {
      name: 'liveness_check_auditor', migration: '20260632820000_agent_liveness_check_auditor.sql',
      typeFile: 'agent-liveness-check-auditor.ts', skillDir: 'liveness-check-auditor',
      interfaces: ['LivenessCheckAuditEntry', 'LivenessCheckAuditConfig', 'LivenessCheckAuditResult'],
      bk: 'liveness_check_auditor', eks: ['lca.entry_logged', 'lca.violation_found', 'lca.export_emitted'],
      subjects: ['sven.lca.entry_logged', 'sven.lca.violation_found', 'sven.lca.export_emitted'],
      cases: ['lca_scanner', 'lca_enforcer', 'lca_reporter'],
    },
    {
      name: 'liveness_check_reporter', migration: '20260632830000_agent_liveness_check_reporter.sql',
      typeFile: 'agent-liveness-check-reporter.ts', skillDir: 'liveness-check-reporter',
      interfaces: ['LivenessCheckReport', 'LivenessCheckReportConfig', 'LivenessCheckReportResult'],
      bk: 'liveness_check_reporter', eks: ['lcr.report_generated', 'lcr.insight_found', 'lcr.export_emitted'],
      subjects: ['sven.lcr.report_generated', 'sven.lcr.insight_found', 'sven.lcr.export_emitted'],
      cases: ['lcr_builder', 'lcr_analyst', 'lcr_reporter'],
    },
    {
      name: 'liveness_check_optimizer', migration: '20260632840000_agent_liveness_check_optimizer.sql',
      typeFile: 'agent-liveness-check-optimizer.ts', skillDir: 'liveness-check-optimizer',
      interfaces: ['LivenessCheckOptPlan', 'LivenessCheckOptConfig', 'LivenessCheckOptResult'],
      bk: 'liveness_check_optimizer', eks: ['lco.plan_created', 'lco.optimization_applied', 'lco.export_emitted'],
      subjects: ['sven.lco.plan_created', 'sven.lco.optimization_applied', 'sven.lco.export_emitted'],
      cases: ['lco_planner', 'lco_executor', 'lco_reporter'],
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
