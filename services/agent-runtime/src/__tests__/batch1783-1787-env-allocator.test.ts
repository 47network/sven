import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Env Allocator verticals', () => {
  const verticals = [
    {
      name: 'env_allocator', migration: '20260634200000_agent_env_allocator.sql',
      typeFile: 'agent-env-allocator.ts', skillDir: 'env-allocator',
      interfaces: ['EnvAllocatorEntry', 'EnvAllocatorConfig', 'EnvAllocatorResult'],
      bk: 'env_allocator', eks: ['ea.entry_created', 'ea.config_updated', 'ea.export_emitted'],
      subjects: ['sven.ea.entry_created', 'sven.ea.config_updated', 'sven.ea.export_emitted'],
      cases: ['ea_provisioner', 'ea_validator', 'ea_reporter'],
    },
    {
      name: 'env_allocator_monitor', migration: '20260634210000_agent_env_allocator_monitor.sql',
      typeFile: 'agent-env-allocator-monitor.ts', skillDir: 'env-allocator-monitor',
      interfaces: ['EnvAllocatorMonitorCheck', 'EnvAllocatorMonitorConfig', 'EnvAllocatorMonitorResult'],
      bk: 'env_allocator_monitor', eks: ['eam.check_passed', 'eam.alert_raised', 'eam.export_emitted'],
      subjects: ['sven.eam.check_passed', 'sven.eam.alert_raised', 'sven.eam.export_emitted'],
      cases: ['eam_watcher', 'eam_alerter', 'eam_reporter'],
    },
    {
      name: 'env_allocator_auditor', migration: '20260634220000_agent_env_allocator_auditor.sql',
      typeFile: 'agent-env-allocator-auditor.ts', skillDir: 'env-allocator-auditor',
      interfaces: ['EnvAllocatorAuditEntry', 'EnvAllocatorAuditConfig', 'EnvAllocatorAuditResult'],
      bk: 'env_allocator_auditor', eks: ['eaa.entry_logged', 'eaa.violation_found', 'eaa.export_emitted'],
      subjects: ['sven.eaa.entry_logged', 'sven.eaa.violation_found', 'sven.eaa.export_emitted'],
      cases: ['eaa_scanner', 'eaa_enforcer', 'eaa_reporter'],
    },
    {
      name: 'env_allocator_reporter', migration: '20260634230000_agent_env_allocator_reporter.sql',
      typeFile: 'agent-env-allocator-reporter.ts', skillDir: 'env-allocator-reporter',
      interfaces: ['EnvAllocatorReport', 'EnvAllocatorReportConfig', 'EnvAllocatorReportResult'],
      bk: 'env_allocator_reporter', eks: ['ear.report_generated', 'ear.insight_found', 'ear.export_emitted'],
      subjects: ['sven.ear.report_generated', 'sven.ear.insight_found', 'sven.ear.export_emitted'],
      cases: ['ear_builder', 'ear_analyst', 'ear_reporter'],
    },
    {
      name: 'env_allocator_optimizer', migration: '20260634240000_agent_env_allocator_optimizer.sql',
      typeFile: 'agent-env-allocator-optimizer.ts', skillDir: 'env-allocator-optimizer',
      interfaces: ['EnvAllocatorOptPlan', 'EnvAllocatorOptConfig', 'EnvAllocatorOptResult'],
      bk: 'env_allocator_optimizer', eks: ['eao.plan_created', 'eao.optimization_applied', 'eao.export_emitted'],
      subjects: ['sven.eao.plan_created', 'sven.eao.optimization_applied', 'sven.eao.export_emitted'],
      cases: ['eao_planner', 'eao_executor', 'eao_reporter'],
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
