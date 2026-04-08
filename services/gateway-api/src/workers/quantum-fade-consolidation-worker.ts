import pg from 'pg';
import { createLogger } from '@sven/shared';
import {
  applyQuantumFade,
  createMemoryAdapter,
  type QuantumFadeConfig,
} from '../services/MemoryStore.js';
import { MemoryConsentService } from '../services/MemoryConsentService.js';

const logger = createLogger('quantum-fade-consolidation-worker');
const ADVISORY_LOCK_KEY = 470022;
const DEFAULT_INTERVAL_MS = 60_000 * 30; // 30 minutes

type StopFn = () => void;

/**
 * Quantum-fade consolidation sweep worker.
 *
 * Periodically scans memories whose decay(t) < consolidation_threshold,
 * extracts core insights, promotes them to knowledge graph nodes,
 * and archives the originals.
 *
 * Also enforces per-user retention policies (GDPR Art.17).
 */
export async function startQuantumFadeConsolidationWorker(pool: pg.Pool): Promise<StopFn> {
  const intervalMs = Math.max(
    10_000,
    Number(process.env.QUANTUM_FADE_CONSOLIDATION_INTERVAL_MS || DEFAULT_INTERVAL_MS),
  );

  const consentService = new MemoryConsentService(pool);

  const tick = async () => {
    const client = await pool.connect();
    let lockAcquired = false;

    try {
      const lockRes = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [ADVISORY_LOCK_KEY],
      );
      lockAcquired = Boolean(lockRes.rows[0]?.locked);
      if (!lockAcquired) return;

      // Load global quantum fade config
      const adapter = createMemoryAdapter(pool);
      let qfConfig: QuantumFadeConfig;
      if ('getQuantumFadeConfig' in adapter && typeof (adapter as any).getQuantumFadeConfig === 'function') {
        qfConfig = await (adapter as any).getQuantumFadeConfig(null);
      } else {
        qfConfig = {
          gamma_base: 0.05,
          amplitude: 0.3,
          omega: 0.5,
          consolidation_threshold: 0.15,
          resonance_factor: 0.2,
          consolidation_interval_hours: 6,
          max_memory_budget_mb: 512,
        };
      }

      // 1. Find quantum_fade memories that might be below threshold
      const candidates = await client.query(
        `SELECT id, key, value, user_id, organization_id, importance,
                gamma, amplitude, omega, phase_offset,
                resonance_boost_count, created_at
         FROM memories
         WHERE decay_type = 'quantum_fade'
           AND archived_at IS NULL
           AND consolidation_status IS NULL
         ORDER BY created_at ASC
         LIMIT 100`,
      );

      let consolidated = 0;
      let skipped = 0;

      for (const memory of candidates.rows as any[]) {
        const daysSinceCreation = Math.max(0, (Date.now() - new Date(memory.created_at).getTime()) / 86400000);
        const strength = applyQuantumFade(
          1.0,
          daysSinceCreation,
          Number(memory.gamma) || qfConfig.gamma_base,
          Number(memory.amplitude) || qfConfig.amplitude,
          Number(memory.omega) || qfConfig.omega,
          Number(memory.phase_offset) || 0,
          Number(memory.resonance_boost_count) || 0,
          qfConfig.resonance_factor,
        );

        if (strength >= qfConfig.consolidation_threshold) {
          skipped++;
          continue;
        }

        // Check user consent for consolidation
        if (memory.user_id && memory.organization_id) {
          const consented = await consentService.isFeatureConsented(
            memory.user_id,
            memory.organization_id,
            'consolidation',
          );
          if (!consented) {
            // No consent → just archive without consolidation
            await client.query(
              `UPDATE memories
               SET consolidation_status = 'archived_no_consent', archived_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [memory.id],
            );
            continue;
          }
        }

        // Mark as pending consolidation
        await client.query(
          `UPDATE memories
           SET consolidation_status = 'pending', updated_at = NOW()
           WHERE id = $1 AND consolidation_status IS NULL`,
          [memory.id],
        );

        try {
          // Extract core insight — simple heuristic extraction
          // (LLM-based extraction can be added later when latency budget allows)
          const coreInsight = extractCoreInsight(
            String(memory.key || ''),
            String(memory.value || ''),
          );

          // Create KG entity for the consolidated insight
          const kgNodeId = await promoteToKnowledgeGraph(client, {
            insight: coreInsight,
            source_memory_id: memory.id,
            user_id: memory.user_id,
            organization_id: memory.organization_id,
            importance: Number(memory.importance || 1),
            reference_count: Number(memory.resonance_boost_count || 0),
          });

          // Mark memory as consolidated
          await client.query(
            `UPDATE memories
             SET consolidation_status = 'consolidated',
                 consolidated_kg_node_id = $2,
                 archived_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [memory.id, kgNodeId],
          );

          consolidated++;
        } catch (err) {
          // Revert pending status
          await client.query(
            `UPDATE memories
             SET consolidation_status = NULL, updated_at = NOW()
             WHERE id = $1`,
            [memory.id],
          );
          logger.warn('Failed to consolidate memory', { id: memory.id, error: String(err) });
        }
      }

      // 2. Apply retention policies
      const orgs = await client.query(
        `SELECT DISTINCT organization_id FROM memory_consent
         WHERE retention_days IS NOT NULL AND consent_given = true`,
      );
      let retentionDeleted = 0;
      for (const org of orgs.rows as any[]) {
        if (org.organization_id) {
          retentionDeleted += await consentService.applyRetentionPolicy(org.organization_id);
        }
      }

      if (consolidated > 0 || retentionDeleted > 0) {
        logger.info('Quantum fade consolidation sweep complete', {
          candidates: candidates.rows.length,
          consolidated,
          skipped,
          retention_deleted: retentionDeleted,
        });
      }
    } catch (err) {
      logger.warn('Quantum fade consolidation tick failed', { error: String(err) });
    } finally {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
      }
      client.release();
    }
  };

  const immediate = setTimeout(() => {
    tick().catch((err) => logger.warn('Initial quantum fade consolidation tick failed', { error: String(err) }));
  }, 5000);

  const timer = setInterval(() => {
    tick().catch((err) => logger.warn('Quantum fade consolidation tick failed', { error: String(err) }));
  }, intervalMs);

  logger.info('Quantum fade consolidation worker started', { intervalMs });

  return () => {
    clearTimeout(immediate);
    clearInterval(timer);
    logger.info('Quantum fade consolidation worker stopped');
  };
}

