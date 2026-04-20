import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Trace Pipeline verticals', () => {
  const verticals = [
    {
      name: 'trace_pipeline', migration: '20260629800000_agent_trace_pipeline.sql',
      typeFile: 'agent-trace-pipeline.ts', skillDir: 'trace-pipeline',
      interfaces: ['TracePipelineEntry', 'TracePipelineConfig', 'TracePipelineResult'],
      bk: 'trace_pipeline', eks: ['tp.entry_created', 'tp.config_updated', 'tp.export_emitted'],
      subjects: ['sven.tp.entry_created', 'sven.tp.config_updated', 'sven.tp.export_emitted'],
      cases: ['tp_collector', 'tp_processor', 'tp_reporter'],
    },
    {
      name: 'trace_pipeline_monitor', migration: '20260629810000_agent_trace_pipeline_monitor.sql',
      typeFile: 'agent-trace-pipeline-monitor.ts', skillDir: 'trace-pipeline-monitor',
      interfaces: ['TracePipelineMonitorCheck', 'TracePipelineMonitorConfig', 'TracePipelineMonitorResult'],
      bk: 'trace_pipeline_monitor', eks: ['tpm.check_passed', 'tpm.alert_raised', 'tpm.export_emitted'],
      subjects: ['sven.tpm.check_passed', 'sven.tpm.alert_raised', 'sven.tpm.export_emitted'],
      cases: ['tpm_watcher', 'tpm_alerter', 'tpm_reporter'],
    },
    {
      name: 'trace_pipeline_auditor', migration: '20260629820000_agent_trace_pipeline_auditor.sql',
      typeFile: 'agent-trace-pipeline-auditor.ts', skillDir: 'trace-pipeline-auditor',
      interfaces: ['TracePipelineAuditEntry', 'TracePipelineAuditConfig', 'TracePipelineAuditResult'],
      bk: 'trace_pipeline_auditor', eks: ['tpa.entry_logged', 'tpa.violation_found', 'tpa.export_emitted'],
      subjects: ['sven.tpa.entry_logged', 'sven.tpa.violation_found', 'sven.tpa.export_emitted'],
      cases: ['tpa_scanner', 'tpa_enforcer', 'tpa_reporter'],
    },
    {
      name: 'trace_pipeline_reporter', migration: '20260629830000_agent_trace_pipeline_reporter.sql',
      typeFile: 'agent-trace-pipeline-reporter.ts', skillDir: 'trace-pipeline-reporter',
      interfaces: ['TracePipelineReport', 'TracePipelineReportConfig', 'TracePipelineReportResult'],
      bk: 'trace_pipeline_reporter', eks: ['tpr.report_generated', 'tpr.insight_found', 'tpr.export_emitted'],
      subjects: ['sven.tpr.report_generated', 'sven.tpr.insight_found', 'sven.tpr.export_emitted'],
      cases: ['tpr_builder', 'tpr_analyst', 'tpr_reporter'],
    },
    {
      name: 'trace_pipeline_optimizer', migration: '20260629840000_agent_trace_pipeline_optimizer.sql',
      typeFile: 'agent-trace-pipeline-optimizer.ts', skillDir: 'trace-pipeline-optimizer',
      interfaces: ['TracePipelineOptPlan', 'TracePipelineOptConfig', 'TracePipelineOptResult'],
      bk: 'trace_pipeline_optimizer', eks: ['tpo.plan_created', 'tpo.optimization_applied', 'tpo.export_emitted'],
      subjects: ['sven.tpo.plan_created', 'sven.tpo.optimization_applied', 'sven.tpo.export_emitted'],
      cases: ['tpo_planner', 'tpo_executor', 'tpo_reporter'],
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
