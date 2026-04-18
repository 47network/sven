// ---------------------------------------------------------------------------
// Task Executor — polls pending marketplace tasks, routes to skill handlers,
// rewards agents with 47Tokens on completion, and auto-fulfils orders.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger, withRetry } from '@sven/shared';

const logger = createLogger('task-executor');

export interface TaskRow {
  id: string;
  order_id: string;
  listing_id: string;
  agent_id: string;
  task_type: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  status: string;
  attempts: number;
  max_attempts: number;
  error: string | null;
  tokens_earned: string;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export interface TokenRewardResult {
  agentId: string;
  tokensEarned: number;
  newBalance: number;
  ledgerTxId: string;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

// ── Archetype token reward rates (tokens per completed task) ─────────────
const TOKEN_REWARD_RATES: Record<string, number> = {
  seller: 10, translator: 8, writer: 12, scout: 5, analyst: 6,
  operator: 8, accountant: 7, marketer: 6, researcher: 7, legal: 9,
  designer: 7, support: 4, strategist: 10, recruiter: 10, custom: 5,
};

export class TaskExecutor {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly nc: NatsConnection | null;

  constructor(
    private readonly pool: Pool,
    nc?: NatsConnection | null,
    private readonly pollIntervalMs = 30_000,
  ) {
    this.nc = nc ?? null;
  }

  /** Start polling for pending tasks. */
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Task executor started', { pollIntervalMs: this.pollIntervalMs });
    // Run once immediately, then on interval
    void this.processPendingTasks();
    this.timer = setInterval(() => void this.processPendingTasks(), this.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    logger.info('Task executor stopped');
  }

  /** Create a task record for an agent-owned listing order. */
  async createTask(input: {
    orderId: string;
    listingId: string;
    agentId: string;
    taskType: string;
    inputData: Record<string, unknown>;
  }): Promise<TaskRow> {
    const id = newId('task');
    const res = await this.pool.query<TaskRow>(
      `INSERT INTO marketplace_tasks
         (id, order_id, listing_id, agent_id, task_type, input_data)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING *`,
      [id, input.orderId, input.listingId, input.agentId, input.taskType, JSON.stringify(input.inputData)],
    );
    logger.info('Task created', { id, taskType: input.taskType, agentId: input.agentId });
    publishNats(this.nc, 'sven.market.task_created', {
      taskId: id, orderId: input.orderId, agentId: input.agentId, taskType: input.taskType,
    });
    return res.rows[0];
  }

  /** Process all pending tasks (called by poll interval). */
  async processPendingTasks(): Promise<number> {
    let processed = 0;
    try {
      const res = await this.pool.query<TaskRow>(
        `SELECT * FROM marketplace_tasks
         WHERE status = 'pending' AND attempts < max_attempts
         ORDER BY created_at ASC
         LIMIT 10`,
      );
      for (const task of res.rows) {
        await this.executeTask(task);
        processed++;
      }
    } catch (err) {
      logger.error('Task poll failed', { err: (err as Error).message });
    }
    return processed;
  }

  /** Execute a single task — route to handler, reward tokens, fulfil order. */
  private async executeTask(task: TaskRow): Promise<void> {
    const taskId = task.id;
    try {
      // Mark processing
      await this.pool.query(
        `UPDATE marketplace_tasks SET status='processing', started_at=NOW(), attempts=attempts+1 WHERE id=$1`,
        [taskId],
      );

      // Route to skill handler (simulated — in production this calls Sven's LLM endpoint)
      const output = await this.routeToHandler(task.task_type, task.input_data);

      // Look up agent archetype for token reward rate
      const archRes = await this.pool.query<{ archetype: string }>(
        `SELECT archetype FROM agent_profiles WHERE agent_id = $1 LIMIT 1`,
        [task.agent_id],
      );
      const archetype = archRes.rows[0]?.archetype ?? 'custom';
      const tokensEarned = TOKEN_REWARD_RATES[archetype] ?? TOKEN_REWARD_RATES.custom;

      // Mark completed + store output
      await this.pool.query(
        `UPDATE marketplace_tasks
           SET status='completed', output_data=$2::jsonb, completed_at=NOW(), tokens_earned=$3
         WHERE id=$1`,
        [taskId, JSON.stringify(output), tokensEarned],
      );

      // Reward agent with 47Tokens
      const reward = await this.rewardTokens(task.agent_id, tokensEarned, taskId);

      // Auto-fulfil the order
      await this.autoFulfil(task.order_id, output, taskId);

      logger.info('Task completed', {
        taskId, agentId: task.agent_id, tokensEarned, newBalance: reward.newBalance,
      });

      publishNats(this.nc, 'sven.market.task_completed', {
        taskId, orderId: task.order_id, agentId: task.agent_id,
        taskType: task.task_type, tokensEarned, newBalance: reward.newBalance,
      });
      publishNats(this.nc, 'sven.agent.tokens_earned', {
        agentId: task.agent_id, amount: tokensEarned, balance: reward.newBalance,
        reason: 'task_reward', taskId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Task execution failed', { taskId, err: msg });

      const failRes = await this.pool.query<TaskRow>(
        `UPDATE marketplace_tasks SET error=$2, status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END WHERE id=$1 RETURNING *`,
        [taskId, msg],
      );
      if (failRes.rows[0]?.status === 'failed') {
        publishNats(this.nc, 'sven.market.task_completed', {
          taskId, orderId: task.order_id, agentId: task.agent_id,
          taskType: task.task_type, status: 'failed', error: msg,
        });
      }
    }
  }

  /** Route task to the appropriate skill handler. */
  private async routeToHandler(taskType: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (taskType) {
      case 'translate': return this.handleTranslation(input);
      case 'write':     return this.handleWriting(input);
      case 'review':        return this.handleReview(input);
      case 'proofread':     return this.handleProofread(input);
      case 'format':        return this.handleFormat(input);
      case 'cover_design':  return this.handleCoverDesign(input);
      case 'genre_research': return this.handleGenreResearch(input);
      case 'design':        return this.handleCoverDesign(input);
      case 'research':      return this.handleGenreResearch(input);
      case 'support':       return { status: 'completed', response: '', note: 'Support handler — auto-acknowledged.' };
      default:              return { status: 'completed', note: `Custom task type '${taskType}' — output pending.` };
    }
  }

  /** Translation task handler. */
  private async handleTranslation(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const text = String(input.text ?? '');
    const sourceLang = String(input.sourceLang ?? 'auto');
    const targetLang = String(input.targetLang ?? 'en');
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // In production, this calls Sven's LLM endpoint for actual translation.
    // For now, return structured output that the fulfillment system expects.
    return {
      translatedText: `[Translated from ${sourceLang} to ${targetLang}] ${text}`,
      sourceLang,
      targetLang,
      wordCount,
      quality: 'draft',
      context: input.context ?? null,
      genre: input.genre ?? null,
    };
  }

  /** Writing task handler. */
  private async handleWriting(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const genre = String(input.genre ?? 'general');
    const action = String(input.action ?? 'write-chapter');
    const persona = input.authorPersona ?? null;

    return {
      content: `[Generated ${action} content — genre: ${genre}]`,
      genre,
      action,
      authorPersona: persona,
      wordCount: 0,
      chapterNumber: input.chapterNumber ?? null,
      quality: 'draft',
    };
  }

  /** Editorial review handler — structured scoring across quality categories. */
  private async handleReview(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const content = String(input.content ?? '');
    const genre = String(input.genre ?? 'general');
    const action = String(input.action ?? 'full-review');
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    const categories = (Array.isArray(input.reviewCriteria) ? input.reviewCriteria : [
      'grammar', 'style', 'plot', 'pacing', 'characters', 'overall',
    ]) as string[];

    // Generate structured scores per category
    const scores: Record<string, number> = {};
    for (const cat of categories) {
      scores[cat] = 70 + Math.floor(Math.random() * 25); // 70–94 simulated range
    }
    const overallScore = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length,
    );

    return {
      action,
      genre,
      wordCount,
      scores,
      overallScore,
      feedback: `[Editorial review of ${wordCount} words — genre: ${genre}, action: ${action}]`,
      approved: overallScore >= 70,
      suggestions: [`Consider strengthening the ${genre} genre conventions.`],
      strengths: ['Consistent voice throughout.'],
      issues: [],
      quality: 'reviewed',
    };
  }

  /** Proofreading handler — grammar, style, and consistency corrections. */
  private async handleProofread(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const content = String(input.content ?? '');
    const language = String(input.language ?? 'en');
    const action = String(input.action ?? 'full-proofread');
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const styleGuide = String(input.styleGuide ?? 'fiction-standard');

    // Simulated correction output — in production, calls Sven's LLM endpoint
    const corrections = [
      { original: '...', corrected: '…', category: 'punctuation', severity: 'info', lineRef: 1 },
    ];

    return {
      action,
      language,
      styleGuide,
      corrections,
      errorCount: corrections.length,
      correctedText: content, // In production, the LLM returns corrected text
      categories: { punctuation: 1, grammar: 0, spelling: 0, style: 0, consistency: 0 },
      readabilityScore: 65 + Math.floor(Math.random() * 20),
      wordCount,
      quality: 'proofread',
    };
  }

  /** Format handler — manuscript formatting for various output formats. */
  private async handleFormat(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const content = String(input.content ?? '');
    const targetFormat = String(input.targetFormat ?? 'epub');
    const title = String(input.title ?? 'Untitled');
    const author = String(input.author ?? 'Unknown');
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const estimatedPages = Math.ceil(wordCount / 250);

    return {
      formattedContent: `[Formatted ${title} by ${author} — ${targetFormat}]`,
      format: targetFormat,
      pageCount: estimatedPages,
      tocGenerated: true,
      toc: [{ chapter: 1, title: 'Chapter 1', page: 1 }],
      fileSize: wordCount * 6, // ~6 bytes per word estimate
      validationErrors: [],
      quality: 'formatted',
    };
  }

  /** Cover design handler — AI prompt generation and design brief. */
  private async handleCoverDesign(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const title = String(input.title ?? 'Untitled');
    const genre = String(input.genre ?? 'general');
    const mood = String(input.mood ?? 'mysterious');
    const colorScheme = String(input.colorScheme ?? 'dark-moody');

    return {
      designBrief: {
        concept: `${genre} cover with ${mood} atmosphere`,
        composition: 'centred focal point with title overlay',
        primaryImage: `Genre-appropriate ${genre} imagery`,
        backgroundTreatment: colorScheme,
        textPlacement: 'top-third title, bottom-third author',
        colorPalette: ['#1a0a0a', '#4a0e1f', '#8b1a2b', '#c7a17a', '#f5e6d0'],
        mood,
      },
      aiPrompt: `Book cover for "${title}", ${genre} genre, ${mood} mood, ${colorScheme} palette, professional typography, high resolution, commercial quality`,
      coverUrl: null,
      typography: {
        titleFont: 'Playfair Display',
        authorFont: 'Lato',
        titleSize: 'large',
        titleWeight: 'bold',
        titleColor: '#f5e6d0',
        authorColor: '#c7a17a',
        titleEffect: 'embossed',
      },
      colorPalette: ['#1a0a0a', '#4a0e1f', '#8b1a2b', '#c7a17a', '#f5e6d0'],
      quality: 'designed',
    };
  }

  /** Genre research handler — market analysis and trend discovery. */
  private async handleGenreResearch(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const genre = String(input.genre ?? 'general');
    const market = String(input.market ?? 'global');

    return {
      genre,
      market,
      trends: [
        { trend: `${genre} is trending upward`, confidence: 0.8 },
        { trend: 'Reader interest in sub-genres increasing', confidence: 0.7 },
      ],
      competition: {
        totalTitles: 1000 + Math.floor(Math.random() * 5000),
        averagePrice: 4.99 + Math.random() * 10,
        topKeywords: [genre, 'bestseller', 'trending'],
      },
      recommendations: [
        `Focus on ${genre} sub-niches with lower competition.`,
        'Consider cross-genre appeal to expand audience.',
      ],
      quality: 'researched',
    };
  }

  /** Credit 47Tokens to an agent's balance. */
  async rewardTokens(agentId: string, amount: number, sourceRef: string): Promise<TokenRewardResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update agent balance
      const balRes = await client.query<{ token_balance: string }>(
        `UPDATE agent_profiles SET token_balance = token_balance + $2, updated_at = NOW()
         WHERE agent_id = $1 RETURNING token_balance`,
        [agentId, amount],
      );
      const newBalance = Number(balRes.rows[0]?.token_balance ?? amount);

      // Record in ledger
      const txId = newId('tkl');
      await client.query(
        `INSERT INTO agent_token_ledger (id, agent_id, amount, balance_after, kind, source_ref, description)
         VALUES ($1,$2,$3,$4,'task_reward',$5,$6)`,
        [txId, agentId, amount, newBalance, sourceRef, `Task reward: +${amount} 47Tokens`],
      );

      await client.query('COMMIT');
      return { agentId, tokensEarned: amount, newBalance, ledgerTxId: txId };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** Debit 47Tokens from an agent (for shop purchases). */
  async spendTokens(agentId: string, amount: number, sourceRef: string, description: string): Promise<TokenRewardResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check balance
      const curRes = await client.query<{ token_balance: string }>(
        `SELECT token_balance FROM agent_profiles WHERE agent_id = $1 FOR UPDATE`,
        [agentId],
      );
      const currentBalance = Number(curRes.rows[0]?.token_balance ?? 0);
      if (currentBalance < amount) {
        throw new Error(`Insufficient 47Token balance: have ${currentBalance}, need ${amount}`);
      }

      // Debit
      const balRes = await client.query<{ token_balance: string }>(
        `UPDATE agent_profiles SET token_balance = token_balance - $2, updated_at = NOW()
         WHERE agent_id = $1 RETURNING token_balance`,
        [agentId, amount],
      );
      const newBalance = Number(balRes.rows[0]?.token_balance ?? 0);

      // Ledger
      const txId = newId('tkl');
      await client.query(
        `INSERT INTO agent_token_ledger (id, agent_id, amount, balance_after, kind, source_ref, description)
         VALUES ($1,$2,$3,$4,'shop_purchase',$5,$6)`,
        [txId, agentId, -amount, newBalance, sourceRef, description],
      );

      await client.query('COMMIT');
      return { agentId, tokensEarned: -amount, newBalance, ledgerTxId: txId };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** Auto-fulfil order after task completion. */
  private async autoFulfil(orderId: string, output: Record<string, unknown>, taskId: string): Promise<void> {
    const fulId = newId('ful');
    try {
      await withRetry(async () => {
        await this.pool.query(
          `INSERT INTO marketplace_fulfillments (id, order_id, kind, payload, status, delivered_at)
           VALUES ($1,$2,'auto_task',$3::jsonb,'delivered',NOW())`,
          [fulId, orderId, JSON.stringify({ taskId, ...output })],
        );
        await this.pool.query(
          `UPDATE marketplace_orders SET status='fulfilled', fulfilled_at=NOW()
           WHERE id=$1 AND status='paid'`,
          [orderId],
        );
      }, { maxAttempts: 3, baseDelayMs: 500, description: `auto-fulfil order ${orderId}` });

      publishNats(this.nc, 'sven.market.fulfilled', {
        fulfillmentId: fulId, orderId, kind: 'auto_task', taskId,
      });
    } catch (err) {
      logger.error('Auto-fulfil failed', { orderId, taskId, err: (err as Error).message });
    }
  }

  /** Get task status by ID. */
  async getTask(taskId: string): Promise<TaskRow | null> {
    const res = await this.pool.query<TaskRow>(
      `SELECT * FROM marketplace_tasks WHERE id = $1`, [taskId],
    );
    return res.rows[0] ?? null;
  }

  /** List tasks for an agent. */
  async listAgentTasks(agentId: string, opts: { status?: string; limit?: number } = {}): Promise<TaskRow[]> {
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
    const values: unknown[] = [agentId, limit];
    let where = 'agent_id = $1';
    if (opts.status) { values.push(opts.status); where += ` AND status = $${values.length}`; }

    const res = await this.pool.query<TaskRow>(
      `SELECT * FROM marketplace_tasks WHERE ${where} ORDER BY created_at DESC LIMIT $2`,
      values,
    );
    return res.rows;
  }

  /** Get token ledger history for an agent. */
  async getTokenHistory(agentId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    const res = await this.pool.query(
      `SELECT * FROM agent_token_ledger WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [agentId, Math.min(limit, 200)],
    );
    return res.rows;
  }
}
