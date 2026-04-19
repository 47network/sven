import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('API Proxy management verticals', () => {
  const verticals = [
    {
      name: 'api_proxy', migration: '20260628200000_agent_api_proxy.sql',
      typeFile: 'agent-api-proxy.ts', skillDir: 'api-proxy',
      interfaces: ['ApiProxyRule', 'ApiProxyConfig', 'ApiProxyResult'],
      bk: 'api_proxy', eks: ['ap.rule_created', 'ap.config_updated', 'ap.export_emitted'],
      subjects: ['sven.ap.rule_created', 'sven.ap.config_updated', 'sven.ap.export_emitted'],
      cases: ['ap_planner', 'ap_enforcer', 'ap_reporter'],
    },
    {
      name: 'api_proxy_monitor', migration: '20260628210000_agent_api_proxy_monitor.sql',
      typeFile: 'agent-api-proxy-monitor.ts', skillDir: 'api-proxy-monitor',
      interfaces: ['ApiProxyMonitorCheck', 'ApiProxyMonitorConfig', 'ApiProxyMonitorResult'],
      bk: 'api_proxy_monitor', eks: ['apm.check_passed', 'apm.alert_raised', 'apm.export_emitted'],
      subjects: ['sven.apm.check_passed', 'sven.apm.alert_raised', 'sven.apm.export_emitted'],
      cases: ['apm_watcher', 'apm_alerter', 'apm_reporter'],
    },
    {
      name: 'api_proxy_auditor', migration: '20260628220000_agent_api_proxy_auditor.sql',
      typeFile: 'agent-api-proxy-auditor.ts', skillDir: 'api-proxy-auditor',
      interfaces: ['ApiProxyAuditEntry', 'ApiProxyAuditConfig', 'ApiProxyAuditResult'],
      bk: 'api_proxy_auditor', eks: ['apa.entry_logged', 'apa.violation_found', 'apa.export_emitted'],
      subjects: ['sven.apa.entry_logged', 'sven.apa.violation_found', 'sven.apa.export_emitted'],
      cases: ['apa_scanner', 'apa_enforcer', 'apa_reporter'],
    },
    {
      name: 'api_proxy_reporter', migration: '20260628230000_agent_api_proxy_reporter.sql',
      typeFile: 'agent-api-proxy-reporter.ts', skillDir: 'api-proxy-reporter',
      interfaces: ['ApiProxyReport', 'ApiProxyReportConfig', 'ApiProxyReportResult'],
      bk: 'api_proxy_reporter', eks: ['apr.report_generated', 'apr.insight_found', 'apr.export_emitted'],
      subjects: ['sven.apr.report_generated', 'sven.apr.insight_found', 'sven.apr.export_emitted'],
      cases: ['apr_builder', 'apr_analyst', 'apr_reporter'],
    },
    {
      name: 'api_proxy_optimizer', migration: '20260628240000_agent_api_proxy_optimizer.sql',
      typeFile: 'agent-api-proxy-optimizer.ts', skillDir: 'api-proxy-optimizer',
      interfaces: ['ApiProxyOptPlan', 'ApiProxyOptConfig', 'ApiProxyOptResult'],
      bk: 'api_proxy_optimizer', eks: ['apo.plan_created', 'apo.optimization_applied', 'apo.export_emitted'],
      subjects: ['sven.apo.plan_created', 'sven.apo.optimization_applied', 'sven.apo.export_emitted'],
      cases: ['apo_planner', 'apo_executor', 'apo_reporter'],
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
