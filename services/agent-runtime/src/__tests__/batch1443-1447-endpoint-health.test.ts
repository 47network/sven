import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Endpoint Health verticals', () => {
  const verticals = [
    {
      name: 'endpoint_health', migration: '20260630800000_agent_endpoint_health.sql',
      typeFile: 'agent-endpoint-health.ts', skillDir: 'endpoint-health',
      interfaces: ['EndpointHealthEntry', 'EndpointHealthConfig', 'EndpointHealthResult'],
      bk: 'endpoint_health', eks: ['eh.entry_created', 'eh.config_updated', 'eh.export_emitted'],
      subjects: ['sven.eh.entry_created', 'sven.eh.config_updated', 'sven.eh.export_emitted'],
      cases: ['eh_prober', 'eh_checker', 'eh_reporter'],
    },
    {
      name: 'endpoint_health_monitor', migration: '20260630810000_agent_endpoint_health_monitor.sql',
      typeFile: 'agent-endpoint-health-monitor.ts', skillDir: 'endpoint-health-monitor',
      interfaces: ['EndpointHealthMonitorCheck', 'EndpointHealthMonitorConfig', 'EndpointHealthMonitorResult'],
      bk: 'endpoint_health_monitor', eks: ['ehm.check_passed', 'ehm.alert_raised', 'ehm.export_emitted'],
      subjects: ['sven.ehm.check_passed', 'sven.ehm.alert_raised', 'sven.ehm.export_emitted'],
      cases: ['ehm_watcher', 'ehm_alerter', 'ehm_reporter'],
    },
    {
      name: 'endpoint_health_auditor', migration: '20260630820000_agent_endpoint_health_auditor.sql',
      typeFile: 'agent-endpoint-health-auditor.ts', skillDir: 'endpoint-health-auditor',
      interfaces: ['EndpointHealthAuditEntry', 'EndpointHealthAuditConfig', 'EndpointHealthAuditResult'],
      bk: 'endpoint_health_auditor', eks: ['eha.entry_logged', 'eha.violation_found', 'eha.export_emitted'],
      subjects: ['sven.eha.entry_logged', 'sven.eha.violation_found', 'sven.eha.export_emitted'],
      cases: ['eha_scanner', 'eha_enforcer', 'eha_reporter'],
    },
    {
      name: 'endpoint_health_reporter', migration: '20260630830000_agent_endpoint_health_reporter.sql',
      typeFile: 'agent-endpoint-health-reporter.ts', skillDir: 'endpoint-health-reporter',
      interfaces: ['EndpointHealthReport', 'EndpointHealthReportConfig', 'EndpointHealthReportResult'],
      bk: 'endpoint_health_reporter', eks: ['ehr.report_generated', 'ehr.insight_found', 'ehr.export_emitted'],
      subjects: ['sven.ehr.report_generated', 'sven.ehr.insight_found', 'sven.ehr.export_emitted'],
      cases: ['ehr_builder', 'ehr_analyst', 'ehr_reporter'],
    },
    {
      name: 'endpoint_health_optimizer', migration: '20260630840000_agent_endpoint_health_optimizer.sql',
      typeFile: 'agent-endpoint-health-optimizer.ts', skillDir: 'endpoint-health-optimizer',
      interfaces: ['EndpointHealthOptPlan', 'EndpointHealthOptConfig', 'EndpointHealthOptResult'],
      bk: 'endpoint_health_optimizer', eks: ['eho.plan_created', 'eho.optimization_applied', 'eho.export_emitted'],
      subjects: ['sven.eho.plan_created', 'sven.eho.optimization_applied', 'sven.eho.export_emitted'],
      cases: ['eho_planner', 'eho_executor', 'eho_reporter'],
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
