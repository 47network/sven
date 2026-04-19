import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Permission Resolver verticals', () => {
  const verticals = [
    {
      name: 'permission_resolver', migration: '20260632000000_agent_permission_resolver.sql',
      typeFile: 'agent-permission-resolver.ts', skillDir: 'permission-resolver',
      interfaces: ['PermissionResolverEntry', 'PermissionResolverConfig', 'PermissionResolverResult'],
      bk: 'permission_resolver', eks: ['pr.entry_created', 'pr.config_updated', 'pr.export_emitted'],
      subjects: ['sven.pr.entry_created', 'sven.pr.config_updated', 'sven.pr.export_emitted'],
      cases: ['pr_evaluator', 'pr_granter', 'pr_reporter'],
    },
    {
      name: 'permission_resolver_monitor', migration: '20260632010000_agent_permission_resolver_monitor.sql',
      typeFile: 'agent-permission-resolver-monitor.ts', skillDir: 'permission-resolver-monitor',
      interfaces: ['PermissionResolverMonitorCheck', 'PermissionResolverMonitorConfig', 'PermissionResolverMonitorResult'],
      bk: 'permission_resolver_monitor', eks: ['prm.check_passed', 'prm.alert_raised', 'prm.export_emitted'],
      subjects: ['sven.prm.check_passed', 'sven.prm.alert_raised', 'sven.prm.export_emitted'],
      cases: ['prm_watcher', 'prm_alerter', 'prm_reporter'],
    },
    {
      name: 'permission_resolver_auditor', migration: '20260632020000_agent_permission_resolver_auditor.sql',
      typeFile: 'agent-permission-resolver-auditor.ts', skillDir: 'permission-resolver-auditor',
      interfaces: ['PermissionResolverAuditEntry', 'PermissionResolverAuditConfig', 'PermissionResolverAuditResult'],
      bk: 'permission_resolver_auditor', eks: ['pra.entry_logged', 'pra.violation_found', 'pra.export_emitted'],
      subjects: ['sven.pra.entry_logged', 'sven.pra.violation_found', 'sven.pra.export_emitted'],
      cases: ['pra_scanner', 'pra_enforcer', 'pra_reporter'],
    },
    {
      name: 'permission_resolver_reporter', migration: '20260632030000_agent_permission_resolver_reporter.sql',
      typeFile: 'agent-permission-resolver-reporter.ts', skillDir: 'permission-resolver-reporter',
      interfaces: ['PermissionResolverReport', 'PermissionResolverReportConfig', 'PermissionResolverReportResult'],
      bk: 'permission_resolver_reporter', eks: ['prr.report_generated', 'prr.insight_found', 'prr.export_emitted'],
      subjects: ['sven.prr.report_generated', 'sven.prr.insight_found', 'sven.prr.export_emitted'],
      cases: ['prr_builder', 'prr_analyst', 'prr_reporter'],
    },
    {
      name: 'permission_resolver_optimizer', migration: '20260632040000_agent_permission_resolver_optimizer.sql',
      typeFile: 'agent-permission-resolver-optimizer.ts', skillDir: 'permission-resolver-optimizer',
      interfaces: ['PermissionResolverOptPlan', 'PermissionResolverOptConfig', 'PermissionResolverOptResult'],
      bk: 'permission_resolver_optimizer', eks: ['pro.plan_created', 'pro.optimization_applied', 'pro.export_emitted'],
      subjects: ['sven.pro.plan_created', 'sven.pro.optimization_applied', 'sven.pro.export_emitted'],
      cases: ['pro_planner', 'pro_executor', 'pro_reporter'],
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
