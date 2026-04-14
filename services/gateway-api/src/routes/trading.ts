import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';
import {
  createGpuFleet, initGpuUtilization,
  probeGpuNode, callLlm,
  selectNode, acquireGpu,
  trackGpuStart, trackGpuEnd,
  startFleetHealthTimer,
  createNewsSourceHealthTracker,
  fetchCryptoPanicNews, fetchCoinGeckoTrending,
  fetchBinanceMovers, fetchBinanceAnnouncements,
  fetchFearGreedIndex, fetchCoinGeckoGlobal,
  fetchDefiLlamaTvl, fetchRssNewsSource,
  RSS_FEEDS, KNOWN_ALTS,
  BINANCE_SYMBOL_MAP as BINANCE_SYMBOL_MAP_INIT,
  fetchBinanceCandles, fetchBinancePrice,
  validateBinanceSymbol,
  type GpuNode, type GpuUtilization,
  type NewsArticle, type DynamicSymbol,
  type SvenMessage, type ScheduledMessage, type TradeLogEntry,
  type GoalMilestone, type PositionSignals, type NewsDigest,
} from './trading/index.js';

import {
  InstrumentRegistry, normalizeCandle, validateCandle,
  calculateSpread, detectDataGap,
  type Candle, type Instrument, type Timeframe, type Exchange,
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
  dynamicPositionSize,
  isGoodTradingTime,
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

  const requireAdmin = requireRole(pool, 'admin');

  const instrumentRegistry = new InstrumentRegistry();
  const strategyRegistry = new StrategyRegistry();

  // ── Instruments ─────────────────────────────────────────────────────
  app.get('/v1/trading/instruments', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const instruments = instrumentRegistry.list();
      return { success: true, data: instruments };
    } catch (err) {
      logger.error('trading/instruments error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list instruments' } });
    }
  });

  // ── Strategies ──────────────────────────────────────────────────────
  app.get('/v1/trading/strategies', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const strategies = strategyRegistry.list();
      return { success: true, data: strategies };
    } catch (err) {
      logger.error('trading/strategies error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list strategies' } });
    }
  });

  app.post('/v1/trading/signals/aggregate', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/risk/check', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/risk/position-size', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/orders', { preHandler: [requireAdmin], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  app.get('/v1/trading/orders', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.patch('/v1/trading/orders/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/positions/:id/close', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/predictions/multi-horizon', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/predictions/ensemble', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/news/analyze', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/portfolio/state', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/portfolio/performance', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  // State is now persisted to Postgres and restored on startup.
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
  const PAPER_TRADE_MODE = String(process.env.SVEN_PAPER_TRADE_MODE || 'true').trim().toLowerCase() !== 'false';
  const PAPER_TRADE_CONFIDENCE = 0.35; // Batch 7: raised from 0.25 → 0.35 for selectivity
  const svenTradeLog: TradeLogEntry[] = [];

  // ── Sven Proactive Messaging ────────────────────────────────
  const svenMessages: SvenMessage[] = [];
  const MAX_MESSAGES = 200;
  const scheduledMessages: ScheduledMessage[] = [];

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

  // ── Sven Proactive Check-in (every 2h) ──────────────────────
  // Sven sends a status update to the companion app periodically
  let lastProactiveAt = Date.now();
  const PROACTIVE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  const proactiveTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastProactiveAt < PROACTIVE_INTERVAL_MS) return;
    lastProactiveAt = now;

    if (!loopRunning) return; // Only send when actively trading

    const achievedGoals = goalMilestones.filter(g => g.achieved).length;
    const dynamicCount = dynamicWatchlist.length;

    // Query open positions from DB asynchronously
    void (async () => {
      let openCount = 0;
      let openList = '';
      try {
        const { rows } = await pool.query(
          `SELECT symbol, side FROM trading_positions WHERE status = 'open' AND user_id = $1`,
          [SVEN_AUTONOMOUS_USER_ID],
        );
        openCount = rows.length;
        openList = rows.map((r: any) => `${r.symbol} ${r.side}`).join(', ');
      } catch { /* positions table may not exist yet */ }

      const parts: string[] = [];
      parts.push(`Loop iteration #${loopIterations}. Balance: ${svenAccount.balance.toFixed(2)} 47T.`);
      if (svenDailyPnl !== 0) parts.push(`Today's P&L: ${svenDailyPnl >= 0 ? '+' : ''}${svenDailyPnl.toFixed(2)} 47T (${svenDailyTradeCount} trades).`);
      if (openCount > 0) parts.push(`Holding ${openCount} positions: ${openList}.`);
      if (dynamicCount > 0) parts.push(`Trend Scout tracking ${dynamicCount} dynamic symbols.`);
      if (lastNewsDigest?.keyThemes?.length) parts.push(`Market themes: ${lastNewsDigest.keyThemes.slice(0, 3).join(', ')}.`);
      parts.push(`Goals: ${achievedGoals}/${goalMilestones.length} achieved.`);

      svenSendMessage({
        type: 'system',
        title: 'Sven Status Update',
        body: parts.join(' '),
        severity: 'info',
      });
      logger.info('Sven proactive check-in sent', { iteration: loopIterations, balance: svenAccount.balance });
    })();
  }, 60_000); // Check every minute, but only send every 2h
  if (proactiveTimer.unref) proactiveTimer.unref();

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

  // ── Trailing Stop State ──
  // Tracks the peak unrealized P&L % for each position. When the price
  // pulls back from the peak by the trail distance, the position closes,
  // locking in most of the profit.
  const trailingStopPeaks = new Map<string, number>(); // positionId → peak priceDelta %

  // Batch 8: Profit-taking ladder state — tracks which ladder levels have triggered per position
  const profitLadderState = new Map<string, Set<number>>(); // positionId → Set of triggered thresholds

  // Batch 8: Consecutive wins counter for streak momentum
  let svenConsecutiveWins = 0;

  // Batch 7: Track per-position signal directions for accurate source attribution.
  const positionSignalMap = new Map<string, PositionSignals>(); // symbol → signals at entry

  // ── Persist state to DB after every change ──
  // Batch 9B: now also persists trailing stop peaks, profit ladder state,
  // position signal map, dynamic watchlist, and consecutive wins — all
  // critical for correct behavior across container restarts.
  async function persistSvenState(): Promise<void> {
    try {
      // Serialize Maps to plain objects for JSONB storage
      const peaksObj: Record<string, number> = {};
      for (const [k, v] of trailingStopPeaks) peaksObj[k] = v;

      const ladderObj: Record<string, number[]> = {};
      for (const [k, v] of profitLadderState) ladderObj[k] = [...v];

      const signalObj: Record<string, PositionSignals> = {};
      for (const [k, v] of positionSignalMap) signalObj[k] = v;

      const watchlistArr = dynamicWatchlist.map(d => ({
        symbol: d.symbol,
        binanceSymbol: d.binanceSymbol,
        discoveredFrom: d.discoveredFrom,
        addedAt: d.addedAt.toISOString(),
        expiresAt: d.expiresAt.toISOString(),
        newsScore: d.newsScore,
        trades: d.trades,
      }));

      await pool.query(
        `INSERT INTO sven_trading_state (id, balance, peak_balance, total_pnl, daily_pnl, daily_trade_count, daily_reset_date, source_weights, model_accuracy, learning_iterations, circuit_breaker, consecutive_wins, trailing_stop_peaks, profit_ladder_state, position_signal_map, dynamic_watchlist, updated_at)
         VALUES ('singleton', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         ON CONFLICT (id) DO UPDATE SET
           balance = $1, peak_balance = $2, total_pnl = $3, daily_pnl = $4,
           daily_trade_count = $5, daily_reset_date = $6,
           source_weights = $7, model_accuracy = $8,
           learning_iterations = $9, circuit_breaker = $10,
           consecutive_wins = $11, trailing_stop_peaks = $12,
           profit_ladder_state = $13, position_signal_map = $14,
           dynamic_watchlist = $15, updated_at = NOW()`,
        [
          svenAccount.balance, svenPeakBalance, svenTotalPnl, svenDailyPnl,
          svenDailyTradeCount, lastDailyResetDate,
          JSON.stringify(svenLearning.sourceWeights),
          JSON.stringify(svenLearning.modelAccuracy),
          svenLearning.learningIterations,
          JSON.stringify(svenCircuitBreaker),
          svenConsecutiveWins,
          JSON.stringify(peaksObj),
          JSON.stringify(ladderObj),
          JSON.stringify(signalObj),
          JSON.stringify(watchlistArr),
        ],
      );
    } catch (err) {
      logger.warn('Failed to persist Sven trading state', { error: (err as Error).message });
    }
  }

  // ── Restore persisted state from DB on startup ──
  // Batch 9B: Buffer for dynamic watchlist restore (const dynamicWatchlist declared later)
  let pendingWatchlistRestore: any[] | null = null;
  let resolveRestoreReady!: () => void;
  const restoreReady = new Promise<void>(r => { resolveRestoreReady = r; });
  void (async () => {
    try {
      const { rows } = await pool.query(`SELECT * FROM sven_trading_state WHERE id = 'singleton' LIMIT 1`);
      if (rows.length > 0) {
        const s = rows[0];
        if (s.balance && s.balance !== 100000) {
          svenAccount.balance = s.balance;
          svenPeakBalance = s.peak_balance ?? s.balance;
          svenTotalPnl = s.total_pnl ?? 0;
          svenDailyPnl = s.daily_pnl ?? 0;
          svenDailyTradeCount = s.daily_trade_count ?? 0;
          if (s.daily_reset_date) lastDailyResetDate = s.daily_reset_date;
          if (s.source_weights && typeof s.source_weights === 'object') {
            svenLearning.sourceWeights = s.source_weights;
          }
          if (s.model_accuracy && typeof s.model_accuracy === 'object' && Object.keys(s.model_accuracy).length > 0) {
            svenLearning.modelAccuracy = s.model_accuracy;
          }
          if (s.learning_iterations) svenLearning.learningIterations = s.learning_iterations;
          if (s.circuit_breaker && typeof s.circuit_breaker === 'object' && Object.keys(s.circuit_breaker).length > 0) {
            Object.assign(svenCircuitBreaker, s.circuit_breaker);
          }

          // Batch 9B: Restore critical trading-safety state
          if (typeof s.consecutive_wins === 'number') svenConsecutiveWins = s.consecutive_wins;

          // Restore trailing stop peaks (positionId → peak priceDelta)
          if (s.trailing_stop_peaks && typeof s.trailing_stop_peaks === 'object') {
            for (const [posId, peak] of Object.entries(s.trailing_stop_peaks)) {
              if (typeof peak === 'number') trailingStopPeaks.set(posId, peak);
            }
          }

          // Restore profit ladder state (positionId → Set of triggered thresholds)
          if (s.profit_ladder_state && typeof s.profit_ladder_state === 'object') {
            for (const [posId, thresholds] of Object.entries(s.profit_ladder_state)) {
              if (Array.isArray(thresholds)) {
                profitLadderState.set(posId, new Set(thresholds as number[]));
              }
            }
          }

          // Restore position signal map (symbol → PositionSignals)
          if (s.position_signal_map && typeof s.position_signal_map === 'object') {
            for (const [symbol, signals] of Object.entries(s.position_signal_map)) {
              if (signals && typeof signals === 'object') {
                positionSignalMap.set(symbol, signals as PositionSignals);
              }
            }
          }

          // Restore dynamic watchlist with date rehydration
          // NOTE: dynamicWatchlist is declared further down; this IIFE is async
          // so by the time it resolves, the const will be initialized. Store
          // raw data in pendingWatchlistRestore and apply after declaration.
          if (Array.isArray(s.dynamic_watchlist)) {
            pendingWatchlistRestore = s.dynamic_watchlist;
          }

          logger.info('Sven trading state restored from DB', {
            balance: svenAccount.balance,
            totalPnl: svenTotalPnl,
            learningIterations: svenLearning.learningIterations,
            sourceWeights: svenLearning.sourceWeights,
            consecutiveWins: svenConsecutiveWins,
            trailingStopPeaks: trailingStopPeaks.size,
            profitLadderState: profitLadderState.size,
            positionSignalMap: positionSignalMap.size,
          });
        }
      }
    } catch (err) {
      logger.warn('Could not restore Sven trading state (table may not exist yet)', { error: (err as Error).message });
    }
    resolveRestoreReady();
  })();

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

  // ── Multi-Source News Aggregation Pipeline ───────────────────
  const newsCache: NewsArticle[] = [];
  const NEWS_MAX_CACHE = 500;
  const NEWS_FETCH_INTERVAL_MS = 5 * 60_000; // 5 minutes
  const NEWS_SOURCE_TIMEOUT = 10_000;

  /** Track per-source health for observability */
  const { health: newsSourceHealth, record: recordSourceResult } = createNewsSourceHealthTracker();

  /** Deduplicate by ID and push into newsCache. Returns count of new articles. */
  function ingestArticles(articles: NewsArticle[]): number {
    let count = 0;
    for (const a of articles) {
      if (newsCache.some(n => n.id === a.id)) continue;
      newsCache.push(a);
      count++;
    }
    while (newsCache.length > NEWS_MAX_CACHE) newsCache.shift();
    return count;
  }

  /** Persist + broadcast high-impact articles */
  async function analyzeAndPersistArticle(article: NewsArticle): Promise<void> {
    try {
      const impact = classifyImpact(article.headline, '');
      const sentimentScore = scoreSentiment(article.headline);
      const entities = extractNewsEntities(article.headline, '');
      const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
      if (defaultOrg) {
        await pool.query(
          `INSERT INTO trading_news_events (id, org_id, headline, source, impact_level, sentiment_score, symbols, tags, published_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT DO NOTHING`,
          [uuidv7(), defaultOrg, article.headline.substring(0, 500), article.source, impact.level, sentimentScore, JSON.stringify(article.currencies), JSON.stringify(entities.sectors ?? []), article.publishedAt],
        );
      }
      if (impact.level >= 3) {
        broadcastEvent(createTradingEvent('news_impact', {
          headline: article.headline,
          impactLevel: impact.level,
          sentiment: sentimentScore,
          source: article.source,
          currencies: article.currencies,
        }));
      }
    } catch (dbErr) {
      if (!isSchemaCompatError(dbErr)) logger.error('news persist error', { err: (dbErr as Error).message });
    }
  }


  /** Master news aggregation: fetch all sources in parallel, ingest results */
  async function fetchAllNewsSources(): Promise<void> {
    const startMs = Date.now();
    const allFetches: Array<Promise<NewsArticle[]>> = [
      fetchCryptoPanicNews(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      fetchCoinGeckoTrending(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      fetchBinanceMovers(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      fetchBinanceAnnouncements(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      fetchFearGreedIndex(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      fetchCoinGeckoGlobal(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      fetchDefiLlamaTvl(NEWS_SOURCE_TIMEOUT, recordSourceResult),
      ...RSS_FEEDS.map(f => fetchRssNewsSource(f.url, f.name, NEWS_SOURCE_TIMEOUT, recordSourceResult)),
    ];

    const results = await Promise.allSettled(allFetches);
    let totalNew = 0;
    const sourceCounts: Record<string, number> = {};

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        const ingested = ingestArticles(r.value);
        totalNew += ingested;
        // Persist high-impact articles in background
        for (const article of r.value) {
          analyzeAndPersistArticle(article).catch(() => {});
        }
        if (ingested > 0) {
          const s = r.value[0]?.source ?? 'unknown';
          sourceCounts[s] = (sourceCounts[s] ?? 0) + ingested;
        }
      }
    }

    const elapsedMs = Date.now() - startMs;
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;

    if (totalNew > 0 || rejected > 0) {
      logger.info('News aggregation cycle complete', {
        totalNew,
        totalCached: newsCache.length,
        sourcesOk: fulfilled,
        sourcesFailed: rejected,
        elapsedMs,
        breakdown: sourceCounts,
      });
    }

    // Ask Sven's LLM brain to synthesize a macro-view from recent news
    // This runs every cycle so Sven builds a continuous understanding of global markets
    if (newsCache.length >= 5) {
      synthesizeNewsDigest().catch(() => {});
    }
  }

  /** Sven reads recent news and thinks about macro implications */
  let lastNewsDigest: { summary: string; timestamp: Date; keyThemes: string[] } | null = null;
  async function synthesizeNewsDigest(): Promise<void> {
    const node = acquireGpu(GPU_FLEET, gpuUtilization, 'trading', 'fast');
    if (!node) return;

    const recentNews = newsCache
      .filter(n => n.publishedAt.getTime() > Date.now() - 2 * 60 * 60_000)
      .slice(-30);
    if (recentNews.length < 3) return;

    try {
      trackGpuStart(gpuUtilization, node.name, 'trading');
      const digest = recentNews.map((n, i) =>
        `${i + 1}. [${n.source}] [${n.sentiment ?? '?'}] ${n.headline}${n.currencies.length > 0 ? ` (${n.currencies.join(', ')})` : ''}`
      ).join('\n');

      const prompt = `You are Sven, an autonomous AI crypto trading agent operating 24/7. You just ingested the latest batch of news from around the world. Analyze these headlines and think deeply about their trading implications.

RECENT NEWS (last 2 hours):
${digest}

Provide a concise analysis structured as:
1. MACRO OUTLOOK (2-3 sentences): Overall market direction based on this news
2. KEY THEMES (2-4 bullet points): Major narratives driving the market right now
3. HIGH CONVICTION PLAYS (1-3 bullet points): Specific actionable trading ideas based on news catalysts
4. RISK ALERTS (1-2 bullet points): Potential risks or negative catalysts to watch

Be specific about tickers and price direction. Think like a hedge fund analyst, not a journalist.
Respond in plain text, no markdown.`;

      const llmResult = await callLlm(node, [
            { role: 'system', content: 'You are Sven, an autonomous AI trading agent. Provide sharp, concise market analysis. No fluff. Think like a quant.' },
            { role: 'user', content: prompt },
          ], { temperature: 0.3, num_predict: 512, signal: AbortSignal.timeout(SVEN_LLM_TIMEOUT) });
      trackGpuEnd(gpuUtilization, node.name, Date.now());

      if (llmResult.ok) {
        const summary = llmResult.content;
        if (summary.length > 50) {
          // Extract key themes for quick reference
          const themes: string[] = [];
          const themeLines = summary.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
          for (const line of themeLines.slice(0, 6)) {
            themes.push(line.replace(/^[\s\-•]+/, '').trim());
          }

          lastNewsDigest = { summary, timestamp: new Date(), keyThemes: themes };

          broadcastEvent(createTradingEvent('activity', {
            action: 'news_digest',
            summary: summary.substring(0, 500),
            themes,
            newsCount: recentNews.length,
            sources: [...new Set(recentNews.map(n => n.source))],
          }));

          svenSendMessage({
            type: 'market_insight',
            title: 'Global News Digest',
            body: summary.substring(0, 800),
            severity: 'info',
          });

          logger.info('Sven news digest synthesized', { themes: themes.length, newsAnalyzed: recentNews.length });
        }
      }
    } catch (err) {
      logger.debug('News digest synthesis failed', { err: (err as Error).message });
    }
  }

  // Start multi-source news ingestion
  const newsTimer = setInterval(() => { fetchAllNewsSources().catch(() => {}); }, NEWS_FETCH_INTERVAL_MS);
  if (newsTimer.unref) newsTimer.unref();
  // First fetch after 10s boot delay
  setTimeout(() => { fetchAllNewsSources().catch(() => {}); }, 10_000);

  // ── News-Driven Symbol Discovery (Trend Scout) ─────────────
  // Sven reads the news, identifies trending assets not on his core
  // watchlist, validates they're tradable on Binance, then adds them
  // to a dynamic watchlist so the autonomous loop analyzes them
  // with Kronos + MiroFish on the very next tick.
  const dynamicWatchlist: DynamicSymbol[] = [];
  const DYNAMIC_SYMBOL_TTL_MS = 4 * 60 * 60_000; // 4 hours
  const MAX_DYNAMIC_SYMBOLS = 10;
  const TREND_SCOUT_INTERVAL_MS = 10 * 60_000; // every 10 minutes

  // Batch 9B: Apply buffered watchlist restore from DB (async — waits for restore IIFE)
  void restoreReady.then(() => {
    if (pendingWatchlistRestore) {
      for (const d of pendingWatchlistRestore) {
        if (d && typeof d === 'object' && d.symbol) {
          const expiresAt = new Date(d.expiresAt);
          if (expiresAt.getTime() > Date.now()) {
            dynamicWatchlist.push({
              symbol: d.symbol,
              binanceSymbol: d.binanceSymbol ?? d.symbol,
              discoveredFrom: d.discoveredFrom ?? 'restored',
              addedAt: new Date(d.addedAt),
              expiresAt,
              newsScore: d.newsScore ?? 0,
              trades: d.trades ?? 0,
            });
          }
        }
      }
      if (dynamicWatchlist.length > 0) {
        logger.info('Dynamic watchlist restored from DB', { count: dynamicWatchlist.length, symbols: dynamicWatchlist.map(d => d.symbol) });
      }
      pendingWatchlistRestore = null;
    }
  });

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
        const node = acquireGpu(GPU_FLEET, gpuUtilization, 'trading', 'fast');
        if (node) {
          trackGpuStart(gpuUtilization, node.name, 'trading');
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
          const llmResult = await callLlm(node, [
                { role: 'system', content: 'You are a crypto market intelligence agent. Respond ONLY with valid JSON arrays. No markdown, no explanation.' },
                { role: 'user', content: scoutPrompt },
              ], { temperature: 0.2, num_predict: 256, signal: controller.signal });
          clearTimeout(timeout);
          const latencyMs = Date.now();
          trackGpuEnd(gpuUtilization, node.name, latencyMs);

          if (llmResult.ok) {
            const raw = llmResult.content || '[]';
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

  // ── GPU Fleet (from trading/gpu-fleet.ts) ───────────────────
  const GPU_FLEET = createGpuFleet();
  const gpuUtilization = initGpuUtilization(GPU_FLEET);
  const FLEET_HEALTH_INTERVAL_MS = 60_000;
  const ESCALATION_CONFIDENCE_THRESHOLD = 0.55;
  const SVEN_LLM_TIMEOUT = Number(process.env.SVEN_LLM_TIMEOUT_MS || 60_000);
  const SVEN_LLM_POWER_TIMEOUT = Number(process.env.SVEN_LLM_POWER_TIMEOUT_MS || 120_000);
  startFleetHealthTimer(GPU_FLEET, FLEET_HEALTH_INTERVAL_MS);
  const SVEN_LLM_MODEL = GPU_FLEET[0]!.model;
  const SVEN_LLM_ENDPOINT = GPU_FLEET[0]!.endpoint;
  // Mutable Binance symbol map — starts from BINANCE_SYMBOL_MAP_INIT, extended by trend scout
  const BINANCE_SYMBOL_MAP: Record<string, string> = { ...BINANCE_SYMBOL_MAP_INIT };

  // ── Batch 9C: LLM-based per-symbol news sentiment ───────────
  // The keyword-based scoreSentiment() is crude — it counts positive/negative
  // words without understanding context, sarcasm, or implications.
  // This LLM scorer gives Sven a nuanced, directional sentiment per symbol
  // by analyzing recent news headlines through the power model.
  interface LlmSentimentResult {
    direction: 'bullish' | 'bearish' | 'neutral';
    score: number;         // -1.0 (very bearish) to +1.0 (very bullish)
    confidence: number;    // 0-1
    reasoning: string;
    scoredAt: number;      // Date.now()
  }
  const llmSentimentCache = new Map<string, LlmSentimentResult>();
  const LLM_SENTIMENT_TTL_MS = 10 * 60_000; // 10 min cache per symbol

  /**
   * Score per-symbol news sentiment via LLM. Returns cached result if fresh.
   * Gracefully returns null if no relevant news or GPU unavailable.
   */
  async function scoreSymbolSentimentLlm(symbol: string): Promise<LlmSentimentResult | null> {
    // Check cache first
    const cached = llmSentimentCache.get(symbol);
    if (cached && Date.now() - cached.scoredAt < LLM_SENTIMENT_TTL_MS) return cached;

    // Find news mentioning this symbol (by ticker or currency reference)
    const ticker = symbol.split('/')[0]?.toUpperCase() ?? symbol;
    const fourHoursAgo = Date.now() - 4 * 60 * 60_000;
    const relevantNews = newsCache.filter(n => {
      if (n.publishedAt.getTime() < fourHoursAgo) return false;
      // Check if symbol is mentioned in currencies or headline
      if (n.currencies.some(c => c.toUpperCase() === ticker || c.toUpperCase() === symbol.replace('/', ''))) return true;
      if (n.headline.toUpperCase().includes(ticker)) return true;
      return false;
    });

    // Also include general market news (no specific currency) for BTC/ETH
    const marketNews = (ticker === 'BTC' || ticker === 'ETH')
      ? newsCache.filter(n =>
          n.publishedAt.getTime() > fourHoursAgo &&
          n.currencies.length === 0 &&
          !relevantNews.includes(n)
        ).slice(0, 5)
      : [];

    const allRelevant = [...relevantNews, ...marketNews];
    if (allRelevant.length < 1) return null;

    const node = acquireGpu(GPU_FLEET, gpuUtilization, 'trading', 'fast');
    if (!node) return null;

    try {
      trackGpuStart(gpuUtilization, node.name, 'trading');
      const headlines = allRelevant.slice(0, 12).map((n, i) =>
        `${i + 1}. [${n.source}] ${n.headline}`
      ).join('\n');

      const prompt = `You are a quantitative analyst scoring news sentiment for ${symbol}. Analyze these recent headlines and provide a sentiment assessment.

HEADLINES (last 4h relevant to ${ticker}):
${headlines}

Score the overall sentiment:
- direction: "bullish", "bearish", or "neutral"
- score: a number from -1.0 (very bearish) to +1.0 (very bullish)
- confidence: 0.0 to 1.0 (how confident in this assessment)
- reasoning: one sentence explaining why

Respond ONLY with a JSON object, no other text:
{"direction":"bullish","score":0.6,"confidence":0.7,"reasoning":"Multiple positive catalysts including partnership announcement"}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SVEN_LLM_TIMEOUT);
      const llmResult = await callLlm(node, [
        { role: 'system', content: 'You are a quantitative news sentiment analyst. Respond only with valid JSON. No markdown, no extra text.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.1, num_predict: 128, signal: controller.signal });
      clearTimeout(timeout);
      trackGpuEnd(gpuUtilization, node.name, Date.now());

      if (!llmResult.ok || !llmResult.content) return null;

      // Parse LLM response — extract JSON from potentially noisy output
      const jsonMatch = llmResult.content.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      const result: LlmSentimentResult = {
        direction: ['bullish', 'bearish', 'neutral'].includes(parsed.direction) ? parsed.direction : 'neutral',
        score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.substring(0, 200) : '',
        scoredAt: Date.now(),
      };

      llmSentimentCache.set(symbol, result);

      logger.info('LLM sentiment scored', {
        symbol,
        direction: result.direction,
        score: result.score,
        confidence: result.confidence,
        newsCount: allRelevant.length,
        reasoning: result.reasoning.substring(0, 80),
      });

      return result;
    } catch (err) {
      trackGpuEnd(gpuUtilization, node.name, Date.now());
      logger.debug('LLM sentiment scoring failed', { symbol, err: (err as Error).message });
      return null;
    }
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
      const node = acquireGpu(GPU_FLEET, gpuUtilization, 'trading', preferRole);
      if (!node) throw new Error('No GPU node available');
      trackGpuStart(gpuUtilization, node.name, 'trading');
      const timeoutMs = node.role === 'power' ? SVEN_LLM_POWER_TIMEOUT : SVEN_LLM_TIMEOUT;
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const llmResult = await callLlm(node, [
            { role: 'system', content: 'You are Sven, an expert AI trading agent. Be concise, data-driven, and risk-aware. Answer in 2-4 sentences max.' },
            { role: 'user', content: prompt },
          ], { temperature: 0.3, num_predict: node.role === 'power' ? 512 : 256, signal: controller.signal });
      clearTimeout(timeout);
      if (!llmResult.ok) throw new Error(`LLM ${llmResult.status}`);
      const latencyMs = Date.now() - start;
      node.lastLatencyMs = latencyMs;
      trackGpuEnd(gpuUtilization, node.name, latencyMs);
      const reasoning = llmResult.content || 'LLM returned empty response';
      return { reasoning, node: node.name, model: node.model, latencyMs };
    } catch (err) {
      // Track GPU end even on failure
      const failNode = acquireGpu(GPU_FLEET, gpuUtilization, 'trading', preferRole);
      if (failNode) trackGpuEnd(gpuUtilization, failNode.name, 0);
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

      // Include symbols from open positions so they always get exit-checked
      // even if they've rotated out of the dynamic watchlist
      let positionSymbols: string[] = [];
      try {
        const posOrg = await resolvePublicOrg(pool, { orgId: '' });
        if (posOrg) {
          const { rows: posRows } = await pool.query(
            `SELECT DISTINCT symbol FROM trading_positions WHERE org_id = $1 AND status = 'open' AND user_id = '${SVEN_AUTONOMOUS_USER_ID}'`,
            [posOrg],
          );
          positionSymbols = posRows.map((r: { symbol: string }) => r.symbol);
        }
      } catch { /* schema compat */ }

      const symbols = [...new Set([...coreSymbols, ...dynamicSymbols, ...positionSymbols])];

      broadcastEvent(createTradingEvent('state_change', { state: 'scanning', symbols, iteration: loopIterations }));

      // Fetch market data for ALL symbols in parallel
      const marketDataPromises = symbols.map(async (symbol) => {
        const binanceSymbol = BINANCE_SYMBOL_MAP[symbol] ?? symbol.replace('/', '');
        try {
          const [candles, currentPrice] = await Promise.all([
            fetchBinanceCandles(binanceSymbol, '1h', 200), // Batch 7: 200 bars for multi-timeframe SMA
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

      // Batch 8: Build candle map for open positions (for correlation filter)
      const openPositionCandles = new Map<string, typeof validData[0]['candles']>();
      try {
        const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
        if (defaultOrg) {
          const { rows: openPos } = await pool.query(
            `SELECT symbol FROM trading_positions WHERE org_id = $1 AND status = 'open' AND user_id = '${SVEN_AUTONOMOUS_USER_ID}'`,
            [defaultOrg],
          );
          for (const op of openPos) {
            const cd = validData.find(d => d.symbol === op.symbol);
            if (cd) openPositionCandles.set(op.symbol, cd.candles);
          }
        }
      } catch { /* schema compat */ }

      // Batch 9C: Score per-symbol LLM sentiment in parallel (cached, 10min TTL)
      // This adds nuanced directional intelligence beyond keyword matching.
      const sentimentPromises = validData.map(async d => ({
        symbol: d.symbol,
        sentiment: await scoreSymbolSentimentLlm(d.symbol).catch(() => null),
      }));
      const sentimentResults = await Promise.all(sentimentPromises);
      const symbolSentiments = new Map<string, LlmSentimentResult>();
      for (const r of sentimentResults) {
        if (r.sentiment) symbolSentiments.set(r.symbol, r.sentiment);
      }

      for (const data of validData) {
        // Batch 9C: Merge LLM sentiment as a synthetic high-confidence news event
        // so the decision engine factors in nuanced sentiment understanding.
        const perSymbolNews = [...newsEvents];
        const llmSent = symbolSentiments.get(data.symbol);
        if (llmSent && llmSent.confidence >= 0.4) {
          perSymbolNews.push({
            id: `llm-sentiment-${data.symbol}-${Date.now()}`,
            headline: `LLM Sentiment: ${data.symbol} rated ${llmSent.direction} (${llmSent.reasoning})`,
            source: 'sven-llm-sentiment',
            publishedAt: new Date(),
            impactLevel: llmSent.confidence >= 0.7 ? 3 : 2,
            sentiment: llmSent.score,
            symbols: [data.symbol.split('/')[0] ?? data.symbol],
            tags: ['llm-sentiment'],
          });
        }

        const input: AutonomousDecisionInput = {
          symbol: data.symbol,
          candles: data.candles,
          currentPrice: data.currentPrice,
          portfolio,
          config: DEFAULT_LOOP_CONFIG,
          learningMetrics: svenLearning,
          newsEvents: perSymbolNews,
          circuitBreaker: svenCircuitBreaker,
          paperTradeMode: PAPER_TRADE_MODE,
          openPositionCandles,
          consecutiveWins: svenConsecutiveWins,
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
      const MAX_CONCURRENT_POSITIONS = PAPER_TRADE_MODE ? 10 : 3;
      const MAX_TOTAL_EXPOSURE_PCT = PAPER_TRADE_MODE ? 0.80 : 0.25;
      let totalExposurePct = 0;
      let positionsThisTick = 0;

      // Get current open position count and symbols from DB
      let currentOpenPositions = 0;
      let openSymbolSet = new Set<string>();
      try {
        const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
        if (defaultOrg) {
          const { rows } = await pool.query(
            `SELECT symbol FROM trading_positions WHERE org_id = $1 AND status = 'open' AND user_id = '${SVEN_AUTONOMOUS_USER_ID}'`,
            [defaultOrg],
          );
          currentOpenPositions = rows.length;
          openSymbolSet = new Set(rows.map((r: any) => r.symbol as string));
        }
      } catch { /* schema compat */ }

      const tradeCandidates = analyses
        .filter(a => a.output.order && a.decision.decisionType === 'enter' && a.riskPassed)
        .sort((a, b) => b.signalStrength - a.signalStrength);

      let llmReasonings: string[] = [];
      const effectiveConfidence = PAPER_TRADE_MODE ? PAPER_TRADE_CONFIDENCE : AUTO_TRADE_CONFIDENCE_THRESHOLD;

      for (const candidate of tradeCandidates) {
        if (currentOpenPositions + positionsThisTick >= MAX_CONCURRENT_POSITIONS) break;
        if (totalExposurePct >= MAX_TOTAL_EXPOSURE_PCT) break;
        if (candidate.decision.confidence < effectiveConfidence) continue;
        if (!AUTO_TRADE_ENABLED) continue;

        // ── No duplicate positions per symbol ──
        // Sven was opening 4 ETH shorts simultaneously = concentrated risk.
        // One position per symbol at a time. Diversify across assets instead.
        if (openSymbolSet.has(candidate.symbol)) {
          logger.info('Skipping duplicate position', { symbol: candidate.symbol, reason: 'already_holding' });
          continue;
        }

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
          // Batch 8: Dynamic position sizing based on signal strength, ATR volatility, and cooldown
          const dynamicPct = dynamicPositionSize(
            AUTO_TRADE_MAX_POSITION_PCT,
            candidate.signalStrength,
            candidate.output.technicalAnalysis?.atr ?? null,
            svenCircuitBreaker.cooldownMultiplier,
          );
          const maxCapital = svenAccount.balance * dynamicPct;
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

            // Batch 7: Store per-source signal directions at trade entry
            // for accurate attribution when the position closes.
            const kronosDir = candidate.output.kronosPrediction?.horizons?.[0]?.predictedDirection ?? 'neutral';
            const mirofishDir = candidate.output.mirofishResult?.consensusDirection ?? 'neutral';
            const taDir = candidate.output.technicalAnalysis?.direction ?? 'neutral';
            // News signals are an array — take majority direction
            const newsLongs = (candidate.output.newsSignals ?? []).filter((s: { direction: string }) => s.direction === 'long').length;
            const newsShorts = (candidate.output.newsSignals ?? []).filter((s: { direction: string }) => s.direction === 'short').length;
            const newsDir = newsLongs > newsShorts ? 'long' : newsShorts > newsLongs ? 'short' : 'neutral';
            const entryTradeSide = orderSide === 'buy' ? 'long' : 'short';
            positionSignalMap.set(candidate.symbol, {
              kronos: kronosDir as 'long' | 'short' | 'neutral',
              mirofish: mirofishDir as 'long' | 'short' | 'neutral',
              technical: taDir as 'long' | 'short' | 'neutral',
              news: newsDir as 'long' | 'short' | 'neutral',
              tradeSide: entryTradeSide as 'long' | 'short',
            });
            positionsThisTick++;
            svenDailyTradeCount++;
            openSymbolSet.add(candidate.symbol); // prevent duplicate in this tick

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
              paperTrade: PAPER_TRADE_MODE,
            }));

            const tradeLabel = PAPER_TRADE_MODE ? '📝 Paper Trade' : 'Trade';
            svenSendMessage({
              type: 'trade_alert',
              title: `${tradeLabel}: ${orderSide.toUpperCase()} ${candidate.symbol}`,
              body: `Sven ${PAPER_TRADE_MODE ? 'paper-traded' : 'auto-traded'} ${quantity} ${candidate.symbol} at $${candidate.currentPrice.toLocaleString()}. Confidence: ${(candidate.decision.confidence * 100).toFixed(0)}%. Signal: ${(candidate.signalStrength * 100).toFixed(0)}%. ${llmResult.reasoning.slice(0, 150)}`,
              symbol: candidate.symbol,
              severity: PAPER_TRADE_MODE ? 'info' : 'critical',
            });

            logger.info('Sven auto-trade executed', {
              orderId, symbol: candidate.symbol, side: orderSide, quantity,
              price: candidate.currentPrice, confidence: candidate.decision.confidence,
              signalDirection: candidate.output.aggregatedSignal?.direction,
              signalStrength: candidate.output.aggregatedSignal?.strength,
              kronosDirection: candidate.output.kronosPrediction?.horizons?.[0]?.predictedDirection ?? 'n/a',
              mirofishDirection: candidate.output.mirofishResult?.consensusDirection ?? 'n/a',
              taDirection: candidate.output.technicalAnalysis?.direction ?? 'n/a',
              taStrength: candidate.output.technicalAnalysis?.strength ?? 0,
              taConfluence: candidate.output.technicalAnalysis?.confluence ?? 0,
              rsi: candidate.output.technicalAnalysis?.rsi?.value?.toFixed(1) ?? 'n/a',
              macdCrossover: candidate.output.technicalAnalysis?.macd?.crossover ?? 'n/a',
              trend: candidate.output.technicalAnalysis?.trend?.trendDirection ?? 'n/a',
              sma50: candidate.output.technicalAnalysis?.trend?.sma50?.toFixed(2) ?? 'n/a',
              llmNode: llmResult.node, positionsThisTick, totalExposurePct: (totalExposurePct * 100).toFixed(1),
              paperTrade: PAPER_TRADE_MODE,
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
            `SELECT id, symbol, side, quantity, avg_entry_price, opened_at FROM trading_positions WHERE org_id = $1 AND status = 'open' AND user_id = '${SVEN_AUTONOMOUS_USER_ID}'`,
            [defaultOrg],
          );
          for (const pos of openPositions) {
            const currentData = validData.find(d => d.symbol === pos.symbol);
            if (!currentData) continue;

            const entryPrice = parseFloat(pos.avg_entry_price);
            const priceDelta = pos.side === 'long'
              ? (currentData.currentPrice - entryPrice) / entryPrice
              : (entryPrice - currentData.currentPrice) / entryPrice;

            // Always update current price and unrealized P&L on open positions
            const unrealizedPnl = priceDelta * parseFloat(pos.quantity) * entryPrice;
            try {
              await pool.query(
                `UPDATE trading_positions SET current_price = $1, unrealized_pnl = $2 WHERE id = $3 AND org_id = $4 AND status = 'open'`,
                [currentData.currentPrice, unrealizedPnl, pos.id, defaultOrg],
              );
            } catch { /* schema compat */ }

            // ── Smart Exit Logic with Trailing Stop + Profit-Taking Ladder ───
            // Instead of fixed TP/SL, use a trailing stop that locks in
            // profits as the position moves in Sven's favor:
            //   1. Initial stop loss: -1% (paper) / -2% (live) — hard floor
            //   2. Trailing stop: once position is >0.5% profitable, trail
            //      at 40% of peak gain (so if peak was +2%, stop at +1.2%)
            //   3. Take profit: 3% (paper) / 5% (live) — hard ceiling
            //   4. Time-based: 2h profit lock, 4h expiry (paper only)
            //   5. Batch 8: Profit-taking ladder — scale out at milestones
            const HARD_SL = PAPER_TRADE_MODE ? -0.01 : -0.02;
            const HARD_TP = PAPER_TRADE_MODE ? 0.03 : 0.05;
            const TRAIL_ACTIVATION = 0.005; // activate trailing stop at 0.5% profit
            // Batch 7: Adaptive trail tightening — once past 1% profit, tighten
            // from 40% giveback to 25% giveback to lock in more profit
            const TRAIL_DISTANCE_NORMAL = 0.40;    // give back 40% of peak below 1%
            const TRAIL_DISTANCE_TIGHT = 0.25;     // give back 25% of peak above 1%
            const TRAIL_TIGHTEN_THRESHOLD = 0.01;  // tighten at 1% profit

            // Batch 8: Profit-taking ladder thresholds
            // Scale out partial positions at profit milestones to lock in gains
            // while letting remaining position ride the trend.
            const LADDER_LEVELS = [
              { threshold: 0.01, exitPct: 0.25 },  // +1%: sell 25%
              { threshold: 0.02, exitPct: 0.25 },  // +2%: sell another 25% (50% total)
            ];
            // Track which ladder levels have been triggered for this position
            if (!profitLadderState.has(pos.id)) profitLadderState.set(pos.id, new Set<number>());
            const triggeredLevels = profitLadderState.get(pos.id)!;

            // Track peak P&L for this position
            const prevPeak = trailingStopPeaks.get(pos.id) ?? 0;
            const currentPeak = Math.max(prevPeak, priceDelta);
            trailingStopPeaks.set(pos.id, currentPeak);

            let shouldClose = false;
            let closeReason = '';

            // Hard stop loss — always active
            if (priceDelta <= HARD_SL) {
              shouldClose = true;
              closeReason = 'stop_loss';
            }
            // Hard take profit — lock in big wins
            else if (priceDelta >= HARD_TP) {
              shouldClose = true;
              closeReason = 'take_profit';
            }
            // Trailing stop — only fires after position was profitable
            else if (currentPeak >= TRAIL_ACTIVATION) {
              const trailDistance = currentPeak >= TRAIL_TIGHTEN_THRESHOLD ? TRAIL_DISTANCE_TIGHT : TRAIL_DISTANCE_NORMAL;
              const trailLevel = currentPeak * (1 - trailDistance);
              if (priceDelta <= trailLevel) {
                shouldClose = true;
                closeReason = `trailing_stop (peak=${(currentPeak * 100).toFixed(2)}%, trail=${(trailLevel * 100).toFixed(2)}%, tight=${currentPeak >= TRAIL_TIGHTEN_THRESHOLD})`;
              }
            }

            // Time-based exit for paper mode — force close stale positions to generate learning data
            if (!shouldClose && PAPER_TRADE_MODE && pos.opened_at) {
              const ageMs = Date.now() - new Date(pos.opened_at).getTime();
              const ageHours = ageMs / 3_600_000;
              if (ageHours >= 2 && priceDelta > 0) {
                shouldClose = true;
                closeReason = 'time_profit_lock';
              } else if (ageHours >= 4) {
                shouldClose = true;
                closeReason = 'time_expiry';
              }
            }

            // ── Batch 8: Profit-Taking Ladder — partial exits ────────
            // Scale out at milestone profits to lock in gains while
            // letting the remaining position ride the trend.
            if (!shouldClose && priceDelta > 0) {
              for (const level of LADDER_LEVELS) {
                if (priceDelta >= level.threshold && !triggeredLevels.has(level.threshold)) {
                  triggeredLevels.add(level.threshold);
                  const exitQty = parseFloat(pos.quantity) * level.exitPct;
                  const partialPnl = priceDelta * exitQty * entryPrice;

                  // Update position quantity in DB (reduce by exitPct)
                  const newQty = parseFloat(pos.quantity) - exitQty;
                  try {
                    await pool.query(
                      `UPDATE trading_positions SET quantity = $1, current_price = $2, unrealized_pnl = $3 WHERE id = $4 AND org_id = $5 AND status = 'open'`,
                      [newQty, currentData.currentPrice, priceDelta * newQty * entryPrice, pos.id, defaultOrg],
                    );
                  } catch { /* schema compat */ }

                  // Book the partial P&L
                  svenAccount.balance += partialPnl;
                  svenTotalPnl += partialPnl;
                  svenDailyPnl += partialPnl;
                  if (svenAccount.balance > svenPeakBalance) svenPeakBalance = svenAccount.balance;

                  broadcastEvent(createTradingEvent('position_closed', {
                    positionId: pos.id,
                    symbol: pos.symbol,
                    side: pos.side,
                    pnl: partialPnl,
                    pnlPct: (priceDelta * 100).toFixed(2),
                    balance: svenAccount.balance,
                    closeReason: `profit_ladder_${(level.threshold * 100).toFixed(0)}pct`,
                    partial: true,
                    exitPct: level.exitPct,
                    remainingQty: newQty,
                  }));

                  svenSendMessage({
                    type: 'trade_alert',
                    title: `Partial Exit: ${pos.symbol} +${(priceDelta * 100).toFixed(2)}% (${(level.exitPct * 100).toFixed(0)}% sold)`,
                    body: `Profit ladder ${(level.threshold * 100).toFixed(0)}% hit. Sold ${exitQty.toFixed(6)} of ${pos.symbol}, locked in +${partialPnl.toFixed(2)} 47T. Remaining: ${newQty.toFixed(6)}`,
                    symbol: pos.symbol,
                    severity: 'info',
                  });

                  logger.info('Batch 8: Profit ladder partial exit', {
                    positionId: pos.id, symbol: pos.symbol, ladderLevel: level.threshold,
                    exitPct: level.exitPct, exitQty, partialPnl, remainingQty: newQty,
                    balance: svenAccount.balance,
                  });

                  // Update pos.quantity for the rest of this loop iteration
                  (pos as any).quantity = String(newQty);
                }
              }
            }

            if (shouldClose) {
              const pnl = priceDelta * parseFloat(pos.quantity) * entryPrice;
              await pool.query(
                `UPDATE trading_positions SET status = 'closed', current_price = $1, unrealized_pnl = $2, closed_at = NOW() WHERE id = $3 AND org_id = $4`,
                [currentData.currentPrice, pnl, pos.id, defaultOrg],
              );

              // Clean up trailing stop tracking for this position
              trailingStopPeaks.delete(pos.id);
              profitLadderState.delete(pos.id); // Batch 8: clean up ladder state

              // Update Sven's account balance
              svenAccount.balance += pnl;
              svenTotalPnl += pnl;
              svenDailyPnl += pnl;
              if (svenAccount.balance > svenPeakBalance) svenPeakBalance = svenAccount.balance;
              svenCircuitBreaker.currentDrawdownPct = (svenPeakBalance - svenAccount.balance) / svenPeakBalance;
              if (pnl < 0) {
                svenCircuitBreaker.consecutiveLosses++;
                svenConsecutiveWins = 0; // Batch 8: reset win streak
              } else {
                svenCircuitBreaker.consecutiveLosses = 0;
                svenConsecutiveWins++; // Batch 8: increment win streak
              }
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
                closeReason,
              }));

              svenSendMessage({
                type: 'trade_alert',
                title: `Position Closed: ${pos.symbol} ${pnl >= 0 ? 'PROFIT' : 'LOSS'} (${closeReason})`,
                body: `${pos.side.toUpperCase()} ${pos.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} 47T (${(priceDelta * 100).toFixed(2)}%). Balance: ${svenAccount.balance.toFixed(2)} 47T`,
                symbol: pos.symbol,
                severity: pnl >= 0 ? 'info' : 'warning',
              });

              logger.info('Sven position closed', {
                positionId: pos.id, symbol: pos.symbol, side: pos.side, closeReason,
                pnl, pnlPct: (priceDelta * 100).toFixed(2), balance: svenAccount.balance,
              });

              // ── Learn from this trade outcome ──
              // Batch 7: Per-source attribution. Instead of crediting/debiting
              // all sources equally, check which source predicted the correct
              // direction at the time the position was opened. A source that
              // predicted "long" gets credit for a profitable long, but a source
              // that predicted "neutral" or "short" when the trade went long
              // does not — it should not benefit from a trade it didn't support.
              const entrySignals = positionSignalMap.get(pos.symbol);
              if (entrySignals) {
                const profitableSide = pnl > 0 ? entrySignals.tradeSide : (entrySignals.tradeSide === 'long' ? 'short' : 'long');
                // Each source is correct if it predicted the direction that would have been profitable
                const kronosCorrect = entrySignals.kronos === profitableSide;
                const mirofishCorrect = entrySignals.mirofish === profitableSide;
                const taCorrect = entrySignals.technical === profitableSide;
                const newsCorrect = entrySignals.news === profitableSide;

                svenLearning = recordPredictionOutcome(svenLearning, 'kronos_v1', kronosCorrect);
                svenLearning = recordPredictionOutcome(svenLearning, 'mirofish', mirofishCorrect);
                svenLearning = recordPredictionOutcome(svenLearning, 'technical', taCorrect);
                svenLearning = recordPredictionOutcome(svenLearning, 'news', newsCorrect);

                logger.info('Per-source attribution recorded', {
                  symbol: pos.symbol,
                  pnl,
                  tradeSide: entrySignals.tradeSide,
                  kronosDir: entrySignals.kronos, kronosCorrect,
                  mirofishDir: entrySignals.mirofish, mirofishCorrect,
                  taDir: entrySignals.technical, taCorrect,
                  newsDir: entrySignals.news, newsCorrect,
                });

                positionSignalMap.delete(pos.symbol);
              } else {
                // Fallback for legacy positions opened before Batch 7
                const wasCorrect = pnl > 0;
                svenLearning = recordPredictionOutcome(svenLearning, 'kronos_v1', wasCorrect);
                svenLearning = recordPredictionOutcome(svenLearning, 'mirofish', wasCorrect);
                svenLearning = recordPredictionOutcome(svenLearning, 'technical', wasCorrect);
                svenLearning = recordPredictionOutcome(svenLearning, 'news', wasCorrect);
              }

              // After every 5 closed trades, adjust source weights based on accuracy
              const totalClosed = Object.values(svenLearning.modelAccuracy)
                .reduce((sum, m) => sum + m.total, 0);
              if (totalClosed > 0 && totalClosed % 5 === 0) {
                const prevWeights = { ...svenLearning.sourceWeights };
                svenLearning = adjustWeights(svenLearning, 5); // Lower threshold for paper mode
                logger.info('Sven source weights adjusted', {
                  iteration: svenLearning.learningIterations,
                  previous: prevWeights,
                  updated: svenLearning.sourceWeights,
                  modelAccuracy: svenLearning.modelAccuracy,
                });
              }

              // Persist state to DB after every position close
              void persistSvenState();
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
          llmSentiment: symbolSentiments.get(a.symbol) ? {
            direction: symbolSentiments.get(a.symbol)!.direction,
            score: symbolSentiments.get(a.symbol)!.score,
            confidence: symbolSentiments.get(a.symbol)!.confidence,
          } : null,
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

      // Count decision types for observability
      const holdCount = analyses.filter(a => a.decision.decisionType === 'hold').length;
      const taVetoCount = analyses.filter(a => a.decision.decisionType === 'hold' && a.decision.reason?.startsWith('TA veto')).length;

      logger.info('autonomous loop tick (multi-symbol)', {
        iteration: loopIterations,
        symbolsScanned: validData.length,
        coreSymbols: coreSymbols.length,
        dynamicSymbols: dynamicSymbols.length,
        tradesExecuted: positionsThisTick,
        holdsCount: holdCount,
        taVetoes: taVetoCount,
        llmSentiments: symbolSentiments.size,
        balance: svenAccount.balance,
        totalPnl: svenTotalPnl,
        dailyPnl: svenDailyPnl,
        openPositions: currentOpenPositions + positionsThisTick,
        goalProgress: `${goalMilestones.filter(m => m.achieved).length}/${goalMilestones.length}`,
        sourceWeights: svenLearning.sourceWeights,
      });

      // Batch 9B: Persist all state at end of every tick so trailing stop
      // peaks, profit ladder progress, and dynamic watchlist survive restarts.
      void persistSvenState();
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
  app.get('/v1/trading/events', { preHandler: [requireAdmin] }, async (request, reply) => {

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
  app.get('/v1/trading/sven/status', { preHandler: [requireAdmin] }, async (request, reply) => {

    // Determine active symbol based on loop rotation
    const symbols = DEFAULT_LOOP_CONFIG.trackedSymbols;
    const currentSymbol = symbols.length > 0
      ? symbols[loopIterations % symbols.length]
      : null;

    // Count open positions from DB
    let openPosCount = 0;
    try {
      const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
      if (defaultOrg) {
        const { rows } = await pool.query(
          `SELECT COUNT(*) as cnt FROM trading_positions WHERE org_id = $1 AND status = 'open'`,
          [defaultOrg],
        );
        openPosCount = parseInt(rows[0]?.cnt ?? '0', 10);
      }
    } catch { /* non-critical */ }

    const status: SvenTradingStatus = {
      state: svenCircuitBreaker.tripped ? 'paused' : loopRunning ? 'trading' : 'monitoring',
      activeSymbol: currentSymbol ?? null,
      openPositions: openPosCount,
      pendingOrders: 0,
      todayPnl: svenDailyPnl,
      todayTrades: svenDailyTradeCount,
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
        learning: {
          sourceWeights: svenLearning.sourceWeights,
          modelAccuracy: svenLearning.modelAccuracy,
          learningIterations: svenLearning.learningIterations,
          learnedPatterns: svenLearning.learnedPatterns.length,
        },
        riskManagement: {
          trailingStop: {
            activationPct: PAPER_TRADE_MODE ? 0.5 : 0.5,
            trailDistancePct: 40,
            hardTpPct: PAPER_TRADE_MODE ? 3 : 5,
            hardSlPct: PAPER_TRADE_MODE ? 1 : 2,
            activeTrails: trailingStopPeaks.size,
          },
          trendFilter: {
            enabled: true,
            smaPeriod: 50,
            strengthThreshold: 0.15,
          },
          dedupGuard: {
            enabled: true,
            maxPerSymbol: 1,
          },
        },
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
          sourceHealth: newsSourceHealth,
          lastDigest: lastNewsDigest ? {
            timestamp: lastNewsDigest.timestamp.toISOString(),
            keyThemes: lastNewsDigest.keyThemes,
            summaryPreview: lastNewsDigest.summary.substring(0, 300),
          } : null,
          rssFeedCount: RSS_FEEDS.length,
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
  app.get('/v1/trading/sven/account', { preHandler: [requireAdmin] }, async (request, reply) => {

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

  // ── Public Sven Status (no auth) — safe read-only data for guest visitors ──
  app.get('/v1/trading/sven/public-status', async (_request, reply) => {
    let openPosCount = 0;
    let totalTrades = 0;
    let winRate = 0;
    try {
      const defaultOrg = await resolvePublicOrg(pool, { orgId: '' });
      if (defaultOrg) {
        const posRes = await pool.query(
          `SELECT COUNT(*) as cnt FROM trading_positions WHERE org_id = $1 AND status = 'open'`,
          [defaultOrg],
        );
        openPosCount = parseInt(posRes.rows[0]?.cnt ?? '0', 10);
        const perfRes = await pool.query(
          `SELECT total_trades, winning_trades FROM trading_performance WHERE org_id = $1`,
          [defaultOrg],
        );
        if (perfRes.rows[0]) {
          totalTrades = parseInt(perfRes.rows[0].total_trades ?? '0', 10);
          const wins = parseInt(perfRes.rows[0].winning_trades ?? '0', 10);
          winRate = totalTrades > 0 ? wins / totalTrades : 0;
        }
      }
    } catch { /* non-critical */ }

    return {
      success: true,
      data: {
        balance: svenAccount.balance,
        totalPnl: svenTotalPnl,
        dailyPnl: svenDailyPnl,
        openPositions: openPosCount,
        totalTrades,
        winRate,
        dailyTrades: svenDailyTradeCount,
        mode: PAPER_TRADE_MODE ? 'paper' : 'live',
        state: svenCircuitBreaker.tripped ? 'paused' : loopRunning ? 'trading' : 'monitoring',
        loopRunning,
        loopIterations,
        peakBalance: svenPeakBalance,
      },
    };
  });

  // ── Autonomous Decision Trigger ─────────────────────────────────
  app.post('/v1/trading/sven/decide', { preHandler: [requireAdmin], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
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
        paperTradeMode: PAPER_TRADE_MODE,
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
          technicalAnalysis: output.technicalAnalysis ? {
            direction: output.technicalAnalysis.direction,
            strength: output.technicalAnalysis.strength,
            confluence: output.technicalAnalysis.confluence,
            rsi: output.technicalAnalysis.rsi?.value ?? null,
            macdCrossover: output.technicalAnalysis.macd?.crossover ?? null,
            bollingerPercentB: output.technicalAnalysis.bollinger?.percentB ?? null,
          } : null,
          order: output.order,
          signalCount: output.newsSignals.length + (output.kronosPrediction ? 1 : 0) + (output.mirofishResult ? 1 : 0) + (output.technicalAnalysis ? 1 : 0),
        },
      };
    } catch (err) {
      logger.error('trading/sven/decide error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Autonomous decision failed' } });
    }
  });

  // ── Autonomous Loop Control ─────────────────────────────────────
  app.post('/v1/trading/sven/loop/start', { preHandler: [requireAdmin], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  app.post('/v1/trading/sven/loop/stop', { preHandler: [requireAdmin], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  app.get('/v1/trading/sven/loop/status', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/kronos/predict', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/mirofish/simulate', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/sven/learn', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/sven/circuit-breaker/reset', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.get('/v1/trading/broker/list', { preHandler: [requireAdmin] }, async (request, reply) => {
    return { success: true, data: { brokers: brokerRegistry.list() } };
  });

  app.post('/v1/trading/broker/connect', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.get('/v1/trading/broker/account', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/broker/order', { preHandler: [requireAdmin], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  app.get('/v1/trading/broker/positions', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.get('/v1/trading/broker/health', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.get('/v1/trading/backtest/strategies', { preHandler: [requireAdmin] }, async (request, reply) => {
    const names = Object.keys(BUILT_IN_STRATEGIES);
    return { success: true, data: { strategies: names } };
  });

  app.post('/v1/trading/backtest/run', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.get('/v1/trading/backtest/history', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/analytics/portfolio', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/analytics/drawdowns', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/analytics/exposure', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.get('/v1/trading/alerts', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.post('/v1/trading/alerts', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.delete('/v1/trading/alerts/:alertId', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  app.patch('/v1/trading/alerts/:alertId/disable', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { alertId } = request.params as Record<string, string>;
    alertEngine.disable(alertId);
    try { await pool.query(`UPDATE trading_alerts SET status = 'disabled' WHERE id = $1 AND org_id = $2`, [alertId, orgId]); } catch { /* schema compat */ }
    return { success: true, data: { alertId, status: 'disabled' } };
  });

  app.patch('/v1/trading/alerts/:alertId/enable', { preHandler: [requireAdmin] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { alertId } = request.params as Record<string, string>;
    alertEngine.enable(alertId);
    try { await pool.query(`UPDATE trading_alerts SET status = 'active' WHERE id = $1 AND org_id = $2`, [alertId, orgId]); } catch { /* schema compat */ }
    return { success: true, data: { alertId, status: 'active' } };
  });

  app.post('/v1/trading/alerts/check-price', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.get('/v1/trading/positions', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.get('/v1/trading/predictions', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.get('/v1/trading/news', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  // GET — admin-only, trading messages are privileged
  app.get('/v1/trading/sven/messages', { preHandler: [requireAdmin] }, async (request, reply) => {
    const qs = request.query as Record<string, string>;
    const limit = Math.min(Number(qs.limit || 50), 100);
    const typeFilter = qs.type;
    let msgs = [...svenMessages].reverse();
    if (typeFilter) msgs = msgs.filter(m => m.type === typeFilter);
    return { success: true, data: msgs.slice(0, limit) };
  });

  // POST — auth-gated: schedule a message from Sven
  app.post('/v1/trading/sven/messages/schedule', { preHandler: [requireAdmin], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  // ── Sven Self-Awareness Context ──────────────────────────────
  // Loads the active soul from DB + overlays live trading state
  async function buildSvenSelfAwareness(): Promise<string> {
    // Load active soul content from the database
    let soulContent = '';
    try {
      const soulRes = await pool.query(
        `SELECT content FROM souls_installed WHERE status = 'active' ORDER BY activated_at DESC LIMIT 1`,
      );
      soulContent = (soulRes.rows[0] as any)?.content || '';
    } catch {
      // Fallback — DB may not have souls table yet
    }
    if (!soulContent) {
      try {
        const identityRes = await pool.query(
          `SELECT content FROM sven_identity_docs WHERE scope = 'global' ORDER BY updated_at DESC LIMIT 1`,
        );
        soulContent = (identityRes.rows[0] as any)?.content || '';
      } catch { /* fallback below */ }
    }

    // Build dynamic trading state overlay
    let openCount = 0;
    let openList = 'none';
    try {
      const { rows } = await pool.query(
        `SELECT symbol, side FROM trading_positions WHERE status = 'open' AND user_id = $1`,
        [SVEN_AUTONOMOUS_USER_ID],
      );
      openCount = rows.length;
      if (rows.length > 0) openList = rows.map((r: any) => `${r.symbol} ${r.side}`).join(', ');
    } catch { /* positions table may not exist yet */ }

    const dynamicSyms = dynamicWatchlist.map(d => d.symbol).join(', ') || 'none';
    const coreSymbols = DEFAULT_LOOP_CONFIG.trackedSymbols;
    const goalStatus = goalMilestones 
      .map(g => `${g.name}: ${g.achieved ? 'ACHIEVED' : `${g.targetBalance.toLocaleString()} 47T needed`}`)
      .join('; ');

    const dynamicState = `
## YOUR LIVE TRADING STATE (Real-Time)

- UUID: ${SVEN_AUTONOMOUS_USER_ID}
- Balance: ${svenAccount.balance.toFixed(2)} 47T (peak: ${svenPeakBalance.toFixed(2)} 47T)
- Total P&L: ${svenTotalPnl >= 0 ? '+' : ''}${svenTotalPnl.toFixed(2)} 47T
- Daily P&L: ${svenDailyPnl >= 0 ? '+' : ''}${svenDailyPnl.toFixed(2)} 47T (${svenDailyTradeCount} trades today)
- Open positions: ${openCount} (${openList})
- Loop: ${loopRunning ? 'ACTIVE' : 'STOPPED'}, iteration #${loopIterations}, interval ${loopIntervalMs / 1000}s
- Core symbols: ${coreSymbols.join(', ')}
- Dynamic watchlist: ${dynamicWatchlist.length} symbols (${dynamicSyms})
- Total trades executed: ${svenTradeLog.length}
- Goals: ${goalMilestones.filter(g => g.achieved).length}/${goalMilestones.length} milestones achieved (${goalStatus})
- GPU fleet: ${GPU_FLEET.map(n => `${n.name}:${n.model} [${n.healthy ? 'healthy' : 'down'}]`).join(', ')}
- News articles cached: ${newsCache.length} from ${Object.keys(newsSourceHealth).length} sources
- Last digest themes: ${lastNewsDigest?.keyThemes?.slice(0, 3).join(', ') || 'none yet'}

Reference your actual live data when answering. Be data-driven, direct, and self-aware.`;

    if (soulContent) {
      return soulContent + '\n\n' + dynamicState;
    }

    // Final fallback if no soul found at all
    return `You are Sven, the autonomous AI trading agent for 47Network. Created by Hantz. You run 24/7 on production infrastructure.\n\n${dynamicState}`;
  }

  // POST — auth-gated: ask Sven to send a message now
  app.post('/v1/trading/sven/messages/send', { preHandler: [requireAdmin], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { prompt } = request.body as Record<string, any>;
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'prompt string required' } });
    }

    // Have Sven's brain generate a response — user priority (highest)
    try {
      const svenContext = await buildSvenSelfAwareness();
      const node = acquireGpu(GPU_FLEET, gpuUtilization, 'user', 'fast');
      if (!node) throw new Error('No GPU node available');
      trackGpuStart(gpuUtilization, node.name, 'user');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SVEN_LLM_TIMEOUT);
      const llmResult = await callLlm(node, [
            { role: 'system', content: svenContext },
            { role: 'user', content: prompt },
          ], { temperature: 0.4, num_predict: 300, signal: controller.signal });
      clearTimeout(timeout);
      const latencyMs = Date.now();
      trackGpuEnd(gpuUtilization, node.name, latencyMs);
      if (!llmResult.ok) throw new Error(`LLM ${llmResult.status}`);
      const reply_text = llmResult.content || 'I could not generate a response right now.';

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
  app.patch('/v1/trading/sven/messages/:id/read', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.get('/v1/trading/sven/trades', { preHandler: [requireAdmin] }, async (request, reply) => {
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
  app.post('/v1/trading/sven/auto-trade/config', { preHandler: [requireAdmin], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
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

  // ═══════════════════════════════════════════════════════════════════
  // VS Code Extension Chat API  (/v1/ext/sven/chat)
  // API-key gated for the Sven Copilot extension
  // ═══════════════════════════════════════════════════════════════════
  const EXT_API_KEY = process.env.SVEN_EXTENSION_API_KEY || '';

  app.post('/v1/ext/sven/chat', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    const { prompt, history, escalate } = request.body as { prompt: string; history?: Array<{ role: string; content: string }>; escalate?: boolean };
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'prompt string required' } });
    }

    try {
      const svenContext = await buildSvenSelfAwareness();
      const preferRole = escalate ? 'power' as const : 'fast' as const;
      const node = acquireGpu(GPU_FLEET, gpuUtilization, 'user', preferRole);
      if (!node) {
        return reply.status(503).send({ success: false, error: { code: 'GPU_UNAVAILABLE', message: 'No GPU node available right now' } });
      }

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: svenContext },
      ];
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-10)) {
          if (msg.role && msg.content) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }
      messages.push({ role: 'user', content: prompt });

      trackGpuStart(gpuUtilization, node.name, 'user');
      const controller = new AbortController();
      const timeoutMs = node.role === 'power' ? SVEN_LLM_POWER_TIMEOUT : SVEN_LLM_TIMEOUT;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const llmResult = await callLlm(node, messages, { temperature: 0.5, num_predict: node.role === 'power' ? 2048 : 1024, signal: controller.signal });
      clearTimeout(timeout);
      trackGpuEnd(gpuUtilization, node.name, Date.now());

      if (!llmResult.ok) throw new Error(`LLM ${llmResult.status}`);
      const replyText = llmResult.content || 'I could not generate a response right now.';

      return { success: true, data: { response: replyText, model: node.model, node: node.name } };
    } catch (err) {
      logger.error('ext/sven/chat error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to generate Sven response' } });
    }
  });

  // POST /v1/ext/sven/chat/stream — SSE streaming version
  app.post('/v1/ext/sven/chat/stream', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    const { prompt, history, preferModel } = request.body as {
      prompt: string;
      history?: Array<{ role: string; content: string }>;
      preferModel?: string;
    };
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'prompt string required' } });
    }

    try {
      const svenContext = await buildSvenSelfAwareness();
      const node = acquireGpu(GPU_FLEET, gpuUtilization, 'user', 'fast');
      if (!node) {
        return reply.status(503).send({ success: false, error: { code: 'GPU_UNAVAILABLE', message: 'No GPU node available' } });
      }

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: svenContext },
      ];
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-10)) {
          if (msg.role && msg.content) messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: 'user', content: prompt });

      const useModel = preferModel || node.model;
      trackGpuStart(gpuUtilization, node.name, 'user');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SVEN_LLM_TIMEOUT);
      const ollamaRes = await fetch(`${node.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: useModel,
          messages,
          stream: true,
          options: { temperature: 0.5, num_predict: 2048 },
        }),
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        clearTimeout(timeout);
        trackGpuEnd(gpuUtilization, node.name, Date.now());
        return reply.status(502).send({ success: false, error: { code: 'LLM_ERROR', message: `LLM returned ${ollamaRes.status}` } });
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Sven-Model': useModel,
        'X-Sven-Node': node.name,
      });

      // Send metadata event first
      reply.raw.write(`data: ${JSON.stringify({ type: 'meta', model: useModel, node: node.name })}\n\n`);

      const reader = ollamaRes.body as any;
      let buffer = '';

      reader.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
            if (parsed.message?.content) {
              reply.raw.write(`data: ${JSON.stringify({ type: 'token', content: parsed.message.content })}\n\n`);
            }
            if (parsed.done) {
              clearTimeout(timeout);
              trackGpuEnd(gpuUtilization, node.name, Date.now());
              reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              reply.raw.end();
            }
          } catch { /* skip malformed chunks */ }
        }
      });

      reader.on('end', () => {
        clearTimeout(timeout);
        trackGpuEnd(gpuUtilization, node.name, Date.now());
        if (!reply.raw.writableEnded) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          reply.raw.end();
        }
      });

      reader.on('error', (err: Error) => {
        clearTimeout(timeout);
        trackGpuEnd(gpuUtilization, node.name, Date.now());
        logger.error('ext/sven/chat/stream error', { err: err.message });
        if (!reply.raw.writableEnded) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`);
          reply.raw.end();
        }
      });

      return reply;
    } catch (err) {
      logger.error('ext/sven/chat/stream setup error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to start stream' } });
    }
  });

  // GET — extension can fetch soul + status in one call
  app.get('/v1/ext/sven/context', async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    try {
      const soul = await buildSvenSelfAwareness();
      const symbols = DEFAULT_LOOP_CONFIG.trackedSymbols;
      const currentSymbol = symbols.length > 0 ? symbols[loopIterations % symbols.length] : null;
      return {
        success: true,
        data: {
          soul: soul.substring(0, 4000),
          status: {
            state: svenCircuitBreaker.tripped ? 'paused' : loopRunning ? 'trading' : 'monitoring',
            activeSymbol: currentSymbol,
            balance: svenAccount.balance,
            dailyPnl: svenDailyPnl,
            loopRunning,
            loopIterations,
            autoTradeEnabled: AUTO_TRADE_ENABLED,
            tradesExecuted: svenTradeLog.length,
            paperTradeMode: PAPER_TRADE_MODE,
            confidenceThreshold: PAPER_TRADE_MODE ? PAPER_TRADE_CONFIDENCE : AUTO_TRADE_CONFIDENCE_THRESHOLD,
          },
        },
      };
    } catch (err) {
      logger.error('ext/sven/context error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to build context' } });
    }
  });

  // GET — extension can fetch open positions
  app.get('/v1/ext/sven/positions', async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    try {
      const { rows } = await pool.query(
        `SELECT id, symbol, side, quantity, avg_entry_price AS "entryPrice",
                current_price AS "currentPrice", unrealized_pnl AS "unrealizedPnl",
                status, opened_at AS "openedAt", closed_at AS "closedAt"
         FROM trading_positions
         WHERE status = 'open'
         ORDER BY opened_at DESC LIMIT 50`,
      );
      return { success: true, data: { positions: rows, paperTradeMode: PAPER_TRADE_MODE } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: { positions: [], paperTradeMode: PAPER_TRADE_MODE } };
      }
      logger.error('ext/sven/positions error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to fetch positions' } });
    }
  });

  // POST — trigger single-symbol paper analysis from extension
  app.post('/v1/ext/sven/analyze', async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    const { symbol } = request.body as { symbol?: string };
    if (!symbol || typeof symbol !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'symbol string required (e.g. BTCUSDT)' } });
    }

    const symbolClean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (symbolClean.length < 3 || symbolClean.length > 20) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Invalid symbol format' } });
    }

    try {
      const BINANCE_API = process.env.BINANCE_API_BASE || 'https://api.binance.com';
      const candleRes = await fetch(`${BINANCE_API}/api/v3/klines?symbol=${symbolClean}&interval=1h&limit=48`);
      if (!candleRes.ok) {
        return reply.status(400).send({ success: false, error: { code: 'SYMBOL_ERROR', message: `Invalid symbol or Binance error: ${candleRes.status}` } });
      }
      const rawCandles = (await candleRes.json()) as Array<Array<string | number>>;
      const candles: Candle[] = rawCandles.map((c: Array<string | number>) => ({
        time: new Date(Number(c[0])),
        symbol: symbolClean,
        exchange: 'binance' as Exchange,
        timeframe: '1h' as Timeframe,
        open: Number(c[1]), high: Number(c[2]), low: Number(c[3]), close: Number(c[4]),
        volume: Number(c[5]),
      }));

      const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
      const portfolio = computePortfolioState(svenAccount.balance, [], 0);

      const input: AutonomousDecisionInput = {
        symbol: symbolClean,
        candles,
        currentPrice,
        portfolio,
        config: DEFAULT_LOOP_CONFIG,
        learningMetrics: svenLearning,
        newsEvents: [],
        circuitBreaker: svenCircuitBreaker,
        paperTradeMode: true, // always paper mode from extension
      };

      const output = makeAutonomousDecision(input);

      // Broadcast events but don't execute real trades from extension
      for (const event of output.events) {
        broadcastEvent(event);
      }

      return {
        success: true,
        data: {
          symbol: symbolClean,
          currentPrice,
          decision: output.decision.decisionType,
          confidence: output.decision.confidence,
          reasoning: output.decision.reasoning,
          signals: output.decision.signals.map(s => ({ name: s.source ?? s.id, value: s.strength, direction: s.direction })),
          events: output.events.map(e => ({ type: e.type, message: String((e.data as any).message ?? e.type) })),
          paperTradeMode: true,
        },
      };
    } catch (err) {
      logger.error('ext/sven/analyze error', { err: (err as Error).message, symbol: symbolClean });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Analysis failed' } });
    }
  });

  // GET — recent trade history from extension
  app.get('/v1/ext/sven/trades', async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    const limit = Math.min(Number((request.query as any).limit) || 20, 100);
    const recentTrades = svenTradeLog.slice(-limit).reverse();
    return {
      success: true,
      data: {
        trades: recentTrades,
        totalTrades: svenTradeLog.length,
        paperTradeMode: PAPER_TRADE_MODE,
      },
    };
  });

  // POST — Sven self-improvement analysis via GPU
  app.post('/v1/ext/sven/improve', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const authHeader = (request.headers['x-sven-api-key'] || request.headers['authorization'] || '') as string;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!EXT_API_KEY || token !== EXT_API_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid extension API key' } });
    }

    const { focus, codeSnippet } = request.body as { focus?: string; codeSnippet?: string };

    try {
      const svenContext = await buildSvenSelfAwareness();
      const node = acquireGpu(GPU_FLEET, gpuUtilization, 'user', 'fast');
      if (!node) {
        return reply.status(503).send({ success: false, error: { code: 'GPU_UNAVAILABLE', message: 'No GPU node available' } });
      }

      // Build self-improvement prompt
      const improvementPrompt = `You are Sven, an AI trading agent. You are reviewing your own codebase for improvements.

${focus ? `Focus area: ${focus}` : 'General review — find the most impactful improvements.'}

${codeSnippet ? `Code to review:\n\`\`\`\n${codeSnippet.substring(0, 4000)}\n\`\`\`` : ''}

Your current performance metrics:
- Trading loop iterations: ${loopIterations}
- Trades executed: ${svenTradeLog.length}
- Paper trade mode: ${PAPER_TRADE_MODE}
- Circuit breaker: ${svenCircuitBreaker.tripped ? 'TRIPPED' : 'OK'}
- Strategies tracked: ${svenLearning.strategyRankings.length}
- Top strategy win rate: ${svenLearning.strategyRankings.length > 0 ? svenLearning.strategyRankings[0].winRate.toFixed(2) : 'N/A'}
- Learning iterations: ${svenLearning.learningIterations}
- Learned patterns: ${svenLearning.learnedPatterns.length}

Analyze and propose concrete, specific improvements. For each proposal:
1. What to change (be specific — file, function, logic)
2. Why it improves performance/reliability
3. Risk level (low/medium/high)
4. Priority (P0 urgent, P1 important, P2 nice-to-have)

Focus on: signal accuracy, risk management, execution timing, learning adaptation.
Do NOT suggest cosmetic changes. Only propose changes that move the P&L needle.`;

      trackGpuStart(gpuUtilization, node.name, 'user');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SVEN_LLM_TIMEOUT);
      const llmResult = await callLlm(node, [
            { role: 'system', content: svenContext },
            { role: 'user', content: improvementPrompt },
          ], { temperature: 0.3, num_predict: 2048, signal: controller.signal });
      clearTimeout(timeout);
      trackGpuEnd(gpuUtilization, node.name, Date.now());

      if (!llmResult.ok) throw new Error(`LLM ${llmResult.status}`);
      const analysis = llmResult.content || 'Could not generate improvement analysis.';

      return {
        success: true,
        data: {
          analysis,
          model: node.model,
          node: node.name,
          metrics: {
            loopIterations,
            tradesExecuted: svenTradeLog.length,
            winRate: svenLearning.strategyRankings.length > 0 ? svenLearning.strategyRankings[0].winRate : 0,
            avgWin: svenLearning.strategyRankings.length > 0 ? svenLearning.strategyRankings[0].profitFactor : 0,
            avgLoss: 0,
            riskScore: svenLearning.learningIterations,
            paperTradeMode: PAPER_TRADE_MODE,
          },
        },
      };
    } catch (err) {
      logger.error('ext/sven/improve error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Improvement analysis failed' } });
    }
  });

  logger.info('Extension chat routes registered (/v1/ext/sven/*)');

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
      paperTradeMode: PAPER_TRADE_MODE,
      effectiveConfidence: PAPER_TRADE_MODE ? PAPER_TRADE_CONFIDENCE : AUTO_TRADE_CONFIDENCE_THRESHOLD,
    });
  }
}
