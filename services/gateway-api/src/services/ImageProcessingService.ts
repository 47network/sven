import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.12 Image Processing Pipeline
 * Local-first vision processing with server escalation.
 * Photos, screenshots, documents, handwriting — processed locally via Gemma 4 vision,
 * escalated to server when deeper analysis is required.
 */

type ProcessingTarget = 'local' | 'server' | 'fallback_server';
type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'escalated';
type ImageCategory = 'photo' | 'screenshot' | 'document' | 'handwriting' | 'chart' | 'diagram' | 'other';

interface ImageJob {
  id: string;
  organization_id: string;
  user_id: string;
  image_ref: string;
  category: ImageCategory;
  target: ProcessingTarget;
  status: ProcessingStatus;
  local_confidence: number;
  escalation_reason: string | null;
  result_summary: string | null;
  result_data: Record<string, unknown> | null;
  processing_ms: number | null;
  model_used: string | null;
  created_at: string;
  completed_at: string | null;
}

interface EscalationPolicy {
  id: string;
  organization_id: string;
  auto_escalate: boolean;
  confidence_threshold: number;
  max_local_processing_ms: number;
  allowed_categories: ImageCategory[];
  prefer_local: boolean;
  ocr_enabled: boolean;
  handwriting_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Categories that Gemma 4 vision handles natively */
const LOCAL_CAPABLE_CATEGORIES: ImageCategory[] = [
  'photo', 'screenshot', 'document', 'handwriting', 'chart', 'diagram',
];

/** Complexity heuristics to determine escalation need */
const ESCALATION_KEYWORDS = [
  'medical', 'xray', 'x-ray', 'mri', 'ct scan', 'radiology',
  'legal document', 'contract analysis', 'multi-page',
  'blueprint', 'architectural', 'technical drawing',
  'financial statement', 'tax form', 'invoice batch',
];

export class ImageProcessingService {
  constructor(private pool: pg.Pool) {}

  /** Get or create escalation policy for an org */
  async getPolicy(organizationId: string): Promise<EscalationPolicy> {
    const result = await this.pool.query(
      `SELECT * FROM image_escalation_policies WHERE organization_id = $1`,
      [organizationId],
    );
    if (result.rows[0]) return this.mapPolicy(result.rows[0]);

    const id = uuidv7();
    const inserted = await this.pool.query(
      `INSERT INTO image_escalation_policies (
        id, organization_id, auto_escalate, confidence_threshold,
        max_local_processing_ms, allowed_categories, prefer_local,
        ocr_enabled, handwriting_enabled, created_at, updated_at
      ) VALUES ($1,$2,TRUE,0.6,5000,$3,TRUE,TRUE,TRUE,NOW(),NOW())
      ON CONFLICT (organization_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [id, organizationId, JSON.stringify(LOCAL_CAPABLE_CATEGORIES)],
    );
    return this.mapPolicy(inserted.rows[0]);
  }

  /** Update escalation policy */
  async updatePolicy(organizationId: string, updates: Partial<EscalationPolicy>): Promise<EscalationPolicy> {
    const fields: string[] = [];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (updates.auto_escalate !== undefined) { params.push(updates.auto_escalate); fields.push(`auto_escalate = $${idx++}`); }
    if (updates.confidence_threshold !== undefined) { params.push(updates.confidence_threshold); fields.push(`confidence_threshold = $${idx++}`); }
    if (updates.max_local_processing_ms !== undefined) { params.push(updates.max_local_processing_ms); fields.push(`max_local_processing_ms = $${idx++}`); }
    if (updates.allowed_categories !== undefined) { params.push(JSON.stringify(updates.allowed_categories)); fields.push(`allowed_categories = $${idx++}`); }
    if (updates.prefer_local !== undefined) { params.push(updates.prefer_local); fields.push(`prefer_local = $${idx++}`); }
    if (updates.ocr_enabled !== undefined) { params.push(updates.ocr_enabled); fields.push(`ocr_enabled = $${idx++}`); }
    if (updates.handwriting_enabled !== undefined) { params.push(updates.handwriting_enabled); fields.push(`handwriting_enabled = $${idx++}`); }

    if (fields.length === 0) return this.getPolicy(organizationId);

    fields.push('updated_at = NOW()');
    const result = await this.pool.query(
      `UPDATE image_escalation_policies SET ${fields.join(', ')} WHERE organization_id = $1 RETURNING *`,
      params,
    );
    return this.mapPolicy(result.rows[0]);
  }

  /** Submit an image for processing — determines local vs server routing */
  async submitJob(
    organizationId: string,
    userId: string,
    imageRef: string,
    category: ImageCategory,
    context?: string,
  ): Promise<ImageJob> {
    const policy = await this.getPolicy(organizationId);
    const target = this.routeImage(category, context || '', policy);
    const id = uuidv7();

    const result = await this.pool.query(
      `INSERT INTO image_processing_jobs (
        id, organization_id, user_id, image_ref, category, target,
        status, local_confidence, escalation_reason, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8,NOW())
      RETURNING *`,
      [
        id, organizationId, userId, imageRef, category, target,
        target === 'local' ? 0.8 : 0.3,
        target !== 'local' ? 'Complexity exceeds local capability threshold' : null,
      ],
    );
    return this.mapJob(result.rows[0]);
  }

  /** Mark a job as completed with results */
  async completeJob(
    jobId: string,
    resultSummary: string,
    resultData: Record<string, unknown>,
    processingMs: number,
    modelUsed: string,
  ): Promise<ImageJob> {
    const result = await this.pool.query(
      `UPDATE image_processing_jobs
       SET status = 'completed', result_summary = $2, result_data = $3,
           processing_ms = $4, model_used = $5, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [jobId, resultSummary, JSON.stringify(resultData), processingMs, modelUsed],
    );
    return this.mapJob(result.rows[0]);
  }

