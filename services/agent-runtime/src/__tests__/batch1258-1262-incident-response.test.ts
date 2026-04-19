import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Incident Response management verticals', () => {
  const verticals = [
    {
      name: 'incident_response', migration: '20260628950000_agent_incident_response.sql',
      typeFile: 'agent-incident-response.ts', skillDir: 'incident-response',
      interfaces: ['IncidentResponsePlan', 'IncidentResponseConfig', 'IncidentResponseResult'],
      bk: 'incident_response', eks: ['ir.plan_created', 'ir.config_updated', 'ir.export_emitted'],
      subjects: ['sven.ir.plan_created', 'sven.ir.config_updated', 'sven.ir.export_emitted'],
      cases: ['ir_coordinator', 'ir_responder', 'ir_reporter'],
    },
    {
      name: 'incident_response_monitor', migration: '20260628960000_agent_incident_response_monitor.sql',
      typeFile: 'agent-incident-response-monitor.ts', skillDir: 'incident-response-monitor',
      interfaces: ['IncidentResponseMonitorCheck', 'IncidentResponseMonitorConfig', 'IncidentResponseMonitorResult'],
      bk: 'incident_response_monitor', eks: ['irm.check_passed', 'irm.alert_raised', 'irm.export_emitted'],
      subjects: ['sven.irm.check_passed', 'sven.irm.alert_raised', 'sven.irm.export_emitted'],
      cases: ['irm_watcher', 'irm_alerter', 'irm_reporter'],
    },
    {
      name: 'incident_response_auditor', migration: '20260628970000_agent_incident_response_auditor.sql',
      typeFile: 'agent-incident-response-auditor.ts', skillDir: 'incident-response-auditor',
      interfaces: ['IncidentResponseAuditEntry', 'IncidentResponseAuditConfig', 'IncidentResponseAuditResult'],
      bk: 'incident_response_auditor', eks: ['ira.entry_logged', 'ira.violation_found', 'ira.export_emitted'],
      subjects: ['sven.ira.entry_logged', 'sven.ira.violation_found', 'sven.ira.export_emitted'],
      cases: ['ira_scanner', 'ira_enforcer', 'ira_reporter'],
    },
    {
      name: 'incident_response_reporter', migration: '20260628980000_agent_incident_response_reporter.sql',
      typeFile: 'agent-incident-response-reporter.ts', skillDir: 'incident-response-reporter',
      interfaces: ['IncidentResponseReport', 'IncidentResponseReportConfig', 'IncidentResponseReportResult'],
      bk: 'incident_response_reporter', eks: ['irr.report_generated', 'irr.insight_found', 'irr.export_emitted'],
      subjects: ['sven.irr.report_generated', 'sven.irr.insight_found', 'sven.irr.export_emitted'],
      cases: ['irr_builder', 'irr_analyst', 'irr_reporter'],
    },
    {
      name: 'incident_response_optimizer', migration: '20260628990000_agent_incident_response_optimizer.sql',
      typeFile: 'agent-incident-response-optimizer.ts', skillDir: 'incident-response-optimizer',
      interfaces: ['IncidentResponseOptPlan', 'IncidentResponseOptConfig', 'IncidentResponseOptResult'],
      bk: 'incident_response_optimizer', eks: ['iro.plan_created', 'iro.optimization_applied', 'iro.export_emitted'],
      subjects: ['sven.iro.plan_created', 'sven.iro.optimization_applied', 'sven.iro.export_emitted'],
      cases: ['iro_planner', 'iro_executor', 'iro_reporter'],
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
