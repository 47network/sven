import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 828-832: File Upload & Storage', () => {
  const verticals = [
    {
      name: 'file_upload_processor', migration: '20260624650000_agent_file_upload_processor.sql',
      typeFile: 'agent-file-upload-processor.ts', skillDir: 'file-upload-processor',
      interfaces: ['FileUploadProcessorConfig', 'UploadRequest', 'ProcessorEvent'],
      bk: 'file_upload_processor', eks: ['fupr.upload_initiated', 'fupr.size_validated', 'fupr.bytes_received', 'fupr.upload_finalized'],
      subjects: ['sven.fupr.upload_initiated', 'sven.fupr.size_validated', 'sven.fupr.bytes_received', 'sven.fupr.upload_finalized'],
      cases: ['fupr_initiate', 'fupr_validate', 'fupr_receive', 'fupr_finalize', 'fupr_report', 'fupr_monitor'],
    },
    {
      name: 'multipart_chunk_assembler', migration: '20260624660000_agent_multipart_chunk_assembler.sql',
      typeFile: 'agent-multipart-chunk-assembler.ts', skillDir: 'multipart-chunk-assembler',
      interfaces: ['MultipartChunkAssemblerConfig', 'UploadAssembly', 'AssemblerEvent'],
      bk: 'multipart_chunk_assembler', eks: ['mcas.chunk_received', 'mcas.checksum_verified', 'mcas.chunks_assembled', 'mcas.assembly_completed'],
      subjects: ['sven.mcas.chunk_received', 'sven.mcas.checksum_verified', 'sven.mcas.chunks_assembled', 'sven.mcas.assembly_completed'],
      cases: ['mcas_receive', 'mcas_verify', 'mcas_assemble', 'mcas_complete', 'mcas_report', 'mcas_monitor'],
    },
    {
      name: 'virus_scan_dispatcher', migration: '20260624670000_agent_virus_scan_dispatcher.sql',
      typeFile: 'agent-virus-scan-dispatcher.ts', skillDir: 'virus-scan-dispatcher',
      interfaces: ['VirusScanDispatcherConfig', 'ScanJob', 'DispatcherEvent'],
      bk: 'virus_scan_dispatcher', eks: ['vscd.scan_queued', 'vscd.engine_invoked', 'vscd.verdict_recorded', 'vscd.quarantine_triggered'],
      subjects: ['sven.vscd.scan_queued', 'sven.vscd.engine_invoked', 'sven.vscd.verdict_recorded', 'sven.vscd.quarantine_triggered'],
      cases: ['vscd_queue', 'vscd_invoke', 'vscd_record', 'vscd_quarantine', 'vscd_report', 'vscd_monitor'],
    },
    {
      name: 'metadata_extractor', migration: '20260624680000_agent_metadata_extractor.sql',
      typeFile: 'agent-metadata-extractor.ts', skillDir: 'metadata-extractor',
      interfaces: ['MetadataExtractorConfig', 'MetadataJob', 'ExtractorEvent'],
      bk: 'metadata_extractor', eks: ['mdex.payload_loaded', 'mdex.exif_parsed', 'mdex.fields_normalized', 'mdex.metadata_persisted'],
      subjects: ['sven.mdex.payload_loaded', 'sven.mdex.exif_parsed', 'sven.mdex.fields_normalized', 'sven.mdex.metadata_persisted'],
      cases: ['mdex_load', 'mdex_parse', 'mdex_normalize', 'mdex_persist', 'mdex_report', 'mdex_monitor'],
    },
    {
      name: 'storage_tier_optimizer', migration: '20260624690000_agent_storage_tier_optimizer.sql',
      typeFile: 'agent-storage-tier-optimizer.ts', skillDir: 'storage-tier-optimizer',
      interfaces: ['StorageTierOptimizerConfig', 'TierMove', 'OptimizerEvent'],
      bk: 'storage_tier_optimizer', eks: ['stop.usage_analyzed', 'stop.candidates_selected', 'stop.tier_transitioned', 'stop.savings_reported'],
      subjects: ['sven.stop.usage_analyzed', 'sven.stop.candidates_selected', 'sven.stop.tier_transitioned', 'sven.stop.savings_reported'],
      cases: ['stop_analyze', 'stop_select', 'stop_transition', 'stop_report_savings', 'stop_report', 'stop_monitor'],
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
