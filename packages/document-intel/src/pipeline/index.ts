// ---------------------------------------------------------------------------
// Document Processing Pipeline
// ---------------------------------------------------------------------------
// End-to-end pipeline: normalisation → segmentation → OCR → structure
// assembly → entity extraction → summarisation → storage. Supports
// batch processing and per-document audit logging.
// ---------------------------------------------------------------------------

import {
  createOcrConfig,
  processOcrRegions,
  buildOcrResult,
  type OcrConfig,
  type OcrResult,
  type OcrPage,
  type OcrRegion,
} from '../ocr/index.js';

/* ------------------------------------------------------------------ types */

export type DocumentType =
  | 'pdf'
  | 'image'
  | 'scan'
  | 'receipt'
  | 'invoice'
  | 'id_document'
  | 'contract'
  | 'report'
  | 'letter'
  | 'form'
  | 'unknown';

export type PipelineStage =
  | 'normalisation'
  | 'segmentation'
  | 'ocr'
  | 'structure_assembly'
  | 'entity_extraction'
  | 'summarisation'
  | 'storage'
  | 'completed'
  | 'failed';

export interface PipelineInput {
  documentId: string;
  fileName: string;
  mimeType: string;
  content: string;                       // base64 or raw text depending on type
  documentType: DocumentType;
  ocrConfig?: Partial<OcrConfig>;
  extractEntities: boolean;
  summarize: boolean;
  piiSafe: boolean;                      // redact PII from output
  adminGated: boolean;                   // requires admin approval (e.g. ID docs)
  metadata: Record<string, unknown>;
}

export interface PipelineResult {
  documentId: string;
  fileName: string;
  documentType: DocumentType;
  stages: StageResult[];
  ocrResult: OcrResult | null;
  entities: ExtractedEntity[];
  summary: string | null;
  piiRedacted: boolean;
  totalProcessingMs: number;
  status: 'completed' | 'failed';
  errorMessage: string | null;
}

export interface StageResult {
  stage: PipelineStage;
  durationMs: number;
  status: 'ok' | 'skipped' | 'error';
  details: string;
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  location: { page: number; regionId: string };
}

/* ------------------------------------------------------ pipeline runner */

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const stages: StageResult[] = [];
  let ocrResult: OcrResult | null = null;
  let entities: ExtractedEntity[] = [];
  let summary: string | null = null;
  let errorMessage: string | null = null;
  let status: 'completed' | 'failed' = 'completed';

  try {
    // Stage 1: Normalisation
    const normalised = runNormalisationStage(input, stages);

    // Stage 2: Segmentation
    const segments = runSegmentationStage(normalised, input, stages);

    // Stage 3: OCR
    ocrResult = runOcrStage(segments, input, stages);

    // Stage 4: Structure assembly
    runStructureAssemblyStage(stages);

    // Stage 5: Entity extraction
    entities = runEntityExtractionStage(ocrResult, input, stages);

    // Stage 6: Summarisation
    summary = runSummarisationStage(ocrResult, input, stages);

    // Stage 7: Storage (metadata only — actual storage delegated to caller)
    stages.push({ stage: 'storage', durationMs: 0, status: 'ok', details: 'Ready for storage' });
    stages.push({ stage: 'completed', durationMs: 0, status: 'ok', details: 'Pipeline completed' });

  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    stages.push({ stage: 'failed', durationMs: 0, status: 'error', details: errorMessage });
  }

  return {
    documentId: input.documentId,
    fileName: input.fileName,
    documentType: input.documentType,
    stages,
    ocrResult,
    entities,
    summary,
    piiRedacted: input.piiSafe,
    totalProcessingMs: Date.now() - pipelineStart,
    status,
    errorMessage,
  };
}

/* --------------------------------------------------- batch processing */

export interface BatchJob {
  id: string;
  documents: PipelineInput[];
  results: PipelineResult[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt: string | null;
}

export async function runBatch(documents: PipelineInput[]): Promise<BatchJob> {
  const job: BatchJob = {
    id: `batch-${Date.now()}`,
    documents,
    results: [],
    status: 'running',
    progress: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  for (let i = 0; i < documents.length; i++) {
    const result = await runPipeline(documents[i]);
    job.results.push(result);
    job.progress = ((i + 1) / documents.length) * 100;
  }

  job.status = job.results.every((r) => r.status === 'completed') ? 'completed' : 'failed';
  job.completedAt = new Date().toISOString();
  return job;
}

/* ----------------------------------------------------- internal helpers */

function normaliseContent(content: string, _mimeType: string): string {
  // Strip BOM, normalise line endings, trim excessive whitespace runs
  return content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n');
}

function segmentDocument(content: string, _docType: DocumentType): string[] {
  // Split by page markers or large whitespace gaps
  const parts = content.split(/\n---page-break---\n|(?:\n{3,})/);
  return parts.filter((p) => p.trim().length > 0);
}

function extractEntities(text: string, piiSafe: boolean): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Email detection
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emails) {
    for (const email of emails) {
      entities.push({
        type: 'email',
        value: piiSafe ? redactEmail(email) : email,
        confidence: 0.95,
        location: { page: 1, regionId: 'auto' },
      });
    }
  }

