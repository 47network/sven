import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 993-997: Experiment Tracker', () => {
  const verticals = [
    {
      name: 'experiment_tracker_writer', migration: '20260626300000_agent_experiment_tracker_writer.sql',
      typeFile: 'agent-experiment-tracker-writer.ts', skillDir: 'experiment-tracker-writer',
      interfaces: ['ExperimentTrackerWriterConfig', 'RunRecord', 'WriterEvent'],
      bk: 'experiment_tracker_writer', eks: ['etwr.record_received', 'etwr.fields_validated', 'etwr.run_persisted', 'etwr.audit_recorded'],
      subjects: ['sven.etwr.record_received', 'sven.etwr.fields_validated', 'sven.etwr.run_persisted', 'sven.etwr.audit_recorded'],
      cases: ['etwr_receive', 'etwr_validate', 'etwr_persist', 'etwr_audit', 'etwr_report', 'etwr_monitor'],
    },
    {
      name: 'experiment_tracker_aggregator', migration: '20260626310000_agent_experiment_tracker_aggregator.sql',
      typeFile: 'agent-experiment-tracker-aggregator.ts', skillDir: 'experiment-tracker-aggregator',
      interfaces: ['ExperimentTrackerAggregatorConfig', 'AggregationJob', 'AggregatorEvent'],
      bk: 'experiment_tracker_aggregator', eks: ['etag.job_received', 'etag.runs_aggregated', 'etag.summary_persisted', 'etag.audit_recorded'],
      subjects: ['sven.etag.job_received', 'sven.etag.runs_aggregated', 'sven.etag.summary_persisted', 'sven.etag.audit_recorded'],
      cases: ['etag_receive', 'etag_aggregate', 'etag_persist', 'etag_audit', 'etag_report', 'etag_monitor'],
    },
    {
      name: 'experiment_tracker_artifact_linker', migration: '20260626320000_agent_experiment_tracker_artifact_linker.sql',
      typeFile: 'agent-experiment-tracker-artifact-linker.ts', skillDir: 'experiment-tracker-artifact-linker',
      interfaces: ['ExperimentTrackerArtifactLinkerConfig', 'LinkRequest', 'LinkerEvent'],
      bk: 'experiment_tracker_artifact_linker', eks: ['etal.request_received', 'etal.artifact_resolved', 'etal.link_persisted', 'etal.audit_recorded'],
      subjects: ['sven.etal.request_received', 'sven.etal.artifact_resolved', 'sven.etal.link_persisted', 'sven.etal.audit_recorded'],
      cases: ['etal_receive', 'etal_resolve', 'etal_persist', 'etal_audit', 'etal_report', 'etal_monitor'],
    },
    {
      name: 'experiment_tracker_reporter', migration: '20260626330000_agent_experiment_tracker_reporter.sql',
      typeFile: 'agent-experiment-tracker-reporter.ts', skillDir: 'experiment-tracker-reporter',
      interfaces: ['ExperimentTrackerReporterConfig', 'ReportRequest', 'ReporterEvent'],
      bk: 'experiment_tracker_reporter', eks: ['etrp.request_received', 'etrp.runs_collected', 'etrp.report_built', 'etrp.signed_url_emitted'],
      subjects: ['sven.etrp.request_received', 'sven.etrp.runs_collected', 'sven.etrp.report_built', 'sven.etrp.signed_url_emitted'],
      cases: ['etrp_receive', 'etrp_collect', 'etrp_build', 'etrp_emit', 'etrp_report', 'etrp_monitor'],
    },
    {
      name: 'experiment_tracker_governance_enforcer', migration: '20260626340000_agent_experiment_tracker_governance_enforcer.sql',
      typeFile: 'agent-experiment-tracker-governance-enforcer.ts', skillDir: 'experiment-tracker-governance-enforcer',
      interfaces: ['ExperimentTrackerGovernanceEnforcerConfig', 'GovernanceRule', 'EnforcerEvent'],
      bk: 'experiment_tracker_governance_enforcer', eks: ['etge.rule_received', 'etge.scope_resolved', 'etge.controls_applied', 'etge.audit_recorded'],
      subjects: ['sven.etge.rule_received', 'sven.etge.scope_resolved', 'sven.etge.controls_applied', 'sven.etge.audit_recorded'],
      cases: ['etge_receive', 'etge_resolve', 'etge_apply', 'etge_audit', 'etge_report', 'etge_monitor'],
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
