import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';

const logger = createLogger('emotional-intelligence');

export interface EmotionalState {
  id: string;
  user_id: string;
  organization_id: string;
  chat_id: string | null;
  message_id: string | null;
  detected_mood: string;
  sentiment_score: number;
  frustration_level: number;
  excitement_level: number;
  confusion_level: number;
  confidence: number;
  raw_signals: Record<string, unknown>;
  created_at: string;
}

export interface EmotionalAnalysis {
  mood: string;
  sentiment: number;
  frustration: number;
  excitement: number;
  confusion: number;
  confidence: number;
  signals: Record<string, unknown>;
}

/**
 * Keyword-based heuristic emotional analysis.
 * Uses lexical patterns to detect mood, sentiment, frustration,
 * excitement, and confusion from user text.
 *
 * This avoids an LLM round-trip for performance and cost.
 * Swap to LLM-based analysis when latency budget allows.
 */
export function analyzeText(text: string): EmotionalAnalysis {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const wordCount = words.length;

  // Signal accumulators
  let positiveSignals = 0;
  let negativeSignals = 0;
  let frustrationSignals = 0;
  let excitementSignals = 0;
  let confusionSignals = 0;

  const frustrationPatterns = [
    /\bnot working\b/, /\bdoesn'?t work\b/, /\bwon'?t\b/, /\bcan'?t\b/,
    /\bbroken\b/, /\bfailing\b/, /\bfailed\b/, /\berror\b/, /\bbug\b/,
    /\bstuck\b/, /\bfrustrat/i, /\bannoy/i, /\birrita/i, /\bwhy (is|does|won'?t|can'?t)\b/,
    /\bagain\b/, /\bstill\b.*\bnot\b/, /\bkeeps?\b/, /!!+/,
  ];

  const excitementPatterns = [
    /\b(amazing|awesome|fantastic|great|excellent|perfect|love|wonderful)\b/,
    /\bthank/i, /\bworks?\b.*\b(great|perfect|now)\b/, /!{2,}/,
    /\bfinally\b/, /\byess?\b/i, /\bcool\b/, /\bnice\b/,
  ];

  const confusionPatterns = [
    /\bconfus/i, /\bdon'?t understand\b/, /\bwhat (do you mean|is)\b/,
    /\bhow (do|does|can|should)\b/, /\bwhy\b/, /\bnot sure\b/,
    /\bunclear\b/, /\blost\b/, /\?\s*$/m, /\?{2,}/,
  ];

  const positiveWords = new Set([
    'good', 'great', 'thanks', 'thank', 'nice', 'love', 'perfect', 'excellent',
    'awesome', 'wonderful', 'helpful', 'works', 'solved', 'fixed', 'appreciate',
  ]);

  const negativeWords = new Set([
    'bad', 'wrong', 'broken', 'error', 'fail', 'hate', 'terrible', 'awful',
    'useless', 'stupid', 'horrible', 'worst', 'sucks', 'disappointing',
  ]);

  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, '');
    if (positiveWords.has(cleaned)) positiveSignals++;
    if (negativeWords.has(cleaned)) negativeSignals++;
  }

  for (const pattern of frustrationPatterns) {
    if (pattern.test(lower)) frustrationSignals++;
  }
  for (const pattern of excitementPatterns) {
    if (pattern.test(lower)) excitementSignals++;
  }
  for (const pattern of confusionPatterns) {
    if (pattern.test(lower)) confusionSignals++;
  }

  // Normalize to 0-1 range based on word count
  const normalize = (count: number, maxPatterns: number): number => {
    const density = wordCount > 0 ? count / Math.sqrt(wordCount) : 0;
    return Math.min(1, density / Math.sqrt(maxPatterns));
  };

  const frustration = normalize(frustrationSignals, frustrationPatterns.length);
  const excitement = normalize(excitementSignals, excitementPatterns.length);
  const confusion = normalize(confusionSignals, confusionPatterns.length);

  // Sentiment: -1 to +1
  const rawSentiment = positiveSignals - negativeSignals;
  const maxSignals = Math.max(1, positiveSignals + negativeSignals);
  const sentiment = Math.max(-1, Math.min(1, rawSentiment / maxSignals));

  // Confidence based on signal strength
  const totalSignals = positiveSignals + negativeSignals + frustrationSignals + excitementSignals + confusionSignals;
  const confidence = Math.min(1, totalSignals > 0 ? Math.min(0.9, 0.3 + totalSignals * 0.1) : 0.2);

  // Determine mood
  let mood = 'neutral';
  if (frustration > 0.4) mood = 'frustrated';
  else if (excitement > 0.4) mood = 'excited';
  else if (confusion > 0.4) mood = 'confused';
  else if (sentiment > 0.3) mood = 'positive';
  else if (sentiment < -0.3) mood = 'negative';

  return {
    mood,
    sentiment,
    frustration,
    excitement,
    confusion,
    confidence,
    signals: {
      positive_signals: positiveSignals,
      negative_signals: negativeSignals,
      frustration_signals: frustrationSignals,
      excitement_signals: excitementSignals,
      confusion_signals: confusionSignals,
      word_count: wordCount,
    },
  };
}

