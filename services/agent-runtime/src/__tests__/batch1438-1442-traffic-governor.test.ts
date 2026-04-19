import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Traffic Governor verticals', () => {
  const verticals = [
    {
      name: 'traffic_governor', migration: '20260630750000_agent_traffic_governor.sql',
      typeFile: 'agent-traffic-governor.ts', skillDir: 'traffic-governor',
      interfaces: ['TrafficGovernorEntry', 'TrafficGovernorConfig', 'TrafficGovernorResult'],
      bk: 'traffic_governor', eks: ['tg.entry_created', 'tg.config_updated', 'tg.export_emitted'],
      subjects: ['sven.tg.entry_created', 'sven.tg.config_updated', 'sven.tg.export_emitted'],
      cases: ['tg_shaper', 'tg_limiter', 'tg_reporter'],
    },
    {
      name: 'traffic_governor_monitor', migration: '20260630760000_agent_traffic_governor_monitor.sql',
      typeFile: 'agent-traffic-governor-monitor.ts', skillDir: 'traffic-governor-monitor',
      interfaces: ['TrafficGovernorMonitorCheck', 'TrafficGovernorMonitorConfig', 'TrafficGovernorMonitorResult'],
      bk: 'traffic_governor_monitor', eks: ['tgm.check_passed', 'tgm.alert_raised', 'tgm.export_emitted'],
      subjects: ['sven.tgm.check_passed', 'sven.tgm.alert_raised', 'sven.tgm.export_emitted'],
      cases: ['tgm_watcher', 'tgm_alerter', 'tgm_reporter'],
    },
    {
      name: 'traffic_governor_auditor', migration: '20260630770000_agent_traffic_governor_auditor.sql',
      typeFile: 'agent-traffic-governor-auditor.ts', skillDir: 'traffic-governor-auditor',
      interfaces: ['TrafficGovernorAuditEntry', 'TrafficGovernorAuditConfig', 'TrafficGovernorAuditResult'],
      bk: 'traffic_governor_auditor', eks: ['tga.entry_logged', 'tga.violation_found', 'tga.export_emitted'],
      subjects: ['sven.tga.entry_logged', 'sven.tga.violation_found', 'sven.tga.export_emitted'],
      cases: ['tga_scanner', 'tga_enforcer', 'tga_reporter'],
    },
    {
      name: 'traffic_governor_reporter', migration: '20260630780000_agent_traffic_governor_reporter.sql',
      typeFile: 'agent-traffic-governor-reporter.ts', skillDir: 'traffic-governor-reporter',
      interfaces: ['TrafficGovernorReport', 'TrafficGovernorReportConfig', 'TrafficGovernorReportResult'],
      bk: 'traffic_governor_reporter', eks: ['tgr.report_generated', 'tgr.insight_found', 'tgr.export_emitted'],
      subjects: ['sven.tgr.report_generated', 'sven.tgr.insight_found', 'sven.tgr.export_emitted'],
      cases: ['tgr_builder', 'tgr_analyst', 'tgr_reporter'],
    },
    {
      name: 'traffic_governor_optimizer', migration: '20260630790000_agent_traffic_governor_optimizer.sql',
      typeFile: 'agent-traffic-governor-optimizer.ts', skillDir: 'traffic-governor-optimizer',
      interfaces: ['TrafficGovernorOptPlan', 'TrafficGovernorOptConfig', 'TrafficGovernorOptResult'],
      bk: 'traffic_governor_optimizer', eks: ['tgo.plan_created', 'tgo.optimization_applied', 'tgo.export_emitted'],
      subjects: ['sven.tgo.plan_created', 'sven.tgo.optimization_applied', 'sven.tgo.export_emitted'],
      cases: ['tgo_planner', 'tgo_executor', 'tgo_reporter'],
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
