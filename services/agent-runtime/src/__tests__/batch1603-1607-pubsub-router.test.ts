import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('PubSub Router verticals', () => {
  const verticals = [
    {
      name: 'pubsub_router', migration: '20260632400000_agent_pubsub_router.sql',
      typeFile: 'agent-pubsub-router.ts', skillDir: 'pubsub-router',
      interfaces: ['PubsubRouterEntry', 'PubsubRouterConfig', 'PubsubRouterResult'],
      bk: 'pubsub_router', eks: ['psr.entry_created', 'psr.config_updated', 'psr.export_emitted'],
      subjects: ['sven.psr.entry_created', 'sven.psr.config_updated', 'sven.psr.export_emitted'],
      cases: ['psr_dispatcher', 'psr_subscriber', 'psr_reporter'],
    },
    {
      name: 'pubsub_router_monitor', migration: '20260632410000_agent_pubsub_router_monitor.sql',
      typeFile: 'agent-pubsub-router-monitor.ts', skillDir: 'pubsub-router-monitor',
      interfaces: ['PubsubRouterMonitorCheck', 'PubsubRouterMonitorConfig', 'PubsubRouterMonitorResult'],
      bk: 'pubsub_router_monitor', eks: ['psrm.check_passed', 'psrm.alert_raised', 'psrm.export_emitted'],
      subjects: ['sven.psrm.check_passed', 'sven.psrm.alert_raised', 'sven.psrm.export_emitted'],
      cases: ['psrm_watcher', 'psrm_alerter', 'psrm_reporter'],
    },
    {
      name: 'pubsub_router_auditor', migration: '20260632420000_agent_pubsub_router_auditor.sql',
      typeFile: 'agent-pubsub-router-auditor.ts', skillDir: 'pubsub-router-auditor',
      interfaces: ['PubsubRouterAuditEntry', 'PubsubRouterAuditConfig', 'PubsubRouterAuditResult'],
      bk: 'pubsub_router_auditor', eks: ['psra.entry_logged', 'psra.violation_found', 'psra.export_emitted'],
      subjects: ['sven.psra.entry_logged', 'sven.psra.violation_found', 'sven.psra.export_emitted'],
      cases: ['psra_scanner', 'psra_enforcer', 'psra_reporter'],
    },
    {
      name: 'pubsub_router_reporter', migration: '20260632430000_agent_pubsub_router_reporter.sql',
      typeFile: 'agent-pubsub-router-reporter.ts', skillDir: 'pubsub-router-reporter',
      interfaces: ['PubsubRouterReport', 'PubsubRouterReportConfig', 'PubsubRouterReportResult'],
      bk: 'pubsub_router_reporter', eks: ['psrr.report_generated', 'psrr.insight_found', 'psrr.export_emitted'],
      subjects: ['sven.psrr.report_generated', 'sven.psrr.insight_found', 'sven.psrr.export_emitted'],
      cases: ['psrr_builder', 'psrr_analyst', 'psrr_reporter'],
    },
    {
      name: 'pubsub_router_optimizer', migration: '20260632440000_agent_pubsub_router_optimizer.sql',
      typeFile: 'agent-pubsub-router-optimizer.ts', skillDir: 'pubsub-router-optimizer',
      interfaces: ['PubsubRouterOptPlan', 'PubsubRouterOptConfig', 'PubsubRouterOptResult'],
      bk: 'pubsub_router_optimizer', eks: ['psro.plan_created', 'psro.optimization_applied', 'psro.export_emitted'],
      subjects: ['sven.psro.plan_created', 'sven.psro.optimization_applied', 'sven.psro.export_emitted'],
      cases: ['psro_planner', 'psro_executor', 'psro_reporter'],
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