  /** Escalate a local job to server processing */
  async escalateJob(jobId: string, reason: string): Promise<ImageJob> {
    const result = await this.pool.query(
      `UPDATE image_processing_jobs
       SET target = 'fallback_server', status = 'escalated', escalation_reason = $2
       WHERE id = $1 RETURNING *`,
      [jobId, reason],
    );
    return this.mapJob(result.rows[0]);
  }

  /** List jobs for an org with optional filtering */
  async listJobs(
    organizationId: string,
    opts?: { status?: ProcessingStatus; category?: ImageCategory; limit?: number; offset?: number },
  ): Promise<{ rows: ImageJob[]; total: number }> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    if (opts?.status) { params.push(opts.status); conditions.push(`status = $${params.length}`); }
    if (opts?.category) { params.push(opts.category); conditions.push(`category = $${params.length}`); }

    const where = conditions.join(' AND ');
    const limit = Math.min(opts?.limit || 50, 200);
    const offset = opts?.offset || 0;

    const [rows, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM image_processing_jobs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM image_processing_jobs WHERE ${where}`, params),
    ]);

    return {
      rows: rows.rows.map((r) => this.mapJob(r)),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  /** Get processing statistics */
  async getStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'escalated')::int AS escalated,
        COUNT(*) FILTER (WHERE target = 'local')::int AS local_processed,
        COUNT(*) FILTER (WHERE target IN ('server','fallback_server'))::int AS server_processed,
        COALESCE(AVG(processing_ms) FILTER (WHERE status = 'completed'), 0)::int AS avg_processing_ms,
        COUNT(DISTINCT category)::int AS categories_used
       FROM image_processing_jobs WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0] || {};
  }

  /** Determine processing target based on policy and content */
  routeImage(category: ImageCategory, context: string, policy: EscalationPolicy): ProcessingTarget {
    if (!policy.prefer_local) return 'server';

    const allowedSet = new Set(policy.allowed_categories || LOCAL_CAPABLE_CATEGORIES);
    if (!allowedSet.has(category)) return 'server';

    const lowerContext = context.toLowerCase();
    const needsEscalation = ESCALATION_KEYWORDS.some((kw) => lowerContext.includes(kw));
    if (needsEscalation && policy.auto_escalate) return 'server';

    return 'local';
  }

  /** Get supported categories */
  static getCategories(): ImageCategory[] {
    return [...LOCAL_CAPABLE_CATEGORIES, 'other'];
  }

  /** Get escalation keywords for routing decisions */
  static getEscalationKeywords(): string[] {
    return [...ESCALATION_KEYWORDS];
  }

  private mapJob(r: Record<string, unknown>): ImageJob {
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      user_id: String(r.user_id),
      image_ref: String(r.image_ref),
      category: r.category as ImageCategory,
      target: r.target as ProcessingTarget,
      status: r.status as ProcessingStatus,
      local_confidence: Number(r.local_confidence || 0),
      escalation_reason: r.escalation_reason ? String(r.escalation_reason) : null,
      result_summary: r.result_summary ? String(r.result_summary) : null,
      result_data: r.result_data && typeof r.result_data === 'object' ? r.result_data as Record<string, unknown> : null,
      processing_ms: r.processing_ms ? Number(r.processing_ms) : null,
      model_used: r.model_used ? String(r.model_used) : null,
      created_at: String(r.created_at),
      completed_at: r.completed_at ? String(r.completed_at) : null,
    };
  }

  private mapPolicy(r: Record<string, unknown>): EscalationPolicy {
    let categories: ImageCategory[];
    try {
      categories = typeof r.allowed_categories === 'string'
        ? JSON.parse(r.allowed_categories as string)
        : Array.isArray(r.allowed_categories) ? r.allowed_categories as ImageCategory[] : LOCAL_CAPABLE_CATEGORIES;
    } catch {
      categories = LOCAL_CAPABLE_CATEGORIES;
    }
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      auto_escalate: Boolean(r.auto_escalate),
      confidence_threshold: Number(r.confidence_threshold || 0.6),
      max_local_processing_ms: Number(r.max_local_processing_ms || 5000),
      allowed_categories: categories,
      prefer_local: Boolean(r.prefer_local),
      ocr_enabled: Boolean(r.ocr_enabled),
      handwriting_enabled: Boolean(r.handwriting_enabled),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}
