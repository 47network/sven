import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Cost Allocation management verticals', () => {
  const verticals = [
    {
      name: 'cost_allocation', migration: '20260629200000_agent_cost_allocation.sql',
      typeFile: 'agent-cost-allocation.ts', skillDir: 'cost-allocation',
      interfaces: ['CostAllocationEntry', 'CostAllocationConfig', 'CostAllocationResult'],
      bk: 'cost_allocation', eks: ['ca.entry_created', 'ca.config_updated', 'ca.export_emitted'],
      subjects: ['sven.ca.entry_created', 'sven.ca.config_updated', 'sven.ca.export_emitted'],
      cases: ['ca_planner', 'ca_allocator', 'ca_reporter'],
    },
    {
      name: 'cost_allocation_monitor', migration: '20260629210000_agent_cost_allocation_monitor.sql',
      typeFile: 'agent-cost-allocation-monitor.ts', skillDir: 'cost-allocation-monitor',
      interfaces: ['CostAllocationMonitorCheck', 'CostAllocationMonitorConfig', 'CostAllocationMonitorResult'],
      bk: 'cost_allocation_monitor', eks: ['cam.check_passed', 'cam.alert_raised', 'cam.export_emitted'],
      subjects: ['sven.cam.check_passed', 'sven.cam.alert_raised', 'sven.cam.export_emitted'],
      cases: ['cam_watcher', 'cam_alerter', 'cam_reporter'],
    },
    {
      name: 'cost_allocation_auditor', migration: '20260629220000_agent_cost_allocation_auditor.sql',
      typeFile: 'agent-cost-allocation-auditor.ts', skillDir: 'cost-allocation-auditor',
      interfaces: ['CostAllocationAuditEntry', 'CostAllocationAuditConfig', 'CostAllocationAuditResult'],
      bk: 'cost_allocation_auditor', eks: ['caa.entry_logged', 'caa.violation_found', 'caa.export_emitted'],
      subjects: ['sven.caa.entry_logged', 'sven.caa.violation_found', 'sven.caa.export_emitted'],
      cases: ['caa_scanner', 'caa_enforcer', 'caa_reporter'],
    },
    {
      name: 'cost_allocation_reporter', migration: '20260629230000_agent_cost_allocation_reporter.sql',
      typeFile: 'agent-cost-allocation-reporter.ts', skillDir: 'cost-allocation-reporter',
      interfaces: ['CostAllocationReport', 'CostAllocationReportConfig', 'CostAllocationReportResult'],
      bk: 'cost_allocation_reporter', eks: ['car.report_generated', 'car.insight_found', 'car.export_emitted'],
      subjects: ['sven.car.report_generated', 'sven.car.insight_found', 'sven.car.export_emitted'],
      cases: ['car_builder', 'car_analyst', 'car_reporter'],
    },
    {
      name: 'cost_allocation_optimizer', migration: '20260629240000_agent_cost_allocation_optimizer.sql',
      typeFile: 'agent-cost-allocation-optimizer.ts', skillDir: 'cost-allocation-optimizer',
      interfaces: ['CostAllocationOptPlan', 'CostAllocationOptConfig', 'CostAllocationOptResult'],
      bk: 'cost_allocation_optimizer', eks: ['cao.plan_created', 'cao.optimization_applied', 'cao.export_emitted'],
      subjects: ['sven.cao.plan_created', 'sven.cao.optimization_applied', 'sven.cao.export_emitted'],
      cases: ['cao_planner', 'cao_executor', 'cao_reporter'],
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
