import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Discount Manager verticals', () => {
  const verticals = [
    {
      name: 'discount_manager', migration: '20260635350000_agent_discount_manager.sql',
      typeFile: 'agent-discount-manager.ts', skillDir: 'discount-manager',
      interfaces: ['DiscountManagerEntry', 'DiscountManagerConfig', 'DiscountManagerResult'],
      bk: 'discount_manager', eks: ['dm.entry_created', 'dm.config_updated', 'dm.export_emitted'],
      subjects: ['sven.dm.entry_created', 'sven.dm.config_updated', 'sven.dm.export_emitted'],
      cases: ['dm_creator', 'dm_validator', 'dm_reporter'],
    },
    {
      name: 'discount_manager_monitor', migration: '20260635360000_agent_discount_manager_monitor.sql',
      typeFile: 'agent-discount-manager-monitor.ts', skillDir: 'discount-manager-monitor',
      interfaces: ['DiscountManagerMonitorCheck', 'DiscountManagerMonitorConfig', 'DiscountManagerMonitorResult'],
      bk: 'discount_manager_monitor', eks: ['dmm.check_passed', 'dmm.alert_raised', 'dmm.export_emitted'],
      subjects: ['sven.dmm.check_passed', 'sven.dmm.alert_raised', 'sven.dmm.export_emitted'],
      cases: ['dmm_watcher', 'dmm_alerter', 'dmm_reporter'],
    },
    {
      name: 'discount_manager_auditor', migration: '20260635370000_agent_discount_manager_auditor.sql',
      typeFile: 'agent-discount-manager-auditor.ts', skillDir: 'discount-manager-auditor',
      interfaces: ['DiscountManagerAuditEntry', 'DiscountManagerAuditConfig', 'DiscountManagerAuditResult'],
      bk: 'discount_manager_auditor', eks: ['dma.entry_logged', 'dma.violation_found', 'dma.export_emitted'],
      subjects: ['sven.dma.entry_logged', 'sven.dma.violation_found', 'sven.dma.export_emitted'],
      cases: ['dma_scanner', 'dma_enforcer', 'dma_reporter'],
    },
    {
      name: 'discount_manager_reporter', migration: '20260635380000_agent_discount_manager_reporter.sql',
      typeFile: 'agent-discount-manager-reporter.ts', skillDir: 'discount-manager-reporter',
      interfaces: ['DiscountManagerReport', 'DiscountManagerReportConfig', 'DiscountManagerReportResult'],
      bk: 'discount_manager_reporter', eks: ['dmr.report_generated', 'dmr.insight_found', 'dmr.export_emitted'],
      subjects: ['sven.dmr.report_generated', 'sven.dmr.insight_found', 'sven.dmr.export_emitted'],
      cases: ['dmr_builder', 'dmr_analyst', 'dmr_reporter'],
    },
    {
      name: 'discount_manager_optimizer', migration: '20260635390000_agent_discount_manager_optimizer.sql',
      typeFile: 'agent-discount-manager-optimizer.ts', skillDir: 'discount-manager-optimizer',
      interfaces: ['DiscountManagerOptPlan', 'DiscountManagerOptConfig', 'DiscountManagerOptResult'],
      bk: 'discount_manager_optimizer', eks: ['dmo.plan_created', 'dmo.optimization_applied', 'dmo.export_emitted'],
      subjects: ['sven.dmo.plan_created', 'sven.dmo.optimization_applied', 'sven.dmo.export_emitted'],
      cases: ['dmo_planner', 'dmo_executor', 'dmo_reporter'],
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
