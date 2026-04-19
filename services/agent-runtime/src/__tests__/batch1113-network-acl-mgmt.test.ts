import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 1113-1117 · Network ACL Management', () => {
  const verticals = [
    {
      name: 'network_acl_policy_builder', migration: '20260627500000_agent_network_acl_policy_builder.sql',
      typeFile: 'agent-network-acl-policy-builder.ts', skillDir: 'network-acl-policy-builder',
      interfaces: ['NetworkAclPolicyBuilderConfig', 'NetworkAclPolicyBuilderEvent', 'NetworkAclPolicyBuilderRule'],
      bk: 'network_acl_policy_builder', eks: ['napb.analysis_completed', 'napb.alert_triggered', 'napb.export_emitted'],
      subjects: ['sven.napb.analysis_completed', 'sven.napb.alert_triggered', 'sven.napb.export_emitted'],
      cases: ['napb_monitor', 'napb_analyzer', 'napb_reporter'],
    },
    {
      name: 'network_acl_rule_validator', migration: '20260627510000_agent_network_acl_rule_validator.sql',
      typeFile: 'agent-network-acl-rule-validator.ts', skillDir: 'network-acl-rule-validator',
      interfaces: ['NetworkAclRuleValidatorConfig', 'NetworkAclRuleValidatorEvent', 'NetworkAclRuleValidatorRule'],
      bk: 'network_acl_rule_validator', eks: ['narv.analysis_completed', 'narv.alert_triggered', 'narv.export_emitted'],
      subjects: ['sven.narv.analysis_completed', 'sven.narv.alert_triggered', 'sven.narv.export_emitted'],
      cases: ['narv_monitor', 'narv_analyzer', 'narv_reporter'],
    },
    {
      name: 'network_acl_access_auditor', migration: '20260627520000_agent_network_acl_access_auditor.sql',
      typeFile: 'agent-network-acl-access-auditor.ts', skillDir: 'network-acl-access-auditor',
      interfaces: ['NetworkAclAccessAuditorConfig', 'NetworkAclAccessAuditorEvent', 'NetworkAclAccessAuditorRule'],
      bk: 'network_acl_access_auditor', eks: ['naaa.analysis_completed', 'naaa.alert_triggered', 'naaa.export_emitted'],
      subjects: ['sven.naaa.analysis_completed', 'sven.naaa.alert_triggered', 'sven.naaa.export_emitted'],
      cases: ['naaa_monitor', 'naaa_analyzer', 'naaa_reporter'],
    },
    {
      name: 'network_acl_change_tracker', migration: '20260627530000_agent_network_acl_change_tracker.sql',
      typeFile: 'agent-network-acl-change-tracker.ts', skillDir: 'network-acl-change-tracker',
      interfaces: ['NetworkAclChangeTrackerConfig', 'NetworkAclChangeTrackerEvent', 'NetworkAclChangeTrackerRule'],
      bk: 'network_acl_change_tracker', eks: ['nact.analysis_completed', 'nact.alert_triggered', 'nact.export_emitted'],
      subjects: ['sven.nact.analysis_completed', 'sven.nact.alert_triggered', 'sven.nact.export_emitted'],
      cases: ['nact_monitor', 'nact_analyzer', 'nact_reporter'],
    },
    {
      name: 'network_acl_compliance_monitor', migration: '20260627540000_agent_network_acl_compliance_monitor.sql',
      typeFile: 'agent-network-acl-compliance-monitor.ts', skillDir: 'network-acl-compliance-monitor',
      interfaces: ['NetworkAclComplianceMonitorConfig', 'NetworkAclComplianceMonitorEvent', 'NetworkAclComplianceMonitorRule'],
      bk: 'network_acl_compliance_monitor', eks: ['nacm.analysis_completed', 'nacm.alert_triggered', 'nacm.export_emitted'],
      subjects: ['sven.nacm.analysis_completed', 'sven.nacm.alert_triggered', 'sven.nacm.export_emitted'],
      cases: ['nacm_monitor', 'nacm_analyzer', 'nacm_reporter'],
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
