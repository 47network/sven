import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Event Bridge verticals', () => {
  const verticals = [
    {
      name: 'event_bridge', migration: '20260632250000_agent_event_bridge.sql',
      typeFile: 'agent-event-bridge.ts', skillDir: 'event-bridge',
      interfaces: ['EventBridgeEntry', 'EventBridgeConfig', 'EventBridgeResult'],
      bk: 'event_bridge', eks: ['eb.entry_created', 'eb.config_updated', 'eb.export_emitted'],
      subjects: ['sven.eb.entry_created', 'sven.eb.config_updated', 'sven.eb.export_emitted'],
      cases: ['eb_router', 'eb_transformer', 'eb_reporter'],
    },
    {
      name: 'event_bridge_monitor', migration: '20260632260000_agent_event_bridge_monitor.sql',
      typeFile: 'agent-event-bridge-monitor.ts', skillDir: 'event-bridge-monitor',
      interfaces: ['EventBridgeMonitorCheck', 'EventBridgeMonitorConfig', 'EventBridgeMonitorResult'],
      bk: 'event_bridge_monitor', eks: ['ebm.check_passed', 'ebm.alert_raised', 'ebm.export_emitted'],
      subjects: ['sven.ebm.check_passed', 'sven.ebm.alert_raised', 'sven.ebm.export_emitted'],
      cases: ['ebm_watcher', 'ebm_alerter', 'ebm_reporter'],
    },
    {
      name: 'event_bridge_auditor', migration: '20260632270000_agent_event_bridge_auditor.sql',
      typeFile: 'agent-event-bridge-auditor.ts', skillDir: 'event-bridge-auditor',
      interfaces: ['EventBridgeAuditEntry', 'EventBridgeAuditConfig', 'EventBridgeAuditResult'],
      bk: 'event_bridge_auditor', eks: ['eba.entry_logged', 'eba.violation_found', 'eba.export_emitted'],
      subjects: ['sven.eba.entry_logged', 'sven.eba.violation_found', 'sven.eba.export_emitted'],
      cases: ['eba_scanner', 'eba_enforcer', 'eba_reporter'],
    },
    {
      name: 'event_bridge_reporter', migration: '20260632280000_agent_event_bridge_reporter.sql',
      typeFile: 'agent-event-bridge-reporter.ts', skillDir: 'event-bridge-reporter',
      interfaces: ['EventBridgeReport', 'EventBridgeReportConfig', 'EventBridgeReportResult'],
      bk: 'event_bridge_reporter', eks: ['ebr.report_generated', 'ebr.insight_found', 'ebr.export_emitted'],
      subjects: ['sven.ebr.report_generated', 'sven.ebr.insight_found', 'sven.ebr.export_emitted'],
      cases: ['ebr_builder', 'ebr_analyst', 'ebr_reporter'],
    },
    {
      name: 'event_bridge_optimizer', migration: '20260632290000_agent_event_bridge_optimizer.sql',
      typeFile: 'agent-event-bridge-optimizer.ts', skillDir: 'event-bridge-optimizer',
      interfaces: ['EventBridgeOptPlan', 'EventBridgeOptConfig', 'EventBridgeOptResult'],
      bk: 'event_bridge_optimizer', eks: ['ebo.plan_created', 'ebo.optimization_applied', 'ebo.export_emitted'],
      subjects: ['sven.ebo.plan_created', 'sven.ebo.optimization_applied', 'sven.ebo.export_emitted'],
      cases: ['ebo_planner', 'ebo_executor', 'ebo_reporter'],
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
