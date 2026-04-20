import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 273-277 — Network Security Tools', () => {
  const verticals = [
    { name: 'traffic_classifier', typefile: 'agent-traffic-classifier', migration: '20260619100000_agent_traffic_classifier.sql', skill: 'traffic-classifier', tables: ['agent_traffic_class_configs','agent_traffic_class_results','agent_traffic_class_policies'] },
    { name: 'qos_enforcer', typefile: 'agent-qos-enforcer', migration: '20260619110000_agent_qos_enforcer.sql', skill: 'qos-enforcer', tables: ['agent_qos_configs','agent_qos_classes','agent_qos_violations'] },
    { name: 'acl_auditor', typefile: 'agent-acl-auditor', migration: '20260619120000_agent_acl_auditor.sql', skill: 'acl-auditor', tables: ['agent_acl_configs','agent_acl_entries','agent_acl_findings'] },
    { name: 'firewall_policy', typefile: 'agent-firewall-policy', migration: '20260619130000_agent_firewall_policy.sql', skill: 'firewall-policy', tables: ['agent_fw_policy_configs','agent_fw_rules','agent_fw_change_log'] },
    { name: 'port_mapper', typefile: 'agent-port-mapper', migration: '20260619140000_agent_port_mapper.sql', skill: 'port-mapper', tables: ['agent_port_map_configs','agent_port_map_results','agent_port_map_changes'] },
  ];

  describe('Migration SQL files', () => {
    verticals.forEach(v => {
      it(`${v.migration} exists and creates tables`, () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        v.tables.forEach(t => expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`));
      });
    });
  });

  describe('Shared TypeScript types', () => {
    verticals.forEach(v => {
      it(`${v.typefile}.ts exists with exports`, () => {
        const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src', `${v.typefile}.ts`), 'utf-8');
        expect(ts).toContain('export');
      });
    });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`index.ts exports ${v.typefile}`, () => { expect(idx).toContain(v.typefile); });
    });
  });

  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      it(`${v.skill}/SKILL.md exists with Actions`, () => {
        const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skill, 'SKILL.md'), 'utf-8');
        expect(md).toContain('## Actions');
        expect(md).toContain('price');
      });
    });
  });

  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['traffic_classifier','qos_enforcer','acl_auditor','firewall_policy','port_mapper'];
    bks.forEach(bk => {
      it(`BK contains '${bk}'`, () => { expect(types).toContain(`'${bk}'`); });
    });
    const eks = ['tclass.flow_classified','qos.classes_configured','acl.audit_completed','fwpol.change_proposed','pmap.scan_completed'];
    eks.forEach(ek => {
      it(`EK contains '${ek}'`, () => { expect(types).toContain(`'${ek}'`); });
    });
    it('districtFor handles traffic_classifier', () => { expect(types).toContain("case 'traffic_classifier':"); });
  });

  describe('Event bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = ['sven.tclass.flow_classified','sven.qos.classes_configured','sven.acl.audit_completed','sven.fwpol.change_proposed','sven.pmap.scan_completed'];
    subjects.forEach(s => {
      it(`SUBJECT_MAP has '${s}'`, () => { expect(eb).toContain(`'${s}'`); });
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['tclass_configure','tclass_classify_flow','qos_configure','qos_apply_policy','acl_configure','acl_full_audit','fwpol_configure','fwpol_analyze_ruleset','pmap_configure','pmap_quick_scan'];
    cases.forEach(c => {
      it(`routes '${c}'`, () => { expect(te).toContain(`case '${c}'`); });
    });
    const handlers = ['handleTclassConfigure','handleQosConfigure','handleAclConfigure','handleFwpolConfigure','handlePmapConfigure'];
    handlers.forEach(h => {
      it(`has handler ${h}`, () => { expect(te).toContain(h); });
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`filters ${v.typefile}`, () => { expect(ga).toContain(v.typefile); });
    });
  });
});
