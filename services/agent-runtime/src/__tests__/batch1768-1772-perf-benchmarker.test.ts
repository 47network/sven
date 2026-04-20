import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Perf Benchmarker verticals', () => {
  const verticals = [
    {
      name: 'perf_benchmarker', migration: '20260634050000_agent_perf_benchmarker.sql',
      typeFile: 'agent-perf-benchmarker.ts', skillDir: 'perf-benchmarker',
      interfaces: ['PerfBenchmarkerEntry', 'PerfBenchmarkerConfig', 'PerfBenchmarkerResult'],
      bk: 'perf_benchmarker', eks: ['pb.entry_created', 'pb.config_updated', 'pb.export_emitted'],
      subjects: ['sven.pb.entry_created', 'sven.pb.config_updated', 'sven.pb.export_emitted'],
      cases: ['pb_runner', 'pb_profiler', 'pb_reporter'],
    },
    {
      name: 'perf_benchmarker_monitor', migration: '20260634060000_agent_perf_benchmarker_monitor.sql',
      typeFile: 'agent-perf-benchmarker-monitor.ts', skillDir: 'perf-benchmarker-monitor',
      interfaces: ['PerfBenchmarkerMonitorCheck', 'PerfBenchmarkerMonitorConfig', 'PerfBenchmarkerMonitorResult'],
      bk: 'perf_benchmarker_monitor', eks: ['pbm.check_passed', 'pbm.alert_raised', 'pbm.export_emitted'],
      subjects: ['sven.pbm.check_passed', 'sven.pbm.alert_raised', 'sven.pbm.export_emitted'],
      cases: ['pbm_watcher', 'pbm_alerter', 'pbm_reporter'],
    },
    {
      name: 'perf_benchmarker_auditor', migration: '20260634070000_agent_perf_benchmarker_auditor.sql',
      typeFile: 'agent-perf-benchmarker-auditor.ts', skillDir: 'perf-benchmarker-auditor',
      interfaces: ['PerfBenchmarkerAuditEntry', 'PerfBenchmarkerAuditConfig', 'PerfBenchmarkerAuditResult'],
      bk: 'perf_benchmarker_auditor', eks: ['pba.entry_logged', 'pba.violation_found', 'pba.export_emitted'],
      subjects: ['sven.pba.entry_logged', 'sven.pba.violation_found', 'sven.pba.export_emitted'],
      cases: ['pba_scanner', 'pba_enforcer', 'pba_reporter'],
    },
    {
      name: 'perf_benchmarker_reporter', migration: '20260634080000_agent_perf_benchmarker_reporter.sql',
      typeFile: 'agent-perf-benchmarker-reporter.ts', skillDir: 'perf-benchmarker-reporter',
      interfaces: ['PerfBenchmarkerReport', 'PerfBenchmarkerReportConfig', 'PerfBenchmarkerReportResult'],
      bk: 'perf_benchmarker_reporter', eks: ['pbr.report_generated', 'pbr.insight_found', 'pbr.export_emitted'],
      subjects: ['sven.pbr.report_generated', 'sven.pbr.insight_found', 'sven.pbr.export_emitted'],
      cases: ['pbr_builder', 'pbr_analyst', 'pbr_reporter'],
    },
    {
      name: 'perf_benchmarker_optimizer', migration: '20260634090000_agent_perf_benchmarker_optimizer.sql',
      typeFile: 'agent-perf-benchmarker-optimizer.ts', skillDir: 'perf-benchmarker-optimizer',
      interfaces: ['PerfBenchmarkerOptPlan', 'PerfBenchmarkerOptConfig', 'PerfBenchmarkerOptResult'],
      bk: 'perf_benchmarker_optimizer', eks: ['pbo.plan_created', 'pbo.optimization_applied', 'pbo.export_emitted'],
      subjects: ['sven.pbo.plan_created', 'sven.pbo.optimization_applied', 'sven.pbo.export_emitted'],
      cases: ['pbo_planner', 'pbo_executor', 'pbo_reporter'],
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