export class EmotionalIntelligenceService {
  constructor(private pool: pg.Pool) {}

  /**
   * Analyze text and record the emotional state for a user message.
   */
  async recordEmotionalState(params: {
    user_id: string;
    organization_id: string;
    chat_id?: string | null;
    message_id?: string | null;
    text: string;
  }): Promise<EmotionalState> {
    const analysis = analyzeText(params.text);
    const id = uuidv7();

    try {
      const res = await this.pool.query(
        `INSERT INTO emotional_states
         (id, user_id, organization_id, chat_id, message_id,
          detected_mood, sentiment_score, frustration_level,
          excitement_level, confusion_level, confidence, raw_signals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
         RETURNING *`,
        [
          id,
          params.user_id,
          params.organization_id,
          params.chat_id ?? null,
          params.message_id ?? null,
          analysis.mood,
          analysis.sentiment,
          analysis.frustration,
          analysis.excitement,
          analysis.confusion,
          analysis.confidence,
          JSON.stringify(analysis.signals),
        ],
      );
      return res.rows[0] as EmotionalState;
    } catch (err) {
      logger.warn('Failed to record emotional state', { error: String(err) });
      // Return the analysis without persisting — non-blocking
      return {
        id,
        user_id: params.user_id,
        organization_id: params.organization_id,
        chat_id: params.chat_id ?? null,
        message_id: params.message_id ?? null,
        detected_mood: analysis.mood,
        sentiment_score: analysis.sentiment,
        frustration_level: analysis.frustration,
        excitement_level: analysis.excitement,
        confusion_level: analysis.confusion,
        confidence: analysis.confidence,
        raw_signals: analysis.signals,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Get emotional history for a user, optionally scoped to a chat.
   */
  async getHistory(params: {
    user_id: string;
    organization_id: string;
    chat_id?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: EmotionalState[]; total: number }> {
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const offset = Math.max(0, Number(params.offset || 0));

    let where = 'WHERE user_id = $1 AND organization_id = $2';
    const queryParams: unknown[] = [params.user_id, params.organization_id];

    if (params.chat_id) {
      queryParams.push(params.chat_id);
      where += ` AND chat_id = $${queryParams.length}`;
    }

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM emotional_states ${where}`,
      queryParams,
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const dataParams = [...queryParams, limit, offset];
    const dataRes = await this.pool.query(
      `SELECT * FROM emotional_states ${where}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: dataRes.rows as EmotionalState[], total };
  }

  /**
   * Get aggregated emotional summary for a user over a time window.
   */
  async getSummary(params: {
    user_id: string;
    organization_id: string;
    days?: number;
  }): Promise<{
    avg_sentiment: number;
    avg_frustration: number;
    avg_excitement: number;
    avg_confusion: number;
    dominant_mood: string;
    sample_count: number;
  }> {
    const days = Math.max(1, Math.min(365, Number(params.days || 30)));

    const res = await this.pool.query(
      `SELECT
         AVG(sentiment_score)::float8 AS avg_sentiment,
         AVG(frustration_level)::float8 AS avg_frustration,
         AVG(excitement_level)::float8 AS avg_excitement,
         AVG(confusion_level)::float8 AS avg_confusion,
         MODE() WITHIN GROUP (ORDER BY detected_mood) AS dominant_mood,
         COUNT(*)::int AS sample_count
       FROM emotional_states
       WHERE user_id = $1
         AND organization_id = $2
         AND created_at > NOW() - make_interval(days => $3)`,
      [params.user_id, params.organization_id, days],
    );

    const row = res.rows[0] || {};
    return {
      avg_sentiment: Number(row.avg_sentiment || 0),
      avg_frustration: Number(row.avg_frustration || 0),
      avg_excitement: Number(row.avg_excitement || 0),
      avg_confusion: Number(row.avg_confusion || 0),
      dominant_mood: String(row.dominant_mood || 'neutral'),
      sample_count: Number(row.sample_count || 0),
    };
  }
}
