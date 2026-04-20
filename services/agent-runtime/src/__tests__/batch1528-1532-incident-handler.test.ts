import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Incident Handler verticals', () => {
  const verticals = [
    {
      name: 'incident_handler', migration: '20260631650000_agent_incident_handler.sql',
      typeFile: 'agent-incident-handler.ts', skillDir: 'incident-handler',
      interfaces: ['IncidentHandlerEntry', 'IncidentHandlerConfig', 'IncidentHandlerResult'],
      bk: 'incident_handler', eks: ['ih.entry_created', 'ih.config_updated', 'ih.export_emitted'],
      subjects: ['sven.ih.entry_created', 'sven.ih.config_updated', 'sven.ih.export_emitted'],
      cases: ['ih_responder', 'ih_escalator', 'ih_reporter'],
    },
    {
      name: 'incident_handler_monitor', migration: '20260631660000_agent_incident_handler_monitor.sql',
      typeFile: 'agent-incident-handler-monitor.ts', skillDir: 'incident-handler-monitor',
      interfaces: ['IncidentHandlerMonitorCheck', 'IncidentHandlerMonitorConfig', 'IncidentHandlerMonitorResult'],
      bk: 'incident_handler_monitor', eks: ['ihm.check_passed', 'ihm.alert_raised', 'ihm.export_emitted'],
      subjects: ['sven.ihm.check_passed', 'sven.ihm.alert_raised', 'sven.ihm.export_emitted'],
      cases: ['ihm_watcher', 'ihm_alerter', 'ihm_reporter'],
    },
    {
      name: 'incident_handler_auditor', migration: '20260631670000_agent_incident_handler_auditor.sql',
      typeFile: 'agent-incident-handler-auditor.ts', skillDir: 'incident-handler-auditor',
      interfaces: ['IncidentHandlerAuditEntry', 'IncidentHandlerAuditConfig', 'IncidentHandlerAuditResult'],
      bk: 'incident_handler_auditor', eks: ['iha.entry_logged', 'iha.violation_found', 'iha.export_emitted'],
      subjects: ['sven.iha.entry_logged', 'sven.iha.violation_found', 'sven.iha.export_emitted'],
      cases: ['iha_scanner', 'iha_enforcer', 'iha_reporter'],
    },
    {
      name: 'incident_handler_reporter', migration: '20260631680000_agent_incident_handler_reporter.sql',
      typeFile: 'agent-incident-handler-reporter.ts', skillDir: 'incident-handler-reporter',
      interfaces: ['IncidentHandlerReport', 'IncidentHandlerReportConfig', 'IncidentHandlerReportResult'],
      bk: 'incident_handler_reporter', eks: ['ihr.report_generated', 'ihr.insight_found', 'ihr.export_emitted'],
      subjects: ['sven.ihr.report_generated', 'sven.ihr.insight_found', 'sven.ihr.export_emitted'],
      cases: ['ihr_builder', 'ihr_analyst', 'ihr_reporter'],
    },
    {
      name: 'incident_handler_optimizer', migration: '20260631690000_agent_incident_handler_optimizer.sql',
      typeFile: 'agent-incident-handler-optimizer.ts', skillDir: 'incident-handler-optimizer',
      interfaces: ['IncidentHandlerOptPlan', 'IncidentHandlerOptConfig', 'IncidentHandlerOptResult'],
      bk: 'incident_handler_optimizer', eks: ['iho.plan_created', 'iho.optimization_applied', 'iho.export_emitted'],
      subjects: ['sven.iho.plan_created', 'sven.iho.optimization_applied', 'sven.iho.export_emitted'],
      cases: ['iho_planner', 'iho_executor', 'iho_reporter'],
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
