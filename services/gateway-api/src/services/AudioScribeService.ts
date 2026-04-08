import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/**
 * 6.14 Audio Scribe Service
 * Local-first speech-to-text orchestration. ~30 second local processing,
 * no cloud dependency. Processes meetings, voice notes, lectures locally.
 * Leverages existing faster-whisper service for server-side STT.
 */

type ScribeSource = 'microphone' | 'voice_note' | 'meeting' | 'lecture' | 'uploaded_file';
type ScribeStatus = 'pending' | 'recording' | 'processing' | 'completed' | 'failed';
type ScribeTarget = 'local' | 'server';

interface ScribeSession {
  id: string;
  organization_id: string;
  user_id: string;
  source: ScribeSource;
  target: ScribeTarget;
  status: ScribeStatus;
  duration_seconds: number | null;
  transcript: string | null;
  language_detected: string | null;
  confidence: number | null;
  word_count: number | null;
  model_used: string | null;
  processing_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ScribeConfig {
  id: string;
  organization_id: string;
  prefer_local: boolean;
  max_local_duration_seconds: number;
  auto_detect_language: boolean;
  default_language: string;
  noise_reduction: boolean;
  punctuation_enabled: boolean;
  speaker_diarization: boolean;
  real_time_mode: boolean;
  created_at: string;
  updated_at: string;
}

/** Maximum duration for local on-device processing (seconds) */
const MAX_LOCAL_DURATION = 30;

/** Languages with high local accuracy */
const HIGH_ACCURACY_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko', 'ar',
];

export class AudioScribeService {
  constructor(private pool: pg.Pool) {}

  /** Get or create scribe config for an org */
  async getConfig(organizationId: string): Promise<ScribeConfig> {
    const result = await this.pool.query(
      `SELECT * FROM audio_scribe_configs WHERE organization_id = $1`,
      [organizationId],
    );
    if (result.rows[0]) return this.mapConfig(result.rows[0]);

    const id = uuidv7();
    const inserted = await this.pool.query(
      `INSERT INTO audio_scribe_configs (
        id, organization_id, prefer_local, max_local_duration_seconds,
        auto_detect_language, default_language, noise_reduction,
        punctuation_enabled, speaker_diarization, real_time_mode,
        created_at, updated_at
      ) VALUES ($1,$2,TRUE,$3,TRUE,'en',TRUE,TRUE,FALSE,FALSE,NOW(),NOW())
      ON CONFLICT (organization_id) DO UPDATE SET updated_at = NOW()
      RETURNING *`,
      [id, organizationId, MAX_LOCAL_DURATION],
    );
    return this.mapConfig(inserted.rows[0]);
  }

  /** Update scribe configuration */
  async updateConfig(organizationId: string, updates: Partial<ScribeConfig>): Promise<ScribeConfig> {
    const fields: string[] = [];
    const params: unknown[] = [organizationId];
    let idx = 2;

    if (updates.prefer_local !== undefined) { params.push(updates.prefer_local); fields.push(`prefer_local = $${idx++}`); }
    if (updates.max_local_duration_seconds !== undefined) {
      params.push(Math.min(updates.max_local_duration_seconds, 120));
      fields.push(`max_local_duration_seconds = $${idx++}`);
    }
    if (updates.auto_detect_language !== undefined) { params.push(updates.auto_detect_language); fields.push(`auto_detect_language = $${idx++}`); }
    if (updates.default_language !== undefined) { params.push(updates.default_language); fields.push(`default_language = $${idx++}`); }
    if (updates.noise_reduction !== undefined) { params.push(updates.noise_reduction); fields.push(`noise_reduction = $${idx++}`); }
    if (updates.punctuation_enabled !== undefined) { params.push(updates.punctuation_enabled); fields.push(`punctuation_enabled = $${idx++}`); }
    if (updates.speaker_diarization !== undefined) { params.push(updates.speaker_diarization); fields.push(`speaker_diarization = $${idx++}`); }
    if (updates.real_time_mode !== undefined) { params.push(updates.real_time_mode); fields.push(`real_time_mode = $${idx++}`); }

    if (fields.length === 0) return this.getConfig(organizationId);

    fields.push('updated_at = NOW()');
    const result = await this.pool.query(
      `UPDATE audio_scribe_configs SET ${fields.join(', ')} WHERE organization_id = $1 RETURNING *`,
      params,
    );
    return this.mapConfig(result.rows[0]);
  }

  /** Start a new scribe session */
  async startSession(
    organizationId: string,
    userId: string,
    source: ScribeSource,
    estimatedDurationSeconds?: number,
  ): Promise<ScribeSession> {
    const config = await this.getConfig(organizationId);
    const target = this.routeAudio(
      estimatedDurationSeconds || 0,
      config,
    );
    const id = uuidv7();

    const result = await this.pool.query(
      `INSERT INTO audio_scribe_sessions (
        id, organization_id, user_id, source, target, status,
        duration_seconds, created_at
      ) VALUES ($1,$2,$3,$4,$5,'pending',$6,NOW())
      RETURNING *`,
      [id, organizationId, userId, source, target, estimatedDurationSeconds || null],
    );
    return this.mapSession(result.rows[0]);
  }

