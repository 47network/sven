import { getPool } from '../db/pool.js';
import {
  extractEntities,
  extractRelations,
  storeEntities,
  storeRelations,
  storeEvidence,
  updateJobStatus,
} from '../services/KnowledgeGraphService.js';

/**
 * Knowledge Graph Extraction Worker
 * Processes background extraction jobs from the queue
 */

const pool = getPool();
const POLL_INTERVAL = 5000; // Poll every 5 seconds
let isRunning = false;
let pollIntervalHandle: NodeJS.Timeout | null = null;

/**
 * Start the extraction worker
 * Polls for pending jobs and processes them
 */
export async function startExtractionWorker(): Promise<void> {
  if (isRunning) {
    console.log('Extraction worker already running');
    return;
  }

  isRunning = true;
  console.log('Starting knowledge graph extraction worker...');

  // Start polling
  pollIntervalHandle = setInterval(async () => {
    try {
      if (!isRunning) return;
      await processPendingJobs();
    } catch (error) {
      console.error('Extraction worker error:', error);
    }
  }, POLL_INTERVAL);

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    console.log('Shutting down extraction worker...');
    stopExtractionWorker();
    process.exit(0);
  });
}

/**
 * Process all pending extraction jobs
 */
async function processPendingJobs(): Promise<void> {
  if (!isRunning) {
    return;
  }
  try {
    const result = await pool.query(
      `WITH claimed AS (
         SELECT id
         FROM kg_extraction_jobs
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT 5
         FOR UPDATE SKIP LOCKED
       )
       UPDATE kg_extraction_jobs j
       SET status = 'processing',
           started_at = CURRENT_TIMESTAMP
       FROM claimed
       WHERE j.id = claimed.id
       RETURNING j.*`
    );

    for (let index = 0; index < result.rows.length; index += 1) {
      if (!isRunning) {
        const remainingIds = result.rows.slice(index).map((row) => String(row.id));
        await requeueClaimedJobs(remainingIds);
        break;
      }
      const job = result.rows[index];
      await processJob(job);
    }
  } catch (error) {
    console.error('Failed to query pending jobs:', error);
  }
}

async function requeueClaimedJobs(jobIds: string[]): Promise<void> {
  if (!jobIds.length) return;
  try {
    await pool.query(
      `UPDATE kg_extraction_jobs
       SET status = 'pending',
           started_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1::uuid[])
         AND status = 'processing'`,
      [jobIds]
    );
  } catch (error) {
    console.error('Failed to requeue claimed extraction jobs during shutdown:', error);
  }
}

/**
 * Process a single extraction job
 */
async function processJob(job: {
  id: string;
  chat_id: string;
  message_id?: string;
  job_type: string;
  text_content?: string;
}): Promise<void> {
  try {
    // Get the message text to extract from
    let textContent = job.text_content;
    if (!textContent && job.message_id) {
      // Fall back to persisted message content when job payload omitted text.
      const msgResult = await pool.query(
        `SELECT content FROM messages WHERE id = $1 LIMIT 1`,
        [job.message_id]
      );
      textContent = msgResult.rows[0]?.content;
    }

    if (!textContent) {
      throw new Error('No text content to extract from');
    }

    // Cap text size to prevent resource exhaustion during entity extraction.
    const MAX_EXTRACTION_TEXT_LENGTH = 1_000_000;
    if (textContent.length > MAX_EXTRACTION_TEXT_LENGTH) {
      textContent = textContent.slice(0, MAX_EXTRACTION_TEXT_LENGTH);
    }

    let entityCount = 0;
    let relationCount = 0;

    // Extract entities if requested
    if (job.job_type === 'entity' || job.job_type === 'full_analysis') {
      const entities = await extractEntities(textContent, job.chat_id, job.message_id);
      const entityMap = await storeEntities(entities, 'extraction_worker', {
        chatId: job.chat_id,
        messageId: job.message_id,
      });

      await storeEvidence(entityMap, [], {
        type: 'message',
        id: job.message_id || 'unknown',
        chatId: job.chat_id,
        text: textContent,
      });

      entityCount = entities.length;
    }

    // Extract relations if requested
    if (job.job_type === 'relation' || job.job_type === 'full_analysis') {
      const entities = await extractEntities(textContent, job.chat_id, job.message_id);
      const relations = await extractRelations(textContent, entities);

      const entityMap = await storeEntities(entities, 'extraction_worker', {
        chatId: job.chat_id,
        messageId: job.message_id,
      });

      const relationIds = await storeRelations(relations, entityMap, 'extraction_worker');
      relationCount = relationIds.length;
    }

    // Mark as completed
    await updateJobStatus(job.id, 'completed', entityCount, relationCount);
    console.log(`Completed extraction job ${job.id}: ${entityCount} entities, ${relationCount} relations`);
  } catch (error) {
    console.error(`Failed to process job ${job.id}:`, error);
    await updateJobStatus(job.id, 'failed', 0, 0, (error as Error).message);
  }
}

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  running: boolean;
  uptime: number;
} {
  return {
    running: isRunning,
    uptime: process.uptime(),
  };
}

/**
 * Stop the extraction worker
 */
export function stopExtractionWorker(): void {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
  }
  isRunning = false;
  console.log('Extraction worker stopped');
}

/**
 * manually submit a job for processing (e.g., from API)
 */
export async function submitExtractionJob(
  chatId: string,
  messageId: string | null,
  textContent: string,
  jobType: 'entity' | 'relation' | 'full_analysis'
): Promise<string> {
  const jobId = (await pool.query(
    `INSERT INTO kg_extraction_jobs (chat_id, message_id, job_type, text_content, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [chatId, messageId, jobType, textContent, 'pending']
  )).rows[0].id;

  return jobId;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<any> {
  const result = await pool.query('SELECT * FROM kg_extraction_jobs WHERE id = $1', [jobId]);
  return result.rows[0] || null;
}

/**
 * Retry failed jobs (restart processing)
 */
export async function retryFailedJobs(): Promise<number> {
  const result = await pool.query(
    `UPDATE kg_extraction_jobs
     SET status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
     RETURNING id`
  );

  console.log(`Requeued ${result.rows.length} failed jobs`);
  return result.rows.length;
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(daysOld: number = 30): Promise<number> {
  const result = await pool.query(
    `DELETE FROM kg_extraction_jobs
     WHERE status IN ('completed', 'failed')
     AND created_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [daysOld]
  );

  console.log(`Cleaned up ${result.rows.length} old extraction jobs`);
  return result.rows.length;
}
