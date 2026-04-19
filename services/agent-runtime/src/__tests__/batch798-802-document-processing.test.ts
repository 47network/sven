import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 798-802: Document & Media Processing', () => {
  const verticals = [
    {
      name: 'pdf_renderer', migration: '20260624350000_agent_pdf_renderer.sql',
      typeFile: 'agent-pdf-renderer.ts', skillDir: 'pdf-renderer',
      interfaces: ['PdfRendererConfig', 'PdfRenderJob', 'RendererEvent'],
      bk: 'pdf_renderer', eks: ['pdfr.template_loaded', 'pdfr.content_merged', 'pdfr.pdf_rendered', 'pdfr.delivery_completed'],
      subjects: ['sven.pdfr.template_loaded', 'sven.pdfr.content_merged', 'sven.pdfr.pdf_rendered', 'sven.pdfr.delivery_completed'],
      cases: ['pdfr_load', 'pdfr_merge', 'pdfr_render', 'pdfr_deliver', 'pdfr_report', 'pdfr_monitor'],
    },
    {
      name: 'document_converter', migration: '20260624360000_agent_document_converter.sql',
      typeFile: 'agent-document-converter.ts', skillDir: 'document-converter',
      interfaces: ['DocumentConverterConfig', 'ConversionJob', 'ConverterEvent'],
      bk: 'document_converter', eks: ['dccv.source_loaded', 'dccv.format_detected', 'dccv.conversion_executed', 'dccv.output_persisted'],
      subjects: ['sven.dccv.source_loaded', 'sven.dccv.format_detected', 'sven.dccv.conversion_executed', 'sven.dccv.output_persisted'],
      cases: ['dccv_load', 'dccv_detect', 'dccv_execute', 'dccv_persist', 'dccv_report', 'dccv_monitor'],
    },
    {
      name: 'ocr_extractor', migration: '20260624370000_agent_ocr_extractor.sql',
      typeFile: 'agent-ocr-extractor.ts', skillDir: 'ocr-extractor',
      interfaces: ['OcrExtractorConfig', 'OcrJob', 'ExtractorEvent'],
      bk: 'ocr_extractor', eks: ['ocrx.image_received', 'ocrx.regions_detected', 'ocrx.text_extracted', 'ocrx.confidence_reported'],
      subjects: ['sven.ocrx.image_received', 'sven.ocrx.regions_detected', 'sven.ocrx.text_extracted', 'sven.ocrx.confidence_reported'],
      cases: ['ocrx_receive', 'ocrx_detect', 'ocrx_extract', 'ocrx_report_conf', 'ocrx_report', 'ocrx_monitor'],
    },
    {
      name: 'barcode_scanner_svc', migration: '20260624380000_agent_barcode_scanner_svc.sql',
      typeFile: 'agent-barcode-scanner-svc.ts', skillDir: 'barcode-scanner-svc',
      interfaces: ['BarcodeScannerSvcConfig', 'ScanRequest', 'ScannerEvent'],
      bk: 'barcode_scanner_svc', eks: ['bcss.image_received', 'bcss.barcode_detected', 'bcss.payload_decoded', 'bcss.metadata_attached'],
      subjects: ['sven.bcss.image_received', 'sven.bcss.barcode_detected', 'sven.bcss.payload_decoded', 'sven.bcss.metadata_attached'],
      cases: ['bcss_receive', 'bcss_detect', 'bcss_decode', 'bcss_attach', 'bcss_report', 'bcss_monitor'],
    },
    {
      name: 'qr_code_generator', migration: '20260624390000_agent_qr_code_generator.sql',
      typeFile: 'agent-qr-code-generator.ts', skillDir: 'qr-code-generator',
      interfaces: ['QrCodeGeneratorConfig', 'QrJob', 'GeneratorEvent'],
      bk: 'qr_code_generator', eks: ['qrcg.payload_validated', 'qrcg.qr_rendered', 'qrcg.error_correction_applied', 'qrcg.asset_persisted'],
      subjects: ['sven.qrcg.payload_validated', 'sven.qrcg.qr_rendered', 'sven.qrcg.error_correction_applied', 'sven.qrcg.asset_persisted'],
      cases: ['qrcg_validate', 'qrcg_render', 'qrcg_apply', 'qrcg_persist', 'qrcg_report', 'qrcg_monitor'],
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