  /** Complete a scribe session with transcript */
  async completeSession(
    sessionId: string,
    transcript: string,
    languageDetected: string,
    confidence: number,
    processingMs: number,
    modelUsed: string,
    actualDurationSeconds?: number,
  ): Promise<ScribeSession> {
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

    const result = await this.pool.query(
      `UPDATE audio_scribe_sessions
       SET status = 'completed', transcript = $2, language_detected = $3,
           confidence = $4, word_count = $5, model_used = $6,
           processing_ms = $7, completed_at = NOW(),
           duration_seconds = COALESCE($8, duration_seconds)
       WHERE id = $1 RETURNING *`,
      [sessionId, transcript, languageDetected, confidence, wordCount, modelUsed, processingMs, actualDurationSeconds || null],
    );
    return this.mapSession(result.rows[0]);
  }

  /** Mark session as failed */
  async failSession(sessionId: string, reason: string): Promise<ScribeSession> {
    const result = await this.pool.query(
      `UPDATE audio_scribe_sessions
       SET status = 'failed', transcript = $2, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [sessionId, `[Error] ${reason}`],
    );
    return this.mapSession(result.rows[0]);
  }

  /** List sessions for an org */
  async listSessions(
    organizationId: string,
    opts?: { status?: ScribeStatus; source?: ScribeSource; limit?: number; offset?: number },
  ): Promise<{ rows: ScribeSession[]; total: number }> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    if (opts?.status) { params.push(opts.status); conditions.push(`status = $${params.length}`); }
    if (opts?.source) { params.push(opts.source); conditions.push(`source = $${params.length}`); }

    const where = conditions.join(' AND ');
    const limit = Math.min(opts?.limit || 50, 200);
    const offset = opts?.offset || 0;

    const [rows, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM audio_scribe_sessions WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM audio_scribe_sessions WHERE ${where}`, params),
    ]);

    return {
      rows: rows.rows.map((r) => this.mapSession(r)),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  /** Get scribe statistics */
  async getStats(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_sessions,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE target = 'local')::int AS local_processed,
        COUNT(*) FILTER (WHERE target = 'server')::int AS server_processed,
        COALESCE(SUM(duration_seconds) FILTER (WHERE status = 'completed'), 0)::int AS total_audio_seconds,
        COALESCE(SUM(word_count) FILTER (WHERE status = 'completed'), 0)::int AS total_words,
        COALESCE(AVG(confidence) FILTER (WHERE status = 'completed'), 0)::numeric(4,2) AS avg_confidence,
        COALESCE(AVG(processing_ms) FILTER (WHERE status = 'completed'), 0)::int AS avg_processing_ms,
        COUNT(DISTINCT language_detected)::int AS languages_detected
       FROM audio_scribe_sessions WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0] || {};
  }

  /** Determine local vs server processing */
  routeAudio(estimatedDurationSeconds: number, config: ScribeConfig): ScribeTarget {
    if (!config.prefer_local) return 'server';
    if (config.speaker_diarization) return 'server';
    if (estimatedDurationSeconds > config.max_local_duration_seconds) return 'server';
    return 'local';
  }

  /** Get supported languages */
  static getHighAccuracyLanguages(): string[] {
    return [...HIGH_ACCURACY_LANGUAGES];
  }

  /** Get max local duration constant */
  static getMaxLocalDuration(): number {
    return MAX_LOCAL_DURATION;
  }

  private mapSession(r: Record<string, unknown>): ScribeSession {
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      user_id: String(r.user_id),
      source: r.source as ScribeSource,
      target: r.target as ScribeTarget,
      status: r.status as ScribeStatus,
      duration_seconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
      transcript: r.transcript ? String(r.transcript) : null,
      language_detected: r.language_detected ? String(r.language_detected) : null,
      confidence: r.confidence != null ? Number(r.confidence) : null,
      word_count: r.word_count != null ? Number(r.word_count) : null,
      model_used: r.model_used ? String(r.model_used) : null,
      processing_ms: r.processing_ms != null ? Number(r.processing_ms) : null,
      created_at: String(r.created_at),
      completed_at: r.completed_at ? String(r.completed_at) : null,
    };
  }

  private mapConfig(r: Record<string, unknown>): ScribeConfig {
    return {
      id: String(r.id),
      organization_id: String(r.organization_id),
      prefer_local: Boolean(r.prefer_local),
      max_local_duration_seconds: Number(r.max_local_duration_seconds || MAX_LOCAL_DURATION),
      auto_detect_language: Boolean(r.auto_detect_language),
      default_language: String(r.default_language || 'en'),
      noise_reduction: Boolean(r.noise_reduction),
      punctuation_enabled: Boolean(r.punctuation_enabled),
      speaker_diarization: Boolean(r.speaker_diarization),
      real_time_mode: Boolean(r.real_time_mode),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}
