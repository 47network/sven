import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 1108-1112 · Network Firewall Management', () => {
  const verticals = [
    {
      name: 'network_firewall_policy_manager', migration: '20260627450000_agent_network_firewall_policy_manager.sql',
      typeFile: 'agent-network-firewall-policy-manager.ts', skillDir: 'network-firewall-policy-manager',
      interfaces: ['NetworkFirewallPolicyManagerConfig', 'NetworkFirewallPolicyManagerEvent', 'NetworkFirewallPolicyManagerRule'],
      bk: 'network_firewall_policy_manager', eks: ['nfpm.analysis_completed', 'nfpm.alert_triggered', 'nfpm.export_emitted'],
      subjects: ['sven.nfpm.analysis_completed', 'sven.nfpm.alert_triggered', 'sven.nfpm.export_emitted'],
      cases: ['nfpm_monitor', 'nfpm_analyzer', 'nfpm_reporter'],
    },
    {
      name: 'network_firewall_rule_auditor', migration: '20260627460000_agent_network_firewall_rule_auditor.sql',
      typeFile: 'agent-network-firewall-rule-auditor.ts', skillDir: 'network-firewall-rule-auditor',
      interfaces: ['NetworkFirewallRuleAuditorConfig', 'NetworkFirewallRuleAuditorEvent', 'NetworkFirewallRuleAuditorRule'],
      bk: 'network_firewall_rule_auditor', eks: ['nfra.analysis_completed', 'nfra.alert_triggered', 'nfra.export_emitted'],
      subjects: ['sven.nfra.analysis_completed', 'sven.nfra.alert_triggered', 'sven.nfra.export_emitted'],
      cases: ['nfra_monitor', 'nfra_analyzer', 'nfra_reporter'],
    },
    {
      name: 'network_firewall_threat_detector', migration: '20260627470000_agent_network_firewall_threat_detector.sql',
      typeFile: 'agent-network-firewall-threat-detector.ts', skillDir: 'network-firewall-threat-detector',
      interfaces: ['NetworkFirewallThreatDetectorConfig', 'NetworkFirewallThreatDetectorEvent', 'NetworkFirewallThreatDetectorRule'],
      bk: 'network_firewall_threat_detector', eks: ['nftd.analysis_completed', 'nftd.alert_triggered', 'nftd.export_emitted'],
      subjects: ['sven.nftd.analysis_completed', 'sven.nftd.alert_triggered', 'sven.nftd.export_emitted'],
      cases: ['nftd_monitor', 'nftd_analyzer', 'nftd_reporter'],
    },
    {
      name: 'network_firewall_traffic_analyzer', migration: '20260627480000_agent_network_firewall_traffic_analyzer.sql',
      typeFile: 'agent-network-firewall-traffic-analyzer.ts', skillDir: 'network-firewall-traffic-analyzer',
      interfaces: ['NetworkFirewallTrafficAnalyzerConfig', 'NetworkFirewallTrafficAnalyzerEvent', 'NetworkFirewallTrafficAnalyzerRule'],
      bk: 'network_firewall_traffic_analyzer', eks: ['nfta.analysis_completed', 'nfta.alert_triggered', 'nfta.export_emitted'],
      subjects: ['sven.nfta.analysis_completed', 'sven.nfta.alert_triggered', 'sven.nfta.export_emitted'],
      cases: ['nfta_monitor', 'nfta_analyzer', 'nfta_reporter'],
    },
    {
      name: 'network_firewall_compliance_checker', migration: '20260627490000_agent_network_firewall_compliance_checker.sql',
      typeFile: 'agent-network-firewall-compliance-checker.ts', skillDir: 'network-firewall-compliance-checker',
      interfaces: ['NetworkFirewallComplianceCheckerConfig', 'NetworkFirewallComplianceCheckerEvent', 'NetworkFirewallComplianceCheckerRule'],
      bk: 'network_firewall_compliance_checker', eks: ['nfcc.analysis_completed', 'nfcc.alert_triggered', 'nfcc.export_emitted'],
      subjects: ['sven.nfcc.analysis_completed', 'sven.nfcc.alert_triggered', 'sven.nfcc.export_emitted'],
      cases: ['nfcc_monitor', 'nfcc_analyzer', 'nfcc_reporter'],
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
