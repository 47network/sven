import pg from 'pg';
import os from 'os';
import { dirname, join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import {
  computeMemorySimilarity,
  shouldMergeBySimilarity,
} from './memory-consolidation-utils.js';
import { embedTextFromEnv } from './embeddings.js';

type Visibility = 'user_private' | 'chat_shared' | 'global';

export interface MemoryRecord {
  id: string;
  user_id: string | null;
  organization_id?: string | null;
  chat_id: string | null;
  visibility: Visibility;
  key: string;
  value: string;
  source: string;
  evidence?: Array<Record<string, unknown>>;
  archived_at?: string | null;
  merged_into?: string | null;
  importance: number;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryCreateInput {
  user_id?: string | null;
  organization_id?: string | null;
  chat_id?: string | null;
  visibility: Visibility;
  key: string;
  value: string;
  source?: string;
  importance?: number;
}

export interface MemorySearchInput {
  query: string;
  organization_id?: string | null;
  user_id?: string;
  chat_id?: string;
  visibility?: Visibility;
  source?: string;
  top_k?: number;
  temporal_decay?: boolean;
  decay_factor?: number;
  decay_curve?: 'linear' | 'exponential' | 'step';
  decay_step_days?: number;
  mmr?: boolean;
  mmr_lambda?: number;
}

export interface MemoryAdapter {
  list(filters: {
    organization_id?: string | null;
    visibility?: string;
    user_id?: string;
    chat_id?: string;
    key?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: MemoryRecord[]; total: number }>;
  create(input: MemoryCreateInput): Promise<string>;
  update(
    id: string,
    patch: Partial<Pick<MemoryRecord, 'visibility' | 'key' | 'value' | 'importance' | 'source'>>,
    scope?: { organization_id?: string | null },
  ): Promise<MemoryRecord | null>;
  delete(id: string, scope?: { organization_id?: string | null }): Promise<boolean>;
  search(input: MemorySearchInput): Promise<Array<MemoryRecord & { score: number }>>;
  consolidate(scope?: { organization_id?: string | null; user_id?: string; chat_id?: string }): Promise<{ merged: number; deleted: number }>;
  decay(opts?: { organization_id?: string | null; half_life_days?: number; floor?: number }): Promise<{ decayed: number }>;
}

const logger = createLogger('memory-store');

function normalizeText(input: string): string {
  return String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tokenSet(input: string): Set<string> {
  const tokens = normalizeText(input)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export { computeMemorySimilarity, shouldMergeBySimilarity } from './memory-consolidation-utils.js';

async function embedText(text: string): Promise<number[] | null> {
  try {
    return await embedTextFromEnv(text, process.env);
  } catch {
    return null;
  }
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * MMR (Maximal Marginal Relevance) re-ranking.
 * Selects diverse results by penalizing candidates similar to already-selected ones.
 * MMR = λ * sim(q, d) - (1-λ) * max(sim(d, d_selected))
 */
export function applyMMR(candidates: Array<any>, lambda: number, topK: number): any[] {
  if (candidates.length <= 1) return candidates;
  const selected: any[] = [];
  const remaining = [...candidates];

  // Pick highest scoring first
  remaining.sort((a, b) => b.score - a.score);
  selected.push(remaining.shift()!);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      // Approximate inter-document similarity via token overlap
      const candTokens = tokenSet(`${candidate.key} ${candidate.value}`);
      let maxSimToSelected = 0;
      for (const sel of selected) {
        const selTokens = tokenSet(`${sel.key} ${sel.value}`);
        maxSimToSelected = Math.max(maxSimToSelected, jaccard(candTokens, selTokens));
      }
      const mmrScore = lambda * candidate.score - (1 - lambda) * maxSimToSelected;
      if (mmrScore > bestMmr) {
        bestMmr = mmrScore;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

function normalizeDecayCurve(curve: unknown): 'linear' | 'exponential' | 'step' {
  const raw = String(curve || '').trim().toLowerCase();
  if (raw === 'linear' || raw === 'step') return raw;
  return 'exponential';
}

export function applyTemporalDecay(
  score: number,
  createdAt: string,
  decayFactor: number,
  curve: 'linear' | 'exponential' | 'step' = 'exponential',
  stepDays = 7,
): number {
  const daysSinceCreation = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (curve === 'linear') {
    const penaltyPerDay = Math.max(0, 1 - decayFactor);
    return score * Math.max(0, 1 - penaltyPerDay * daysSinceCreation);
  }
  if (curve === 'step') {
    const safeStepDays = Math.max(1, Math.floor(Number(stepDays) || 7));
    const steps = Math.floor(daysSinceCreation / safeStepDays);
    return score * Math.pow(decayFactor, steps);
  }
  return score * Math.pow(decayFactor, daysSinceCreation);
}

class PostgresMemoryAdapter implements MemoryAdapter {
  constructor(private pool: pg.Pool) {}
  private consolidationEnabled = (process.env.MEMORY_CONSOLIDATION_ENABLED || 'true').toLowerCase() !== 'false';
  private consolidationThreshold = Number(process.env.MEMORY_CONSOLIDATION_THRESHOLD || '0.9');
  private consolidationModeDefault: 'inline' | 'deferred' = String(process.env.MEMORY_CONSOLIDATION_MODE || 'inline').trim().toLowerCase() === 'deferred'
    ? 'deferred'
    : 'inline';
  private fallbackSimilarityThreshold = Math.max(0.6, this.consolidationThreshold);

  private async getConsolidationConfig(orgId?: string | null): Promise<{ enabled: boolean; threshold: number; mode: 'inline' | 'deferred' }> {
    try {
      if (orgId) {
        const orgRes = await this.pool.query(
          `SELECT key, value
           FROM organization_settings
           WHERE organization_id = $1
             AND key IN ('memory.consolidation.enabled', 'memory.consolidation.threshold', 'memory.consolidation.mode')`,
          [orgId],
        );
        if (orgRes.rows.length > 0) {
          const map = new Map<string, unknown>(orgRes.rows.map((r) => [String(r.key), r.value]));
          const enabled = String(map.get('memory.consolidation.enabled') ?? this.consolidationEnabled).toLowerCase() !== 'false';
          const thresholdRaw = Number(map.get('memory.consolidation.threshold') ?? this.consolidationThreshold);
          const threshold = Number.isFinite(thresholdRaw) ? Math.max(0, Math.min(1, thresholdRaw)) : this.consolidationThreshold;
          const mode = String(map.get('memory.consolidation.mode') ?? this.consolidationModeDefault).trim().toLowerCase() === 'deferred'
            ? 'deferred'
            : 'inline';
          return { enabled, threshold, mode };
        }
      }

      const globalRes = await this.pool.query(
        `SELECT key, value
         FROM settings_global
         WHERE key IN ('memory.consolidation.enabled', 'memory.consolidation.threshold', 'memory.consolidation.mode')`,
      );
      if (globalRes.rows.length > 0) {
        const map = new Map<string, unknown>(globalRes.rows.map((r) => [String(r.key), r.value]));
        const enabled = String(map.get('memory.consolidation.enabled') ?? this.consolidationEnabled).toLowerCase() !== 'false';
        const thresholdRaw = Number(map.get('memory.consolidation.threshold') ?? this.consolidationThreshold);
        const threshold = Number.isFinite(thresholdRaw) ? Math.max(0, Math.min(1, thresholdRaw)) : this.consolidationThreshold;
        const mode = String(map.get('memory.consolidation.mode') ?? this.consolidationModeDefault).trim().toLowerCase() === 'deferred'
          ? 'deferred'
          : 'inline';
        return { enabled, threshold, mode };
      }
    } catch {
      // Fall through to defaults
    }
    return {
      enabled: this.consolidationEnabled,
      threshold: this.consolidationThreshold,
      mode: this.consolidationModeDefault,
    };
  }

  private buildConsolidationScopeFingerprint(
    organizationId?: string | null,
    userId?: string | null,
    chatId?: string | null,
  ): string {
    return `${organizationId || '~'}|${userId || '~'}|${chatId || '~'}`;
  }

  private async enqueueDeferredConsolidation(input: MemoryCreateInput): Promise<void> {
    try {
      const organizationId = input.organization_id || null;
      const userId = input.user_id || null;
      const chatId = input.chat_id || null;
      const fingerprint = this.buildConsolidationScopeFingerprint(organizationId, userId, chatId);
      await this.pool.query(
        `INSERT INTO memory_consolidation_jobs
           (id, organization_id, user_id, chat_id, scope_fingerprint, status, attempts, created_at, run_after)
         VALUES ($1, $2, $3, $4, $5, 'pending', 0, NOW(), NOW())
         ON CONFLICT (scope_fingerprint)
         DO UPDATE SET
           run_after = LEAST(memory_consolidation_jobs.run_after, NOW()),
           status = CASE WHEN memory_consolidation_jobs.status = 'processing' THEN memory_consolidation_jobs.status ELSE 'pending' END`,
        [uuidv7(), organizationId, userId, chatId, fingerprint],
      );
    } catch (err) {
      logger.warn('Deferred memory consolidation enqueue failed', { error: String(err) });
    }
  }

  private buildEvidenceEntry(input: MemoryCreateInput): Record<string, unknown> {
    return {
      source: input.source || 'manual',
      key: input.key,
      value: input.value,
      captured_at: new Date().toISOString(),
    };
  }

  private mergeEvidence(
    existing: unknown,
    incoming: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const rows = Array.isArray(existing)
      ? (existing.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
      : [];
    rows.push(incoming);
    const seen = new Set<string>();
    const deduped: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const signature = `${String(row.source || '')}|${String(row.key || '')}|${String(row.value || '')}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      deduped.push(row);
    }
    return deduped;
  }

  async list(filters: {
    organization_id?: string | null;
    visibility?: string;
    user_id?: string;
    chat_id?: string;
    key?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: MemoryRecord[]; total: number }> {
    let where = 'WHERE archived_at IS NULL';
    const params: unknown[] = [];
    params.push(filters.organization_id ?? null);
    where += ` AND (organization_id IS NOT DISTINCT FROM $${params.length})`;
    if (filters.visibility) {
      params.push(filters.visibility);
      where += ` AND visibility = $${params.length}`;
    }
    if (filters.user_id) {
      params.push(filters.user_id);
      where += ` AND user_id = $${params.length}`;
    }
    if (filters.chat_id) {
      params.push(filters.chat_id);
      where += ` AND chat_id = $${params.length}`;
    }
    if (filters.key) {
      params.push(`%${filters.key}%`);
      where += ` AND key ILIKE $${params.length}`;
    }
    const countRes = await this.pool.query(`SELECT COUNT(*)::int AS total FROM memories ${where}`, params);
    const total = Number(countRes.rows[0]?.total || 0);
    const dataParams = [...params, filters.limit, filters.offset];
    const data = await this.pool.query(
      `SELECT id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, archived_at, merged_into,
              importance, access_count, last_accessed_at, created_at, updated_at
       FROM memories ${where}
       ORDER BY importance DESC, updated_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );
    return { rows: data.rows, total };
  }

  async create(input: MemoryCreateInput): Promise<string> {
    const orgId = input.organization_id || null;
    const { enabled, threshold, mode } = await this.getConsolidationConfig(orgId);
    const source = input.source || 'manual';
    const evidenceEntry = this.buildEvidenceEntry(input);
    const embedding = await embedText(`${input.key}: ${input.value}`);

    if (enabled && mode === 'deferred') {
      const id = uuidv7();
      await this.pool.query(
        `INSERT INTO memories (id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, importance, embedding, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::vector, NOW(), NOW())`,
        [
          id,
          input.user_id || null,
          orgId,
          input.chat_id || null,
          input.visibility,
          input.key,
          input.value,
          source,
          JSON.stringify([evidenceEntry]),
          input.importance ?? 1.0,
          embedding ? toVectorLiteral(embedding) : null,
        ],
      );
      await this.enqueueDeferredConsolidation(input);
      return id;
    }

    // B4: Near-duplicate detection — merge with existing if similarity > threshold.
    if (enabled && embedding) {
      try {
        const dupRes = await this.pool.query(
          `SELECT id, key, value, source, evidence, importance, embedding,
                  (1 - (embedding <=> $1::vector))::float8 AS similarity
           FROM memories
           WHERE embedding IS NOT NULL
             AND archived_at IS NULL
             AND (organization_id IS NOT DISTINCT FROM $2)
             AND visibility = $3
             AND (user_id IS NOT DISTINCT FROM $4)
             AND (chat_id IS NOT DISTINCT FROM $5)
           ORDER BY embedding <=> $1::vector ASC
           LIMIT 1`,
          [toVectorLiteral(embedding), orgId, input.visibility, input.user_id || null, input.chat_id || null],
        );
        if (dupRes.rows.length > 0 && shouldMergeBySimilarity(Number(dupRes.rows[0].similarity), threshold)) {
          const existing = dupRes.rows[0];
          const mergedValue = existing.value === input.value
            ? existing.value
            : `${existing.value} | ${input.value}`;
          const mergedImportance = Math.min(5, (Number(existing.importance) + 0.15));
          const mergedEvidence = this.mergeEvidence(existing.evidence, evidenceEntry);
          const archivedId = uuidv7();

          await this.pool.query(
            `UPDATE memories
             SET value = $2,
                 importance = $3,
                 source = 'consolidated',
                 evidence = $4::jsonb,
                 updated_at = NOW(),
                 embedding = $5::vector
             WHERE id = $1`,
            [existing.id, mergedValue, mergedImportance, JSON.stringify(mergedEvidence), toVectorLiteral(embedding)],
          );
          await this.pool.query(
            `INSERT INTO memories (id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, importance, embedding, archived_at, merged_into, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::vector, NOW(), $12, NOW(), NOW())`,
            [
              archivedId,
              input.user_id || null,
              orgId,
              input.chat_id || null,
              input.visibility,
              input.key,
              input.value,
              source,
              JSON.stringify([evidenceEntry]),
              input.importance ?? 1.0,
              toVectorLiteral(embedding),
              existing.id,
            ],
          );
          logger.info('Memory consolidated with existing', { existing_id: existing.id, similarity: dupRes.rows[0].similarity });
          return existing.id;
        }
      } catch (err) {
        logger.warn('Near-duplicate check failed, inserting new memory', { error: String(err) });
      }
    }

    // Fallback near-duplicate check when embeddings are unavailable.
    if (enabled && !embedding) {
      try {
        const dupRes = await this.pool.query(
          `SELECT id, key, value, source, evidence, importance
           FROM memories
           WHERE archived_at IS NULL
             AND (organization_id IS NOT DISTINCT FROM $1)
             AND visibility = $2
             AND (user_id IS NOT DISTINCT FROM $3)
             AND (chat_id IS NOT DISTINCT FROM $4)
           ORDER BY updated_at DESC
           LIMIT 25`,
          [orgId, input.visibility, input.user_id || null, input.chat_id || null],
        );
        const candidate = dupRes.rows
          .map((row) => ({
            row,
            similarity: computeMemorySimilarity(String(row.key || ''), String(row.value || ''), input.key, input.value),
          }))
          .sort((a, b) => b.similarity - a.similarity)[0];

        if (candidate && shouldMergeBySimilarity(candidate.similarity, Math.min(threshold, this.fallbackSimilarityThreshold))) {
          const existing = candidate.row;
          const mergedValue = existing.value === input.value
            ? existing.value
            : `${existing.value} | ${input.value}`;
          const mergedImportance = Math.min(5, (Number(existing.importance) + 0.15));
          const mergedEvidence = this.mergeEvidence(existing.evidence, evidenceEntry);

          await this.pool.query(
            `UPDATE memories
             SET value = $2,
                 importance = $3,
                 source = 'consolidated',
                 evidence = $4::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [existing.id, mergedValue, mergedImportance, JSON.stringify(mergedEvidence)],
          );
          await this.pool.query(
            `INSERT INTO memories (id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, importance, archived_at, merged_into, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW(), $11, NOW(), NOW())`,
            [
              uuidv7(),
              input.user_id || null,
              orgId,
              input.chat_id || null,
              input.visibility,
              input.key,
              input.value,
              source,
              JSON.stringify([evidenceEntry]),
              input.importance ?? 1.0,
              existing.id,
            ],
          );
          logger.info('Memory consolidated with existing (fallback similarity)', {
            existing_id: existing.id,
            similarity: candidate.similarity,
          });
          return existing.id;
        }
      } catch (err) {
        logger.warn('Fallback near-duplicate check failed, inserting new memory', { error: String(err) });
      }
    }

    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO memories (id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, importance, embedding, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, ${embedding ? `$11::vector` : 'NULL'}, NOW(), NOW())`,
      embedding
        ? [id, input.user_id || null, orgId, input.chat_id || null, input.visibility, input.key, input.value, source, JSON.stringify([evidenceEntry]), input.importance ?? 1.0, toVectorLiteral(embedding)]
        : [id, input.user_id || null, orgId, input.chat_id || null, input.visibility, input.key, input.value, source, JSON.stringify([evidenceEntry]), input.importance ?? 1.0],
    );
    return id;
  }

  async update(
    id: string,
    patch: Partial<Pick<MemoryRecord, 'visibility' | 'key' | 'value' | 'importance' | 'source'>>,
    scope?: { organization_id?: string | null },
  ): Promise<MemoryRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.visibility !== undefined) {
      params.push(patch.visibility);
      sets.push(`visibility = $${params.length}`);
    }
    if (patch.key !== undefined) {
      params.push(patch.key);
      sets.push(`key = $${params.length}`);
    }
    if (patch.value !== undefined) {
      params.push(patch.value);
      sets.push(`value = $${params.length}`);
    }
    if (patch.source !== undefined) {
      params.push(patch.source);
      sets.push(`source = $${params.length}`);
    }
    if (patch.importance !== undefined) {
      params.push(patch.importance);
      sets.push(`importance = $${params.length}`);
    }
    if (sets.length === 0) return null;
    const orgId = scope?.organization_id ?? null;
    params.push(id);
    params.push(orgId);
    const res = await this.pool.query(
      `UPDATE memories
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1}
         AND (organization_id IS NOT DISTINCT FROM $${params.length})
       RETURNING id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, archived_at, merged_into,
                 importance, access_count, last_accessed_at, created_at, updated_at`,
      params,
    );
    const current = res.rows[0] || null;
    if (!current) return null;

    const changedDedupInputs =
      patch.visibility !== undefined ||
      patch.key !== undefined ||
      patch.value !== undefined;
    if (!changedDedupInputs) {
      return current;
    }

    const { enabled, threshold, mode } = await this.getConsolidationConfig(orgId);
    if (!enabled) {
      return current;
    }

    if (mode === 'deferred') {
      await this.enqueueDeferredConsolidation({
        organization_id: current.organization_id ?? orgId,
        user_id: current.user_id || null,
        chat_id: current.chat_id || null,
        visibility: current.visibility,
        key: current.key,
        value: current.value,
        source: current.source,
      });
      return current;
    }

    const nowIso = new Date().toISOString();
    const mergeEvidenceEntry = {
      source: 'update_consolidation',
      key: String(current.key || ''),
      value: String(current.value || ''),
      captured_at: nowIso,
    };
    const currentVisibility = String(current.visibility || '');
    const currentUserId = current.user_id || null;
    const currentChatId = current.chat_id || null;
    const currentOrgId = current.organization_id ?? orgId;

    const mergeWithDuplicate = async (candidate: any, embeddingLiteral?: string) => {
      const mergedValue = candidate.value === current.value
        ? String(current.value || '')
        : Array.from(new Set([String(current.value || ''), String(candidate.value || '')]))
          .filter(Boolean)
          .join(' | ');
      const mergedImportance = Math.min(5, Number(current.importance || 1) + 0.15);
      let mergedEvidence = this.mergeEvidence(current.evidence, mergeEvidenceEntry);
      const candidateEvidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
      for (const item of candidateEvidence) {
        mergedEvidence = this.mergeEvidence(mergedEvidence, item as Record<string, unknown>);
      }

      if (embeddingLiteral) {
        await this.pool.query(
          `UPDATE memories
           SET value = $2,
               importance = $3,
               source = 'consolidated',
               evidence = $4::jsonb,
               embedding = $5::vector,
               updated_at = NOW()
           WHERE id = $1`,
          [id, mergedValue, mergedImportance, JSON.stringify(mergedEvidence), embeddingLiteral],
        );
      } else {
        await this.pool.query(
          `UPDATE memories
           SET value = $2,
               importance = $3,
               source = 'consolidated',
               evidence = $4::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [id, mergedValue, mergedImportance, JSON.stringify(mergedEvidence)],
        );
      }

      await this.pool.query(
        `UPDATE memories
         SET archived_at = NOW(),
             merged_into = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [candidate.id, id],
      );
    };

    const embedding = await embedText(`${String(current.key || '')}: ${String(current.value || '')}`);
    if (embedding) {
      try {
        const embeddingLiteral = toVectorLiteral(embedding);
        const dupRes = await this.pool.query(
          `SELECT id, key, value, source, evidence, importance,
                  (1 - (embedding <=> $1::vector))::float8 AS similarity
          FROM memories
           WHERE id <> $2
             AND embedding IS NOT NULL
             AND archived_at IS NULL
             AND (organization_id IS NOT DISTINCT FROM $6)
             AND visibility = $3
             AND (user_id IS NOT DISTINCT FROM $4)
             AND (chat_id IS NOT DISTINCT FROM $5)
           ORDER BY embedding <=> $1::vector ASC
           LIMIT 1`,
          [embeddingLiteral, id, currentVisibility, currentUserId, currentChatId, currentOrgId],
        );

        if (dupRes.rows.length > 0 && shouldMergeBySimilarity(Number(dupRes.rows[0].similarity), threshold)) {
          await mergeWithDuplicate(dupRes.rows[0], embeddingLiteral);
          const mergedRes = await this.pool.query(
            `SELECT id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, archived_at, merged_into,
                    importance, access_count, last_accessed_at, created_at, updated_at
             FROM memories
             WHERE id = $1`,
            [id],
          );
          if (mergedRes.rows[0]) return mergedRes.rows[0];
        }
      } catch (err) {
        logger.warn('Near-duplicate check on update failed', { id, error: String(err) });
      }
    } else {
      try {
        const dupRes = await this.pool.query(
          `SELECT id, key, value, source, evidence, importance
          FROM memories
           WHERE id <> $1
             AND archived_at IS NULL
             AND (organization_id IS NOT DISTINCT FROM $5)
             AND visibility = $2
             AND (user_id IS NOT DISTINCT FROM $3)
             AND (chat_id IS NOT DISTINCT FROM $4)
           ORDER BY updated_at DESC
           LIMIT 25`,
          [id, currentVisibility, currentUserId, currentChatId, currentOrgId],
        );
        const candidate = dupRes.rows
          .map((row) => ({
            row,
            similarity: computeMemorySimilarity(
              String(row.key || ''),
              String(row.value || ''),
              String(current.key || ''),
              String(current.value || ''),
            ),
          }))
          .sort((a, b) => b.similarity - a.similarity)[0];
        if (candidate && shouldMergeBySimilarity(candidate.similarity, Math.min(threshold, this.fallbackSimilarityThreshold))) {
          await mergeWithDuplicate(candidate.row);
          const mergedRes = await this.pool.query(
            `SELECT id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, archived_at, merged_into,
                    importance, access_count, last_accessed_at, created_at, updated_at
             FROM memories
             WHERE id = $1`,
            [id],
          );
          if (mergedRes.rows[0]) return mergedRes.rows[0];
        }
      } catch (err) {
        logger.warn('Fallback near-duplicate check on update failed', { id, error: String(err) });
      }
    }

    return current;
  }

  async delete(id: string, scope?: { organization_id?: string | null }): Promise<boolean> {
    const orgId = scope?.organization_id ?? null;
    const res = await this.pool.query(
      `DELETE FROM memories WHERE id = $1 AND (organization_id IS NOT DISTINCT FROM $2) RETURNING id`,
      [id, orgId],
    );
    return res.rows.length > 0;
  }

  async search(input: MemorySearchInput): Promise<Array<MemoryRecord & { score: number }>> {
    const query = String(input.query || '').trim();
    if (!query) return [];
    const topK = Math.max(1, Math.min(100, Number(input.top_k || 10)));
    const useDecay = input.temporal_decay !== false;
    const decayFactor = Math.max(0.5, Math.min(1.0, Number(input.decay_factor || 0.98)));
    const decayCurve = normalizeDecayCurve(input.decay_curve);
    const decayStepDays = Math.max(1, Math.floor(Number(input.decay_step_days || 7)));
    const useMmr = input.mmr !== false;
    const mmrLambda = Math.max(0, Math.min(1.0, Number(input.mmr_lambda || 0.7)));
    // Fetch more candidates for MMR re-ranking
    const fetchK = useMmr ? Math.min(topK * 3, 100) : topK;

    const embedding = await embedText(query);
    if (embedding) {
      const params: unknown[] = [toVectorLiteral(embedding), fetchK];
      let where = 'WHERE embedding IS NOT NULL AND archived_at IS NULL';
      params.push(input.organization_id ?? null);
      where += ` AND (organization_id IS NOT DISTINCT FROM $${params.length})`;
      if (input.visibility) {
        params.push(input.visibility);
        where += ` AND visibility = $${params.length}`;
      }
      if (input.user_id) {
        params.push(input.user_id);
        where += ` AND (user_id = $${params.length} OR user_id IS NULL)`;
      }
      if (input.chat_id) {
        params.push(input.chat_id);
        where += ` AND (chat_id = $${params.length} OR chat_id IS NULL)`;
      }
      if (input.source) {
        params.push(input.source);
        where += ` AND source = $${params.length}`;
      }
      const sql = `
        SELECT id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, importance, access_count, last_accessed_at, created_at, updated_at,
               (1 - (embedding <=> $1::vector))::float8 AS score,
               embedding
        FROM memories
        ${where}
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $2
      `;
      const res = await this.pool.query(sql, params);

      let results = res.rows.map((r: any) => {
        let adjustedScore = Number(r.score);
        // A9: Temporal decay — recent memories score higher
        if (useDecay) {
          adjustedScore = applyTemporalDecay(
            adjustedScore,
            r.created_at,
            decayFactor,
            decayCurve,
            decayStepDays,
          );
        }
        return { ...r, score: adjustedScore };
      });

      // A9: MMR re-ranking — diversify results
      if (useMmr && results.length > topK) {
        results = applyMMR(results, mmrLambda, topK);
      } else {
        results.sort((a: any, b: any) => b.score - a.score);
        results = results.slice(0, topK);
      }

      // Strip raw embedding from response
      results = results.map(({ embedding: _e, ...rest }: any) => rest);

      const ids = results.map((r: any) => r.id);
      if (ids.length > 0) {
        await this.pool.query(
          `UPDATE memories SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = ANY($1::uuid[])`,
          [ids],
        );
      }
      return results;
    }

    const res = await this.pool.query(
      `SELECT id, user_id, organization_id, chat_id, visibility, key, value, source, evidence, importance, access_count, last_accessed_at, created_at, updated_at
       FROM memories
       WHERE archived_at IS NULL
         AND (organization_id IS NOT DISTINCT FROM $2)
         AND ($1::text IS NULL OR source = $1)
       ORDER BY updated_at DESC
       LIMIT 300`,
      [input.source || null, input.organization_id ?? null],
    );
    const queryTokens = tokenSet(query);
    const scored = res.rows
      .map((row: any) => {
        let s = jaccard(queryTokens, tokenSet(`${row.key} ${row.value}`));
        if (useDecay) {
          s = applyTemporalDecay(s, row.created_at, decayFactor, decayCurve, decayStepDays);
        }
        return { ...row, score: s };
      })
      .filter((r: any) => r.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, topK);
    if (scored.length > 0) {
      await this.pool.query(
        `UPDATE memories SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = ANY($1::uuid[])`,
        [scored.map((r: any) => r.id)],
      );
    }
    return scored;
  }

  async consolidate(scope?: { organization_id?: string | null; user_id?: string; chat_id?: string }): Promise<{ merged: number; deleted: number }> {
    const params: unknown[] = [];
    let where = 'WHERE archived_at IS NULL';
    params.push(scope?.organization_id ?? null);
    where += ` AND (organization_id IS NOT DISTINCT FROM $${params.length})`;
    if (scope?.user_id) {
      params.push(scope.user_id);
      where += ` AND user_id = $${params.length}`;
    }
    if (scope?.chat_id) {
      params.push(scope.chat_id);
      where += ` AND chat_id = $${params.length}`;
    }
    const res = await this.pool.query(
      `SELECT id, visibility, user_id, chat_id, key, value, source, evidence, importance
       FROM memories
       ${where}
       ORDER BY updated_at DESC
       LIMIT 1000`,
      params,
    );

    const groups = new Map<string, any[]>();
    for (const row of res.rows) {
      const gk = `${row.visibility}:${row.user_id || ''}:${row.chat_id || ''}:${normalizeText(row.key)}`;
      const list = groups.get(gk) || [];
      list.push(row);
      groups.set(gk, list);
    }

    let merged = 0;
    let deleted = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const head = list[0];
      const tail = list.slice(1);
      const uniqueValues = Array.from(new Set([head.value, ...tail.map((x: any) => x.value)].map((v) => String(v).trim()))).filter(Boolean);
      const mergedValue = uniqueValues.join(' | ');
      const importance = Math.min(5, (Number(head.importance || 1) + tail.length * 0.1));
      const mergedEvidence = this.mergeEvidence(
        [head.evidence, ...tail.map((x: any) => x.evidence)].flat(),
        {
          source: 'consolidate',
          key: head.key,
          value: mergedValue,
          captured_at: new Date().toISOString(),
        },
      );
      await this.pool.query(
        `UPDATE memories
         SET value = $2, importance = $3, source = 'consolidated', evidence = $4::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [head.id, mergedValue, importance, JSON.stringify(mergedEvidence)],
      );
      await this.pool.query(
        `UPDATE memories
         SET archived_at = NOW(), merged_into = $2, updated_at = NOW()
         WHERE id = ANY($1::text[])`,
        [tail.map((x: any) => String(x.id)), String(head.id)],
      );
      merged += 1;
      deleted += tail.length;
    }
    return { merged, deleted };
  }

  async decay(opts?: { organization_id?: string | null; half_life_days?: number; floor?: number }): Promise<{ decayed: number }> {
    const halfLife = Number(opts?.half_life_days || 90);
    const floor = Number(opts?.floor || 0.2);
    const orgId = opts?.organization_id ?? null;
    const res = await this.pool.query(
      `UPDATE memories
       SET importance = GREATEST($1::real, importance * EXP(-LN(2) * (EXTRACT(EPOCH FROM (NOW() - COALESCE(last_accessed_at, updated_at))) / 86400.0) / $2::real)),
           updated_at = NOW()
       WHERE importance > $1::real
         AND (organization_id IS NOT DISTINCT FROM $3)
       RETURNING id`,
      [floor, halfLife, orgId],
    );
    return { decayed: res.rows.length };
  }
}

class JsonFileMemoryAdapter implements MemoryAdapter {
  private path: string;
  constructor(filePath?: string) {
    this.path = filePath || process.env.MEMORY_FILE_PATH || join(os.homedir(), '.sven', 'memory-store.json');
  }

  private async readAll(): Promise<MemoryRecord[]> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeAll(rows: MemoryRecord[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true }).catch(() => {});
    await writeFile(this.path, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  }

  async list(filters: {
    organization_id?: string | null;
    visibility?: string;
    user_id?: string;
    chat_id?: string;
    key?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: MemoryRecord[]; total: number }> {
    const rows = await this.readAll();
    const filtered = rows.filter((r) => {
      if (r.archived_at) return false;
      if ((r.organization_id ?? null) !== (filters.organization_id ?? null)) return false;
      if (filters.visibility && r.visibility !== filters.visibility) return false;
      if (filters.user_id && r.user_id !== filters.user_id) return false;
      if (filters.chat_id && r.chat_id !== filters.chat_id) return false;
      if (filters.key && !r.key.toLowerCase().includes(String(filters.key).toLowerCase())) return false;
      return true;
    });
    return { rows: filtered.slice(filters.offset, filters.offset + filters.limit), total: filtered.length };
  }

  async create(input: MemoryCreateInput): Promise<string> {
    const rows = await this.readAll();
    const now = new Date().toISOString();
    const enabled = (process.env.MEMORY_CONSOLIDATION_ENABLED || 'true').toLowerCase() !== 'false';
    const threshold = Math.max(0, Math.min(1, Number(process.env.MEMORY_CONSOLIDATION_THRESHOLD || '0.9')));
    const source = input.source || 'manual';
    const evidenceEntry: Record<string, unknown> = {
      source,
      key: input.key,
      value: input.value,
      captured_at: now,
    };

    if (enabled) {
      const candidates = rows.filter((r) => {
        if (r.archived_at) return false;
        return r.visibility === input.visibility
          && (r.organization_id ?? null) === (input.organization_id ?? null)
          && r.user_id === (input.user_id || null)
          && r.chat_id === (input.chat_id || null);
      });
      const best = candidates
        .map((r) => ({
          row: r,
          similarity: computeMemorySimilarity(r.key, r.value, input.key, input.value),
        }))
        .sort((a, b) => b.similarity - a.similarity)[0];
      if (best && shouldMergeBySimilarity(best.similarity, threshold)) {
        const existing = best.row;
        const merged = Array.from(new Set([existing.value, input.value])).filter(Boolean);
        existing.value = merged.join(' | ');
        existing.source = 'consolidated';
        existing.evidence = Array.isArray(existing.evidence) ? existing.evidence : [];
        existing.evidence.push(evidenceEntry);
        existing.importance = Math.min(5, Number(existing.importance || 1) + 0.15);
        existing.updated_at = now;

        rows.unshift({
          id: uuidv7(),
          user_id: input.user_id || null,
          organization_id: input.organization_id ?? null,
          chat_id: input.chat_id || null,
          visibility: input.visibility,
          key: input.key,
          value: input.value,
          source,
          evidence: [evidenceEntry],
          archived_at: now,
          merged_into: existing.id,
          importance: Number(input.importance ?? 1.0),
          access_count: 0,
          last_accessed_at: null,
          created_at: now,
          updated_at: now,
        });
        await this.writeAll(rows);
        return existing.id;
      }
    }

    const id = uuidv7();
    rows.unshift({
      id,
      user_id: input.user_id || null,
      organization_id: input.organization_id ?? null,
      chat_id: input.chat_id || null,
      visibility: input.visibility,
      key: input.key,
      value: input.value,
      source,
      evidence: [evidenceEntry],
      importance: Number(input.importance ?? 1.0),
      access_count: 0,
      last_accessed_at: null,
      created_at: now,
      updated_at: now,
    });
    await this.writeAll(rows);
    return id;
  }

  async update(
    id: string,
    patch: Partial<Pick<MemoryRecord, 'visibility' | 'key' | 'value' | 'importance' | 'source'>>,
    scope?: { organization_id?: string | null },
  ): Promise<MemoryRecord | null> {
    const rows = await this.readAll();
    const scopeOrgId = scope?.organization_id ?? null;
    const idx = rows.findIndex((x) => x.id === id && (x.organization_id ?? null) === scopeOrgId);
    if (idx < 0) return null;
    rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
    const current = rows[idx];
    const changedDedupInputs =
      patch.visibility !== undefined ||
      patch.key !== undefined ||
      patch.value !== undefined;
    if (changedDedupInputs) {
      const enabled = (process.env.MEMORY_CONSOLIDATION_ENABLED || 'true').toLowerCase() !== 'false';
      const threshold = Math.max(0, Math.min(1, Number(process.env.MEMORY_CONSOLIDATION_THRESHOLD || '0.9')));
      if (enabled) {
        const candidates = rows.filter((r) => {
          if (r.id === current.id) return false;
          if (r.archived_at) return false;
          return r.visibility === current.visibility
            && (r.organization_id ?? null) === (current.organization_id ?? null)
            && r.user_id === (current.user_id || null)
            && r.chat_id === (current.chat_id || null);
        });
        const best = candidates
          .map((r) => ({
            row: r,
            similarity: computeMemorySimilarity(r.key, r.value, current.key, current.value),
          }))
          .sort((a, b) => b.similarity - a.similarity)[0];
        const fallbackThreshold = Math.max(0.6, threshold);
        if (best && shouldMergeBySimilarity(best.similarity, Math.min(threshold, fallbackThreshold))) {
          const other = best.row;
          const merged = Array.from(new Set([current.value, other.value])).filter(Boolean);
          current.value = merged.join(' | ');
          current.source = 'consolidated';
          current.evidence = [
            ...(Array.isArray(current.evidence) ? current.evidence : []),
            ...(Array.isArray(other.evidence) ? other.evidence : []),
          ];
          current.importance = Math.min(5, Number(current.importance || 1) + 0.15);
          current.updated_at = new Date().toISOString();
          other.archived_at = new Date().toISOString();
          other.merged_into = current.id;
          other.updated_at = new Date().toISOString();
        }
      }
    }
    await this.writeAll(rows);
    return current;
  }

  async delete(id: string, scope?: { organization_id?: string | null }): Promise<boolean> {
    const rows = await this.readAll();
    const scopeOrgId = scope?.organization_id ?? null;
    const next = rows.filter((x) => !(x.id === id && (x.organization_id ?? null) === scopeOrgId));
    if (next.length === rows.length) return false;
    await this.writeAll(next);
    return true;
  }

  async search(input: MemorySearchInput): Promise<Array<MemoryRecord & { score: number }>> {
    const rows = await this.readAll();
    const q = tokenSet(input.query);
    const topK = Math.max(1, Math.min(100, Number(input.top_k || 10)));
    const scored = rows
      .map((r) => ({ ...r, score: jaccard(q, tokenSet(`${r.key} ${r.value}`)) }))
      .filter((r) => !r.archived_at)
      .filter((r) => (r.organization_id ?? null) === (input.organization_id ?? null))
      .filter((r) => !input.source || r.source === input.source)
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  }

  async consolidate(scope?: { organization_id?: string | null; user_id?: string; chat_id?: string }): Promise<{ merged: number; deleted: number }> {
    const rows = await this.readAll();
    const filtered = rows.filter((r) => {
      if (r.archived_at) return false;
      if ((r.organization_id ?? null) !== (scope?.organization_id ?? null)) return false;
      if (scope?.user_id && r.user_id !== scope.user_id) return false;
      if (scope?.chat_id && r.chat_id !== scope.chat_id) return false;
      return true;
    });
    const groups = new Map<string, MemoryRecord[]>();
    for (const row of filtered) {
      const key = `${row.visibility}:${row.user_id || ''}:${row.chat_id || ''}:${normalizeText(row.key)}`;
      const list = groups.get(key) || [];
      list.push(row);
      groups.set(key, list);
    }
    let merged = 0;
    let deleted = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const head = list[0];
      const tail = list.slice(1);
      const values = Array.from(new Set([head.value, ...tail.map((x) => x.value)]));
      head.value = values.join(' | ');
      head.source = 'consolidated';
      head.evidence = [...(Array.isArray(head.evidence) ? head.evidence : []), ...tail.flatMap((x) => (Array.isArray(x.evidence) ? x.evidence : []))];
      head.importance = Math.min(5, head.importance + tail.length * 0.1);
      head.updated_at = new Date().toISOString();
      tail.forEach((x) => {
        x.archived_at = new Date().toISOString();
        x.merged_into = head.id;
      });
      merged += 1;
      deleted += tail.length;
    }
    await this.writeAll(rows);
    return { merged, deleted };
  }

  async decay(opts?: { organization_id?: string | null; half_life_days?: number; floor?: number }): Promise<{ decayed: number }> {
    const rows = await this.readAll();
    const halfLife = Number(opts?.half_life_days || 90);
    const floor = Number(opts?.floor || 0.2);
    let decayed = 0;
    const nowMs = Date.now();
    for (const row of rows) {
      if ((row.organization_id ?? null) !== (opts?.organization_id ?? null)) continue;
      if (row.importance <= floor) continue;
      const ref = new Date(row.last_accessed_at || row.updated_at).getTime();
      const days = Math.max(0, (nowMs - ref) / (1000 * 60 * 60 * 24));
      const factor = Math.exp((-Math.log(2) * days) / halfLife);
      const next = Math.max(floor, row.importance * factor);
      if (next < row.importance) {
        row.importance = next;
        row.updated_at = new Date().toISOString();
        decayed += 1;
      }
    }
    await this.writeAll(rows);
    return { decayed };
  }
}

class FallbackAdapter implements MemoryAdapter {
  constructor(private fallback: MemoryAdapter, private name: string) {}
  private warn() {
    logger.warn(`Requested memory adapter is unavailable, using fallback`, { adapter: this.name, fallback: 'file' });
  }
  async list(filters: any) { this.warn(); return this.fallback.list(filters); }
  async create(input: any) { this.warn(); return this.fallback.create(input); }
  async update(id: string, patch: any, scope?: any) { this.warn(); return this.fallback.update(id, patch, scope); }
  async delete(id: string, scope?: any) { this.warn(); return this.fallback.delete(id, scope); }
  async search(input: any) { this.warn(); return this.fallback.search(input); }
  async consolidate(scope?: any) { this.warn(); return this.fallback.consolidate(scope); }
  async decay(opts?: any) { this.warn(); return this.fallback.decay(opts); }
}

export function createMemoryAdapter(pool: pg.Pool): MemoryAdapter {
  const kind = String(process.env.MEMORY_ADAPTER || 'postgres').toLowerCase();
  const fileAdapter = new JsonFileMemoryAdapter();
  if (kind === 'postgres') return new PostgresMemoryAdapter(pool);
  if (kind === 'file') return fileAdapter;
  if (kind === 'redis') return new FallbackAdapter(fileAdapter, 'redis');
  if (kind === 'libsql') return new FallbackAdapter(fileAdapter, 'libsql');
  return new PostgresMemoryAdapter(pool);
}
