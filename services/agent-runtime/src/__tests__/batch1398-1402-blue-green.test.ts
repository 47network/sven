import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Blue Green verticals', () => {
  const verticals = [
    {
      name: 'blue_green', migration: '20260630350000_agent_blue_green.sql',
      typeFile: 'agent-blue-green.ts', skillDir: 'blue-green',
      interfaces: ['BlueGreenEntry', 'BlueGreenConfig', 'BlueGreenResult'],
      bk: 'blue_green', eks: ['bg.entry_created', 'bg.config_updated', 'bg.export_emitted'],
      subjects: ['sven.bg.entry_created', 'sven.bg.config_updated', 'sven.bg.export_emitted'],
      cases: ['bg_planner', 'bg_switcher', 'bg_reporter'],
    },
    {
      name: 'blue_green_monitor', migration: '20260630360000_agent_blue_green_monitor.sql',
      typeFile: 'agent-blue-green-monitor.ts', skillDir: 'blue-green-monitor',
      interfaces: ['BlueGreenMonitorCheck', 'BlueGreenMonitorConfig', 'BlueGreenMonitorResult'],
      bk: 'blue_green_monitor', eks: ['bgm.check_passed', 'bgm.alert_raised', 'bgm.export_emitted'],
      subjects: ['sven.bgm.check_passed', 'sven.bgm.alert_raised', 'sven.bgm.export_emitted'],
      cases: ['bgm_watcher', 'bgm_alerter', 'bgm_reporter'],
    },
    {
      name: 'blue_green_auditor', migration: '20260630370000_agent_blue_green_auditor.sql',
      typeFile: 'agent-blue-green-auditor.ts', skillDir: 'blue-green-auditor',
      interfaces: ['BlueGreenAuditEntry', 'BlueGreenAuditConfig', 'BlueGreenAuditResult'],
      bk: 'blue_green_auditor', eks: ['bga.entry_logged', 'bga.violation_found', 'bga.export_emitted'],
      subjects: ['sven.bga.entry_logged', 'sven.bga.violation_found', 'sven.bga.export_emitted'],
      cases: ['bga_scanner', 'bga_enforcer', 'bga_reporter'],
    },
    {
      name: 'blue_green_reporter', migration: '20260630380000_agent_blue_green_reporter.sql',
      typeFile: 'agent-blue-green-reporter.ts', skillDir: 'blue-green-reporter',
      interfaces: ['BlueGreenReport', 'BlueGreenReportConfig', 'BlueGreenReportResult'],
      bk: 'blue_green_reporter', eks: ['bgr.report_generated', 'bgr.insight_found', 'bgr.export_emitted'],
      subjects: ['sven.bgr.report_generated', 'sven.bgr.insight_found', 'sven.bgr.export_emitted'],
      cases: ['bgr_builder', 'bgr_analyst', 'bgr_reporter'],
    },
    {
      name: 'blue_green_optimizer', migration: '20260630390000_agent_blue_green_optimizer.sql',
      typeFile: 'agent-blue-green-optimizer.ts', skillDir: 'blue-green-optimizer',
      interfaces: ['BlueGreenOptPlan', 'BlueGreenOptConfig', 'BlueGreenOptResult'],
      bk: 'blue_green_optimizer', eks: ['bgo.plan_created', 'bgo.optimization_applied', 'bgo.export_emitted'],
      subjects: ['sven.bgo.plan_created', 'sven.bgo.optimization_applied', 'sven.bgo.export_emitted'],
      cases: ['bgo_planner', 'bgo_executor', 'bgo_reporter'],
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
