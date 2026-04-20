import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 488-492: Observability & Monitoring', () => {
  const verticals = [
    {
      name: 'span_collector',
      migration: '20260621250000_agent_span_collector.sql',
      typeFile: 'agent-span-collector.ts',
      skillDir: 'span-collector',
      interfaces: ['SpanCollectorConfig', 'CollectedSpan', 'SpanFilter'],
      bk: 'span_collector',
      eks: ['spcl.span_ingested', 'spcl.span_filtered', 'spcl.batch_flushed', 'spcl.export_completed'],
      subjects: ['sven.spcl.span_ingested', 'sven.spcl.span_filtered', 'sven.spcl.batch_flushed', 'sven.spcl.export_completed'],
      cases: ['spcl_ingest', 'spcl_filter', 'spcl_flush', 'spcl_export', 'spcl_report', 'spcl_monitor'],
    },
    {
      name: 'uptime_tracker',
      migration: '20260621260000_agent_uptime_tracker.sql',
      typeFile: 'agent-uptime-tracker.ts',
      skillDir: 'uptime-tracker',
      interfaces: ['UptimeTrackerConfig', 'UptimeRecord', 'DowntimeEvent'],
      bk: 'uptime_tracker',
      eks: ['uptk.check_completed', 'uptk.downtime_detected', 'uptk.uptime_reported', 'uptk.alert_fired'],
      subjects: ['sven.uptk.check_completed', 'sven.uptk.downtime_detected', 'sven.uptk.uptime_reported', 'sven.uptk.alert_fired'],
      cases: ['uptk_check', 'uptk_detect', 'uptk_report', 'uptk_alert', 'uptk_history', 'uptk_monitor'],
    },
    {
      name: 'sla_monitor',
      migration: '20260621270000_agent_sla_monitor.sql',
      typeFile: 'agent-sla-monitor.ts',
      skillDir: 'sla-monitor',
      interfaces: ['SlaMonitorConfig', 'SlaTarget', 'SlaViolation'],
      bk: 'sla_monitor',
      eks: ['slam.sla_evaluated', 'slam.violation_detected', 'slam.report_generated', 'slam.target_updated'],
      subjects: ['sven.slam.sla_evaluated', 'sven.slam.violation_detected', 'sven.slam.report_generated', 'sven.slam.target_updated'],
      cases: ['slam_evaluate', 'slam_detect', 'slam_report', 'slam_update', 'slam_audit', 'slam_monitor'],
    },
    {
      name: 'cardinality_limiter',
      migration: '20260621280000_agent_cardinality_limiter.sql',
      typeFile: 'agent-cardinality-limiter.ts',
      skillDir: 'cardinality-limiter',
      interfaces: ['CardinalityLimiterConfig', 'CardinalityRule', 'LimitAction'],
      bk: 'cardinality_limiter',
      eks: ['cdlm.limit_applied', 'cdlm.series_dropped', 'cdlm.rule_updated', 'cdlm.threshold_breached'],
      subjects: ['sven.cdlm.limit_applied', 'sven.cdlm.series_dropped', 'sven.cdlm.rule_updated', 'sven.cdlm.threshold_breached'],
      cases: ['cdlm_limit', 'cdlm_drop', 'cdlm_rule', 'cdlm_breach', 'cdlm_report', 'cdlm_monitor'],
    },
    {
      name: 'exemplar_sampler',
      migration: '20260621290000_agent_exemplar_sampler.sql',
      typeFile: 'agent-exemplar-sampler.ts',
      skillDir: 'exemplar-sampler',
      interfaces: ['ExemplarSamplerConfig', 'SampledExemplar', 'SamplingPolicy'],
      bk: 'exemplar_sampler',
      eks: ['exsm.exemplar_captured', 'exsm.policy_applied', 'exsm.sample_exported', 'exsm.rate_adjusted'],
      subjects: ['sven.exsm.exemplar_captured', 'sven.exsm.policy_applied', 'sven.exsm.sample_exported', 'sven.exsm.rate_adjusted'],
      cases: ['exsm_capture', 'exsm_policy', 'exsm_export', 'exsm_adjust', 'exsm_report', 'exsm_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(migPath)).toBe(true);
      });
      test('migration has correct table', () => {
        const migPath = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(migPath, 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(tf)).toBe(true);
      });
      test('type file exports interfaces', () => {
        const tf = path.join(ROOT, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(tf, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`from './${modName}'`);
      });
      test('SKILL.md exists', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(sp)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const sp = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(sp, 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
