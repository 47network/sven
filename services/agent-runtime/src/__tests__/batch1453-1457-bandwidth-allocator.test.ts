import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Bandwidth Allocator verticals', () => {
  const verticals = [
    {
      name: 'bandwidth_allocator', migration: '20260630900000_agent_bandwidth_allocator.sql',
      typeFile: 'agent-bandwidth-allocator.ts', skillDir: 'bandwidth-allocator',
      interfaces: ['BandwidthAllocatorEntry', 'BandwidthAllocatorConfig', 'BandwidthAllocatorResult'],
      bk: 'bandwidth_allocator', eks: ['ba.entry_created', 'ba.config_updated', 'ba.export_emitted'],
      subjects: ['sven.ba.entry_created', 'sven.ba.config_updated', 'sven.ba.export_emitted'],
      cases: ['ba_planner', 'ba_enforcer', 'ba_reporter'],
    },
    {
      name: 'bandwidth_allocator_monitor', migration: '20260630910000_agent_bandwidth_allocator_monitor.sql',
      typeFile: 'agent-bandwidth-allocator-monitor.ts', skillDir: 'bandwidth-allocator-monitor',
      interfaces: ['BandwidthAllocatorMonitorCheck', 'BandwidthAllocatorMonitorConfig', 'BandwidthAllocatorMonitorResult'],
      bk: 'bandwidth_allocator_monitor', eks: ['bam.check_passed', 'bam.alert_raised', 'bam.export_emitted'],
      subjects: ['sven.bam.check_passed', 'sven.bam.alert_raised', 'sven.bam.export_emitted'],
      cases: ['bam_watcher', 'bam_alerter', 'bam_reporter'],
    },
    {
      name: 'bandwidth_allocator_auditor', migration: '20260630920000_agent_bandwidth_allocator_auditor.sql',
      typeFile: 'agent-bandwidth-allocator-auditor.ts', skillDir: 'bandwidth-allocator-auditor',
      interfaces: ['BandwidthAllocatorAuditEntry', 'BandwidthAllocatorAuditConfig', 'BandwidthAllocatorAuditResult'],
      bk: 'bandwidth_allocator_auditor', eks: ['baa.entry_logged', 'baa.violation_found', 'baa.export_emitted'],
      subjects: ['sven.baa.entry_logged', 'sven.baa.violation_found', 'sven.baa.export_emitted'],
      cases: ['baa_scanner', 'baa_enforcer', 'baa_reporter'],
    },
    {
      name: 'bandwidth_allocator_reporter', migration: '20260630930000_agent_bandwidth_allocator_reporter.sql',
      typeFile: 'agent-bandwidth-allocator-reporter.ts', skillDir: 'bandwidth-allocator-reporter',
      interfaces: ['BandwidthAllocatorReport', 'BandwidthAllocatorReportConfig', 'BandwidthAllocatorReportResult'],
      bk: 'bandwidth_allocator_reporter', eks: ['bar.report_generated', 'bar.insight_found', 'bar.export_emitted'],
      subjects: ['sven.bar.report_generated', 'sven.bar.insight_found', 'sven.bar.export_emitted'],
      cases: ['bar_builder', 'bar_analyst', 'bar_reporter'],
    },
    {
      name: 'bandwidth_allocator_optimizer', migration: '20260630940000_agent_bandwidth_allocator_optimizer.sql',
      typeFile: 'agent-bandwidth-allocator-optimizer.ts', skillDir: 'bandwidth-allocator-optimizer',
      interfaces: ['BandwidthAllocatorOptPlan', 'BandwidthAllocatorOptConfig', 'BandwidthAllocatorOptResult'],
      bk: 'bandwidth_allocator_optimizer', eks: ['bao.plan_created', 'bao.optimization_applied', 'bao.export_emitted'],
      subjects: ['sven.bao.plan_created', 'sven.bao.optimization_applied', 'sven.bao.export_emitted'],
      cases: ['bao_planner', 'bao_executor', 'bao_reporter'],
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
