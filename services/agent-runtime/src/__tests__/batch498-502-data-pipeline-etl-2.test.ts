import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 498-502: Data Pipeline & ETL Part 2', () => {
  const verticals = [
    {
      name: 'dead_letter_handler',
      migration: '20260621350000_agent_dead_letter_handler.sql',
      typeFile: 'agent-dead-letter-handler.ts',
      skillDir: 'dead-letter-handler',
      interfaces: ['DeadLetterHandlerConfig', 'DeadLetterEntry', 'RetryPolicy'],
      bk: 'dead_letter_handler',
      eks: ['dlhd.message_quarantined', 'dlhd.retry_attempted', 'dlhd.message_discarded', 'dlhd.dlq_cleared'],
      subjects: ['sven.dlhd.message_quarantined', 'sven.dlhd.retry_attempted', 'sven.dlhd.message_discarded', 'sven.dlhd.dlq_cleared'],
      cases: ['dlhd_quarantine', 'dlhd_retry', 'dlhd_discard', 'dlhd_clear', 'dlhd_report', 'dlhd_monitor'],
    },
    {
      name: 'backfill_runner',
      migration: '20260621360000_agent_backfill_runner.sql',
      typeFile: 'agent-backfill-runner.ts',
      skillDir: 'backfill-runner',
      interfaces: ['BackfillRunnerConfig', 'BackfillJob', 'BackfillProgress'],
      bk: 'backfill_runner',
      eks: ['bfrl.backfill_started', 'bfrl.chunk_processed', 'bfrl.backfill_completed', 'bfrl.backfill_failed'],
      subjects: ['sven.bfrl.backfill_started', 'sven.bfrl.chunk_processed', 'sven.bfrl.backfill_completed', 'sven.bfrl.backfill_failed'],
      cases: ['bfrl_start', 'bfrl_chunk', 'bfrl_complete', 'bfrl_fail', 'bfrl_report', 'bfrl_monitor'],
    },
    {
      name: 'lineage_tracer',
      migration: '20260621370000_agent_lineage_tracer.sql',
      typeFile: 'agent-lineage-tracer.ts',
      skillDir: 'lineage-tracer',
      interfaces: ['LineageTracerConfig', 'LineageGraph', 'LineageEdge'],
      bk: 'lineage_tracer',
      eks: ['lntc.lineage_captured', 'lntc.dependency_found', 'lntc.graph_updated', 'lntc.impact_analyzed'],
      subjects: ['sven.lntc.lineage_captured', 'sven.lntc.dependency_found', 'sven.lntc.graph_updated', 'sven.lntc.impact_analyzed'],
      cases: ['lntc_capture', 'lntc_dependency', 'lntc_graph', 'lntc_impact', 'lntc_report', 'lntc_monitor'],
    },
    {
      name: 'data_cataloger',
      migration: '20260621380000_agent_data_cataloger.sql',
      typeFile: 'agent-data-cataloger.ts',
      skillDir: 'data-cataloger',
      interfaces: ['DataCatalogerConfig', 'CatalogEntry', 'DataClassification'],
      bk: 'data_cataloger',
      eks: ['dtcl.asset_registered', 'dtcl.schema_indexed', 'dtcl.classification_applied', 'dtcl.catalog_refreshed'],
      subjects: ['sven.dtcl.asset_registered', 'sven.dtcl.schema_indexed', 'sven.dtcl.classification_applied', 'sven.dtcl.catalog_refreshed'],
      cases: ['dtcl_register', 'dtcl_index', 'dtcl_classify', 'dtcl_refresh', 'dtcl_report', 'dtcl_monitor'],
    },
    {
      name: 'change_capture',
      migration: '20260621390000_agent_change_capture.sql',
      typeFile: 'agent-change-capture.ts',
      skillDir: 'change-capture',
      interfaces: ['ChangeCaptureConfig', 'CapturedChange', 'ChangeStream'],
      bk: 'change_capture',
      eks: ['chcp.change_detected', 'chcp.event_published', 'chcp.snapshot_taken', 'chcp.replication_synced'],
      subjects: ['sven.chcp.change_detected', 'sven.chcp.event_published', 'sven.chcp.snapshot_taken', 'sven.chcp.replication_synced'],
      cases: ['chcp_detect', 'chcp_publish', 'chcp_snapshot', 'chcp_sync', 'chcp_report', 'chcp_monitor'],
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
