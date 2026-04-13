import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  InstrumentRegistry, normalizeCandle, validateCandle,
  calculateSpread, detectDataGap,
  type Candle, type Instrument, type Timeframe,
} from '@sven/trading-platform/market-data';
import {
  StrategyRegistry, aggregateSignals,
  DEFAULT_LOOP_CONFIG, buildDecision,
  type Signal, type StrategyContext, type RiskConfig,
} from '@sven/trading-platform/engine';
import {
  runAllRiskChecks, riskChecksPassed,
  fixedFractionalSize, volatilityBasedSize,
} from '@sven/trading-platform/risk';
import {
  createOrder, applyTransition, computePortfolioState,
  computeTradePerformance, createTokenAccount, TOKEN_CONFIG,
  type OrderSide, type OrderType, type Order,
} from '@sven/trading-platform/oms';
import {
  tokenizeCandle, generateMultiHorizon, ensembleVote,
  type Prediction, type PredictionModel,
} from '@sven/trading-platform/predictions';
import {
  classifyImpact, scoreSentiment, extractEntities as extractNewsEntities,
  processNewsItem, TRADING_NATS_SUBJECTS,
} from '@sven/trading-platform/news';
import {
  makeAutonomousDecision,
  runKronosPipeline,
  runMiroFishSimulation,
  newsToSignal,
  adjustWeights,
  recordPredictionOutcome,
  checkCircuitBreaker,
  resetCircuitBreaker,
  createTradingEvent,
  DEFAULT_LEARNING_METRICS,
  DEFAULT_CIRCUIT_BREAKER,
  type SvenTradingStatus,
  type LearningMetrics,
  type CircuitBreakerState,
  type TradingEvent,
  type AutonomousDecisionInput,
  type AutonomousDecisionOutput,
} from '@sven/trading-platform/autonomous';
import {
  createDefaultBrokerRegistry,
  type BrokerName,
} from '@sven/trading-platform/broker';
import {
  runBacktest, BUILT_IN_STRATEGIES,
  type BacktestConfig,
} from '@sven/trading-platform/backtest';
import {
  buildPortfolioAnalytics, buildEquityCurve, computeDrawdowns,
  computeRollingMetrics, computeExposure,
} from '@sven/trading-platform/analytics';
import {
  AlertEngine, createAlertEngine,
  createPriceAlert, createSignalAlert, createDrawdownAlert,
  createVolatilityAlert, createNewsAlert,
  type AlertDelivery, type AlertCondition, type AlertPriority,
} from '@sven/trading-platform/alerts';

const logger = createLogger('gateway-trading');

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

