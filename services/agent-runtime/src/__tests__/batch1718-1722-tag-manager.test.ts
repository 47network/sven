import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Tag Manager verticals', () => {
  const verticals = [
    {
      name: 'tag_manager', migration: '20260633550000_agent_tag_manager.sql',
      typeFile: 'agent-tag-manager.ts', skillDir: 'tag-manager',
      interfaces: ['TagManagerEntry', 'TagManagerConfig', 'TagManagerResult'],
      bk: 'tag_manager', eks: ['tm.entry_created', 'tm.config_updated', 'tm.export_emitted'],
      subjects: ['sven.tm.entry_created', 'sven.tm.config_updated', 'sven.tm.export_emitted'],
      cases: ['tm_creator', 'tm_validator', 'tm_reporter'],
    },
    {
      name: 'tag_manager_monitor', migration: '20260633560000_agent_tag_manager_monitor.sql',
      typeFile: 'agent-tag-manager-monitor.ts', skillDir: 'tag-manager-monitor',
      interfaces: ['TagManagerMonitorCheck', 'TagManagerMonitorConfig', 'TagManagerMonitorResult'],
      bk: 'tag_manager_monitor', eks: ['tmm.check_passed', 'tmm.alert_raised', 'tmm.export_emitted'],
      subjects: ['sven.tmm.check_passed', 'sven.tmm.alert_raised', 'sven.tmm.export_emitted'],
      cases: ['tmm_watcher', 'tmm_alerter', 'tmm_reporter'],
    },
    {
      name: 'tag_manager_auditor', migration: '20260633570000_agent_tag_manager_auditor.sql',
      typeFile: 'agent-tag-manager-auditor.ts', skillDir: 'tag-manager-auditor',
      interfaces: ['TagManagerAuditEntry', 'TagManagerAuditConfig', 'TagManagerAuditResult'],
      bk: 'tag_manager_auditor', eks: ['tma.entry_logged', 'tma.violation_found', 'tma.export_emitted'],
      subjects: ['sven.tma.entry_logged', 'sven.tma.violation_found', 'sven.tma.export_emitted'],
      cases: ['tma_scanner', 'tma_enforcer', 'tma_reporter'],
    },
    {
      name: 'tag_manager_reporter', migration: '20260633580000_agent_tag_manager_reporter.sql',
      typeFile: 'agent-tag-manager-reporter.ts', skillDir: 'tag-manager-reporter',
      interfaces: ['TagManagerReport', 'TagManagerReportConfig', 'TagManagerReportResult'],
      bk: 'tag_manager_reporter', eks: ['tmr.report_generated', 'tmr.insight_found', 'tmr.export_emitted'],
      subjects: ['sven.tmr.report_generated', 'sven.tmr.insight_found', 'sven.tmr.export_emitted'],
      cases: ['tmr_builder', 'tmr_analyst', 'tmr_reporter'],
    },
    {
      name: 'tag_manager_optimizer', migration: '20260633590000_agent_tag_manager_optimizer.sql',
      typeFile: 'agent-tag-manager-optimizer.ts', skillDir: 'tag-manager-optimizer',
      interfaces: ['TagManagerOptPlan', 'TagManagerOptConfig', 'TagManagerOptResult'],
      bk: 'tag_manager_optimizer', eks: ['tmo.plan_created', 'tmo.optimization_applied', 'tmo.export_emitted'],
      subjects: ['sven.tmo.plan_created', 'sven.tmo.optimization_applied', 'sven.tmo.export_emitted'],
      cases: ['tmo_planner', 'tmo_executor', 'tmo_reporter'],
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