/**
 * Extract a concise core insight from memory key/value.
 * Heuristic extraction — keeps the essence, drops conversational context.
 */
function extractCoreInsight(key: string, value: string): string {
  // Combine key and value, strip timestamps and filler
  const combined = `${key}: ${value}`.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, '').trim();
  // Take first 500 chars as the core insight
  return combined.length > 500 ? combined.slice(0, 500) : combined;
}

/**
 * Promote a fading memory's core insight to a knowledge graph entity.
 */
async function promoteToKnowledgeGraph(
  client: pg.PoolClient,
  params: {
    insight: string;
    source_memory_id: string;
    user_id: string | null;
    organization_id: string | null;
    importance: number;
    reference_count: number;
  },
): Promise<string> {
  const { nanoid } = await import('nanoid');
  const id = nanoid();

  // Confidence: base 0.5, boosted by importance and references
  const confidence = Math.min(
    1.0,
    0.5 + (params.importance / 10) + (params.reference_count * 0.02),
  );

  await client.query(
    `INSERT INTO kg_entities (id, type, name, description, confidence, created_by, metadata)
     VALUES ($1, 'consolidated_insight', $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (name, type) DO UPDATE SET
       confidence = GREATEST(kg_entities.confidence, EXCLUDED.confidence),
       metadata = kg_entities.metadata || EXCLUDED.metadata,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      params.insight.slice(0, 200),
      params.insight,
      confidence,
      params.user_id,
      JSON.stringify({
        source: 'quantum_fade_consolidation',
        source_memory_id: params.source_memory_id,
        organization_id: params.organization_id,
        reference_count: params.reference_count,
        consolidated_at: new Date().toISOString(),
      }),
    ],
  );

  return id;
}