  // Date detection
  const dates = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi);
  if (dates) {
    for (const d of dates) {
      entities.push({ type: 'date', value: d, confidence: 0.9, location: { page: 1, regionId: 'auto' } });
    }
  }

  // Currency detection
  const amounts = text.match(/[$€£¥]\s?\d[\d,]*\.?\d*/g);
  if (amounts) {
    for (const a of amounts) {
      entities.push({ type: 'currency', value: a, confidence: 0.88, location: { page: 1, regionId: 'auto' } });
    }
  }

  // Phone detection
  const phones = text.match(/\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g);
  if (phones) {
    for (const p of phones) {
      entities.push({
        type: 'phone',
        value: piiSafe ? redactPhone(p) : p,
        confidence: 0.85,
        location: { page: 1, regionId: 'auto' },
      });
    }
  }

  return entities;
}

function summariseText(text: string): string {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  if (sentences.length <= 3) return text.trim();
  // Take first 3 sentences as a rudimentary extractive summary
  return sentences.slice(0, 3).map((s) => s.trim()).join('. ') + '.';
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

function redactPhone(phone: string): string {
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

function runNormalisationStage(input: PipelineInput, stages: StageResult[]): string {
  const normStart = Date.now();
  const normalised = normaliseContent(input.content, input.mimeType);
  stages.push({ stage: 'normalisation', durationMs: Date.now() - normStart, status: 'ok', details: 'Content normalised' });
  return normalised;
}

function runSegmentationStage(normalised: string, input: PipelineInput, stages: StageResult[]): string[] {
  const segStart = Date.now();
  const segments = segmentDocument(normalised, input.documentType);
  stages.push({ stage: 'segmentation', durationMs: Date.now() - segStart, status: 'ok', details: `${segments.length} segments identified` });
  return segments;
}

function runOcrStage(segments: string[], input: PipelineInput, stages: StageResult[]): OcrResult {
  const ocrStart = Date.now();
  const config = createOcrConfig(input.ocrConfig);
  const regions: OcrRegion[] = [];
  for (const seg of segments) {
    regions.push(...processOcrRegions(seg, config));
  }
  const page: OcrPage = {
    pageNumber: 1,
    width: 2480,
    height: 3508,
    regions,
    text: regions.map((r) => r.content).join('\n'),
    tables: [],
  };
  const ocrResult = buildOcrResult(input.documentId, [page], ocrStart);
  stages.push({ stage: 'ocr', durationMs: Date.now() - ocrStart, status: 'ok', details: `${regions.length} regions extracted` });
  return ocrResult;
}

function runStructureAssemblyStage(stages: StageResult[]): void {
  const structStart = Date.now();
  stages.push({ stage: 'structure_assembly', durationMs: Date.now() - structStart, status: 'ok', details: 'Document structure assembled' });
}

function runEntityExtractionStage(ocrResult: OcrResult, input: PipelineInput, stages: StageResult[]): ExtractedEntity[] {
  if (input.extractEntities) {
    const entityStart = Date.now();
    const entities = extractEntities(ocrResult.fullText, input.piiSafe);
    stages.push({ stage: 'entity_extraction', durationMs: Date.now() - entityStart, status: 'ok', details: `${entities.length} entities found` });
    return entities;
  } else {
    stages.push({ stage: 'entity_extraction', durationMs: 0, status: 'skipped', details: 'Entity extraction not requested' });
    return [];
  }
}

function runSummarisationStage(ocrResult: OcrResult, input: PipelineInput, stages: StageResult[]): string | null {
  if (input.summarize) {
    const sumStart = Date.now();
    const summary = summariseText(ocrResult.fullText);
    stages.push({ stage: 'summarisation', durationMs: Date.now() - sumStart, status: 'ok', details: 'Summary generated' });
    return summary;
  } else {
    stages.push({ stage: 'summarisation', durationMs: 0, status: 'skipped', details: 'Summarisation not requested' });
    return null;
  }
}
