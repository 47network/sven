import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 66 — Agent Data Export & Import', () => {

  /* ------------------------------------------------------------------ */
  /*  Migration SQL                                                     */
  /* ------------------------------------------------------------------ */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260608120000_agent_data_export_import.sql'),
      'utf-8',
    );

    it('creates 5 tables', () => {
      for (const t of [
        'data_export_jobs', 'data_import_jobs', 'data_schemas',
        'data_mappings', 'data_transfer_logs',
      ]) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });

    it('creates at least 19 indexes', () => {
      const idxCount = (sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(19);
    });

    it('includes Batch 66 header comment', () => {
      expect(sql).toContain('Batch 66');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Shared types                                                      */
  /* ------------------------------------------------------------------ */
  describe('Shared types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-data-export-import.ts'),
      'utf-8',
    );

    it('exports 7 type unions', () => {
      const types = (src.match(/export type \w+/g) || []);
      expect(types.length).toBe(7);
    });

    it('exports 5 interfaces', () => {
      const ifaces = (src.match(/export interface \w+/g) || []);
      expect(ifaces.length).toBe(5);
    });

    it('exports 4 helper constants', () => {
      const consts = (src.match(/export const \w+/g) || []);
      expect(consts.length).toBeGreaterThanOrEqual(4);
    });

    it('exports 4 helper functions', () => {
      const fns = (src.match(/export function \w+/g) || []);
      expect(fns.length).toBeGreaterThanOrEqual(4);
    });

    it('ExportType has 5 values', () => {
      const m = src.match(/export type ExportType\s*=\s*([^;]+);/);
      expect(m).not.toBeNull();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('ExportFormat has 5 values', () => {
      const m = src.match(/export type ExportFormat\s*=\s*([^;]+);/);
      expect(m).not.toBeNull();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('DataTransferAction has 7 values', () => {
      const m = src.match(/export type DataTransferAction\s*=\s*([^;]+);/);
      expect(m).not.toBeNull();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Barrel export                                                     */
  /* ------------------------------------------------------------------ */
  describe('Barrel export', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('re-exports agent-data-export-import', () => {
      expect(idx).toContain("./agent-data-export-import");
    });

    it('has at least 91 lines', () => {
      const lines = idx.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(91);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  SKILL.md                                                          */
  /* ------------------------------------------------------------------ */
  describe('SKILL.md', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-data-export-import/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(md).toMatch(/skill:\s*agent-data-export-import/);
    });

    it('defines 7 actions', () => {
      const actions = (md.match(/^### \w+/gm) || []);
      expect(actions.length).toBe(7);
    });

    it('includes all expected actions', () => {
      for (const a of [
        'export_create', 'import_create', 'schema_register',
        'mapping_create', 'export_download', 'import_validate', 'transfer_status',
      ]) {
        expect(md).toContain(a);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Eidolon types                                                     */
  /* ------------------------------------------------------------------ */
  describe('Eidolon types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('EidolonBuildingKind has 49 values', () => {
      const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect(m).not.toBeNull();
      const pipes = (m![1].match(/\|/g) || []).length;
      expect(pipes).toBe(49);
    });

    it('includes data_warehouse building kind', () => {
      expect(src).toContain("'data_warehouse'");
    });

    it('EidolonEventKind has 212 values', () => {
      const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect(m).not.toBeNull();
      const pipes = (m![1].match(/\|/g) || []).length;
      expect(pipes).toBe(212);
    });

    it('includes 4 data_transfer event kinds', () => {
      for (const e of [
        'data_transfer.export_created',
        'data_transfer.import_created',
        'data_transfer.transfer_completed',
        'data_transfer.schema_registered',
      ]) {
        expect(src).toContain(`'${e}'`);
      }
    });

    it('districtFor has 49 cases', () => {
      const dfBlock = src.split('districtFor')[1].split('function ')[0];
      const cases = (dfBlock.match(/case '\w+':/g) || []).length;
      expect(cases).toBe(49);
    });

    it('districtFor maps data_warehouse correctly', () => {
      const dfBlock = src.split('districtFor')[1];
      expect(dfBlock).toContain("case 'data_warehouse':");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Event bus                                                         */
  /* ------------------------------------------------------------------ */
  describe('Event bus', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('SUBJECT_MAP has 211 entries', () => {
      const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).not.toBeNull();
      const entries = (m![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(211);
    });

    it('has 4 data_transfer subjects', () => {
      for (const s of [
        'sven.data_transfer.export_created',
        'sven.data_transfer.import_created',
        'sven.data_transfer.transfer_completed',
        'sven.data_transfer.schema_registered',
      ]) {
        expect(src).toContain(`'${s}'`);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Task executor                                                     */
  /* ------------------------------------------------------------------ */
  describe('Task executor', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 243 switch cases', () => {
      const cases = (src.match(/case '\w+':/g) || []).length;
      expect(cases).toBe(243);
    });

    it('has 239 handler methods', () => {
      const handlers = (src.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(239);
    });

    it('includes 7 batch 66 switch cases', () => {
      for (const c of [
        'export_create', 'import_create', 'schema_register',
        'mapping_create', 'export_download', 'import_validate', 'transfer_status',
      ]) {
        expect(src).toContain(`case '${c}':`);
      }
    });

    it('includes 7 batch 66 handler methods', () => {
      for (const h of [
        'handleExportCreate', 'handleImportCreate', 'handleSchemaRegister',
        'handleMappingCreate', 'handleExportDownload', 'handleImportValidate',
        'handleTransferStatus',
      ]) {
        expect(src).toContain(h);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  .gitattributes                                                    */
  /* ------------------------------------------------------------------ */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks batch 66 migration private', () => {
      expect(ga).toContain('20260608120000_agent_data_export_import.sql');
    });

    it('marks batch 66 shared types private', () => {
      expect(ga).toContain('agent-data-export-import.ts');
    });

    it('marks batch 66 skill private', () => {
      expect(ga).toContain('agent-data-export-import/**');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  CHANGELOG                                                         */
  /* ------------------------------------------------------------------ */
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('mentions Batch 66', () => {
      expect(cl).toContain('Batch 66');
    });

    it('mentions data export import', () => {
      expect(cl).toMatch(/Data Export.*Import/i);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Migration count                                                   */
  /* ------------------------------------------------------------------ */
  describe('Migration count', () => {
    const migDir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));

    it('has 52 migration files', () => {
      expect(files.length).toBe(52);
    });
  });
});
