import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Breaker Fence verticals', () => {
  const verticals = [
    {
      name: 'breaker_fence', migration: '20260632550000_agent_breaker_fence.sql',
      typeFile: 'agent-breaker-fence.ts', skillDir: 'breaker-fence',
      interfaces: ['BreakerFenceEntry', 'BreakerFenceConfig', 'BreakerFenceResult'],
      bk: 'breaker_fence', eks: ['bf.entry_created', 'bf.config_updated', 'bf.export_emitted'],
      subjects: ['sven.bf.entry_created', 'sven.bf.config_updated', 'sven.bf.export_emitted'],
      cases: ['bf_tripper', 'bf_resetter', 'bf_reporter'],
    },
    {
      name: 'breaker_fence_monitor', migration: '20260632560000_agent_breaker_fence_monitor.sql',
      typeFile: 'agent-breaker-fence-monitor.ts', skillDir: 'breaker-fence-monitor',
      interfaces: ['BreakerFenceMonitorCheck', 'BreakerFenceMonitorConfig', 'BreakerFenceMonitorResult'],
      bk: 'breaker_fence_monitor', eks: ['bfm.check_passed', 'bfm.alert_raised', 'bfm.export_emitted'],
      subjects: ['sven.bfm.check_passed', 'sven.bfm.alert_raised', 'sven.bfm.export_emitted'],
      cases: ['bfm_watcher', 'bfm_alerter', 'bfm_reporter'],
    },
    {
      name: 'breaker_fence_auditor', migration: '20260632570000_agent_breaker_fence_auditor.sql',
      typeFile: 'agent-breaker-fence-auditor.ts', skillDir: 'breaker-fence-auditor',
      interfaces: ['BreakerFenceAuditEntry', 'BreakerFenceAuditConfig', 'BreakerFenceAuditResult'],
      bk: 'breaker_fence_auditor', eks: ['bfa.entry_logged', 'bfa.violation_found', 'bfa.export_emitted'],
      subjects: ['sven.bfa.entry_logged', 'sven.bfa.violation_found', 'sven.bfa.export_emitted'],
      cases: ['bfa_scanner', 'bfa_enforcer', 'bfa_reporter'],
    },
    {
      name: 'breaker_fence_reporter', migration: '20260632580000_agent_breaker_fence_reporter.sql',
      typeFile: 'agent-breaker-fence-reporter.ts', skillDir: 'breaker-fence-reporter',
      interfaces: ['BreakerFenceReport', 'BreakerFenceReportConfig', 'BreakerFenceReportResult'],
      bk: 'breaker_fence_reporter', eks: ['bfr.report_generated', 'bfr.insight_found', 'bfr.export_emitted'],
      subjects: ['sven.bfr.report_generated', 'sven.bfr.insight_found', 'sven.bfr.export_emitted'],
      cases: ['bfr_builder', 'bfr_analyst', 'bfr_reporter'],
    },
    {
      name: 'breaker_fence_optimizer', migration: '20260632590000_agent_breaker_fence_optimizer.sql',
      typeFile: 'agent-breaker-fence-optimizer.ts', skillDir: 'breaker-fence-optimizer',
      interfaces: ['BreakerFenceOptPlan', 'BreakerFenceOptConfig', 'BreakerFenceOptResult'],
      bk: 'breaker_fence_optimizer', eks: ['bfo.plan_created', 'bfo.optimization_applied', 'bfo.export_emitted'],
      subjects: ['sven.bfo.plan_created', 'sven.bfo.optimization_applied', 'sven.bfo.export_emitted'],
      cases: ['bfo_planner', 'bfo_executor', 'bfo_reporter'],
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
