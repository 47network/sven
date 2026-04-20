/**
 * Batches 233-237: Security Access Control
 * access_auditor, permission_manager, token_validator, session_enforcer, network_firewall
 * 135 tests across 7 describe blocks
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 233-237 — Security Access Control', () => {
  // ── Migration SQL files ──────────────────────────────────────
  describe('Migration SQL files', () => {
    const migrations = [
      { file: '20260618700000_agent_access_auditor.sql', tables: ['agent_access_logs', 'agent_access_patterns', 'agent_access_alerts'] },
      { file: '20260618710000_agent_permission_manager.sql', tables: ['agent_roles', 'agent_role_assignments', 'agent_permission_checks'] },
      { file: '20260618720000_agent_token_validator.sql', tables: ['agent_token_configs', 'agent_issued_tokens', 'agent_token_validations'] },
      { file: '20260618730000_agent_session_enforcer.sql', tables: ['agent_session_policies', 'agent_active_sessions', 'agent_session_violations'] },
      { file: '20260618740000_agent_network_firewall.sql', tables: ['agent_firewall_rules', 'agent_firewall_logs', 'agent_firewall_zones'] },
    ];
    for (const m of migrations) {
      it(`${m.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true);
      });
      for (const t of m.tables) {
        it(`${m.file} creates ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
      it(`${m.file} has indexes`, () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
        expect(sql).toContain('CREATE INDEX');
      });
    }
  });

  // ── Shared TypeScript types ──────────────────────────────────
  describe('Shared TypeScript types', () => {
    const types = [
      { file: 'agent-access-auditor.ts', exports: ['AccessAction', 'AccessOutcome', 'AccessPatternType', 'AccessAlertType', 'AgentAccessLog', 'AgentAccessPattern', 'AgentAccessAlert'] },
      { file: 'agent-permission-manager.ts', exports: ['RoleAssignmentStatus', 'PermissionCheckResult', 'AgentRole', 'AgentRoleAssignment', 'AgentPermissionCheck'] },
      { file: 'agent-token-validator.ts', exports: ['TokenType', 'TokenStatus', 'ValidationResult', 'AgentTokenConfig', 'AgentIssuedToken', 'AgentTokenValidation'] },
      { file: 'agent-session-enforcer.ts', exports: ['SessionStatus', 'SessionViolationType', 'ViolationAction', 'AgentSessionPolicy', 'AgentActiveSession', 'AgentSessionViolation'] },
      { file: 'agent-network-firewall.ts', exports: ['FirewallDirection', 'FirewallProtocol', 'FirewallAction', 'FirewallZoneType', 'FirewallZoneStatus', 'AgentFirewallRule', 'AgentFirewallLog', 'AgentFirewallZone'] },
    ];
    for (const t of types) {
      it(`${t.file} exists`, () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', t.file))).toBe(true);
      });
      for (const exp of t.exports) {
        it(`${t.file} exports ${exp}`, () => {
          const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', t.file), 'utf-8');
          expect(content).toContain(exp);
        });
      }
    }
  });

  // ── Barrel exports ───────────────────────────────────────────
  describe('Barrel exports (index.ts)', () => {
    const barrelPath = path.join(ROOT, 'packages/shared/src/index.ts');
    const modules = ['agent-access-auditor', 'agent-permission-manager', 'agent-token-validator', 'agent-session-enforcer', 'agent-network-firewall'];
    for (const mod of modules) {
      it(`exports ${mod}`, () => {
        const content = fs.readFileSync(barrelPath, 'utf-8');
        expect(content).toContain(`from './${mod}.js'`);
      });
    }
  });

  // ── SKILL.md files ───────────────────────────────────────────
  describe('SKILL.md files', () => {
    const skills = [
      { dir: 'access-auditor', name: 'access-auditor', actions: ['audit-access-log', 'detect-pattern', 'raise-alert'] },
      { dir: 'permission-manager', name: 'permission-manager', actions: ['create-role', 'assign-role', 'check-permission'] },
      { dir: 'token-validator', name: 'token-validator', actions: ['configure-token', 'issue-token', 'validate-token'] },
      { dir: 'session-enforcer', name: 'session-enforcer', actions: ['create-policy', 'enforce-session', 'terminate-session'] },
      { dir: 'network-firewall', name: 'network-firewall', actions: ['create-rule', 'manage-zones', 'review-logs'] },
    ];
    for (const s of skills) {
      const skillPath = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => {
        expect(fs.existsSync(skillPath)).toBe(true);
      });
      it(`${s.dir}/SKILL.md has name: ${s.name}`, () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).toContain(`name: ${s.name}`);
      });
      it(`${s.dir}/SKILL.md has ## Actions`, () => {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).toContain('## Actions');
      });
      for (const a of s.actions) {
        it(`${s.dir}/SKILL.md has action ${a}`, () => {
          const content = fs.readFileSync(skillPath, 'utf-8');
          expect(content).toContain(a);
        });
      }
    }
  });

  // ── Eidolon types.ts wiring ──────────────────────────────────
  describe('Eidolon types.ts wiring', () => {
    const typesPath = path.join(ROOT, 'services/sven-eidolon/src/types.ts');
    const bkValues = ['access_auditor', 'permission_manager', 'token_validator', 'session_enforcer', 'network_firewall'];
    const ekValues = ['access.logged', 'access.pattern_detected', 'access.alert_raised', 'access.report_generated',
      'permission.role_created', 'permission.role_assigned', 'permission.checked', 'permission.audit_completed',
      'token.config_created', 'token.issued', 'token.validated', 'token.revoked',
      'session.policy_created', 'session.enforced', 'session.violation_detected', 'session.terminated_enforced',
      'firewall_rule.created', 'firewall_rule.zone_configured', 'firewall_rule.log_analyzed', 'firewall_rule.tested'];

    for (const bk of bkValues) {
      it(`BK has '${bk}'`, () => {
        const content = fs.readFileSync(typesPath, 'utf-8');
        expect(content).toContain(`'${bk}'`);
      });
    }
    for (const ek of ekValues) {
      it(`EK has '${ek}'`, () => {
        const content = fs.readFileSync(typesPath, 'utf-8');
        expect(content).toContain(`'${ek}'`);
      });
    }
    for (const bk of bkValues) {
      it(`districtFor handles '${bk}'`, () => {
        const content = fs.readFileSync(typesPath, 'utf-8');
        expect(content).toContain(`case '${bk}':`);
      });
    }
  });

  // ── Event bus SUBJECT_MAP ────────────────────────────────────
  describe('Event bus SUBJECT_MAP', () => {
    const busPath = path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts');
    const subjects = [
      'sven.access.logged', 'sven.access.pattern_detected', 'sven.access.alert_raised', 'sven.access.report_generated',
      'sven.permission.role_created', 'sven.permission.role_assigned', 'sven.permission.checked', 'sven.permission.audit_completed',
      'sven.token.config_created', 'sven.token.issued', 'sven.token.validated', 'sven.token.revoked',
      'sven.session.policy_created', 'sven.session.enforced', 'sven.session.violation_detected', 'sven.session.terminated_enforced',
      'sven.firewall_rule.created', 'sven.firewall_rule.zone_configured', 'sven.firewall_rule.log_analyzed', 'sven.firewall_rule.tested',
    ];
    for (const s of subjects) {
      it(`SUBJECT_MAP has '${s}'`, () => {
        const content = fs.readFileSync(busPath, 'utf-8');
        expect(content).toContain(`'${s}'`);
      });
    }
  });

  // ── Task executor handlers ───────────────────────────────────
  describe('Task executor handlers', () => {
    const execPath = path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts');
    const cases = [
      'access_audit_log', 'access_detect_pattern', 'access_raise_alert', 'access_generate_report', 'access_review_logs', 'access_configure_monitoring',
      'permission_create_role', 'permission_assign_role', 'permission_check', 'permission_audit', 'permission_revoke_role', 'permission_list_roles',
      'token_configure', 'token_issue', 'token_validate', 'token_revoke', 'token_list_active', 'token_rotate',
      'session_create_policy', 'session_enforce', 'session_terminate', 'session_report_violations', 'session_list_active', 'session_update_policy',
      'firewall_create_rule', 'firewall_manage_zone', 'firewall_review_logs', 'firewall_test_rules', 'firewall_list_rules', 'firewall_update_zone',
    ];
    for (const c of cases) {
      it(`switch handles '${c}'`, () => {
        const content = fs.readFileSync(execPath, 'utf-8');
        expect(content).toContain(`case '${c}'`);
      });
    }
  });
});
