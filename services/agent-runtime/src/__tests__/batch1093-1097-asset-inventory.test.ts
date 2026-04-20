import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1093-1097: Asset Inventory', () => {
  const verticals = [
    {
      name: 'asset_inventory_collector', migration: '20260627300000_agent_asset_inventory_collector.sql',
      typeFile: 'agent-asset-inventory-collector.ts', skillDir: 'asset-inventory-collector',
      interfaces: ['AssetInventoryCollectorConfig', 'AssetEvent', 'CollectorEvent'],
      bk: 'asset_inventory_collector', eks: ['aico.event_received', 'aico.fields_validated', 'aico.asset_persisted', 'aico.audit_recorded'],
      subjects: ['sven.aico.event_received', 'sven.aico.fields_validated', 'sven.aico.asset_persisted', 'sven.aico.audit_recorded'],
      cases: ['aico_receive', 'aico_validate', 'aico_persist', 'aico_audit', 'aico_report', 'aico_monitor'],
    },
    {
      name: 'asset_inventory_writer', migration: '20260627310000_agent_asset_inventory_writer.sql',
      typeFile: 'agent-asset-inventory-writer.ts', skillDir: 'asset-inventory-writer',
      interfaces: ['AssetInventoryWriterConfig', 'WriteRequest', 'WriterEvent'],
      bk: 'asset_inventory_writer', eks: ['aiwr.request_received', 'aiwr.fields_validated', 'aiwr.asset_persisted', 'aiwr.audit_recorded'],
      subjects: ['sven.aiwr.request_received', 'sven.aiwr.fields_validated', 'sven.aiwr.asset_persisted', 'sven.aiwr.audit_recorded'],
      cases: ['aiwr_receive', 'aiwr_validate', 'aiwr_persist', 'aiwr_audit', 'aiwr_report', 'aiwr_monitor'],
    },
    {
      name: 'asset_inventory_reconciler', migration: '20260627320000_agent_asset_inventory_reconciler.sql',
      typeFile: 'agent-asset-inventory-reconciler.ts', skillDir: 'asset-inventory-reconciler',
      interfaces: ['AssetInventoryReconcilerConfig', 'ReconcileRequest', 'ReconcilerEvent'],
      bk: 'asset_inventory_reconciler', eks: ['airc.request_received', 'airc.diff_computed', 'airc.reconciliation_emitted', 'airc.audit_recorded'],
      subjects: ['sven.airc.request_received', 'sven.airc.diff_computed', 'sven.airc.reconciliation_emitted', 'sven.airc.audit_recorded'],
      cases: ['airc_receive', 'airc_compute', 'airc_emit', 'airc_audit', 'airc_report', 'airc_monitor'],
    },
    {
      name: 'asset_inventory_reporter', migration: '20260627330000_agent_asset_inventory_reporter.sql',
      typeFile: 'agent-asset-inventory-reporter.ts', skillDir: 'asset-inventory-reporter',
      interfaces: ['AssetInventoryReporterConfig', 'ReportRequest', 'ReporterEvent'],
      bk: 'asset_inventory_reporter', eks: ['airp.request_received', 'airp.assets_loaded', 'airp.report_generated', 'airp.audit_recorded'],
      subjects: ['sven.airp.request_received', 'sven.airp.assets_loaded', 'sven.airp.report_generated', 'sven.airp.audit_recorded'],
      cases: ['airp_receive', 'airp_load', 'airp_generate', 'airp_audit', 'airp_report', 'airp_monitor'],
    },
    {
      name: 'asset_inventory_audit_logger', migration: '20260627340000_agent_asset_inventory_audit_logger.sql',
      typeFile: 'agent-asset-inventory-audit-logger.ts', skillDir: 'asset-inventory-audit-logger',
      interfaces: ['AssetInventoryAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'asset_inventory_audit_logger', eks: ['aiau.record_received', 'aiau.fields_validated', 'aiau.record_persisted', 'aiau.export_emitted'],
      subjects: ['sven.aiau.record_received', 'sven.aiau.fields_validated', 'sven.aiau.record_persisted', 'sven.aiau.export_emitted'],
      cases: ['aiau_receive', 'aiau_validate', 'aiau_persist', 'aiau_emit', 'aiau_report', 'aiau_monitor'],
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
