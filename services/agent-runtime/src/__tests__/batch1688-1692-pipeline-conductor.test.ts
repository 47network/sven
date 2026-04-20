import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Pipeline Conductor verticals', () => {
  const verticals = [
    {
      name: 'pipeline_conductor', migration: '20260633250000_agent_pipeline_conductor.sql',
      typeFile: 'agent-pipeline-conductor.ts', skillDir: 'pipeline-conductor',
      interfaces: ['PipelineConductorEntry', 'PipelineConductorConfig', 'PipelineConductorResult'],
      bk: 'pipeline_conductor', eks: ['pc.entry_created', 'pc.config_updated', 'pc.export_emitted'],
      subjects: ['sven.pc.entry_created', 'sven.pc.config_updated', 'sven.pc.export_emitted'],
      cases: ['pc_scheduler', 'pc_executor', 'pc_reporter'],
    },
    {
      name: 'pipeline_conductor_monitor', migration: '20260633260000_agent_pipeline_conductor_monitor.sql',
      typeFile: 'agent-pipeline-conductor-monitor.ts', skillDir: 'pipeline-conductor-monitor',
      interfaces: ['PipelineConductorMonitorCheck', 'PipelineConductorMonitorConfig', 'PipelineConductorMonitorResult'],
      bk: 'pipeline_conductor_monitor', eks: ['pcm.check_passed', 'pcm.alert_raised', 'pcm.export_emitted'],
      subjects: ['sven.pcm.check_passed', 'sven.pcm.alert_raised', 'sven.pcm.export_emitted'],
      cases: ['pcm_watcher', 'pcm_alerter', 'pcm_reporter'],
    },
    {
      name: 'pipeline_conductor_auditor', migration: '20260633270000_agent_pipeline_conductor_auditor.sql',
      typeFile: 'agent-pipeline-conductor-auditor.ts', skillDir: 'pipeline-conductor-auditor',
      interfaces: ['PipelineConductorAuditEntry', 'PipelineConductorAuditConfig', 'PipelineConductorAuditResult'],
      bk: 'pipeline_conductor_auditor', eks: ['pca.entry_logged', 'pca.violation_found', 'pca.export_emitted'],
      subjects: ['sven.pca.entry_logged', 'sven.pca.violation_found', 'sven.pca.export_emitted'],
      cases: ['pca_scanner', 'pca_enforcer', 'pca_reporter'],
    },
    {
      name: 'pipeline_conductor_reporter', migration: '20260633280000_agent_pipeline_conductor_reporter.sql',
      typeFile: 'agent-pipeline-conductor-reporter.ts', skillDir: 'pipeline-conductor-reporter',
      interfaces: ['PipelineConductorReport', 'PipelineConductorReportConfig', 'PipelineConductorReportResult'],
      bk: 'pipeline_conductor_reporter', eks: ['pcr.report_generated', 'pcr.insight_found', 'pcr.export_emitted'],
      subjects: ['sven.pcr.report_generated', 'sven.pcr.insight_found', 'sven.pcr.export_emitted'],
      cases: ['pcr_builder', 'pcr_analyst', 'pcr_reporter'],
    },
    {
      name: 'pipeline_conductor_optimizer', migration: '20260633290000_agent_pipeline_conductor_optimizer.sql',
      typeFile: 'agent-pipeline-conductor-optimizer.ts', skillDir: 'pipeline-conductor-optimizer',
      interfaces: ['PipelineConductorOptPlan', 'PipelineConductorOptConfig', 'PipelineConductorOptResult'],
      bk: 'pipeline_conductor_optimizer', eks: ['pco.plan_created', 'pco.optimization_applied', 'pco.export_emitted'],
      subjects: ['sven.pco.plan_created', 'sven.pco.optimization_applied', 'sven.pco.export_emitted'],
      cases: ['pco_planner', 'pco_executor', 'pco_reporter'],
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
