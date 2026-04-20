import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 718-722: Security Posture', () => {
  const verticals = [
    {
      name: 'waf_engine', migration: '20260623550000_agent_waf_engine.sql',
      typeFile: 'agent-waf-engine.ts', skillDir: 'waf-engine',
      interfaces: ['WafEngineConfig', 'WafRule', 'EngineEvent'],
      bk: 'waf_engine', eks: ['wafe.rule_loaded', 'wafe.request_blocked', 'wafe.signature_updated', 'wafe.bypass_detected'],
      subjects: ['sven.wafe.rule_loaded', 'sven.wafe.request_blocked', 'sven.wafe.signature_updated', 'sven.wafe.bypass_detected'],
      cases: ['wafe_load', 'wafe_block', 'wafe_update', 'wafe_detect', 'wafe_report', 'wafe_monitor'],
    },
    {
      name: 'ddos_mitigator', migration: '20260623560000_agent_ddos_mitigator.sql',
      typeFile: 'agent-ddos-mitigator.ts', skillDir: 'ddos-mitigator',
      interfaces: ['DdosMitigatorConfig', 'MitigationPolicy', 'MitigatorEvent'],
      bk: 'ddos_mitigator', eks: ['ddmt.attack_detected', 'ddmt.mitigation_engaged', 'ddmt.scrubbing_activated', 'ddmt.attack_subsided'],
      subjects: ['sven.ddmt.attack_detected', 'sven.ddmt.mitigation_engaged', 'sven.ddmt.scrubbing_activated', 'sven.ddmt.attack_subsided'],
      cases: ['ddmt_detect', 'ddmt_engage', 'ddmt_activate', 'ddmt_subside', 'ddmt_report', 'ddmt_monitor'],
    },
    {
      name: 'penetration_tester', migration: '20260623570000_agent_penetration_tester.sql',
      typeFile: 'agent-penetration-tester.ts', skillDir: 'penetration-tester',
      interfaces: ['PenetrationTesterConfig', 'PentestRun', 'TesterEvent'],
      bk: 'penetration_tester', eks: ['pntst.scan_started', 'pntst.vulnerability_found', 'pntst.exploit_validated', 'pntst.report_generated'],
      subjects: ['sven.pntst.scan_started', 'sven.pntst.vulnerability_found', 'sven.pntst.exploit_validated', 'sven.pntst.report_generated'],
      cases: ['pntst_start', 'pntst_find', 'pntst_validate', 'pntst_generate', 'pntst_report', 'pntst_monitor'],
    },
    {
      name: 'security_baseline_enforcer', migration: '20260623580000_agent_security_baseline_enforcer.sql',
      typeFile: 'agent-security-baseline-enforcer.ts', skillDir: 'security-baseline-enforcer',
      interfaces: ['SecurityBaselineEnforcerConfig', 'BaselinePolicy', 'EnforcerEvent'],
      bk: 'security_baseline_enforcer', eks: ['sbsn.baseline_applied', 'sbsn.drift_detected', 'sbsn.remediation_executed', 'sbsn.compliance_verified'],
      subjects: ['sven.sbsn.baseline_applied', 'sven.sbsn.drift_detected', 'sven.sbsn.remediation_executed', 'sven.sbsn.compliance_verified'],
      cases: ['sbsn_apply', 'sbsn_detect', 'sbsn_remediate', 'sbsn_verify', 'sbsn_report', 'sbsn_monitor'],
    },
    {
      name: 'asset_inventory_tracker', migration: '20260623590000_agent_asset_inventory_tracker.sql',
      typeFile: 'agent-asset-inventory-tracker.ts', skillDir: 'asset-inventory-tracker',
      interfaces: ['AssetInventoryTrackerConfig', 'Asset', 'TrackerEvent'],
      bk: 'asset_inventory_tracker', eks: ['aitr.asset_discovered', 'aitr.attribute_updated', 'aitr.ownership_assigned', 'aitr.lifecycle_tracked'],
      subjects: ['sven.aitr.asset_discovered', 'sven.aitr.attribute_updated', 'sven.aitr.ownership_assigned', 'sven.aitr.lifecycle_tracked'],
      cases: ['aitr_discover', 'aitr_update', 'aitr_assign', 'aitr_track', 'aitr_report', 'aitr_monitor'],
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
