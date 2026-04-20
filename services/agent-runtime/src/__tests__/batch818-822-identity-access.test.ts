import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 818-822: Identity & Access Management', () => {
  const verticals = [
    {
      name: 'user_directory_sync', migration: '20260624550000_agent_user_directory_sync.sql',
      typeFile: 'agent-user-directory-sync.ts', skillDir: 'user-directory-sync',
      interfaces: ['UserDirectorySyncConfig', 'DirectorySyncJob', 'SyncEvent'],
      bk: 'user_directory_sync', eks: ['udsy.scim_received', 'udsy.diff_computed', 'udsy.users_upserted', 'udsy.deprovisioning_executed'],
      subjects: ['sven.udsy.scim_received', 'sven.udsy.diff_computed', 'sven.udsy.users_upserted', 'sven.udsy.deprovisioning_executed'],
      cases: ['udsy_receive', 'udsy_compute', 'udsy_upsert', 'udsy_execute', 'udsy_report', 'udsy_monitor'],
    },
    {
      name: 'group_membership_resolver', migration: '20260624560000_agent_group_membership_resolver.sql',
      typeFile: 'agent-group-membership-resolver.ts', skillDir: 'group-membership-resolver',
      interfaces: ['GroupMembershipResolverConfig', 'MembershipQuery', 'ResolverEvent'],
      bk: 'group_membership_resolver', eks: ['gmre.query_received', 'gmre.hierarchy_walked', 'gmre.cache_consulted', 'gmre.membership_returned'],
      subjects: ['sven.gmre.query_received', 'sven.gmre.hierarchy_walked', 'sven.gmre.cache_consulted', 'sven.gmre.membership_returned'],
      cases: ['gmre_receive', 'gmre_walk', 'gmre_consult', 'gmre_return', 'gmre_report', 'gmre_monitor'],
    },
    {
      name: 'role_assignment_engine', migration: '20260624570000_agent_role_assignment_engine.sql',
      typeFile: 'agent-role-assignment-engine.ts', skillDir: 'role-assignment-engine',
      interfaces: ['RoleAssignmentEngineConfig', 'RoleAssignment', 'EngineEvent'],
      bk: 'role_assignment_engine', eks: ['rasn.request_received', 'rasn.policy_evaluated', 'rasn.assignment_persisted', 'rasn.notification_sent'],
      subjects: ['sven.rasn.request_received', 'sven.rasn.policy_evaluated', 'sven.rasn.assignment_persisted', 'sven.rasn.notification_sent'],
      cases: ['rasn_receive', 'rasn_evaluate', 'rasn_persist', 'rasn_notify', 'rasn_report', 'rasn_monitor'],
    },
    {
      name: 'permission_evaluator', migration: '20260624580000_agent_permission_evaluator.sql',
      typeFile: 'agent-permission-evaluator.ts', skillDir: 'permission-evaluator',
      interfaces: ['PermissionEvaluatorConfig', 'AccessCheck', 'EvaluatorEvent'],
      bk: 'permission_evaluator', eks: ['pmev.check_received', 'pmev.policies_loaded', 'pmev.decision_computed', 'pmev.reason_logged'],
      subjects: ['sven.pmev.check_received', 'sven.pmev.policies_loaded', 'sven.pmev.decision_computed', 'sven.pmev.reason_logged'],
      cases: ['pmev_receive', 'pmev_load', 'pmev_compute', 'pmev_log', 'pmev_report', 'pmev_monitor'],
    },
    {
      name: 'audit_trail_recorder', migration: '20260624590000_agent_audit_trail_recorder.sql',
      typeFile: 'agent-audit-trail-recorder.ts', skillDir: 'audit-trail-recorder',
      interfaces: ['AuditTrailRecorderConfig', 'AuditEntry', 'RecorderEvent'],
      bk: 'audit_trail_recorder', eks: ['atrc.event_received', 'atrc.entry_normalized', 'atrc.entry_persisted', 'atrc.integrity_sealed'],
      subjects: ['sven.atrc.event_received', 'sven.atrc.entry_normalized', 'sven.atrc.entry_persisted', 'sven.atrc.integrity_sealed'],
      cases: ['atrc_receive', 'atrc_normalize', 'atrc_persist', 'atrc_seal', 'atrc_report', 'atrc_monitor'],
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
