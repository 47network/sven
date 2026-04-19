import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 948-952: Data Lake', () => {
  const verticals = [
    {
      name: 'lake_ingestion_validator', migration: '20260625850000_agent_lake_ingestion_validator.sql',
      typeFile: 'agent-lake-ingestion-validator.ts', skillDir: 'lake-ingestion-validator',
      interfaces: ['LakeIngestionValidatorConfig', 'IngestionBatch', 'ValidatorEvent'],
      bk: 'lake_ingestion_validator', eks: ['lkiv.batch_received', 'lkiv.schema_checked', 'lkiv.records_validated', 'lkiv.report_emitted'],
      subjects: ['sven.lkiv.batch_received', 'sven.lkiv.schema_checked', 'sven.lkiv.records_validated', 'sven.lkiv.report_emitted'],
      cases: ['lkiv_receive', 'lkiv_check', 'lkiv_validate', 'lkiv_emit', 'lkiv_report', 'lkiv_monitor'],
    },
    {
      name: 'lake_compactor', migration: '20260625860000_agent_lake_compactor.sql',
      typeFile: 'agent-lake-compactor.ts', skillDir: 'lake-compactor',
      interfaces: ['LakeCompactorConfig', 'CompactionJob', 'CompactorEvent'],
      bk: 'lake_compactor', eks: ['lkcm.job_received', 'lkcm.files_scanned', 'lkcm.files_merged', 'lkcm.manifest_committed'],
      subjects: ['sven.lkcm.job_received', 'sven.lkcm.files_scanned', 'sven.lkcm.files_merged', 'sven.lkcm.manifest_committed'],
      cases: ['lkcm_receive', 'lkcm_scan', 'lkcm_merge', 'lkcm_commit', 'lkcm_report', 'lkcm_monitor'],
    },
    {
      name: 'lake_partition_evolver', migration: '20260625870000_agent_lake_partition_evolver.sql',
      typeFile: 'agent-lake-partition-evolver.ts', skillDir: 'lake-partition-evolver',
      interfaces: ['LakePartitionEvolverConfig', 'EvolutionRequest', 'EvolverEvent'],
      bk: 'lake_partition_evolver', eks: ['lkpe.request_received', 'lkpe.layout_evaluated', 'lkpe.evolution_applied', 'lkpe.audit_recorded'],
      subjects: ['sven.lkpe.request_received', 'sven.lkpe.layout_evaluated', 'sven.lkpe.evolution_applied', 'sven.lkpe.audit_recorded'],
      cases: ['lkpe_receive', 'lkpe_evaluate', 'lkpe_apply', 'lkpe_audit', 'lkpe_report', 'lkpe_monitor'],
    },
    {
      name: 'lake_governance_enforcer', migration: '20260625880000_agent_lake_governance_enforcer.sql',
      typeFile: 'agent-lake-governance-enforcer.ts', skillDir: 'lake-governance-enforcer',
      interfaces: ['LakeGovernanceEnforcerConfig', 'GovernanceRule', 'EnforcerEvent'],
      bk: 'lake_governance_enforcer', eks: ['lkge.rule_received', 'lkge.scope_resolved', 'lkge.controls_applied', 'lkge.audit_recorded'],
      subjects: ['sven.lkge.rule_received', 'sven.lkge.scope_resolved', 'sven.lkge.controls_applied', 'sven.lkge.audit_recorded'],
      cases: ['lkge_receive', 'lkge_resolve', 'lkge_apply', 'lkge_audit', 'lkge_report', 'lkge_monitor'],
    },
    {
      name: 'lake_export_packager', migration: '20260625890000_agent_lake_export_packager.sql',
      typeFile: 'agent-lake-export-packager.ts', skillDir: 'lake-export-packager',
      interfaces: ['LakeExportPackagerConfig', 'ExportRequest', 'PackagerEvent'],
      bk: 'lake_export_packager', eks: ['lkep.request_received', 'lkep.dataset_collected', 'lkep.package_built', 'lkep.signed_url_emitted'],
      subjects: ['sven.lkep.request_received', 'sven.lkep.dataset_collected', 'sven.lkep.package_built', 'sven.lkep.signed_url_emitted'],
      cases: ['lkep_receive', 'lkep_collect', 'lkep_build', 'lkep_emit', 'lkep_report', 'lkep_monitor'],
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
