import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Service Discovery management verticals', () => {
  const verticals = [
    {
      name: 'service_discovery', migration: '20260628300000_agent_service_discovery.sql',
      typeFile: 'agent-service-discovery.ts', skillDir: 'service-discovery',
      interfaces: ['ServiceDiscoveryEntry', 'ServiceDiscoveryConfig', 'ServiceDiscoveryResult'],
      bk: 'service_discovery', eks: ['sd.entry_registered', 'sd.config_updated', 'sd.export_emitted'],
      subjects: ['sven.sd.entry_registered', 'sven.sd.config_updated', 'sven.sd.export_emitted'],
      cases: ['sd_registrar', 'sd_resolver', 'sd_reporter'],
    },
    {
      name: 'service_discovery_monitor', migration: '20260628310000_agent_service_discovery_monitor.sql',
      typeFile: 'agent-service-discovery-monitor.ts', skillDir: 'service-discovery-monitor',
      interfaces: ['ServiceDiscoveryMonitorCheck', 'ServiceDiscoveryMonitorConfig', 'ServiceDiscoveryMonitorResult'],
      bk: 'service_discovery_monitor', eks: ['sdm.check_passed', 'sdm.alert_raised', 'sdm.export_emitted'],
      subjects: ['sven.sdm.check_passed', 'sven.sdm.alert_raised', 'sven.sdm.export_emitted'],
      cases: ['sdm_watcher', 'sdm_alerter', 'sdm_reporter'],
    },
    {
      name: 'service_discovery_auditor', migration: '20260628320000_agent_service_discovery_auditor.sql',
      typeFile: 'agent-service-discovery-auditor.ts', skillDir: 'service-discovery-auditor',
      interfaces: ['ServiceDiscoveryAuditEntry', 'ServiceDiscoveryAuditConfig', 'ServiceDiscoveryAuditResult'],
      bk: 'service_discovery_auditor', eks: ['sda.entry_logged', 'sda.violation_found', 'sda.export_emitted'],
      subjects: ['sven.sda.entry_logged', 'sven.sda.violation_found', 'sven.sda.export_emitted'],
      cases: ['sda_scanner', 'sda_enforcer', 'sda_reporter'],
    },
    {
      name: 'service_discovery_reporter', migration: '20260628330000_agent_service_discovery_reporter.sql',
      typeFile: 'agent-service-discovery-reporter.ts', skillDir: 'service-discovery-reporter',
      interfaces: ['ServiceDiscoveryReport', 'ServiceDiscoveryReportConfig', 'ServiceDiscoveryReportResult'],
      bk: 'service_discovery_reporter', eks: ['sdr.report_generated', 'sdr.insight_found', 'sdr.export_emitted'],
      subjects: ['sven.sdr.report_generated', 'sven.sdr.insight_found', 'sven.sdr.export_emitted'],
      cases: ['sdr_builder', 'sdr_analyst', 'sdr_reporter'],
    },
    {
      name: 'service_discovery_optimizer', migration: '20260628340000_agent_service_discovery_optimizer.sql',
      typeFile: 'agent-service-discovery-optimizer.ts', skillDir: 'service-discovery-optimizer',
      interfaces: ['ServiceDiscoveryOptPlan', 'ServiceDiscoveryOptConfig', 'ServiceDiscoveryOptResult'],
      bk: 'service_discovery_optimizer', eks: ['sdo.plan_created', 'sdo.optimization_applied', 'sdo.export_emitted'],
      subjects: ['sven.sdo.plan_created', 'sven.sdo.optimization_applied', 'sven.sdo.export_emitted'],
      cases: ['sdo_planner', 'sdo_executor', 'sdo_reporter'],
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
