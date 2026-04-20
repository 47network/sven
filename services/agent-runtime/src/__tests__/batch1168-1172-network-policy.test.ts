import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Network Policy management verticals', () => {
  const verticals = [
    {
      name: 'network_policy', migration: '20260628050000_agent_network_policy.sql',
      typeFile: 'agent-network-policy.ts', skillDir: 'network-policy',
      interfaces: ['NetworkPolicyRule', 'NetworkPolicyConfig', 'NetworkPolicyResult'],
      bk: 'network_policy', eks: ['np.rule_created', 'np.config_updated', 'np.export_emitted'],
      subjects: ['sven.np.rule_created', 'sven.np.config_updated', 'sven.np.export_emitted'],
      cases: ['np_planner', 'np_enforcer', 'np_reporter'],
    },
    {
      name: 'network_policy_monitor', migration: '20260628060000_agent_network_policy_monitor.sql',
      typeFile: 'agent-network-policy-monitor.ts', skillDir: 'network-policy-monitor',
      interfaces: ['NetworkPolicyMonitorCheck', 'NetworkPolicyMonitorConfig', 'NetworkPolicyMonitorResult'],
      bk: 'network_policy_monitor', eks: ['npm.check_passed', 'npm.alert_raised', 'npm.export_emitted'],
      subjects: ['sven.npm.check_passed', 'sven.npm.alert_raised', 'sven.npm.export_emitted'],
      cases: ['npm_watcher', 'npm_alerter', 'npm_reporter'],
    },
    {
      name: 'network_policy_auditor', migration: '20260628070000_agent_network_policy_auditor.sql',
      typeFile: 'agent-network-policy-auditor.ts', skillDir: 'network-policy-auditor',
      interfaces: ['NetworkPolicyAuditEntry', 'NetworkPolicyAuditConfig', 'NetworkPolicyAuditResult'],
      bk: 'network_policy_auditor', eks: ['npa.entry_logged', 'npa.violation_found', 'npa.export_emitted'],
      subjects: ['sven.npa.entry_logged', 'sven.npa.violation_found', 'sven.npa.export_emitted'],
      cases: ['npa_scanner', 'npa_enforcer', 'npa_reporter'],
    },
    {
      name: 'network_policy_reporter', migration: '20260628080000_agent_network_policy_reporter.sql',
      typeFile: 'agent-network-policy-reporter.ts', skillDir: 'network-policy-reporter',
      interfaces: ['NetworkPolicyReport', 'NetworkPolicyReportConfig', 'NetworkPolicyReportResult'],
      bk: 'network_policy_reporter', eks: ['npr.report_generated', 'npr.insight_found', 'npr.export_emitted'],
      subjects: ['sven.npr.report_generated', 'sven.npr.insight_found', 'sven.npr.export_emitted'],
      cases: ['npr_builder', 'npr_analyst', 'npr_reporter'],
    },
    {
      name: 'network_policy_optimizer', migration: '20260628090000_agent_network_policy_optimizer.sql',
      typeFile: 'agent-network-policy-optimizer.ts', skillDir: 'network-policy-optimizer',
      interfaces: ['NetworkPolicyOptPlan', 'NetworkPolicyOptConfig', 'NetworkPolicyOptResult'],
      bk: 'network_policy_optimizer', eks: ['npo.plan_created', 'npo.optimization_applied', 'npo.export_emitted'],
      subjects: ['sven.npo.plan_created', 'sven.npo.optimization_applied', 'sven.npo.export_emitted'],
      cases: ['npo_planner', 'npo_executor', 'npo_reporter'],
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
