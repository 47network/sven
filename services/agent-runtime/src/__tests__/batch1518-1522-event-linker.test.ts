import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Event Linker verticals', () => {
  const verticals = [
    {
      name: 'event_linker', migration: '20260631550000_agent_event_linker.sql',
      typeFile: 'agent-event-linker.ts', skillDir: 'event-linker',
      interfaces: ['EventLinkerEntry', 'EventLinkerConfig', 'EventLinkerResult'],
      bk: 'event_linker', eks: ['el.entry_created', 'el.config_updated', 'el.export_emitted'],
      subjects: ['sven.el.entry_created', 'sven.el.config_updated', 'sven.el.export_emitted'],
      cases: ['el_correlator', 'el_grouper', 'el_reporter'],
    },
    {
      name: 'event_linker_monitor', migration: '20260631560000_agent_event_linker_monitor.sql',
      typeFile: 'agent-event-linker-monitor.ts', skillDir: 'event-linker-monitor',
      interfaces: ['EventLinkerMonitorCheck', 'EventLinkerMonitorConfig', 'EventLinkerMonitorResult'],
      bk: 'event_linker_monitor', eks: ['elm.check_passed', 'elm.alert_raised', 'elm.export_emitted'],
      subjects: ['sven.elm.check_passed', 'sven.elm.alert_raised', 'sven.elm.export_emitted'],
      cases: ['elm_watcher', 'elm_alerter', 'elm_reporter'],
    },
    {
      name: 'event_linker_auditor', migration: '20260631570000_agent_event_linker_auditor.sql',
      typeFile: 'agent-event-linker-auditor.ts', skillDir: 'event-linker-auditor',
      interfaces: ['EventLinkerAuditEntry', 'EventLinkerAuditConfig', 'EventLinkerAuditResult'],
      bk: 'event_linker_auditor', eks: ['ela.entry_logged', 'ela.violation_found', 'ela.export_emitted'],
      subjects: ['sven.ela.entry_logged', 'sven.ela.violation_found', 'sven.ela.export_emitted'],
      cases: ['ela_scanner', 'ela_enforcer', 'ela_reporter'],
    },
    {
      name: 'event_linker_reporter', migration: '20260631580000_agent_event_linker_reporter.sql',
      typeFile: 'agent-event-linker-reporter.ts', skillDir: 'event-linker-reporter',
      interfaces: ['EventLinkerReport', 'EventLinkerReportConfig', 'EventLinkerReportResult'],
      bk: 'event_linker_reporter', eks: ['elr.report_generated', 'elr.insight_found', 'elr.export_emitted'],
      subjects: ['sven.elr.report_generated', 'sven.elr.insight_found', 'sven.elr.export_emitted'],
      cases: ['elr_builder', 'elr_analyst', 'elr_reporter'],
    },
    {
      name: 'event_linker_optimizer', migration: '20260631590000_agent_event_linker_optimizer.sql',
      typeFile: 'agent-event-linker-optimizer.ts', skillDir: 'event-linker-optimizer',
      interfaces: ['EventLinkerOptPlan', 'EventLinkerOptConfig', 'EventLinkerOptResult'],
      bk: 'event_linker_optimizer', eks: ['elo.plan_created', 'elo.optimization_applied', 'elo.export_emitted'],
      subjects: ['sven.elo.plan_created', 'sven.elo.optimization_applied', 'sven.elo.export_emitted'],
      cases: ['elo_planner', 'elo_executor', 'elo_reporter'],
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
