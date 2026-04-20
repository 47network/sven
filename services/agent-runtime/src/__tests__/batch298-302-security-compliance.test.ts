import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'services', 'gateway-api', 'migrations');
const SHARED = path.join(ROOT, 'packages', 'shared', 'src');
const SKILLS = path.join(ROOT, 'skills', 'autonomous-economy');
const TYPES = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
const EVBUS = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts');
const TASK_EXEC = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
const GITATTR = path.join(ROOT, '.gitattributes');

describe('Batches 298-302: Security & Compliance', () => {
  describe('Migrations', () => {
    const migs = [
      { file: '20260619350000_agent_vuln_scanner.sql', tables: ['agent_vuln_scan_configs', 'agent_vuln_scans', 'agent_vulnerabilities'] },
      { file: '20260619360000_agent_credential_rotator.sql', tables: ['agent_cred_rot_configs', 'agent_credentials', 'agent_rotation_logs'] },
      { file: '20260619370000_agent_compliance_auditor.sql', tables: ['agent_compliance_configs', 'agent_compliance_checks', 'agent_compliance_reports'] },
      { file: '20260619380000_agent_rbac_controller.sql', tables: ['agent_rbac_configs', 'agent_rbac_roles', 'agent_rbac_assignments'] },
      { file: '20260619390000_agent_policy_enforcer.sql', tables: ['agent_policy_configs', 'agent_policies', 'agent_policy_decisions'] },
    ];
    for (const m of migs) {
      it(`creates ${m.file}`, () => {
        const sql = fs.readFileSync(path.join(MIGRATIONS, m.file), 'utf-8');
        for (const t of m.tables) expect(sql).toContain(t);
      });
    }
  });

  describe('Shared types', () => {
    const types = [
      { file: 'agent-vuln-scanner.ts', exports: ['ScanType', 'VulnSeverity', 'AgentVulnScanConfig'] },
      { file: 'agent-credential-rotator.ts', exports: ['CredentialType', 'CredentialState', 'AgentCredRotConfig'] },
      { file: 'agent-compliance-auditor.ts', exports: ['ComplianceFramework', 'CheckState', 'AgentComplianceConfig'] },
      { file: 'agent-rbac-controller.ts', exports: ['PrincipalType', 'Permission', 'AgentRbacConfig'] },
      { file: 'agent-policy-enforcer.ts', exports: ['PolicyEngine', 'EnforcementMode', 'AgentPolicyConfig'] },
    ];
    for (const t of types) {
      it(`exports from ${t.file}`, () => {
        const src = fs.readFileSync(path.join(SHARED, t.file), 'utf-8');
        for (const e of t.exports) expect(src).toContain(e);
      });
    }
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(SHARED, 'index.ts'), 'utf-8');
    for (const m of ['agent-vuln-scanner', 'agent-credential-rotator', 'agent-compliance-auditor', 'agent-rbac-controller', 'agent-policy-enforcer']) {
      it(`re-exports ${m}`, () => expect(idx).toContain(m));
    }
  });

  describe('SKILL.md files', () => {
    const skills = [
      { dir: 'vuln-scanner', name: 'vuln-scanner', price: '14.99' },
      { dir: 'credential-rotator', name: 'credential-rotator', price: '11.99' },
      { dir: 'compliance-auditor', name: 'compliance-auditor', price: '19.99' },
      { dir: 'rbac-controller', name: 'rbac-controller', price: '13.99' },
      { dir: 'policy-enforcer', name: 'policy-enforcer', price: '15.99' },
    ];
    for (const s of skills) {
      it(`has ${s.dir}/SKILL.md`, () => {
        const md = fs.readFileSync(path.join(SKILLS, s.dir, 'SKILL.md'), 'utf-8');
        expect(md).toContain(`name: ${s.name}`);
        expect(md).toContain(`price: ${s.price}`);
        expect(md).toContain('## Actions');
      });
    }
  });

  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const bk of ['vuln_scanner', 'credential_rotator', 'compliance_auditor', 'rbac_controller', 'policy_enforcer']) {
      it(`has '${bk}'`, () => expect(types).toContain(`'${bk}'`));
    }
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const ek of ['vscan.scan_completed', 'crot.credential_rotated', 'caud.audit_completed', 'rbac.role_created', 'penf.policy_evaluated']) {
      it(`has '${ek}'`, () => expect(types).toContain(`'${ek}'`));
    }
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(EVBUS, 'utf-8');
    for (const s of ['sven.vscan.scan_completed', 'sven.crot.credential_rotated', 'sven.caud.audit_completed', 'sven.rbac.role_created', 'sven.penf.policy_evaluated']) {
      it(`maps '${s}'`, () => expect(bus).toContain(`'${s}'`));
    }
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const c of ['vscan_configure', 'crot_rotate_credential', 'caud_run_audit', 'rbac_create_role', 'penf_create_policy', 'penf_export_report']) {
      it(`routes '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task executor handlers', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const h of ['handleVscanConfigure', 'handleCrotRotateCredential', 'handleCaudRunAudit', 'handleRbacCreateRole', 'handlePenfCreatePolicy']) {
      it(`has handler ${h}`, () => expect(te).toContain(`${h}(`));
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(GITATTR, 'utf-8');
    for (const f of ['agent-vuln-scanner', 'agent-credential-rotator', 'agent-compliance-auditor', 'agent-rbac-controller', 'agent-policy-enforcer']) {
      it(`filters ${f}`, () => expect(ga).toContain(f));
    }
  });
});
