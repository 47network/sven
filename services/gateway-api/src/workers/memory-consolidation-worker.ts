import pg from 'pg';
import { createLogger } from '@sven/shared';
import { createMemoryAdapter } from '../services/MemoryStore.js';

const logger = createLogger('memory-consolidation-worker');
const ADVISORY_LOCK_KEY = 470021;
const DEFAULT_INTERVAL_MS = 15000;
const DEFAULT_BATCH_SIZE = 10;

type StopFn = () => void;

function normalizeMode(value: unknown): 'inline' | 'deferred' {
  return String(value || '').trim().toLowerCase() === 'deferred' ? 'deferred' : 'inline';
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function startMemoryConsolidationWorker(pool: pg.Pool): Promise<StopFn> {
  const intervalMs = parsePositiveInt(
    process.env.MEMORY_CONSOLIDATION_DEFERRED_WORKER_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
  );
  const batchSize = parsePositiveInt(
    process.env.MEMORY_CONSOLIDATION_DEFERRED_WORKER_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
  );

  const tick = async () => {
    const modeRes = await pool.query(
      `SELECT value FROM settings_global WHERE key = 'memory.consolidation.mode' LIMIT 1`,
    ).catch(() => ({ rows: [] as Array<{ value?: unknown }> }));
    const mode = normalizeMode(modeRes.rows[0]?.value ?? process.env.MEMORY_CONSOLIDATION_MODE);
    if (mode !== 'deferred') return;

    const client = await pool.connect();
    let lockAcquired = false;
    try {
      const lockRes = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [ADVISORY_LOCK_KEY],
      );
      lockAcquired = Boolean(lockRes.rows[0]?.locked);
      if (!lockAcquired) return;

      const claim = await client.query(
        `WITH picked AS (
           SELECT id
           FROM memory_consolidation_jobs
           WHERE status = 'pending'
             AND run_after <= NOW()
           ORDER BY created_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE memory_consolidation_jobs j
         SET status = 'processing',
             attempts = j.attempts + 1,
             started_at = NOW(),
             last_error = NULL
         FROM picked
         WHERE j.id = picked.id
         RETURNING j.id, j.organization_id, j.user_id, j.chat_id, j.attempts`,
        [batchSize],
      );
      if (claim.rows.length === 0) return;

      const adapter = createMemoryAdapter(pool);
      for (const job of claim.rows as Array<Record<string, unknown>>) {
        const jobId = String(job.id || '');
        try {
          const result = await adapter.consolidate({
            organization_id: (job.organization_id as string | null) ?? null,
            user_id: (job.user_id as string | null) ?? undefined,
            chat_id: (job.chat_id as string | null) ?? undefined,
          });
          await pool.query(
            `UPDATE memory_consolidation_jobs
             SET status = 'done',
                 result = $2::jsonb,
                 finished_at = NOW()
             WHERE id = $1`,
            [jobId, JSON.stringify(result)],
          );
        } catch (err) {
          const attempts = Number(job.attempts || 1);
          const retrySeconds = Math.min(300, Math.max(15, attempts * 15));
          await pool.query(
            `UPDATE memory_consolidation_jobs
             SET status = CASE WHEN attempts >= 10 THEN 'failed' ELSE 'pending' END,
                 last_error = $2,
                 run_after = NOW() + make_interval(secs => $3),
                 finished_at = NOW()
             WHERE id = $1`,
            [jobId, String(err), retrySeconds],
          );
          logger.warn('Deferred memory consolidation job failed', { jobId, error: String(err), attempts });
        }
      }
    } catch (err) {
      logger.warn('Deferred memory consolidation tick failed', { error: String(err) });
    } finally {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
      }
      client.release();
    }
  };

  const immediate = setTimeout(() => {
    tick().catch((err) => logger.warn('Initial deferred consolidation tick failed', { error: String(err) }));
  }, 2000);
  const timer = setInterval(() => {
    tick().catch((err) => logger.warn('Deferred consolidation tick failed', { error: String(err) }));
  }, Math.max(2000, intervalMs));

  logger.info('Memory consolidation worker started', { intervalMs, batchSize });

  return () => {
    clearTimeout(immediate);
    clearInterval(timer);
    logger.info('Memory consolidation worker stopped');
  };
}

