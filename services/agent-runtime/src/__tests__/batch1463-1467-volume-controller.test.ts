import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Volume Controller verticals', () => {
  const verticals = [
    {
      name: 'volume_controller', migration: '20260631000000_agent_volume_controller.sql',
      typeFile: 'agent-volume-controller.ts', skillDir: 'volume-controller',
      interfaces: ['VolumeControllerEntry', 'VolumeControllerConfig', 'VolumeControllerResult'],
      bk: 'volume_controller', eks: ['vc.entry_created', 'vc.config_updated', 'vc.export_emitted'],
      subjects: ['sven.vc.entry_created', 'sven.vc.config_updated', 'sven.vc.export_emitted'],
      cases: ['vc_manager', 'vc_resizer', 'vc_reporter'],
    },
    {
      name: 'volume_controller_monitor', migration: '20260631010000_agent_volume_controller_monitor.sql',
      typeFile: 'agent-volume-controller-monitor.ts', skillDir: 'volume-controller-monitor',
      interfaces: ['VolumeControllerMonitorCheck', 'VolumeControllerMonitorConfig', 'VolumeControllerMonitorResult'],
      bk: 'volume_controller_monitor', eks: ['vcm.check_passed', 'vcm.alert_raised', 'vcm.export_emitted'],
      subjects: ['sven.vcm.check_passed', 'sven.vcm.alert_raised', 'sven.vcm.export_emitted'],
      cases: ['vcm_watcher', 'vcm_alerter', 'vcm_reporter'],
    },
    {
      name: 'volume_controller_auditor', migration: '20260631020000_agent_volume_controller_auditor.sql',
      typeFile: 'agent-volume-controller-auditor.ts', skillDir: 'volume-controller-auditor',
      interfaces: ['VolumeControllerAuditEntry', 'VolumeControllerAuditConfig', 'VolumeControllerAuditResult'],
      bk: 'volume_controller_auditor', eks: ['vca.entry_logged', 'vca.violation_found', 'vca.export_emitted'],
      subjects: ['sven.vca.entry_logged', 'sven.vca.violation_found', 'sven.vca.export_emitted'],
      cases: ['vca_scanner', 'vca_enforcer', 'vca_reporter'],
    },
    {
      name: 'volume_controller_reporter', migration: '20260631030000_agent_volume_controller_reporter.sql',
      typeFile: 'agent-volume-controller-reporter.ts', skillDir: 'volume-controller-reporter',
      interfaces: ['VolumeControllerReport', 'VolumeControllerReportConfig', 'VolumeControllerReportResult'],
      bk: 'volume_controller_reporter', eks: ['vcr.report_generated', 'vcr.insight_found', 'vcr.export_emitted'],
      subjects: ['sven.vcr.report_generated', 'sven.vcr.insight_found', 'sven.vcr.export_emitted'],
      cases: ['vcr_builder', 'vcr_analyst', 'vcr_reporter'],
    },
    {
      name: 'volume_controller_optimizer', migration: '20260631040000_agent_volume_controller_optimizer.sql',
      typeFile: 'agent-volume-controller-optimizer.ts', skillDir: 'volume-controller-optimizer',
      interfaces: ['VolumeControllerOptPlan', 'VolumeControllerOptConfig', 'VolumeControllerOptResult'],
      bk: 'volume_controller_optimizer', eks: ['vco.plan_created', 'vco.optimization_applied', 'vco.export_emitted'],
      subjects: ['sven.vco.plan_created', 'sven.vco.optimization_applied', 'sven.vco.export_emitted'],
      cases: ['vco_planner', 'vco_executor', 'vco_reporter'],
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