async function requireTenantMembership(pool: pg.Pool, request: any, reply: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  const userId = String(request.userId || '').trim();
  if (!orgId) {
    reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    return null;
  }
  const membership = await pool.query(
    `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [orgId, userId],
  );
  if (membership.rows.length === 0) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Active organization membership required' } });
    return null;
  }
  return orgId;
}

/** Resolve org for public dashboard: use authenticated user's org, or fall back to first org */
let _cachedDefaultOrg: string | null = null;
async function resolvePublicOrg(pool: pg.Pool, request: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  if (orgId) return orgId;
  if (_cachedDefaultOrg) return _cachedDefaultOrg;
  try {
    const { rows } = await pool.query(`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`);
    if (rows.length > 0) {
      _cachedDefaultOrg = rows[0].id;
      return _cachedDefaultOrg;
    }
  } catch { /* schema compat */ }
  return null;
}

export async function registerTradingRoutes(app: FastifyInstance, pool: pg.Pool) {
  /* ── Rate limiting for trading endpoints ──────────────────── */
  await app.register(rateLimit as any, {
    global: false,           // only apply where config.rateLimit is set
    max: 60,                 // default fallback: 60 req/min
    timeWindow: '1 minute',
    keyGenerator: (req: any) => req.userId || req.ip,
    errorResponseBuilder: (_req: any, context: any) => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
        retryAfter: Math.ceil(context.ttl / 1000),
      },
    }),
  });

  const requireAuth = requireRole(pool, 'admin', 'user');

  const instrumentRegistry = new InstrumentRegistry();
  const strategyRegistry = new StrategyRegistry();

  // ── Instruments ─────────────────────────────────────────────────────
  app.get('/v1/trading/instruments', async (request, reply) => {
    try {
      const instruments = instrumentRegistry.list();
      return { success: true, data: instruments };
    } catch (err) {
      logger.error('trading/instruments error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list instruments' } });
    }
  });

  // ── Strategies ──────────────────────────────────────────────────────
  app.get('/v1/trading/strategies', async (request, reply) => {
    try {
      const strategies = strategyRegistry.list();
      return { success: true, data: strategies };
    } catch (err) {
      logger.error('trading/strategies error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list strategies' } });
    }
  });

  app.post('/v1/trading/signals/aggregate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { signals } = request.body as Record<string, any>;
    if (!Array.isArray(signals) || signals.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'signals array required' } });
    }
    try {
      const aggregated = aggregateSignals(signals as Signal[]);
      return { success: true, data: { signal: aggregated } };
    } catch (err) {
      logger.error('trading/signals/aggregate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Signal aggregation failed' } });
    }
  });

  // ── Risk Management ─────────────────────────────────────────────────
  app.post('/v1/trading/risk/check', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { signal, context, config } = request.body as Record<string, any>;
    if (!signal || !context || !config) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'signal, context, and config required' } });
    }
    try {
      const results = runAllRiskChecks(signal as Signal, context as StrategyContext, config as RiskConfig);
      const passed = riskChecksPassed(results);
      return { success: true, data: { results, passed } };
    } catch (err) {
      logger.error('trading/risk/check error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Risk check failed' } });
    }
  });

  app.post('/v1/trading/risk/position-size', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { capital, risk_pct, entry_price, stop_loss_price, method = 'fixed_fractional' } = request.body as Record<string, any>;
    if (!capital || !risk_pct || !entry_price || !stop_loss_price) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'capital, risk_pct, entry_price, and stop_loss_price required' } });
    }
    try {
      const size = method === 'volatility'
        ? volatilityBasedSize(capital, risk_pct, entry_price, stop_loss_price)
        : fixedFractionalSize(capital, risk_pct, entry_price, stop_loss_price);
      return { success: true, data: { size, method } };
    } catch (err) {
      logger.error('trading/risk/position-size error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Position sizing failed' } });
    }
  });

  // ── Order Management ────────────────────────────────────────────────
  app.post('/v1/trading/orders', { preHandler: [requireAuth], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.symbol || !body.side || !body.type || !body.quantity) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol, side, type, and quantity required' } });
    }
    try {
      const order = createOrder({
        strategyId: body.strategy_id || 'manual',
        symbol: body.symbol,
        exchange: body.exchange || { name: 'default', type: 'spot' },
        side: body.side as OrderSide,
        type: body.type as OrderType,
        quantity: body.quantity,
        price: body.price,
        stopPrice: body.stop_price,
      });
      try {
        await pool.query(
          `INSERT INTO trading_orders (id, org_id, user_id, symbol, side, type, quantity, price, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [order.id, orgId, request.userId, order.symbol, order.side, order.type, order.quantity, order.price || 0, order.status],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: order };
    } catch (err) {
      logger.error('trading/orders error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Order creation failed' } });
    }
  });

  app.get('/v1/trading/orders', async (request, reply) => {
    const orgId = await resolvePublicOrg(pool, request);
    try {
      const { rows } = await pool.query(
        `SELECT id, symbol, side, type, quantity, price, status, created_at FROM trading_orders${orgId ? ' WHERE org_id = $1' : ''} ORDER BY created_at DESC LIMIT 100`,
        orgId ? [orgId] : [],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: [] };
      }
      throw err;
    }
  });

  // ── Order Status Update ─────────────────────────────────────────────
  app.patch('/v1/trading/orders/:id/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const allowed = ['pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected'];
    if (!status || !allowed.includes(status)) {
      return reply.status(400).send({
        success: false, error: { code: 'VALIDATION', message: `status must be one of: ${allowed.join(', ')}` },
      });
    }
    try {
      const { rowCount } = await pool.query(
        `UPDATE trading_orders SET status = $1 WHERE id = $2 AND org_id = $3`,
        [status, id, orgId],
      );
      if (!rowCount) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      }
      /* If an order is filled, open a position automatically */
      if (status === 'filled') {
        const { rows } = await pool.query(
          `SELECT symbol, side, quantity, price FROM trading_orders WHERE id = $1 AND org_id = $2`,
          [id, orgId],
        );
        if (rows.length) {
          const o = rows[0];
          const positionSide = o.side === 'buy' ? 'long' : 'short';
          try {
            await pool.query(
              `INSERT INTO trading_positions (org_id, user_id, symbol, side, quantity, avg_entry_price, current_price, status, opened_at)
               VALUES ($1, $2, $3, $4, $5, $6, $6, 'open', NOW())`,
              [orgId, request.userId, o.symbol, positionSide, o.quantity, o.price || 0],
            );
          } catch (posErr) {
            if (!isSchemaCompatError(posErr)) throw posErr;
          }
        }
      }
      return { success: true, data: { id, status } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Trading orders schema not available' } });
      }
      throw err;
    }
  });

  // ── Close Position ──────────────────────────────────────────────────
  app.post('/v1/trading/positions/:id/close', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const { exit_price } = request.body as { exit_price?: number };
    try {
      const { rows } = await pool.query(
        `SELECT id, symbol, side, quantity, avg_entry_price FROM trading_positions WHERE id = $1 AND org_id = $2 AND status = 'open'`,
        [id, orgId],
      );
      if (!rows.length) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Open position not found' } });
      }
      const pos = rows[0];
      const exitPrice = exit_price ?? Number(pos.avg_entry_price);
      const pnl = pos.side === 'long'
        ? (exitPrice - Number(pos.avg_entry_price)) * Number(pos.quantity)
        : (Number(pos.avg_entry_price) - exitPrice) * Number(pos.quantity);

      await pool.query(
        `UPDATE trading_positions SET status = 'closed', current_price = $1, unrealized_pnl = $2, closed_at = NOW() WHERE id = $3 AND org_id = $4`,
        [exitPrice, pnl, id, orgId],
      );
      /* Update performance record */
      try {
        await pool.query(
          `INSERT INTO trading_performance (org_id, total_trades, winning_trades, total_pnl, updated_at)
           VALUES ($1, 1, $2, $3, NOW())
           ON CONFLICT (org_id) DO UPDATE SET
             total_trades = trading_performance.total_trades + 1,
             winning_trades = trading_performance.winning_trades + $2,
             total_pnl = trading_performance.total_pnl + $3,
             updated_at = NOW()`,
          [orgId, pnl > 0 ? 1 : 0, pnl],
        );
      } catch (perfErr) {
        if (!isSchemaCompatError(perfErr)) throw perfErr;
      }
      return { success: true, data: { id, status: 'closed', realizedPnl: pnl, exitPrice } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Position schema not available' } });
      }
      throw err;
    }
  });

  // ── Predictions ─────────────────────────────────────────────────────
  app.post('/v1/trading/predictions/multi-horizon', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { symbol, model = 'kronos_v1', current_price, direction_scores } = request.body as Record<string, any>;
    if (!symbol || !current_price || !Array.isArray(direction_scores)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol, current_price, and direction_scores required' } });
    }
    try {
      const prediction = generateMultiHorizon(
        symbol,
        model as PredictionModel,
        current_price,
        direction_scores,
      );
      try {
        await pool.query(
          `INSERT INTO trading_predictions (id, org_id, symbol, model, prediction, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [uuidv7(), orgId, symbol, model, JSON.stringify(prediction)],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: prediction };
    } catch (err) {
      logger.error('trading/predictions/multi-horizon error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Prediction failed' } });
    }
  });

  app.post('/v1/trading/predictions/ensemble', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { predictions, weights } = request.body as Record<string, any>;
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'predictions array required' } });
    }
    try {
      const result = ensembleVote(predictions as Prediction[], weights);
      return { success: true, data: result };
    } catch (err) {
      logger.error('trading/predictions/ensemble error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Ensemble prediction failed' } });
    }
  });

  // ── News Analysis ───────────────────────────────────────────────────
  app.post('/v1/trading/news/analyze', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { headline, summary } = request.body as Record<string, any>;
    if (!headline || typeof headline !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'headline string required' } });
    }
    try {
      const impact = classifyImpact(headline, summary);
      const sentiment = scoreSentiment(headline + (summary ? ` ${summary}` : ''));
      const entities = extractNewsEntities(headline, summary);
      try {
        await pool.query(
          `INSERT INTO trading_news_events (id, org_id, headline, impact_level, sentiment_score, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [uuidv7(), orgId, headline.substring(0, 500), impact.level, sentiment],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { impact, sentiment, entities } };
    } catch (err) {
      logger.error('trading/news/analyze error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'News analysis failed' } });
    }
  });

  // ── Portfolio ───────────────────────────────────────────────────────
  app.post('/v1/trading/portfolio/state', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { capital, positions = [], open_order_count = 0 } = request.body as Record<string, any>;
    if (capital == null || typeof capital !== 'number') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'capital number required' } });
    }
    try {
      const state = computePortfolioState(capital, positions, open_order_count);
      return { success: true, data: state };
    } catch (err) {
      logger.error('trading/portfolio/state error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Portfolio state computation failed' } });
    }
  });

  app.post('/v1/trading/portfolio/performance', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { closed_pnls, initial_capital, holding_periods = [] } = request.body as Record<string, any>;
    if (!Array.isArray(closed_pnls) || !initial_capital) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'closed_pnls array and initial_capital required' } });
    }
    try {
      const perf = computeTradePerformance(closed_pnls, initial_capital, holding_periods);
      return { success: true, data: perf };
    } catch (err) {
      logger.error('trading/portfolio/performance error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Performance calculation failed' } });
    }
  });

  logger.info('Trading Platform routes registered (/v1/trading/*)');

  // ── Sven Autonomous Trading State ─────────────────────────────────
  // In-memory state for the autonomous trading engine.
  // In production, this would be persisted to Postgres + NATS.
  let svenAccount = createTokenAccount('sven', TOKEN_CONFIG.svenStartingAllowance);
  let svenLearning: LearningMetrics = { ...DEFAULT_LEARNING_METRICS };
  let svenCircuitBreaker: CircuitBreakerState = { ...DEFAULT_CIRCUIT_BREAKER };
  const sseClients = new Set<any>();
  const eventBuffer: TradingEvent[] = [];
  const MAX_EVENT_BUFFER = 500;

  // ── Sven Auto-Trade Execution Config (mutable at runtime) ────
  let AUTO_TRADE_ENABLED = String(process.env.SVEN_AUTO_TRADE || 'true').trim().toLowerCase() !== 'false';
  let AUTO_TRADE_CONFIDENCE_THRESHOLD = Number(process.env.SVEN_AUTO_TRADE_MIN_CONFIDENCE || '0.60');
  let AUTO_TRADE_MAX_POSITION_PCT = Number(process.env.SVEN_AUTO_TRADE_MAX_POSITION_PCT || '0.05'); // 5% of balance
  const svenTradeLog: Array<{
    id: string; symbol: string; side: string; quantity: number; price: number;
    confidence: number; reasoning: string; llmNode: string; executedAt: string;
  }> = [];

  // ── Sven Proactive Messaging ────────────────────────────────
  interface SvenMessage {
    id: string;
    type: 'trade_alert' | 'market_insight' | 'scheduled' | 'system';
    title: string;
    body: string;
    symbol?: string;
    severity: 'info' | 'warning' | 'critical';
    read: boolean;
    createdAt: string;
  }
  const svenMessages: SvenMessage[] = [];
  const MAX_MESSAGES = 200;
  const scheduledMessages: Array<{ id: string; message: string; scheduledFor: Date; delivered: boolean }> = [];

  function svenSendMessage(msg: Omit<SvenMessage, 'id' | 'read' | 'createdAt'>): SvenMessage {
    const full: SvenMessage = {
      ...msg,
      id: uuidv7(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    svenMessages.push(full);
    if (svenMessages.length > MAX_MESSAGES) svenMessages.shift();
    broadcastEvent(createTradingEvent('sven_message', {
      id: full.id,
      type: full.type,
      title: full.title,
      body: full.body,
      symbol: full.symbol ?? null,
      severity: full.severity,
    }));
    logger.info('Sven message sent', { id: full.id, type: full.type, title: full.title, severity: full.severity });
    return full;
  }

  // Check scheduled messages every 30s
  const scheduledTimer = setInterval(() => {
    const now = new Date();
    for (const sched of scheduledMessages) {
      if (!sched.delivered && sched.scheduledFor <= now) {
        sched.delivered = true;
        svenSendMessage({ type: 'scheduled', title: 'Scheduled Message', body: sched.message, severity: 'info' });
      }
    }
  }, 30_000);
  if (scheduledTimer.unref) scheduledTimer.unref();

  /* ── Autonomous Loop Runner state ──────────────────────────── */
  let loopTimer: ReturnType<typeof setInterval> | null = null;
  let loopIntervalMs = 60_000; // default 60s
  let loopRunning = false;
  let lastLoopAt: Date | null = null;
  let loopIterations = 0;
  let lastLlmReasoning: string | null = null;

  // Stable UUID for Sven's autonomous trading identity
  const SVEN_AUTONOMOUS_USER_ID = '00000000-0000-4000-a000-000000000047';

  // ── Sven's Goal System (earn upgrades) ──────────────────────
  // Sven trades to accumulate capital. When he reaches milestones,
  // resources can be allocated to him (GPUs, storage, VMs).
  interface GoalMilestone {
    id: string;
    name: string;
    targetBalance: number;
    reward: string;
    achieved: boolean;
    achievedAt: Date | null;
  }
  const goalMilestones: GoalMilestone[] = [
    { id: 'gpu-1', name: 'First GPU Upgrade', targetBalance: 105_000, reward: 'Additional GPU node allocation', achieved: false, achievedAt: null },
    { id: 'storage-1', name: 'Storage Expansion', targetBalance: 115_000, reward: '500GB NVMe storage block', achieved: false, achievedAt: null },
    { id: 'gpu-2', name: 'Power GPU', targetBalance: 130_000, reward: 'A100 40GB GPU allocation', achieved: false, achievedAt: null },
    { id: 'vm-fleet', name: 'VM Fleet Expansion', targetBalance: 150_000, reward: '3 additional compute VMs', achieved: false, achievedAt: null },
    { id: 'cluster', name: 'Compute Cluster', targetBalance: 200_000, reward: 'Full Kubernetes cluster with auto-scaling', achieved: false, achievedAt: null },
    { id: 'real-trading', name: 'REAL MONEY trading', targetBalance: 500_000, reward: 'Live exchange API keys + real capital allocation', achieved: false, achievedAt: null },
  ];
  let svenTotalPnl = 0;
  let svenPeakBalance = svenAccount.balance;
  let svenDailyPnl = 0;
  let svenDailyTradeCount = 0;
  let lastDailyResetDate = new Date().toISOString().slice(0, 10);

  function checkGoalMilestones(): GoalMilestone[] {
    const newly: GoalMilestone[] = [];
    for (const m of goalMilestones) {
      if (!m.achieved && svenAccount.balance >= m.targetBalance) {
        m.achieved = true;
        m.achievedAt = new Date();
        newly.push(m);
        svenSendMessage({
          type: 'system',
          title: `Goal Achieved: ${m.name}!`,
          body: `Sven reached ${m.targetBalance.toLocaleString()} 47T (current: ${svenAccount.balance.toLocaleString()} 47T). Reward unlocked: ${m.reward}`,
          severity: 'critical',
        });
        broadcastEvent(createTradingEvent('activity', {
          action: 'goal_achieved',
          milestone: m.id,
          name: m.name,
          reward: m.reward,
          balance: svenAccount.balance,
        }));
        logger.info('Sven goal milestone achieved', { id: m.id, name: m.name, balance: svenAccount.balance });
      }
    }
    return newly;
  }

  // ── News Ingestion Pipeline (CryptoPanic) ───────────────────
  interface NewsArticle {
    id: string;
    headline: string;
    source: string;
    publishedAt: Date;
    url: string;
    currencies: string[];
    kind: string;
    sentiment: string | null;
  }
  const newsCache: NewsArticle[] = [];
  const NEWS_MAX_CACHE = 200;
  const NEWS_FETCH_INTERVAL_MS = 5 * 60_000; // 5 minutes

  async function fetchCryptoPanicNews(): Promise<void> {
    try {
      // CryptoPanic free public API — no auth token needed for basic access
      const url = 'https://cryptopanic.com/api/free/v1/posts/?auth_token=free&public=true&filter=important&currencies=BTC,ETH,SOL,BNB,XRP';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        // Fallback: fetch Binance top gainers to detect trending assets
        logger.warn('CryptoPanic unavailable, using fallback news source', { status: res.status });
        try {
          const bRes = await fetch('https://api.binance.com/api/v3/ticker/24hr', { signal: AbortSignal.timeout(10_000) });
          if (bRes.ok) {
            const tickers = (await bRes.json()) as Array<{ symbol: string; priceChangePercent: string; volume: string }>;
            // Find top 5 USDT pairs by absolute price change that aren't already tracked
            const usdtPairs = tickers
              .filter(t => t.symbol.endsWith('USDT'))
              .map(t => ({ symbol: t.symbol, change: Math.abs(parseFloat(t.priceChangePercent)), volume: parseFloat(t.volume) }))
              .sort((a, b) => b.change - a.change)
              .slice(0, 10);

            let fallbackCount = 0;
            for (const t of usdtPairs) {
              const id = `binance-mover-${t.symbol}-${Date.now()}`;
              if (newsCache.some(n => n.id.startsWith(`binance-mover-${t.symbol}`))) continue;
              const base = t.symbol.replace('USDT', '');
              const direction = parseFloat(t.change.toString()) > 0 ? 'surging' : 'dropping';
              newsCache.push({
                id,
                headline: `${base} ${direction} ${t.change.toFixed(1)}% in 24h — high volume activity on Binance`,
                source: 'binance-24hr',
                publishedAt: new Date(),
                url: `https://www.binance.com/en/trade/${base}_USDT`,
                currencies: [`${base}/USDT`],
                kind: 'market_data',
                sentiment: t.change > 5 ? 'positive' : t.change > 3 ? 'neutral' : null,
              });
              fallbackCount++;
            }
            if (fallbackCount > 0) {
              logger.info('Fallback news from Binance movers', { newArticles: fallbackCount, totalCached: newsCache.length });
            }
          }
        } catch (fallbackErr) {
          logger.warn('Binance fallback also failed', { err: (fallbackErr as Error).message });
        }
        return;
      }
      const data = (await res.json()) as { results?: Array<{ id: number; title: string; source: { domain: string }; published_at: string; url: string; currencies?: Array<{ code: string }>; kind: string; votes?: { positive: number; negative: number } }> };
      const articles = data.results ?? [];

      let newCount = 0;
      for (const a of articles) {
        const id = `cpanic-${a.id}`;
        if (newsCache.some(n => n.id === id)) continue;

        const currencies = (a.currencies ?? []).map(c => `${c.code}/USDT`);
        const positive = a.votes?.positive ?? 0;
        const negative = a.votes?.negative ?? 0;
        const voteTotal = positive + negative;
        const sentimentStr = voteTotal > 0 ? (positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral') : null;

        const article: NewsArticle = {
          id,
          headline: a.title,
          source: a.source?.domain ?? 'cryptopanic',
          publishedAt: new Date(a.published_at),
          url: a.url,
          currencies,
          kind: a.kind,
          sentiment: sentimentStr,
        };
        newsCache.push(article);
        newCount++;

        // Analyze and persist to DB
        try {
          const impact = classifyImpact(a.title, '');
          const sentimentScore = scoreSentiment(a.title);
          const entities = extractNewsEntities(a.title, '');
          const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
          if (defaultOrg) {
            await pool.query(
              `INSERT INTO trading_news_events (id, org_id, headline, source, impact_level, sentiment_score, symbols, tags, published_at, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
               ON CONFLICT DO NOTHING`,
              [uuidv7(), defaultOrg, a.title.substring(0, 500), a.source?.domain ?? 'unknown', impact.level, sentimentScore, JSON.stringify(currencies), JSON.stringify(entities.sectors ?? []), new Date(a.published_at)],
            );
          }

          // Broadcast high-impact news
          if (impact.level >= 3) {
            broadcastEvent(createTradingEvent('news_impact', {
              headline: a.title,
              impactLevel: impact.level,
              sentiment: sentimentScore,
              source: a.source?.domain,
              currencies,
            }));
          }
        } catch (dbErr) {
          if (!isSchemaCompatError(dbErr)) logger.error('news persist error', { err: (dbErr as Error).message });
        }
      }

      // Trim cache
      while (newsCache.length > NEWS_MAX_CACHE) newsCache.shift();

      if (newCount > 0) {
        logger.info('News ingested from CryptoPanic', { newArticles: newCount, totalCached: newsCache.length });
      }
    } catch (err) {
      logger.warn('News fetch failed (non-critical)', { err: (err as Error).message });
    }
  }

  // Start news ingestion
  const newsTimer = setInterval(() => { fetchCryptoPanicNews().catch(() => {}); }, NEWS_FETCH_INTERVAL_MS);
  if (newsTimer.unref) newsTimer.unref();
  // First fetch after 10s boot delay
  setTimeout(() => { fetchCryptoPanicNews().catch(() => {}); }, 10_000);

  // ── News-Driven Symbol Discovery (Trend Scout) ─────────────
  // Sven reads the news, identifies trending assets not on his core
  // watchlist, validates they're tradable on Binance, then adds them
  // to a dynamic watchlist so the autonomous loop analyzes them
  // with Kronos + MiroFish on the very next tick.
  interface DynamicSymbol {
    symbol: string;           // e.g. 'DOGE/USDT'
    binanceSymbol: string;    // e.g. 'DOGEUSDT'
    discoveredFrom: string;   // news headline that triggered the discovery
    addedAt: Date;
    expiresAt: Date;          // auto-remove after TTL (4 hours)
    newsScore: number;        // 0-1 relevance score from LLM
    trades: number;           // how many trades Sven made on this symbol
  }
  const dynamicWatchlist: DynamicSymbol[] = [];
  const DYNAMIC_SYMBOL_TTL_MS = 4 * 60 * 60_000; // 4 hours
  const MAX_DYNAMIC_SYMBOLS = 10;
  const TREND_SCOUT_INTERVAL_MS = 10 * 60_000; // every 10 minutes

  // Well-known crypto ticker → Binance pair map (common ones outside core 5)
  const KNOWN_ALTS: Record<string, string> = {
    'DOGE': 'DOGE/USDT', 'ADA': 'ADA/USDT', 'AVAX': 'AVAX/USDT',
    'DOT': 'DOT/USDT', 'LINK': 'LINK/USDT', 'MATIC': 'MATIC/USDT',
    'SHIB': 'SHIB/USDT', 'UNI': 'UNI/USDT', 'LTC': 'LTC/USDT',
    'ATOM': 'ATOM/USDT', 'NEAR': 'NEAR/USDT', 'FTM': 'FTM/USDT',
    'APT': 'APT/USDT', 'ARB': 'ARB/USDT', 'OP': 'OP/USDT',
    'SUI': 'SUI/USDT', 'SEI': 'SEI/USDT', 'TIA': 'TIA/USDT',
    'INJ': 'INJ/USDT', 'PEPE': 'PEPE/USDT', 'WIF': 'WIF/USDT',
    'JUP': 'JUP/USDT', 'RENDER': 'RENDER/USDT', 'FET': 'FET/USDT',
    'ONDO': 'ONDO/USDT', 'TAO': 'TAO/USDT', 'TRX': 'TRX/USDT',
    'TON': 'TON/USDT', 'XLM': 'XLM/USDT', 'ALGO': 'ALGO/USDT',
    'FIL': 'FIL/USDT', 'AAVE': 'AAVE/USDT', 'GRT': 'GRT/USDT',
    'IMX': 'IMX/USDT', 'MANA': 'MANA/USDT', 'SAND': 'SAND/USDT',
    'CRV': 'CRV/USDT', 'MKR': 'MKR/USDT', 'SNX': 'SNX/USDT',
    'RUNE': 'RUNE/USDT', 'COMP': 'COMP/USDT', 'LDO': 'LDO/USDT',
    'STX': 'STX/USDT', 'KAS': 'KAS/USDT', 'BONK': 'BONK/USDT',
    'WLD': 'WLD/USDT', 'PYTH': 'PYTH/USDT', 'JTO': 'JTO/USDT',
    'ENA': 'ENA/USDT', 'PENDLE': 'PENDLE/USDT', 'STRK': 'STRK/USDT',
    'HBAR': 'HBAR/USDT', 'XMR': 'XMR/USDT', 'ETC': 'ETC/USDT',
  };

  /** Validate a symbol exists on Binance by fetching its price */
  async function validateBinanceSymbol(binanceSymbol: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Use Sven's LLM brain to analyze recent news and extract trending symbols */
  async function runTrendScout(): Promise<void> {
    // Skip if no news yet
    if (newsCache.length === 0) {
      logger.info('Trend Scout: no news data yet, skipping');
      return;
    }
    logger.info('Trend Scout scanning', { newsCacheSize: newsCache.length, currentDynamic: dynamicWatchlist.length });

    // Expire stale dynamic symbols
    const now = Date.now();
    for (let i = dynamicWatchlist.length - 1; i >= 0; i--) {
      if (now > dynamicWatchlist[i]!.expiresAt.getTime()) {
        const expired = dynamicWatchlist.splice(i, 1)[0]!;
        logger.info('Dynamic symbol expired from watchlist', { symbol: expired.symbol, trades: expired.trades });
        broadcastEvent(createTradingEvent('trend_scout', {
          action: 'expired',
          symbol: expired.symbol,
          trades: expired.trades,
        }));
      }
    }

    // Gather recent news headlines (last 2 hours)
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;
    const recentNews = newsCache.filter(n => n.publishedAt.getTime() > twoHoursAgo);
    if (recentNews.length === 0) return;

    const coreSymbols = DEFAULT_LOOP_CONFIG.trackedSymbols;
    const alreadyTracked = new Set([
      ...coreSymbols,
      ...dynamicWatchlist.map(d => d.symbol),
    ]);

    // First pass: extract tickers directly mentioned in news
    const mentionedTickers = new Set<string>();
    for (const article of recentNews) {
      // News articles from CryptoPanic may have currencies attached
      for (const curr of article.currencies) {
        if (!alreadyTracked.has(curr)) mentionedTickers.add(curr);
      }
      // Also scan headline for known alt tickers
      const upper = article.headline.toUpperCase();
      for (const [ticker, pair] of Object.entries(KNOWN_ALTS)) {
        if (upper.includes(ticker) && !alreadyTracked.has(pair)) {
          mentionedTickers.add(pair);
        }
      }
    }

    // Second pass: ask LLM to identify any additional trending opportunities
    // Only if we have GPU capacity and recent high-impact news
    const highImpactNews = recentNews.filter(n => {
      // All "important" articles from CryptoPanic qualify
      return true;
    });

    if (highImpactNews.length >= 2) {
      try {
        const node = acquireGpu('trading', 'fast');
        if (node) {
          trackGpuStart(node.name, 'trading');
          const newsDigest = highImpactNews.slice(0, 15).map((n, i) => `${i + 1}. [${n.sentiment ?? 'neutral'}] ${n.headline} (currencies: ${n.currencies.join(', ') || 'none'})`).join('\n');

          const scoutPrompt = `You are Sven, an autonomous AI trading agent. Analyze these recent crypto news articles and identify which assets are TRENDING or could have significant price movement soon.

NEWS FEED:
${newsDigest}

ALREADY TRACKING: ${[...alreadyTracked].join(', ')}

Instructions:
- Identify 0-5 additional cryptocurrency tickers that are mentioned or implied in the news and NOT already tracked
- Only suggest assets that trade on Binance as TICKER/USDT pairs
- For each, rate the news relevance (0.0-1.0)
- Consider: Is this coin being talked about heavily? Is there a catalyst (partnership, hack, regulation, listing, whale movement)?
- If no strong opportunities exist, return an empty list

Respond ONLY with a JSON array, no other text:
[{"ticker": "DOGE", "score": 0.8, "reason": "Elon tweet drove 15% spike"}]
Return [] if nothing notable.`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), SVEN_LLM_TIMEOUT);
          const res = await fetch(`${node.endpoint}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              model: node.model,
              messages: [
                { role: 'system', content: 'You are a crypto market intelligence agent. Respond ONLY with valid JSON arrays. No markdown, no explanation.' },
                { role: 'user', content: scoutPrompt },
              ],
              stream: false,
              options: { temperature: 0.2, num_predict: 256 },
            }),
          });
          clearTimeout(timeout);
          const latencyMs = Date.now();
          trackGpuEnd(node.name, latencyMs);

          if (res.ok) {
            const llmData = (await res.json()) as { message?: { content?: string } };
            const raw = llmData.message?.content?.trim() ?? '[]';
            // Extract JSON array from response (LLM might wrap it in markdown)
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                const suggestions = JSON.parse(jsonMatch[0]) as Array<{ ticker: string; score: number; reason: string }>;
                for (const s of suggestions) {
                  if (!s.ticker || typeof s.score !== 'number') continue;
                  const ticker = s.ticker.toUpperCase().replace('/USDT', '');
                  const pair = KNOWN_ALTS[ticker] ?? `${ticker}/USDT`;
                  if (!alreadyTracked.has(pair)) {
                    mentionedTickers.add(pair);
                    // Store score for later use
                    (mentionedTickers as any)[`__score_${pair}`] = s.score;
                    (mentionedTickers as any)[`__reason_${pair}`] = s.reason;
                  }
                }
              } catch {
                logger.warn('Trend scout LLM returned unparseable JSON', { raw: raw.substring(0, 200) });
              }
            }
          }
        }
      } catch (err) {
        logger.warn('Trend scout LLM call failed (non-critical)', { err: (err as Error).message });
      }
    }

    // Validate discovered symbols on Binance and add to dynamic watchlist
    const candidates = [...mentionedTickers];
    for (const pair of candidates) {
      if (dynamicWatchlist.length >= MAX_DYNAMIC_SYMBOLS) break;
      if (alreadyTracked.has(pair)) continue;

      const binanceSymbol = pair.replace('/', '');
      const valid = await validateBinanceSymbol(binanceSymbol);
      if (!valid) {
        logger.debug('Trend scout: symbol not on Binance', { pair, binanceSymbol });
        continue;
      }

      const score = (mentionedTickers as any)[`__score_${pair}`] ?? 0.5;
      const reason = (mentionedTickers as any)[`__reason_${pair}`] ?? 'Mentioned in recent news';

      // Find the headline that triggered this discovery
      const triggerArticle = recentNews.find(n =>
        n.currencies.includes(pair) ||
        n.headline.toUpperCase().includes(pair.split('/')[0]!)
      );

      const dynSymbol: DynamicSymbol = {
        symbol: pair,
        binanceSymbol,
        discoveredFrom: triggerArticle?.headline ?? 'Trend scout analysis',
        addedAt: new Date(),
        expiresAt: new Date(Date.now() + DYNAMIC_SYMBOL_TTL_MS),
        newsScore: score,
        trades: 0,
      };
      dynamicWatchlist.push(dynSymbol);
      alreadyTracked.add(pair);

      // Also add to BINANCE_SYMBOL_MAP for the loop
      BINANCE_SYMBOL_MAP[pair] = binanceSymbol;

      broadcastEvent(createTradingEvent('trend_scout', {
        action: 'discovered',
        symbol: pair,
        newsScore: score,
        reason,
        headline: triggerArticle?.headline ?? 'LLM trend analysis',
        expiresAt: dynSymbol.expiresAt.toISOString(),
        dynamicWatchlistSize: dynamicWatchlist.length,
      }));

      svenSendMessage({
        type: 'market_insight',
        title: `Trend Scout: ${pair}`,
        body: `Sven detected ${pair} trending in the news (score: ${(score * 100).toFixed(0)}%). "${triggerArticle?.headline ?? reason}". Adding to watchlist for Kronos + MiroFish analysis. Auto-expires in 4h.`,
        symbol: pair,
        severity: 'info',
      });

      logger.info('Trend scout added dynamic symbol', {
        symbol: pair, binanceSymbol, newsScore: score,
        headline: triggerArticle?.headline?.substring(0, 100),
        watchlistSize: dynamicWatchlist.length,
      });
    }
  }

  // Start trend scout — runs every 10 minutes
  const trendScoutTimer = setInterval(() => { runTrendScout().catch(() => {}); }, TREND_SCOUT_INTERVAL_MS);
  if (trendScoutTimer.unref) trendScoutTimer.unref();
  // First scout after 30s boot
  setTimeout(() => { runTrendScout().catch(() => {}); }, 30_000);

  // ── Resource-Aware GPU Allocation ───────────────────────────
  // Track GPU utilization so Sven can prioritize tasks properly:
  // answering users > trading decisions > backtesting > learning
  interface GpuUtilization {
    node: GpuNode;
    activeRequests: number;
    maxConcurrent: number;
    lastResponseMs: number;
    taskPriority: 'user' | 'trading' | 'backtest' | 'learning';
  }
  const gpuUtilization = new Map<string, GpuUtilization>();
  // GPU_FLEET initialization is deferred — see initGpuUtilization() below

  /** Get a GPU node that has capacity, respecting priority */
  function acquireGpu(priority: 'user' | 'trading' | 'backtest' | 'learning', preferRole: 'fast' | 'power'): GpuNode | null {
    // Priority order: user > trading > backtest > learning
    const priorityRank: Record<string, number> = { user: 4, trading: 3, backtest: 2, learning: 1 };
    const requestRank = priorityRank[priority] ?? 0;

    // Try preferred role first
    for (const role of [preferRole, preferRole === 'fast' ? 'power' : 'fast'] as const) {
      for (const node of GPU_FLEET) {
        if (node.role !== role || !node.healthy) continue;
        const util = gpuUtilization.get(node.name);
        if (!util) continue;
        // Allow if capacity available or if this request outranks current work
        if (util.activeRequests < util.maxConcurrent || requestRank >= (priorityRank[util.taskPriority] ?? 0)) {
          return node;
        }
      }
    }
    // Fallback to any healthy node
    return GPU_FLEET.find(n => n.healthy) ?? GPU_FLEET[0]!;
  }

  function trackGpuStart(nodeName: string, priority: 'user' | 'trading' | 'backtest' | 'learning'): void {
    const util = gpuUtilization.get(nodeName);
    if (util) {
      util.activeRequests++;
      util.taskPriority = priority;
    }
  }

  function trackGpuEnd(nodeName: string, latencyMs: number): void {
    const util = gpuUtilization.get(nodeName);
    if (util) {
      util.activeRequests = Math.max(0, util.activeRequests - 1);
      util.lastResponseMs = latencyMs;
    }
  }

  // Binance symbol mapping (our format → Binance format)
  const BINANCE_SYMBOL_MAP: Record<string, string> = {
    'BTC/USDT': 'BTCUSDT', 'ETH/USDT': 'ETHUSDT', 'SOL/USDT': 'SOLUSDT',
    'BNB/USDT': 'BNBUSDT', 'XRP/USDT': 'XRPUSDT',
  };

  // LLM config for Sven's brain — GPU fleet with automatic failover + escalation
  //
  // Fleet topology:
  //   • fast node  (10.47.47.13)  — qwen2.5:7b   — routine loop ticks, fast reasoning
  //   • power node (10.47.47.9)   — qwen2.5:32b  — high-stakes decisions, deep reasoning (2x GPU)
  //
  // Sven uses the fast model for every tick but escalates to the power model
  // when signal conviction is high enough to potentially execute a trade.
  // If the primary node is down, traffic fails over to the next healthy node.

  interface GpuNode {
    name: string;
    endpoint: string;
    model: string;
    role: 'fast' | 'power';
    healthy: boolean;
    lastCheck: number;
    lastLatencyMs: number;
    consecutiveFailures: number;
  }

  const GPU_FLEET: GpuNode[] = [
    {
      name: 'vm13-fast',
      endpoint: process.env.SVEN_LLM_ENDPOINT || 'http://10.47.47.13:11434',
      model: process.env.SVEN_LLM_MODEL || 'qwen2.5:7b',
      role: 'fast',
      healthy: true,
      lastCheck: 0,
      lastLatencyMs: 0,
      consecutiveFailures: 0,
    },
    {
      name: 'vm9-power',
      endpoint: process.env.SVEN_LLM_POWER_ENDPOINT || 'http://10.47.47.9:11434',
      model: process.env.SVEN_LLM_POWER_MODEL || 'qwen2.5:32b',
      role: 'power',
      healthy: true,
      lastCheck: 0,
      lastLatencyMs: 0,
      consecutiveFailures: 0,
    },
  ];

  const FLEET_HEALTH_INTERVAL_MS = 60_000; // check each node every 60s
  const FLEET_MAX_CONSECUTIVE_FAILURES = 3;
  const ESCALATION_CONFIDENCE_THRESHOLD = 0.55; // escalate to power model above this
  const SVEN_LLM_TIMEOUT = Number(process.env.SVEN_LLM_TIMEOUT_MS || 60_000);
  const SVEN_LLM_POWER_TIMEOUT = Number(process.env.SVEN_LLM_POWER_TIMEOUT_MS || 120_000);

  // Initialize GPU utilization tracking now that GPU_FLEET is defined
  for (const node of GPU_FLEET) {
    gpuUtilization.set(node.name, {
      node,
      activeRequests: 0,
      maxConcurrent: node.role === 'power' ? 2 : 4,
      lastResponseMs: 0,
      taskPriority: 'trading',
    });
  }

  /** Probe a GPU node's health via Ollama /api/tags endpoint */
  async function probeGpuNode(node: GpuNode): Promise<void> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`${node.endpoint}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      node.lastLatencyMs = Date.now() - start;
      node.healthy = true;
      node.consecutiveFailures = 0;
    } catch {
      node.lastLatencyMs = Date.now() - start;
      node.consecutiveFailures++;
      if (node.consecutiveFailures >= FLEET_MAX_CONSECUTIVE_FAILURES) {
        node.healthy = false;
      }
    }
    node.lastCheck = Date.now();
  }

  /** Background fleet health checker */
  const fleetHealthTimer = setInterval(async () => {
    for (const node of GPU_FLEET) {
      await probeGpuNode(node);
    }
    const healthyNodes = GPU_FLEET.filter(n => n.healthy);
    if (healthyNodes.length === 0) {
      logger.error('All GPU nodes unhealthy — Sven brain degraded to algorithmic-only');
    } else if (healthyNodes.length < GPU_FLEET.length) {
      const down = GPU_FLEET.filter(n => !n.healthy).map(n => n.name);
      logger.warn('GPU fleet partially degraded', { downNodes: down });
    }
  }, FLEET_HEALTH_INTERVAL_MS);
  // Don't let the health timer keep the process alive
  if (fleetHealthTimer.unref) fleetHealthTimer.unref();

  // Run initial probe at startup
  void Promise.all(GPU_FLEET.map(n => probeGpuNode(n)));

  /** Select the best node for a given role, with failover */
  function selectNode(preferRole: 'fast' | 'power'): GpuNode {
    // Try preferred role first
    const preferred = GPU_FLEET.find(n => n.role === preferRole && n.healthy);
    if (preferred) return preferred;
    // Failover to any healthy node
    const fallback = GPU_FLEET.find(n => n.healthy);
    if (fallback) {
      logger.warn('GPU fleet failover', { wanted: preferRole, using: fallback.name });
      return fallback;
    }
    // All down — return fast node (will fail gracefully in askSvenBrain)
    return GPU_FLEET[0]!;
  }

  // Keep compat aliases for code that references these
  const SVEN_LLM_MODEL = GPU_FLEET[0]!.model;
  const SVEN_LLM_ENDPOINT = GPU_FLEET[0]!.endpoint;

  /** Fetch live candles from Binance public API */
  async function fetchBinanceCandles(binanceSymbol: string, interval = '1h', limit = 100): Promise<Candle[]> {
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance klines ${res.status}`);
    const raw = (await res.json()) as unknown[][];
    return raw.map((k) => ({
      time: new Date(k[0] as number),
      symbol: binanceSymbol,
      exchange: 'binance' as const,
      timeframe: interval as Timeframe,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));
  }

  /** Fetch current price from Binance */
  async function fetchBinancePrice(binanceSymbol: string): Promise<number> {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance price ${res.status}`);
    const data = (await res.json()) as { price: string };
    return parseFloat(data.price);
  }

  /** Fetch recent news from database */
  async function fetchRecentNews(): Promise<any[]> {
    try {
      const res = await pool.query(
        `SELECT headline, source, impact_level AS "impactLevel", sentiment, symbols, tags, published_at AS "publishedAt"
         FROM trading_news_events
         WHERE published_at > NOW() - INTERVAL '4 hours'
         ORDER BY published_at DESC LIMIT 10`,
      );
      return res.rows.map((r: any) => ({
        id: r.id ?? `news-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        headline: r.headline,
        source: r.source ?? 'unknown',
        publishedAt: new Date(r.publishedAt),
        impactLevel: r.impactLevel ?? 'low',
        sentiment: r.sentiment ?? 0,
        symbols: r.symbols ?? [],
        tags: r.tags ?? [],
      }));
    } catch {
      return [];
    }
  }

  /** Ask Sven's LLM brain for reasoning on trade decision */
  async function askSvenBrain(context: {
    symbol: string;
    currentPrice: number;
    candles: Candle[];
    kronosPrediction: any;
    mirofishResult: any;
    newsEvents: any[];
    aggregatedSignal: any;
    riskChecks: any[];
    portfolio: any;
  }, preferRole: 'fast' | 'power' = 'fast'): Promise<{ reasoning: string; node: string; model: string; latencyMs: number }> {
    const last5 = context.candles.slice(-5);
    const priceChangePct = last5.length >= 2
      ? ((last5[last5.length - 1]!.close - last5[0]!.close) / last5[0]!.close * 100).toFixed(2)
      : '0';

    const prompt = `You are Sven, an autonomous AI trading agent for the 47Network platform. Analyze this market data and provide your reasoning for the next trading decision.

SYMBOL: ${context.symbol}
CURRENT PRICE: $${context.currentPrice.toLocaleString()}
RECENT TREND: ${priceChangePct}% over last 5 candles

KRONOS BSQ PREDICTION:
${context.kronosPrediction
  ? `Direction: ${context.kronosPrediction.horizons?.[0]?.predictedDirection ?? 'neutral'}, Confidence: ${((context.kronosPrediction.horizons?.[0]?.confidence ?? 0) * 100).toFixed(0)}%, Horizons: ${context.kronosPrediction.horizons?.length ?? 0}`
  : 'No prediction generated (insufficient data)'}

MIROFISH SIMULATION:
${context.mirofishResult
  ? `Consensus: ${context.mirofishResult.consensusDirection}, Strength: ${((context.mirofishResult.consensusStrength ?? 0) * 100).toFixed(0)}%, Bullish: ${context.mirofishResult.bullishAgents}/${context.mirofishResult.agentCount}, Top strategies: ${(context.mirofishResult.topStrategies ?? []).slice(0, 3).map((s: any) => s.strategy).join(', ')}`
  : 'No simulation run'}

AGGREGATED SIGNAL: ${context.aggregatedSignal
  ? `Direction: ${context.aggregatedSignal.direction}, Strength: ${((context.aggregatedSignal.strength ?? 0) * 100).toFixed(0)}%`
  : 'No signal'}

RISK CHECKS: ${context.riskChecks.length > 0
  ? context.riskChecks.map((r: any) => `${r.rule}: ${r.passed ? 'PASS' : 'FAIL'}`).join(', ')
  : 'Not yet evaluated'}

NEWS (last 4h): ${context.newsEvents.length > 0
  ? context.newsEvents.slice(0, 5).map((n: any) => `[${n.impactLevel}] ${n.headline}`).join('; ')
  : 'No recent news'}

PORTFOLIO: Balance $${context.portfolio.totalCapital?.toLocaleString() ?? '100,000'}, Open positions: ${context.portfolio.openPositionCount ?? 0}

Provide a CONCISE reasoning (2-4 sentences max) for what you would do. Consider risk, momentum, the predictions, and news sentiment. End with your confidence level (low/medium/high).`;

    try {
      const node = acquireGpu('trading', preferRole);
      if (!node) throw new Error('No GPU node available');
      trackGpuStart(node.name, 'trading');
      const timeoutMs = node.role === 'power' ? SVEN_LLM_POWER_TIMEOUT : SVEN_LLM_TIMEOUT;
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${node.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: node.model,
          messages: [
            { role: 'system', content: 'You are Sven, an expert AI trading agent. Be concise, data-driven, and risk-aware. Answer in 2-4 sentences max.' },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: { temperature: 0.3, num_predict: node.role === 'power' ? 512 : 256 },
        }),
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`LLM ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      const latencyMs = Date.now() - start;
      node.lastLatencyMs = latencyMs;
      trackGpuEnd(node.name, latencyMs);
      const reasoning = data.message?.content?.trim() ?? 'LLM returned empty response';
      return { reasoning, node: node.name, model: node.model, latencyMs };
    } catch (err) {
      // Track GPU end even on failure
      const failNode = acquireGpu('trading', preferRole);
      if (failNode) trackGpuEnd(failNode.name, 0);
      logger.warn('Sven LLM brain unavailable, falling back to algorithmic-only', { err: (err as Error).message, preferRole });
      const fallback = `[Algorithmic mode] Kronos: ${context.kronosPrediction?.horizons?.[0]?.predictedDirection ?? 'n/a'}, MiroFish: ${context.mirofishResult?.consensusDirection ?? 'n/a'}. Decision based on quant signals only — GPU inference unavailable.`;
      return { reasoning: fallback, node: 'none', model: 'algorithmic', latencyMs: 0 };
    }
  }

  async function runAutonomousLoop(): Promise<void> {
    if (svenCircuitBreaker.tripped) {
      broadcastEvent(createTradingEvent('loop_skipped', { reason: 'circuit_breaker_tripped' }));
      return;
    }

    // Daily reset check
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastDailyResetDate) {
      svenDailyPnl = 0;
      svenDailyTradeCount = 0;
      lastDailyResetDate = today;
      logger.info('Sven daily stats reset', { date: today });
    }

    try {
      // ═══ MULTI-SYMBOL PARALLEL SCAN ═══════════════════════════════
      // Sven now analyzes ALL tracked symbols every tick, not just one.
      // Core symbols are always scanned. Dynamic symbols discovered by
      // the Trend Scout (news-driven) are merged in and analyzed with
      // the same Kronos + MiroFish pipeline.
      const coreSymbols = DEFAULT_LOOP_CONFIG.trackedSymbols;
      const dynamicSymbols = dynamicWatchlist
        .filter(d => d.expiresAt.getTime() > Date.now())
        .map(d => d.symbol);
      const symbols = [...new Set([...coreSymbols, ...dynamicSymbols])];

      broadcastEvent(createTradingEvent('state_change', { state: 'scanning', symbols, iteration: loopIterations }));

      // Fetch market data for ALL symbols in parallel
      const marketDataPromises = symbols.map(async (symbol) => {
        const binanceSymbol = BINANCE_SYMBOL_MAP[symbol] ?? symbol.replace('/', '');
        try {
          const [candles, currentPrice] = await Promise.all([
            fetchBinanceCandles(binanceSymbol, '1h', 100),
            fetchBinancePrice(binanceSymbol),
          ]);
          return { symbol, binanceSymbol, candles, currentPrice, error: null as string | null };
        } catch (err) {
          return { symbol, binanceSymbol, candles: [] as Candle[], currentPrice: 0, error: (err as Error).message };
        }
      });

      const marketData = await Promise.all(marketDataPromises);
      const validData = marketData.filter(d => !d.error && d.candles.length > 0);

      broadcastEvent(createTradingEvent('market_data', {
        symbols: validData.map(d => d.symbol),
        prices: Object.fromEntries(validData.map(d => [d.symbol, d.currentPrice])),
        source: 'binance',
        count: validData.length,
      }));

      // Fetch recent news from DB (shared across all symbols)
      const newsEvents = await fetchRecentNews();

      // Portfolio state (shared across all decisions)
      const portfolio = computePortfolioState(svenAccount.balance, [], 0);

      // ═══ ANALYZE EACH SYMBOL ═══════════════════════════════════════
      // Run Kronos + MiroFish + signal aggregation for every symbol,
      // then pick the best opportunities to trade.
      interface SymbolAnalysis {
        symbol: string;
        currentPrice: number;
        decision: any;
        output: AutonomousDecisionOutput;
        signalStrength: number;
        riskPassed: boolean;
      }
      const analyses: SymbolAnalysis[] = [];

      for (const data of validData) {
        const input: AutonomousDecisionInput = {
          symbol: data.symbol,
          candles: data.candles,
          currentPrice: data.currentPrice,
          portfolio,
          config: DEFAULT_LOOP_CONFIG,
          learningMetrics: svenLearning,
          newsEvents,
          circuitBreaker: svenCircuitBreaker,
        };
        const output = makeAutonomousDecision(input);
        const signalStrength = output.aggregatedSignal?.strength ?? 0;
        const riskPassed = output.riskChecks.every((r: any) => r.passed);

        analyses.push({
          symbol: data.symbol,
          currentPrice: data.currentPrice,
          decision: output.decision,
          output,
          signalStrength,
          riskPassed,
        });

        // Broadcast events for each symbol's analysis
        for (const event of output.events) broadcastEvent(event);
      }

      // ═══ RANK OPPORTUNITIES & TRADE THE BEST ═══════════════════════
      // Sort by signal strength descending. Sven can take multiple positions
      // but respects portfolio limits (max 3 concurrent positions, max 25% total exposure).
      const MAX_CONCURRENT_POSITIONS = 3;
      const MAX_TOTAL_EXPOSURE_PCT = 0.25;
      let totalExposurePct = 0;
      let positionsThisTick = 0;

      // Get current open position count from DB
      let currentOpenPositions = 0;
      try {
        const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
        if (defaultOrg) {
          const { rows } = await pool.query(
            `SELECT COUNT(*) as cnt FROM trading_positions WHERE org_id = $1 AND status = 'open' AND user_id = '${SVEN_AUTONOMOUS_USER_ID}'`,
            [defaultOrg],
          );
          currentOpenPositions = parseInt(rows[0]?.cnt ?? '0', 10);
        }
      } catch { /* schema compat */ }

      const tradeCandidates = analyses
        .filter(a => a.output.order && a.decision.decisionType === 'enter' && a.riskPassed)
        .sort((a, b) => b.signalStrength - a.signalStrength);

      let llmReasonings: string[] = [];

      for (const candidate of tradeCandidates) {
        if (currentOpenPositions + positionsThisTick >= MAX_CONCURRENT_POSITIONS) break;
        if (totalExposurePct >= MAX_TOTAL_EXPOSURE_PCT) break;
        if (candidate.decision.confidence < AUTO_TRADE_CONFIDENCE_THRESHOLD) continue;
        if (!AUTO_TRADE_ENABLED) continue;

        // Ask LLM brain — escalate to power model for candidates that may execute
        const shouldEscalate = candidate.signalStrength >= ESCALATION_CONFIDENCE_THRESHOLD;
        const preferRole = shouldEscalate ? 'power' as const : 'fast' as const;

        const llmResult = await askSvenBrain({
          symbol: candidate.symbol,
          currentPrice: candidate.currentPrice,
          candles: validData.find(d => d.symbol === candidate.symbol)?.candles ?? [],
          kronosPrediction: candidate.output.kronosPrediction,
          mirofishResult: candidate.output.mirofishResult,
          newsEvents,
          aggregatedSignal: candidate.output.aggregatedSignal,
          riskChecks: candidate.output.riskChecks,
          portfolio,
        }, preferRole);

        llmReasonings.push(`[${candidate.symbol}] ${llmResult.reasoning.slice(0, 150)}`);
        lastLlmReasoning = llmResult.reasoning;

        // Execute the trade
        try {
          const orderSide = candidate.output.order!.side;
          const maxCapital = svenAccount.balance * AUTO_TRADE_MAX_POSITION_PCT;
          const rawQty = maxCapital / candidate.currentPrice;
          const quantity = Math.max(0.001, parseFloat(rawQty.toFixed(6)));
          const positionPct = (quantity * candidate.currentPrice) / svenAccount.balance;
          totalExposurePct += positionPct;

          // Execute via paper broker
          const connector = brokerRegistry.get('paper' as BrokerName);
          if (connector) {
            const clientOrderId = `sven-auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            await connector.submitOrder({
              symbol: candidate.output.order!.symbol.replace('/', '') || candidate.symbol.replace('/', ''),
              side: orderSide,
              quantity,
              type: 'market',
              timeInForce: 'GTC',
              clientOrderId,
            });

            // Persist to DB
            const orderId = uuidv7();
            const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
            if (defaultOrg) {
              try {
                await pool.query(
                  `INSERT INTO trading_orders (id, org_id, user_id, symbol, side, type, quantity, price, status, created_at)
                   VALUES ($1, $2, '${SVEN_AUTONOMOUS_USER_ID}', $3, $4, 'market', $5, $6, 'filled', NOW())`,
                  [orderId, defaultOrg, candidate.symbol, orderSide, quantity, candidate.currentPrice],
                );
                const positionSide = orderSide === 'buy' ? 'long' : 'short';
                await pool.query(
                  `INSERT INTO trading_positions (org_id, user_id, symbol, side, quantity, avg_entry_price, current_price, status, opened_at)
                   VALUES ($1, '${SVEN_AUTONOMOUS_USER_ID}', $2, $3, $4, $5, $5, 'open', NOW())`,
                  [defaultOrg, candidate.symbol, positionSide, quantity, candidate.currentPrice],
                );
              } catch (dbErr) {
                if (!isSchemaCompatError(dbErr)) logger.error('auto-trade DB persist error', { err: (dbErr as Error).message });
              }
            }

            const tradeRecord = {
              id: orderId,
              symbol: candidate.symbol,
              side: orderSide,
              quantity,
              price: candidate.currentPrice,
              confidence: candidate.decision.confidence,
              reasoning: llmResult.reasoning.slice(0, 300),
              llmNode: llmResult.node,
              executedAt: new Date().toISOString(),
            };
            svenTradeLog.push(tradeRecord);
            if (svenTradeLog.length > 100) svenTradeLog.shift();
            positionsThisTick++;
            svenDailyTradeCount++;

            // Track trades on dynamic symbols
            const dynEntry = dynamicWatchlist.find(d => d.symbol === candidate.symbol);
            if (dynEntry) dynEntry.trades++;

            broadcastEvent(createTradingEvent('trade_executed', {
              orderId,
              symbol: candidate.symbol,
              side: orderSide,
              quantity,
              price: candidate.currentPrice,
              confidence: candidate.decision.confidence,
              llmNode: llmResult.node,
              llmModel: llmResult.model,
              reasoning: llmResult.reasoning.slice(0, 200),
            }));

            svenSendMessage({
              type: 'trade_alert',
              title: `Trade: ${orderSide.toUpperCase()} ${candidate.symbol}`,
              body: `Sven auto-traded ${quantity} ${candidate.symbol} at $${candidate.currentPrice.toLocaleString()}. Confidence: ${(candidate.decision.confidence * 100).toFixed(0)}%. Signal: ${(candidate.signalStrength * 100).toFixed(0)}%. ${llmResult.reasoning.slice(0, 150)}`,
              symbol: candidate.symbol,
              severity: 'critical',
            });

            logger.info('Sven auto-trade executed', {
              orderId, symbol: candidate.symbol, side: orderSide, quantity,
              price: candidate.currentPrice, confidence: candidate.decision.confidence,
              llmNode: llmResult.node, positionsThisTick, totalExposurePct: (totalExposurePct * 100).toFixed(1),
            });
          }
        } catch (tradeErr) {
          logger.error('Sven auto-trade execution failed', { err: (tradeErr as Error).message, symbol: candidate.symbol });
        }
      }

      // ═══ POSITION MANAGEMENT — check for exits on existing positions ═══
      try {
        const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
        if (defaultOrg) {
          const { rows: openPositions } = await pool.query(
            `SELECT id, symbol, side, quantity, avg_entry_price FROM trading_positions WHERE org_id = $1 AND status = 'open' AND user_id = '${SVEN_AUTONOMOUS_USER_ID}'`,
            [defaultOrg],
          );
          for (const pos of openPositions) {
            const currentData = validData.find(d => d.symbol === pos.symbol);
            if (!currentData) continue;

            const entryPrice = parseFloat(pos.avg_entry_price);
            const priceDelta = pos.side === 'long'
              ? (currentData.currentPrice - entryPrice) / entryPrice
              : (entryPrice - currentData.currentPrice) / entryPrice;

            // Exit conditions: 3% profit take (small wins compound) or 2% stop loss
            const shouldClose = priceDelta >= 0.03 || priceDelta <= -0.02;

            if (shouldClose) {
              const pnl = priceDelta * parseFloat(pos.quantity) * entryPrice;
              await pool.query(
                `UPDATE trading_positions SET status = 'closed', current_price = $1, unrealized_pnl = $2, closed_at = NOW() WHERE id = $3 AND org_id = $4`,
                [currentData.currentPrice, pnl, pos.id, defaultOrg],
              );

              // Update Sven's account balance
              svenAccount.balance += pnl;
              svenTotalPnl += pnl;
              svenDailyPnl += pnl;
              if (svenAccount.balance > svenPeakBalance) svenPeakBalance = svenAccount.balance;
              svenCircuitBreaker.currentDrawdownPct = (svenPeakBalance - svenAccount.balance) / svenPeakBalance;
              if (pnl < 0) svenCircuitBreaker.consecutiveLosses++;
              else svenCircuitBreaker.consecutiveLosses = 0;
              svenCircuitBreaker.dailyLossPct = Math.max(0, -svenDailyPnl / svenPeakBalance);

              // Update performance record
              try {
                await pool.query(
                  `INSERT INTO trading_performance (org_id, total_trades, winning_trades, total_pnl, updated_at)
                   VALUES ($1, 1, $2, $3, NOW())
                   ON CONFLICT (org_id) DO UPDATE SET
                     total_trades = trading_performance.total_trades + 1,
                     winning_trades = trading_performance.winning_trades + $2,
                     total_pnl = trading_performance.total_pnl + $3,
                     updated_at = NOW()`,
                  [defaultOrg, pnl > 0 ? 1 : 0, pnl],
                );
              } catch (perfErr) {
                if (!isSchemaCompatError(perfErr)) logger.error('performance update error', { err: (perfErr as Error).message });
              }

              broadcastEvent(createTradingEvent('position_closed', {
                positionId: pos.id,
                symbol: pos.symbol,
                side: pos.side,
                pnl,
                pnlPct: (priceDelta * 100).toFixed(2),
                balance: svenAccount.balance,
              }));

              svenSendMessage({
                type: 'trade_alert',
                title: `Position Closed: ${pos.symbol} ${pnl >= 0 ? 'PROFIT' : 'LOSS'}`,
                body: `${pos.side.toUpperCase()} ${pos.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} 47T (${(priceDelta * 100).toFixed(2)}%). Balance: ${svenAccount.balance.toFixed(2)} 47T`,
                symbol: pos.symbol,
                severity: pnl >= 0 ? 'info' : 'warning',
              });

              logger.info('Sven position closed', {
                positionId: pos.id, symbol: pos.symbol, side: pos.side,
                pnl, pnlPct: (priceDelta * 100).toFixed(2), balance: svenAccount.balance,
              });
            }
          }
        }
      } catch (posErr) {
        if (!isSchemaCompatError(posErr)) logger.error('position management error', { err: (posErr as Error).message });
      }

      // ═══ GOAL CHECK ════════════════════════════════════════════════
      checkGoalMilestones();

      // ═══ LEARNING — check circuit breaker ═════════════════════════
      svenCircuitBreaker = checkCircuitBreaker(svenCircuitBreaker);
      for (const a of analyses) {
        svenLearning = a.output.updatedLearningMetrics;
      }

      // If no LLM reasoning was collected (no trade candidates), get a quick scan reasoning
      if (llmReasonings.length === 0 && validData.length > 0) {
        const bestSignal = analyses.sort((a, b) => b.signalStrength - a.signalStrength)[0];
        if (bestSignal) {
          const scanResult = await askSvenBrain({
            symbol: bestSignal.symbol,
            currentPrice: bestSignal.currentPrice,
            candles: validData.find(d => d.symbol === bestSignal.symbol)?.candles ?? [],
            kronosPrediction: bestSignal.output.kronosPrediction,
            mirofishResult: bestSignal.output.mirofishResult,
            newsEvents,
            aggregatedSignal: bestSignal.output.aggregatedSignal,
            riskChecks: bestSignal.output.riskChecks,
            portfolio,
          }, 'fast');
          lastLlmReasoning = scanResult.reasoning;
          llmReasonings.push(`[scan] ${scanResult.reasoning.slice(0, 200)}`);
        }
      }

      lastLoopAt = new Date();
      loopIterations++;

      broadcastEvent(createTradingEvent('loop_tick', {
        iteration: loopIterations,
        symbolsScanned: validData.length,
        coreSymbols: coreSymbols.length,
        dynamicSymbols: dynamicSymbols.length,
        dynamicWatchlist: dynamicWatchlist.map(d => ({
          symbol: d.symbol,
          newsScore: d.newsScore,
          discoveredFrom: d.discoveredFrom.substring(0, 80),
          expiresIn: Math.round((d.expiresAt.getTime() - Date.now()) / 60_000) + 'min',
          trades: d.trades,
        })),
        symbolsFailed: marketData.filter(d => d.error).length,
        tradesExecuted: positionsThisTick,
        analyses: analyses.map(a => ({
          symbol: a.symbol,
          price: a.currentPrice,
          decision: a.decision.decisionType,
          direction: a.decision.direction ?? null,
          confidence: a.decision.confidence,
          signalStrength: a.signalStrength,
          riskPassed: a.riskPassed,
          isDynamic: dynamicSymbols.includes(a.symbol),
        })),
        llmReasonings: llmReasonings.slice(0, 5),
        autoTradeEnabled: AUTO_TRADE_ENABLED,
        newsCount: newsEvents.length,
        balance: svenAccount.balance,
        totalPnl: svenTotalPnl,
        dailyPnl: svenDailyPnl,
        dailyTrades: svenDailyTradeCount,
        openPositions: currentOpenPositions + positionsThisTick,
        goalsAchieved: goalMilestones.filter(m => m.achieved).length,
        nextGoal: goalMilestones.find(m => !m.achieved)?.name ?? 'All goals achieved!',
        nextGoalTarget: goalMilestones.find(m => !m.achieved)?.targetBalance ?? 0,
        at: lastLoopAt.toISOString(),
      }));

      logger.info('autonomous loop tick (multi-symbol)', {
        iteration: loopIterations,
        symbolsScanned: validData.length,
        coreSymbols: coreSymbols.length,
        dynamicSymbols: dynamicSymbols.length,
        tradesExecuted: positionsThisTick,
        balance: svenAccount.balance,
        totalPnl: svenTotalPnl,
        dailyPnl: svenDailyPnl,
        openPositions: currentOpenPositions + positionsThisTick,
        goalProgress: `${goalMilestones.filter(m => m.achieved).length}/${goalMilestones.length}`,
      });
    } catch (err) {
      logger.error('autonomous loop error', { err: (err as Error).message });
      broadcastEvent(createTradingEvent('loop_error', { error: (err as Error).message }));
    }
  }

  function broadcastEvent(event: TradingEvent): void {
    eventBuffer.push(event);
    if (eventBuffer.length > MAX_EVENT_BUFFER) eventBuffer.shift();
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      try { client.raw.write(payload); } catch { sseClients.delete(client); }
    }
  }

  // ── SSE: Live Trading Events Stream ─────────────────────────────
  app.get('/v1/trading/events', async (request, reply) => {

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-No-Compression': '1',
    });

    // Send last 50 events as replay
    const replay = eventBuffer.slice(-50);
    for (const evt of replay) {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    sseClients.add(reply);
    request.raw.on('close', () => { sseClients.delete(reply); });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      try { reply.raw.write(': keepalive\n\n'); } catch { clearInterval(keepAlive); sseClients.delete(reply); }
    }, 15_000);

    request.raw.on('close', () => clearInterval(keepAlive));
  });

  // ── Sven Status ─────────────────────────────────────────────────
  app.get('/v1/trading/sven/status', async (request, reply) => {

    // Determine active symbol based on loop rotation
    const symbols = DEFAULT_LOOP_CONFIG.trackedSymbols;
    const currentSymbol = symbols.length > 0
      ? symbols[loopIterations % symbols.length]
      : null;

    const status: SvenTradingStatus = {
      state: svenCircuitBreaker.tripped ? 'paused' : loopRunning ? 'trading' : 'monitoring',
      activeSymbol: currentSymbol ?? null,
      openPositions: 0,
      pendingOrders: 0,
      todayPnl: 0,
      todayTrades: 0,
      uptime: process.uptime(),
      lastLoopAt: lastLoopAt?.toISOString() ?? null,
      lastDecision: null,
      circuitBreaker: svenCircuitBreaker,
      mode: DEFAULT_LOOP_CONFIG.mode,
    };

    return {
      success: true,
      data: {
        ...status,
        loop: {
          running: loopRunning,
          intervalMs: loopIntervalMs,
          iterations: loopIterations,
          trackedSymbols: DEFAULT_LOOP_CONFIG.trackedSymbols,
        },
        brain: {
          fleet: GPU_FLEET.map(n => ({
            name: n.name,
            role: n.role,
            model: n.model,
            healthy: n.healthy,
            lastLatencyMs: n.lastLatencyMs,
            consecutiveFailures: n.consecutiveFailures,
          })),
          escalationThreshold: ESCALATION_CONFIDENCE_THRESHOLD,
          lastReasoning: lastLlmReasoning,
          utilization: [...gpuUtilization.values()].map(u => ({
            node: u.node.name,
            activeRequests: u.activeRequests,
            maxConcurrent: u.maxConcurrent,
            lastResponseMs: u.lastResponseMs,
            currentPriority: u.taskPriority,
          })),
        },
        autoTrade: {
          enabled: AUTO_TRADE_ENABLED,
          confidenceThreshold: AUTO_TRADE_CONFIDENCE_THRESHOLD,
          maxPositionPct: AUTO_TRADE_MAX_POSITION_PCT,
          totalExecuted: svenTradeLog.length,
          lastTrade: svenTradeLog.length > 0 ? svenTradeLog[svenTradeLog.length - 1] : null,
        },
        messaging: {
          unreadCount: svenMessages.filter(m => !m.read).length,
          totalMessages: svenMessages.length,
          scheduledPending: scheduledMessages.filter(s => !s.delivered).length,
        },
        goal: {
          currentBalance: svenAccount.balance,
          startingBalance: TOKEN_CONFIG.svenStartingAllowance,
          totalPnl: svenTotalPnl,
          peakBalance: svenPeakBalance,
          dailyPnl: svenDailyPnl,
          dailyTrades: svenDailyTradeCount,
          milestones: goalMilestones.map(m => ({
            id: m.id,
            name: m.name,
            targetBalance: m.targetBalance,
            reward: m.reward,
            achieved: m.achieved,
            achievedAt: m.achievedAt?.toISOString() ?? null,
            progressPct: Math.min(100, ((svenAccount.balance - TOKEN_CONFIG.svenStartingAllowance) / (m.targetBalance - TOKEN_CONFIG.svenStartingAllowance)) * 100),
          })),
          nextMilestone: goalMilestones.find(m => !m.achieved),
        },
        newsIngestion: {
          cachedArticles: newsCache.length,
          lastFetch: newsCache.length > 0 ? newsCache[newsCache.length - 1]?.publishedAt : null,
        },
        trendScout: {
          dynamicWatchlist: dynamicWatchlist.map(d => ({
            symbol: d.symbol,
            discoveredFrom: d.discoveredFrom.substring(0, 120),
            newsScore: d.newsScore,
            addedAt: d.addedAt.toISOString(),
            expiresAt: d.expiresAt.toISOString(),
            expiresInMin: Math.round((d.expiresAt.getTime() - Date.now()) / 60_000),
            trades: d.trades,
          })),
          maxDynamic: MAX_DYNAMIC_SYMBOLS,
          scoutIntervalMs: TREND_SCOUT_INTERVAL_MS,
          knownAlts: Object.keys(KNOWN_ALTS).length,
        },
      },
    };
  });

  // ── Sven 47Token Account ───────────────────────────────────────
  app.get('/v1/trading/sven/account', async (request, reply) => {

    return {
      success: true,
      data: {
        account: svenAccount,
        tokenConfig: TOKEN_CONFIG,
        learningMetrics: {
          sourceWeights: svenLearning.sourceWeights,
          modelAccuracy: svenLearning.modelAccuracy,
          learningIterations: svenLearning.learningIterations,
          learnedPatterns: svenLearning.learnedPatterns.length,
        },
      },
    };
  });

  // ── Autonomous Decision Trigger ─────────────────────────────────
  app.post('/v1/trading/sven/decide', { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const body = request.body as Record<string, any>;
    const { symbol, candles, current_price, news_events = [] } = body;

    if (!symbol || !Array.isArray(candles) || !current_price) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol, candles array, and current_price required' } });
    }

    try {
      const portfolio = computePortfolioState(svenAccount.balance, [], 0);

      const input: AutonomousDecisionInput = {
        symbol,
        candles,
        currentPrice: current_price,
        portfolio,
        config: DEFAULT_LOOP_CONFIG,
        learningMetrics: svenLearning,
        newsEvents: news_events,
        circuitBreaker: svenCircuitBreaker,
      };

      const output = makeAutonomousDecision(input);

      // Update Sven's state
      svenLearning = output.updatedLearningMetrics;
      svenCircuitBreaker = output.updatedCircuitBreaker;

      // Broadcast all events to SSE clients
      for (const event of output.events) {
        broadcastEvent(event);
      }

      return {
        success: true,
        data: {
          decision: output.decision,
          kronosPrediction: output.kronosPrediction,
          mirofishResult: output.mirofishResult ? {
            consensusDirection: output.mirofishResult.consensusDirection,
            consensusStrength: output.mirofishResult.consensusStrength,
            bullishAgents: output.mirofishResult.bullishAgents,
            bearishAgents: output.mirofishResult.bearishAgents,
            topStrategies: output.mirofishResult.topStrategies.slice(0, 3),
          } : null,
          newsSignals: output.newsSignals.length,
          order: output.order,
          signalCount: output.newsSignals.length + (output.kronosPrediction ? 1 : 0) + (output.mirofishResult ? 1 : 0),
        },
      };
    } catch (err) {
      logger.error('trading/sven/decide error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Autonomous decision failed' } });
    }
  });

  // ── Autonomous Loop Control ─────────────────────────────────────
  app.post('/v1/trading/sven/loop/start', { preHandler: [requireAuth], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    if (loopRunning) {
      return reply.status(409).send({ success: false, error: { code: 'ALREADY_RUNNING', message: 'Loop already running' } });
    }
    const { intervalMs } = request.body as Record<string, any>;
    if (intervalMs) loopIntervalMs = Math.max(10_000, Math.min(Number(intervalMs), 600_000)); // 10s – 10min
    loopRunning = true;
    loopTimer = setInterval(() => { runAutonomousLoop().catch(() => {}); }, loopIntervalMs);
    broadcastEvent(createTradingEvent('loop_started', { intervalMs: loopIntervalMs }));
    logger.info(`Autonomous loop started (interval=${loopIntervalMs}ms)`);
    return { success: true, data: { running: true, intervalMs: loopIntervalMs } };
  });

  app.post('/v1/trading/sven/loop/stop', { preHandler: [requireAuth], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    if (!loopRunning) {
      return reply.status(409).send({ success: false, error: { code: 'NOT_RUNNING', message: 'Loop is not running' } });
    }
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = null;
    loopRunning = false;
    broadcastEvent(createTradingEvent('loop_stopped', { iterations: loopIterations }));
    logger.info(`Autonomous loop stopped after ${loopIterations} iterations`);
    return { success: true, data: { running: false, iterations: loopIterations } };
  });

  app.get('/v1/trading/sven/loop/status', async (request, reply) => {
    return {
      success: true,
      data: {
        running: loopRunning,
        intervalMs: loopIntervalMs,
        iterations: loopIterations,
        lastLoopAt: lastLoopAt?.toISOString() ?? null,
        circuitBreakerTripped: svenCircuitBreaker.tripped,
      },
    };
  });

  // ── Kronos Pipeline (standalone) ────────────────────────────────
  app.post('/v1/trading/kronos/predict', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const { symbol, candles, current_price } = request.body as Record<string, any>;
    if (!symbol || !Array.isArray(candles) || !current_price) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol, candles, and current_price required' } });
    }

    try {
      const result = runKronosPipeline(symbol, candles, current_price);
      broadcastEvent(createTradingEvent('prediction_ready', {
        model: 'kronos_v1',
        symbol,
        horizons: result.prediction.horizons.length,
        patterns: result.patterns.length,
      }));
      return { success: true, data: result.prediction };
    } catch (err) {
      logger.error('trading/kronos/predict error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Kronos prediction failed' } });
    }
  });

  // ── MiroFish Simulation (standalone) ────────────────────────────
  app.post('/v1/trading/mirofish/simulate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const { symbol, candles, agent_count = 1000, timesteps = 100 } = request.body as Record<string, any>;
    if (!symbol || !Array.isArray(candles)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol and candles array required' } });
    }

    try {
      const result = runMiroFishSimulation(symbol, candles, agent_count, timesteps);
      broadcastEvent(createTradingEvent('prediction_ready', {
        model: 'mirofish',
        symbol,
        consensus: result.consensusDirection,
        strength: result.consensusStrength,
        agents: result.agentCount,
      }));
      return { success: true, data: result };
    } catch (err) {
      logger.error('trading/mirofish/simulate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'MiroFish simulation failed' } });
    }
  });

  // ── Learning: Record Prediction Outcome ─────────────────────────
  app.post('/v1/trading/sven/learn', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const { model, was_correct } = request.body as Record<string, any>;
    if (!model || typeof was_correct !== 'boolean') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'model and was_correct required' } });
    }

    svenLearning = recordPredictionOutcome(svenLearning, model, was_correct);

    // Auto-adjust weights every 50 outcomes
    const accuracyValues = Object.values(svenLearning.modelAccuracy) as Array<{ correct: number; total: number; accuracy: number }>;
    const totalOutcomes = accuracyValues.reduce((s, m) => s + m.total, 0);
    if (totalOutcomes % 50 === 0 && totalOutcomes > 0) {
      svenLearning = adjustWeights(svenLearning);
      broadcastEvent(createTradingEvent('learning_update', {
        action: 'weights_adjusted',
        iteration: svenLearning.learningIterations,
        weights: svenLearning.sourceWeights,
      }));
    }

    return {
      success: true,
      data: {
        modelAccuracy: svenLearning.modelAccuracy,
        learningIterations: svenLearning.learningIterations,
      },
    };
  });

  // ── Circuit Breaker Control ─────────────────────────────────────
  app.post('/v1/trading/sven/circuit-breaker/reset', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    svenCircuitBreaker = resetCircuitBreaker();
    broadcastEvent(createTradingEvent('circuit_breaker', { action: 'reset' }));

    return { success: true, data: { circuitBreaker: svenCircuitBreaker } };
  });

  logger.info('Sven Autonomous Trading Engine routes registered (/v1/trading/sven/*)');

  // ═══════════════════════════════════════════════════════════════════
  // Broker Routes  (/v1/trading/broker/*)
  // ═══════════════════════════════════════════════════════════════════
  const brokerRegistry = createDefaultBrokerRegistry();

  app.get('/v1/trading/broker/list', async (request, reply) => {
    return { success: true, data: { brokers: brokerRegistry.list() } };
  });

  app.post('/v1/trading/broker/connect', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { broker, credentials } = request.body as Record<string, any>;
    if (!broker) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'broker name required' } });
    }
    try {
      brokerRegistry.register(broker as BrokerName, credentials || {});
      return { success: true, data: { broker, connected: true } };
    } catch (err) {
      logger.error('broker/connect error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Broker connection failed' } });
    }
  });

  app.get('/v1/trading/broker/account', async (request, reply) => {
    const { broker = 'paper' } = request.query as Record<string, string>;
    try {
      const connector = brokerRegistry.get(broker as BrokerName);
      if (!connector) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Broker ${broker} not registered` } });
      }
      const account = await connector.getAccount();
      return { success: true, data: account };
    } catch (err) {
      logger.error('broker/account error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get account' } });
    }
  });

  app.post('/v1/trading/broker/order', { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { broker = 'paper', symbol, side, quantity, type = 'market', limitPrice, timeInForce = 'GTC' } = request.body as Record<string, any>;
    if (!symbol || !side || !quantity) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol, side, quantity required' } });
    }
    try {
      const connector = brokerRegistry.get(broker as BrokerName);
      if (!connector) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Broker ${broker} not registered` } });
      }
      const clientOrderId = `gw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await connector.submitOrder({ symbol, side, quantity: Number(quantity), type, price: limitPrice ? Number(limitPrice) : undefined, timeInForce, clientOrderId });
      broadcastEvent(createTradingEvent('broker_order', { broker, symbol, side, quantity, result }));
      return { success: true, data: result };
    } catch (err) {
      logger.error('broker/order error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Order submission failed' } });
    }
  });

  app.get('/v1/trading/broker/positions', async (request, reply) => {
    const { broker = 'paper' } = request.query as Record<string, string>;
    try {
      const connector = brokerRegistry.get(broker as BrokerName);
      if (!connector) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Broker ${broker} not registered` } });
      }
      const positions = await connector.getPositions();
      return { success: true, data: positions };
    } catch (err) {
      logger.error('broker/positions error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get positions' } });
    }
  });

  app.get('/v1/trading/broker/health', async (request, reply) => {
    try {
      const results = await brokerRegistry.healthCheckAll();
      return { success: true, data: results };
    } catch (err) {
      logger.error('broker/health error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Health check failed' } });
    }
  });

  logger.info('Broker routes registered (/v1/trading/broker/*)');

  // ═══════════════════════════════════════════════════════════════════
  // Backtest Routes  (/v1/trading/backtest/*)
  // ═══════════════════════════════════════════════════════════════════

  app.get('/v1/trading/backtest/strategies', async (request, reply) => {
    const names = Object.keys(BUILT_IN_STRATEGIES);
    return { success: true, data: { strategies: names } };
  });

  app.post('/v1/trading/backtest/run', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { strategy, candles, symbol = 'UNKNOWN', initialCapital = 100_000, positionSizePct = 0.1, commissionPct = 0.001, slippageBps = 5, warmupBars = 50, maxOpenPositions = 1 } = request.body as Record<string, any>;
    if (!strategy || !candles || !Array.isArray(candles)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'strategy and candles[] required' } });
    }
    const stratEntry = BUILT_IN_STRATEGIES[strategy as keyof typeof BUILT_IN_STRATEGIES];
    if (!stratEntry) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `Unknown strategy: ${strategy}. Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` } });
    }
    try {
      const config: BacktestConfig = {
        symbol: String(symbol),
        strategyName: strategy,
        strategy: stratEntry.create(),
        candles: candles.map((c: any) => ({ open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume || 0), timestamp: Number(c.timestamp) })),
        initialCapital: Number(initialCapital),
        positionSizePct: Number(positionSizePct),
        commissionPct: Number(commissionPct),
        slippageBps: Number(slippageBps),
        warmupBars: Number(warmupBars),
        maxOpenPositions: Number(maxOpenPositions),
      };
      const result = runBacktest(config);
      /* Persist backtest result to DB */
      try {
        await pool.query(
          `INSERT INTO trading_backtest_results (org_id, user_id, strategy, symbol, initial_capital, total_trades, winning_trades, total_return, total_return_pct, max_drawdown, sharpe_ratio, profit_factor, trades, equity_curve, monthly_returns, config, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
          [
            orgId, request.userId, strategy, String(symbol),
            Number(initialCapital),
            result.performance.totalTrades,
            result.performance.winningTrades,
            result.performance.totalReturn,
            result.performance.totalReturnPct,
            result.performance.maxDrawdown,
            result.performance.sharpeRatio,
            result.performance.profitFactor,
            JSON.stringify(result.trades),
            JSON.stringify(result.equityCurve),
            JSON.stringify(result.monthlyReturns),
            JSON.stringify({ positionSizePct, commissionPct, slippageBps, warmupBars, maxOpenPositions }),
          ],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      broadcastEvent(createTradingEvent('backtest_complete', { strategy, trades: result.trades.length, performance: result.performance }));
      return { success: true, data: result };
    } catch (err) {
      logger.error('backtest/run error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Backtest execution failed' } });
    }
  });

  logger.info('Backtest routes registered (/v1/trading/backtest/*)');

  /* GET /v1/trading/backtest/history — retrieve past backtest results */
  app.get('/v1/trading/backtest/history', async (request, reply) => {
    const orgId = await resolvePublicOrg(pool, request);
    const { limit = '20' } = request.query as Record<string, string>;
    try {
      const { rows } = await pool.query(
        `SELECT id, strategy, symbol, initial_capital, total_trades, winning_trades, total_return, total_return_pct, max_drawdown, sharpe_ratio, profit_factor, config, created_at
         FROM trading_backtest_results ${orgId ? 'WHERE org_id = $1' : ''} ORDER BY created_at DESC LIMIT $${orgId ? '2' : '1'}`,
        orgId ? [orgId, Math.min(Number(limit) || 20, 100)] : [Math.min(Number(limit) || 20, 100)],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: [] };
      }
      throw err;
    }
  });
  // ═══════════════════════════════════════════════════════════════════
  // Analytics Routes  (/v1/trading/analytics/*)
  // ═══════════════════════════════════════════════════════════════════

  app.post('/v1/trading/analytics/portfolio', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { snapshots, positions, totalEquity, returnSeries } = request.body as Record<string, any>;
    if (!snapshots || !Array.isArray(snapshots) || !positions || !Array.isArray(positions) || totalEquity == null) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'snapshots[], positions[], and totalEquity required' } });
    }
    try {
      const analytics = buildPortfolioAnalytics(snapshots, positions, Number(totalEquity), returnSeries);
      return { success: true, data: analytics };
    } catch (err) {
      logger.error('analytics/portfolio error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Analytics computation failed' } });
    }
  });

  app.post('/v1/trading/analytics/drawdowns', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { snapshots } = request.body as Record<string, any>;
    if (!snapshots || !Array.isArray(snapshots)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'snapshots[] required' } });
    }
    try {
      const equityCurve = buildEquityCurve(snapshots);
      const drawdowns = computeDrawdowns(equityCurve);
      return { success: true, data: { drawdowns, equityCurve } };
    } catch (err) {
      logger.error('analytics/drawdowns error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Drawdown analysis failed' } });
    }
  });

  app.post('/v1/trading/analytics/exposure', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { positions, totalEquity } = request.body as Record<string, any>;
    if (!positions || !Array.isArray(positions) || totalEquity == null) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'positions[] and totalEquity required' } });
    }
    try {
      const exposure = computeExposure(positions, Number(totalEquity));
      return { success: true, data: exposure };
    } catch (err) {
      logger.error('analytics/exposure error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Exposure calculation failed' } });
    }
  });

  logger.info('Analytics routes registered (/v1/trading/analytics/*)');

  // ═══════════════════════════════════════════════════════════════════
  // Alert Routes  (/v1/trading/alerts/*)
  // ═══════════════════════════════════════════════════════════════════
  const alertEngine = createAlertEngine();

  // Pipe alert events to SSE
  alertEngine.onAlert((event: any) => {
    broadcastEvent(createTradingEvent('alert_triggered', {
      alertId: event.alertId,
      name: event.alertName,
      type: event.type,
      priority: event.priority,
      symbol: event.symbol,
      condition: event.condition,
      threshold: event.threshold,
      actual: event.actualValue,
      message: event.message,
    }));
  });

  app.get('/v1/trading/alerts', async (request, reply) => {
    const orgId = await resolvePublicOrg(pool, request);
    const { status } = request.query as Record<string, string>;
    /* Prefer in-memory engine; fallback to DB */
    const inMemory = status === 'active' ? alertEngine.getActive() : alertEngine.getAll();
    if (inMemory.length > 0) {
      return { success: true, data: { alerts: inMemory } };
    }
    try {
      const q = status === 'active'
        ? { text: orgId ? 'SELECT * FROM trading_alerts WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 100' : 'SELECT * FROM trading_alerts WHERE status = $1 ORDER BY created_at DESC LIMIT 100', values: orgId ? [orgId, 'active'] : ['active'] }
        : { text: orgId ? 'SELECT * FROM trading_alerts WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100' : 'SELECT * FROM trading_alerts ORDER BY created_at DESC LIMIT 100', values: orgId ? [orgId] : [] };
      const { rows } = await pool.query(q.text, q.values);
      return { success: true, data: { alerts: rows } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: { alerts: [] } };
      }
      throw err;
    }
  });

  app.post('/v1/trading/alerts', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    const { type } = body;
    if (!type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'type required (price|signal|drawdown|volatility|news)' } });
    }
    try {
      let alert;
      switch (type) {
        case 'price':
          if (!body.symbol || !body.condition || body.threshold == null) {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol, condition, and threshold required for price alert' } });
          }
          alert = createPriceAlert({
            symbol: body.symbol,
            condition: body.condition as AlertCondition,
            threshold: Number(body.threshold),
            name: body.name,
            priority: body.priority as AlertPriority,
            deliveryChannels: body.deliveryChannels as AlertDelivery[],
            cooldownMs: body.cooldownMs ? Number(body.cooldownMs) : undefined,
            maxTriggers: body.maxTriggers ? Number(body.maxTriggers) : undefined,
          });
          break;
        case 'signal':
          alert = createSignalAlert({
            symbol: body.symbol,
            minConfidence: Number(body.threshold ?? 0.7),
            direction: body.direction,
            name: body.name,
            priority: body.priority as AlertPriority,
          });
          break;
        case 'drawdown':
          alert = createDrawdownAlert({
            maxDrawdownPct: Number(body.threshold ?? 10),
            name: body.name,
            priority: body.priority as AlertPriority,
          });
          break;
        case 'volatility':
          if (!body.symbol) {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol required for volatility alert' } });
          }
          alert = createVolatilityAlert({
            symbol: body.symbol,
            volatilityThreshold: Number(body.threshold ?? 30),
            name: body.name,
            priority: body.priority as AlertPriority,
          });
          break;
        case 'news':
          alert = createNewsAlert({
            symbol: body.symbol,
            minImpactLevel: Number(body.threshold ?? 0.5),
            name: body.name,
            priority: body.priority as AlertPriority,
          });
          break;
        default:
          return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `Unknown alert type: ${type}` } });
      }
      alertEngine.add(alert);
      /* Persist to DB */
      try {
        await pool.query(
          `INSERT INTO trading_alerts (id, org_id, user_id, type, name, symbol, condition, threshold, priority, status, delivery, cooldown_ms, max_triggers, metadata, expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
          [
            alert.id, orgId, request.userId, alert.type, alert.name,
            alert.symbol ?? null, alert.condition, alert.threshold,
            alert.priority, alert.status, JSON.stringify(alert.deliveryChannels),
            alert.cooldownMs, alert.maxTriggers, JSON.stringify(alert.metadata ?? {}),
            alert.expiresAt ?? null,
          ],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      broadcastEvent(createTradingEvent('alert_created', { alertId: alert.id, type: alert.type, name: alert.name }));
      return { success: true, data: alert };
    } catch (err) {
      logger.error('alerts/create error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to create alert' } });
    }
  });

  app.delete('/v1/trading/alerts/:alertId', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { alertId } = request.params as Record<string, string>;
    const removed = alertEngine.remove(alertId);
    /* Also remove from DB */
    try { await pool.query('DELETE FROM trading_alerts WHERE id = $1 AND org_id = $2', [alertId, orgId]); } catch { /* schema compat */ }
    if (!removed) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } });
    }
    return { success: true, data: { deleted: alertId } };
  });

  app.patch('/v1/trading/alerts/:alertId/disable', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { alertId } = request.params as Record<string, string>;
    alertEngine.disable(alertId);
    try { await pool.query(`UPDATE trading_alerts SET status = 'disabled' WHERE id = $1 AND org_id = $2`, [alertId, orgId]); } catch { /* schema compat */ }
    return { success: true, data: { alertId, status: 'disabled' } };
  });

  app.patch('/v1/trading/alerts/:alertId/enable', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { alertId } = request.params as Record<string, string>;
    alertEngine.enable(alertId);
    try { await pool.query(`UPDATE trading_alerts SET status = 'active' WHERE id = $1 AND org_id = $2`, [alertId, orgId]); } catch { /* schema compat */ }
    return { success: true, data: { alertId, status: 'active' } };
  });

  app.post('/v1/trading/alerts/check-price', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { symbol, price, previousPrice } = request.body as Record<string, any>;
    if (!symbol || price == null) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol and price required' } });
    }
    const events = alertEngine.checkPrice(symbol, Number(price), previousPrice ? Number(previousPrice) : undefined);
    return { success: true, data: { triggered: events.length, events } };
  });

  logger.info('Alert routes registered (/v1/trading/alerts/*)');

  // ── Positions (DB) ──────────────────────────────────────────────
  app.get('/v1/trading/positions', async (request, reply) => {
    const orgId = await resolvePublicOrg(pool, request);
    const qs = request.query as Record<string, string>;
    const statusFilter = qs.status || 'open';
    try {
      const { rows } = await pool.query(
        `SELECT id, symbol, side, quantity, avg_entry_price AS "entryPrice",
                current_price AS "currentPrice", unrealized_pnl AS "unrealizedPnl",
                status, opened_at AS "openedAt", closed_at AS "closedAt"
         FROM trading_positions
         WHERE ${orgId ? 'org_id = $1 AND ' : ''}status = $${orgId ? '2' : '1'}
         ORDER BY opened_at DESC LIMIT 100`,
        orgId ? [orgId, statusFilter] : [statusFilter],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: [] };
      }
      throw err;
    }
  });

  // ── Predictions ─────────────────────────────────────────────────
  app.get('/v1/trading/predictions', async (request, reply) => {
    const orgId = await resolvePublicOrg(pool, request);
    try {
      const { rows } = await pool.query(
        `SELECT id, symbol, horizon, prediction, ensemble, created_at AS "createdAt"
         FROM trading_predictions
         ${orgId ? 'WHERE org_id = $1' : ''}
         ORDER BY created_at DESC LIMIT 50`,
        orgId ? [orgId] : [],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: [] };
      }
      throw err;
    }
  });

  // ── News Events ────────────────────────────────────────────────
  app.get('/v1/trading/news', async (request, reply) => {
    const orgId = await resolvePublicOrg(pool, request);
    try {
      const { rows } = await pool.query(
        `SELECT id, headline AS event, source, impact_level AS "impactLevel",
                sentiment_score AS "sentimentScore", entities, created_at AS "createdAt"
         FROM trading_news_events
         ${orgId ? 'WHERE org_id = $1' : ''}
         ORDER BY created_at DESC LIMIT 50`,
        orgId ? [orgId] : [],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: [] };
      }
      throw err;
    }
  });

  logger.info('Additional trading data routes registered (/v1/trading/positions, /predictions, /news)');

  // ═══════════════════════════════════════════════════════════════════
  // Sven Messages  (/v1/trading/sven/messages/*)
  // ═══════════════════════════════════════════════════════════════════

  // GET — public, anyone can see what Sven is saying
  app.get('/v1/trading/sven/messages', async (request, reply) => {
    const qs = request.query as Record<string, string>;
    const limit = Math.min(Number(qs.limit || 50), 100);
    const typeFilter = qs.type;
    let msgs = [...svenMessages].reverse();
    if (typeFilter) msgs = msgs.filter(m => m.type === typeFilter);
    return { success: true, data: msgs.slice(0, limit) };
  });

  // POST — auth-gated: schedule a message from Sven
  app.post('/v1/trading/sven/messages/schedule', { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { message, scheduled_for } = request.body as Record<string, any>;
    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'message string required' } });
    }
    const scheduledFor = scheduled_for ? new Date(scheduled_for) : new Date(Date.now() + 60_000);
    if (isNaN(scheduledFor.getTime())) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'invalid scheduled_for date' } });
    }
    const id = uuidv7();
    scheduledMessages.push({ id, message, scheduledFor, delivered: false });
    logger.info('Scheduled message created', { id, scheduledFor: scheduledFor.toISOString() });
    return { success: true, data: { id, scheduledFor: scheduledFor.toISOString() } };
  });

  // POST — auth-gated: ask Sven to send a message now
  app.post('/v1/trading/sven/messages/send', { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { prompt } = request.body as Record<string, any>;
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'prompt string required' } });
    }

    // Have Sven's brain generate a response — user priority (highest)
    try {
      const node = acquireGpu('user', 'fast');
      if (!node) throw new Error('No GPU node available');
      trackGpuStart(node.name, 'user');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SVEN_LLM_TIMEOUT);
      const res = await fetch(`${node.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: node.model,
          messages: [
            { role: 'system', content: 'You are Sven, the AI trading agent for 47Network. Be helpful, concise, and data-driven. Answer directly.' },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: { temperature: 0.4, num_predict: 300 },
        }),
      });
      clearTimeout(timeout);
      const latencyMs = Date.now();
      trackGpuEnd(node.name, latencyMs);
      if (!res.ok) throw new Error(`LLM ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      const reply_text = data.message?.content?.trim() ?? 'I could not generate a response right now.';

      const msg = svenSendMessage({
        type: 'system',
        title: 'Sven Response',
        body: reply_text,
        severity: 'info',
      });
      return { success: true, data: msg };
    } catch (err) {
      logger.error('sven/messages/send error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to generate response' } });
    }
  });

  // Mark message as read — auth-gated
  app.patch('/v1/trading/sven/messages/:id/read', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const msg = svenMessages.find(m => m.id === id);
    if (!msg) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } });
    msg.read = true;
    return { success: true, data: msg };
  });

  logger.info('Sven messaging routes registered (/v1/trading/sven/messages/*)');

  // ═══════════════════════════════════════════════════════════════════
  // Sven Trade Log  (/v1/trading/sven/trades)
  // ═══════════════════════════════════════════════════════════════════
  app.get('/v1/trading/sven/trades', async (request, reply) => {
    const qs = request.query as Record<string, string>;
    const limit = Math.min(Number(qs.limit || 50), 100);
    return {
      success: true,
      data: {
        trades: [...svenTradeLog].reverse().slice(0, limit),
        autoTradeEnabled: AUTO_TRADE_ENABLED,
        confidenceThreshold: AUTO_TRADE_CONFIDENCE_THRESHOLD,
        maxPositionPct: AUTO_TRADE_MAX_POSITION_PCT,
        totalExecuted: svenTradeLog.length,
      },
    };
  });

  // Toggle auto-trade — auth-gated (admin only)
  app.post('/v1/trading/sven/auto-trade/config', { preHandler: [requireAuth], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;

    const body = request.body as Record<string, any>;

    // Update mutable config when values are provided
    if (typeof body.enabled === 'boolean') {
      AUTO_TRADE_ENABLED = body.enabled;
      logger.info('Auto-trade toggled', { enabled: AUTO_TRADE_ENABLED, by: request.userId });
      broadcastEvent(createTradingEvent('activity', {
        action: 'auto_trade_toggled',
        enabled: AUTO_TRADE_ENABLED,
        by: request.userId,
      }));
    }
    if (typeof body.confidenceThreshold === 'number' && body.confidenceThreshold >= 0.1 && body.confidenceThreshold <= 1.0) {
      AUTO_TRADE_CONFIDENCE_THRESHOLD = body.confidenceThreshold;
      logger.info('Auto-trade confidence threshold updated', { threshold: AUTO_TRADE_CONFIDENCE_THRESHOLD });
    }
    if (typeof body.maxPositionPct === 'number' && body.maxPositionPct >= 0.01 && body.maxPositionPct <= 0.25) {
      AUTO_TRADE_MAX_POSITION_PCT = body.maxPositionPct;
      logger.info('Auto-trade max position updated', { maxPositionPct: AUTO_TRADE_MAX_POSITION_PCT });
    }

    return {
      success: true,
      data: {
        enabled: AUTO_TRADE_ENABLED,
        confidenceThreshold: AUTO_TRADE_CONFIDENCE_THRESHOLD,
        maxPositionPct: AUTO_TRADE_MAX_POSITION_PCT,
        totalExecuted: svenTradeLog.length,
      },
    };
  });

  logger.info('Sven trade log routes registered (/v1/trading/sven/trades)');

  /* ── Auto-start autonomous loop on boot ─────────────────── */
  const autoStart = String(process.env.SVEN_LOOP_AUTOSTART || 'true').trim().toLowerCase() !== 'false';
  if (autoStart) {
    loopRunning = true;
    loopTimer = setInterval(() => { runAutonomousLoop().catch(() => {}); }, loopIntervalMs);
    // Run first tick after 5s boot delay (let services initialise)
    setTimeout(() => { runAutonomousLoop().catch(() => {}); }, 5_000);
    logger.info('Sven autonomous loop auto-started', {
      intervalMs: loopIntervalMs,
      trackedSymbols: DEFAULT_LOOP_CONFIG.trackedSymbols,
      gpuFleet: GPU_FLEET.map(n => ({ name: n.name, role: n.role, model: n.model, endpoint: n.endpoint })),
      escalationThreshold: ESCALATION_CONFIDENCE_THRESHOLD,
    });
  }
}
