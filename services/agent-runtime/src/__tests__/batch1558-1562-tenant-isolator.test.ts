import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Tenant Isolator verticals', () => {
  const verticals = [
    {
      name: 'tenant_isolator', migration: '20260631950000_agent_tenant_isolator.sql',
      typeFile: 'agent-tenant-isolator.ts', skillDir: 'tenant-isolator',
      interfaces: ['TenantIsolatorEntry', 'TenantIsolatorConfig', 'TenantIsolatorResult'],
      bk: 'tenant_isolator', eks: ['ti.entry_created', 'ti.config_updated', 'ti.export_emitted'],
      subjects: ['sven.ti.entry_created', 'sven.ti.config_updated', 'sven.ti.export_emitted'],
      cases: ['ti_partitioner', 'ti_enforcer', 'ti_reporter'],
    },
    {
      name: 'tenant_isolator_monitor', migration: '20260631960000_agent_tenant_isolator_monitor.sql',
      typeFile: 'agent-tenant-isolator-monitor.ts', skillDir: 'tenant-isolator-monitor',
      interfaces: ['TenantIsolatorMonitorCheck', 'TenantIsolatorMonitorConfig', 'TenantIsolatorMonitorResult'],
      bk: 'tenant_isolator_monitor', eks: ['tim.check_passed', 'tim.alert_raised', 'tim.export_emitted'],
      subjects: ['sven.tim.check_passed', 'sven.tim.alert_raised', 'sven.tim.export_emitted'],
      cases: ['tim_watcher', 'tim_alerter', 'tim_reporter'],
    },
    {
      name: 'tenant_isolator_auditor', migration: '20260631970000_agent_tenant_isolator_auditor.sql',
      typeFile: 'agent-tenant-isolator-auditor.ts', skillDir: 'tenant-isolator-auditor',
      interfaces: ['TenantIsolatorAuditEntry', 'TenantIsolatorAuditConfig', 'TenantIsolatorAuditResult'],
      bk: 'tenant_isolator_auditor', eks: ['tia.entry_logged', 'tia.violation_found', 'tia.export_emitted'],
      subjects: ['sven.tia.entry_logged', 'sven.tia.violation_found', 'sven.tia.export_emitted'],
      cases: ['tia_scanner', 'tia_enforcer', 'tia_reporter'],
    },
    {
      name: 'tenant_isolator_reporter', migration: '20260631980000_agent_tenant_isolator_reporter.sql',
      typeFile: 'agent-tenant-isolator-reporter.ts', skillDir: 'tenant-isolator-reporter',
      interfaces: ['TenantIsolatorReport', 'TenantIsolatorReportConfig', 'TenantIsolatorReportResult'],
      bk: 'tenant_isolator_reporter', eks: ['tir.report_generated', 'tir.insight_found', 'tir.export_emitted'],
      subjects: ['sven.tir.report_generated', 'sven.tir.insight_found', 'sven.tir.export_emitted'],
      cases: ['tir_builder', 'tir_analyst', 'tir_reporter'],
    },
    {
      name: 'tenant_isolator_optimizer', migration: '20260631990000_agent_tenant_isolator_optimizer.sql',
      typeFile: 'agent-tenant-isolator-optimizer.ts', skillDir: 'tenant-isolator-optimizer',
      interfaces: ['TenantIsolatorOptPlan', 'TenantIsolatorOptConfig', 'TenantIsolatorOptResult'],
      bk: 'tenant_isolator_optimizer', eks: ['tio.plan_created', 'tio.optimization_applied', 'tio.export_emitted'],
      subjects: ['sven.tio.plan_created', 'sven.tio.optimization_applied', 'sven.tio.export_emitted'],
      cases: ['tio_planner', 'tio_executor', 'tio_reporter'],
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
