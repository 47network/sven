import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

const VERTICALS = [
  {
    name: 'token_rotator',
    migration: '20260621050000_agent_token_rotator.sql',
    table: 'agent_token_rotator_configs',
    typeFile: 'agent-token-rotator.ts',
    interfaces: ['TokenRotatorConfig', 'RotationEvent', 'TokenHealth'],
    skillDir: 'token-rotator',
    bk: 'token_rotator',
    ekPrefix: 'tkrt',
    eks: ['tkrt.rotation_completed', 'tkrt.token_revoked', 'tkrt.health_checked', 'tkrt.grace_expired'],
    subjects: ['sven.tkrt.rotation_completed', 'sven.tkrt.token_revoked', 'sven.tkrt.health_checked', 'sven.tkrt.grace_expired'],
    cases: ['tkrt_rotate', 'tkrt_schedule', 'tkrt_health', 'tkrt_revoke', 'tkrt_status', 'tkrt_list'],
  },
  {
    name: 'secret_scanner',
    migration: '20260621060000_agent_secret_scanner.sql',
    table: 'agent_secret_scanner_configs',
    typeFile: 'agent-secret-scanner.ts',
    interfaces: ['SecretScannerConfig', 'SecretFinding', 'ScanReport'],
    skillDir: 'secret-scanner',
    bk: 'secret_scanner',
    ekPrefix: 'scsc',
    eks: ['scsc.scan_completed', 'scsc.secret_found', 'scsc.finding_verified', 'scsc.remediation_applied'],
    subjects: ['sven.scsc.scan_completed', 'sven.scsc.secret_found', 'sven.scsc.finding_verified', 'sven.scsc.remediation_applied'],
    cases: ['scsc_full', 'scsc_incremental', 'scsc_verify', 'scsc_remediate', 'scsc_report', 'scsc_status'],
  },
  {
    name: 'auth_auditor',
    migration: '20260621070000_agent_auth_auditor.sql',
    table: 'agent_auth_auditor_configs',
    typeFile: 'agent-auth-auditor.ts',
    interfaces: ['AuthAuditorConfig', 'AuditFinding', 'ComplianceReport'],
    skillDir: 'auth-auditor',
    bk: 'auth_auditor',
    ekPrefix: 'auad',
    eks: ['auad.audit_completed', 'auad.anomaly_detected', 'auad.compliance_checked', 'auad.report_generated'],
    subjects: ['sven.auad.audit_completed', 'sven.auad.anomaly_detected', 'sven.auad.compliance_checked', 'sven.auad.report_generated'],
    cases: ['auad_audit', 'auad_compliance', 'auad_anomaly', 'auad_report', 'auad_status', 'auad_schedule'],
  },
  {
    name: 'permission_mapper',
    migration: '20260621080000_agent_permission_mapper.sql',
    table: 'agent_permission_mapper_configs',
    typeFile: 'agent-permission-mapper.ts',
    interfaces: ['PermissionMapperConfig', 'RoleMapping', 'PermissionCheck'],
    skillDir: 'permission-mapper',
    bk: 'permission_mapper',
    ekPrefix: 'pmmp',
    eks: ['pmmp.roles_mapped', 'pmmp.access_checked', 'pmmp.excessive_found', 'pmmp.hierarchy_optimized'],
    subjects: ['sven.pmmp.roles_mapped', 'sven.pmmp.access_checked', 'sven.pmmp.excessive_found', 'sven.pmmp.hierarchy_optimized'],
    cases: ['pmmp_map', 'pmmp_check', 'pmmp_excessive', 'pmmp_optimize', 'pmmp_report', 'pmmp_export'],
  },
  {
    name: 'session_tracker',
    migration: '20260621090000_agent_session_tracker.sql',
    table: 'agent_session_tracker_configs',
    typeFile: 'agent-session-tracker.ts',
    interfaces: ['SessionTrackerConfig', 'ActiveSession', 'SessionAnalytics'],
    skillDir: 'session-tracker',
    bk: 'session_tracker',
    ekPrefix: 'sntr',
    eks: ['sntr.sessions_listed', 'sntr.anomaly_detected', 'sntr.limits_enforced', 'sntr.analytics_generated'],
    subjects: ['sven.sntr.sessions_listed', 'sven.sntr.anomaly_detected', 'sven.sntr.limits_enforced', 'sven.sntr.analytics_generated'],
    cases: ['sntr_list', 'sntr_anomaly', 'sntr_enforce', 'sntr_analytics', 'sntr_terminate', 'sntr_report'],
  },
];

describe('Batches 468-472 — API Security & Auth', () => {
  VERTICALS.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });

      test('migration creates correct table', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(v.table);
        expect(sql).toContain('agent_id');
        expect(sql).toContain('enabled');
      });

      test('migration has indexes', () => {
        const p = path.join(REPO, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE INDEX');
      });

      test('type file exists', () => {
        const p = path.join(REPO, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(p)).toBe(true);
      });

      test('type file exports all interfaces', () => {
        const p = path.join(REPO, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(p, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });

      test('barrel export exists', () => {
        const barrel = fs.readFileSync(path.join(REPO, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(barrel).toContain(`export * from './${modName}'`);
      });

      test('SKILL.md exists', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });

      test('SKILL.md has actions section', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });

      test('SKILL.md has price', () => {
        const p = path.join(REPO, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('price:');
      });

      test('BK registered', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });

      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });

      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });

      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(REPO, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((sub) => {
          expect(eb).toContain(`'${sub}'`);
        });
      });

      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(REPO, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => {
          expect(te).toContain(`case '${c}'`);
        });
      });
    });
  });
});
