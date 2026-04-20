import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Traffic Shaping management verticals', () => {
  const verticals = [
    {
      name: 'traffic_shaping', migration: '20260628100000_agent_traffic_shaping.sql',
      typeFile: 'agent-traffic-shaping.ts', skillDir: 'traffic-shaping',
      interfaces: ['TrafficShapingRule', 'TrafficShapingConfig', 'TrafficShapingResult'],
      bk: 'traffic_shaping', eks: ['ts.rule_created', 'ts.config_updated', 'ts.export_emitted'],
      subjects: ['sven.ts.rule_created', 'sven.ts.config_updated', 'sven.ts.export_emitted'],
      cases: ['ts_planner', 'ts_enforcer', 'ts_reporter'],
    },
    {
      name: 'traffic_shaping_monitor', migration: '20260628110000_agent_traffic_shaping_monitor.sql',
      typeFile: 'agent-traffic-shaping-monitor.ts', skillDir: 'traffic-shaping-monitor',
      interfaces: ['TrafficShapingMonitorCheck', 'TrafficShapingMonitorConfig', 'TrafficShapingMonitorResult'],
      bk: 'traffic_shaping_monitor', eks: ['tsm.check_passed', 'tsm.alert_raised', 'tsm.export_emitted'],
      subjects: ['sven.tsm.check_passed', 'sven.tsm.alert_raised', 'sven.tsm.export_emitted'],
      cases: ['tsm_watcher', 'tsm_alerter', 'tsm_reporter'],
    },
    {
      name: 'traffic_shaping_auditor', migration: '20260628120000_agent_traffic_shaping_auditor.sql',
      typeFile: 'agent-traffic-shaping-auditor.ts', skillDir: 'traffic-shaping-auditor',
      interfaces: ['TrafficShapingAuditEntry', 'TrafficShapingAuditConfig', 'TrafficShapingAuditResult'],
      bk: 'traffic_shaping_auditor', eks: ['tsa.entry_logged', 'tsa.violation_found', 'tsa.export_emitted'],
      subjects: ['sven.tsa.entry_logged', 'sven.tsa.violation_found', 'sven.tsa.export_emitted'],
      cases: ['tsa_scanner', 'tsa_enforcer', 'tsa_reporter'],
    },
    {
      name: 'traffic_shaping_reporter', migration: '20260628130000_agent_traffic_shaping_reporter.sql',
      typeFile: 'agent-traffic-shaping-reporter.ts', skillDir: 'traffic-shaping-reporter',
      interfaces: ['TrafficShapingReport', 'TrafficShapingReportConfig', 'TrafficShapingReportResult'],
      bk: 'traffic_shaping_reporter', eks: ['tsr.report_generated', 'tsr.insight_found', 'tsr.export_emitted'],
      subjects: ['sven.tsr.report_generated', 'sven.tsr.insight_found', 'sven.tsr.export_emitted'],
      cases: ['tsr_builder', 'tsr_analyst', 'tsr_reporter'],
    },
    {
      name: 'traffic_shaping_optimizer', migration: '20260628140000_agent_traffic_shaping_optimizer.sql',
      typeFile: 'agent-traffic-shaping-optimizer.ts', skillDir: 'traffic-shaping-optimizer',
      interfaces: ['TrafficShapingOptPlan', 'TrafficShapingOptConfig', 'TrafficShapingOptResult'],
      bk: 'traffic_shaping_optimizer', eks: ['tso.plan_created', 'tso.optimization_applied', 'tso.export_emitted'],
      subjects: ['sven.tso.plan_created', 'sven.tso.optimization_applied', 'sven.tso.export_emitted'],
      cases: ['tso_planner', 'tso_executor', 'tso_reporter'],
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
