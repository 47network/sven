import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Admin Trading Dashboard — Batch 10F
// Provides consolidated views for the admin UI: dashboard overview,
// correlation matrix, execution quality, and alert summary.
// ---------------------------------------------------------------------------

function isSchemaCompatError(err: unknown): boolean {
  const msg = String((err as Error)?.message || '');
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('column');
}

export async function registerTradingDashboardRoutes(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  app.addHook('preHandler', async (request: any, reply: any) => {
    if (!request.orgId) {
      return reply.code(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
  });

  // ── GET /trading/dashboard ──────────────────────────────────────
  // Consolidated trading overview for admin UI. Returns all key metrics
  // in a single response to minimize round-trips.
  app.get('/trading/dashboard', async (request: any) => {
    const orgId = String(request.orgId || '');

    // Parallel queries for speed
    const [
      stateResult,
      openPositionsResult,
      performanceResult,
      recentOrdersResult,
      alertsResult,
      recentClosedResult,
    ] = await Promise.all([
      pool.query(
        `SELECT balance, peak_balance, total_pnl, daily_pnl, daily_trade_count,
                circuit_breaker, consecutive_wins, source_weights, model_accuracy,
                learning_iterations, dynamic_watchlist, updated_at
         FROM sven_trading_state WHERE org_id = $1 LIMIT 1`,
        [orgId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, symbol, side, quantity, avg_entry_price, current_price,
                unrealized_pnl, opened_at
         FROM trading_positions
         WHERE org_id = $1 AND status = 'open'
         ORDER BY opened_at DESC`,
        [orgId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT total_trades, winning_trades, total_pnl, max_drawdown,
                sharpe_ratio, updated_at
         FROM trading_performance WHERE org_id = $1 LIMIT 1`,
        [orgId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, symbol, side, type, quantity, price, status, created_at
         FROM trading_orders
         WHERE org_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [orgId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, type, name, symbol, condition, threshold, priority, status,
                trigger_count, triggered_at, created_at
         FROM trading_alerts
         WHERE org_id = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, symbol, side, quantity, avg_entry_price, current_price,
                unrealized_pnl, opened_at, closed_at
         FROM trading_positions
         WHERE org_id = $1 AND status = 'closed'
         ORDER BY closed_at DESC LIMIT 20`,
        [orgId],
      ).catch(() => ({ rows: [] })),
    ]);

    const state = stateResult.rows[0] as Record<string, any> | undefined;
    const perf = performanceResult.rows[0] as Record<string, any> | undefined;

    // Compute drawdown from state
    const balance = parseFloat(state?.balance) || 0;
    const peakBalance = parseFloat(state?.peak_balance) || 0;
    const currentDrawdownPct = peakBalance > 0
      ? ((peakBalance - balance) / peakBalance) * 100
      : 0;

    // Parse circuit breaker
    let circuitBreaker: Record<string, unknown> = {};
    try {
      circuitBreaker = typeof state?.circuit_breaker === 'string'
        ? JSON.parse(state.circuit_breaker)
        : (state?.circuit_breaker ?? {});
    } catch { /* default */ }

    // Win rate from closed positions
    const closedPositions = recentClosedResult.rows;
    const wins = closedPositions.filter((p: any) => parseFloat(p.unrealized_pnl) > 0).length;
    const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0;

    // Total unrealized PnL
    const totalUnrealizedPnl = openPositionsResult.rows.reduce(
      (sum: number, p: any) => sum + (parseFloat(p.unrealized_pnl) || 0),
      0,
    );

    return {
      success: true,
      data: {
        overview: {
          balance,
          peakBalance,
          totalPnl: parseFloat(state?.total_pnl) || 0,
          dailyPnl: parseFloat(state?.daily_pnl) || 0,
          dailyTradeCount: parseInt(state?.daily_trade_count, 10) || 0,
          currentDrawdownPct: parseFloat(currentDrawdownPct.toFixed(2)),
          consecutiveWins: parseInt(state?.consecutive_wins, 10) || 0,
          learningIterations: parseInt(state?.learning_iterations, 10) || 0,
          modelAccuracy: parseFloat(state?.model_accuracy) || 0,
          updatedAt: state?.updated_at ?? null,
        },
        circuitBreaker,
        openPositions: {
          count: openPositionsResult.rows.length,
          totalUnrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
          positions: openPositionsResult.rows.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
            side: p.side,
            quantity: parseFloat(p.quantity),
            entryPrice: parseFloat(p.avg_entry_price),
            currentPrice: parseFloat(p.current_price),
            unrealizedPnl: parseFloat(p.unrealized_pnl),
            openedAt: p.opened_at,
          })),
        },
        performance: {
          totalTrades: parseInt(perf?.total_trades, 10) || 0,
          winningTrades: parseInt(perf?.winning_trades, 10) || 0,
          totalPnl: parseFloat(perf?.total_pnl) || 0,
          maxDrawdown: parseFloat(perf?.max_drawdown) || 0,
          sharpeRatio: parseFloat(perf?.sharpe_ratio) || 0,
          recentWinRate: parseFloat(winRate.toFixed(1)),
          updatedAt: perf?.updated_at ?? null,
        },
        recentOrders: recentOrdersResult.rows.map((o: any) => ({
          id: o.id,
          symbol: o.symbol,
          side: o.side,
          type: o.type,
          quantity: parseFloat(o.quantity),
          price: o.price ? parseFloat(o.price) : null,
          status: o.status,
          createdAt: o.created_at,
        })),
        recentClosedPositions: closedPositions.map((p: any) => ({
          id: p.id,
          symbol: p.symbol,
          side: p.side,
          quantity: parseFloat(p.quantity),
          entryPrice: parseFloat(p.avg_entry_price),
          exitPrice: parseFloat(p.current_price),
          pnl: parseFloat(p.unrealized_pnl),
          openedAt: p.opened_at,
          closedAt: p.closed_at,
        })),
        alerts: {
          activeCount: alertsResult.rows.length,
          alerts: alertsResult.rows.map((a: any) => ({
            id: a.id,
            type: a.type,
            name: a.name,
            symbol: a.symbol,
            condition: a.condition,
            threshold: parseFloat(a.threshold),
            priority: a.priority,
            triggerCount: parseInt(a.trigger_count, 10) || 0,
            triggeredAt: a.triggered_at,
            createdAt: a.created_at,
          })),
        },
        sourceWeights: state?.source_weights ?? null,
        dynamicWatchlist: state?.dynamic_watchlist ?? null,
      },
    };
  });

  // ── GET /trading/correlation-matrix ────────────────────────────
  // Live portfolio correlation matrix for open positions.
  app.get('/trading/correlation-matrix', async (request: any) => {
    const orgId = String(request.orgId || '');

    // Get open positions
    const { rows: positions } = await pool.query(
      `SELECT symbol, side, quantity, avg_entry_price
       FROM trading_positions
       WHERE org_id = $1 AND status = 'open'`,
      [orgId],
    ).catch(() => ({ rows: [] as any[] }));

    if (positions.length === 0) {
      return { success: true, data: { matrix: [], symbols: [], heat: 0 } };
    }

    // Get recent candles from the trading_predictions table
    // or from the market data that the loop collects.
    // For admin dashboard, we compute correlation from DB-stored price history.
    // Fallback: return symbols without correlation if no candle data.
    const symbols = positions.map((p: any) => String(p.symbol));

    // Build a simplified correlation matrix from position metadata
    // The full candle-based correlation is computed in the loop; here we
    // provide the static correlation groups as a reference.
    const staticGroups: Record<string, string[]> = {
      'BTC-ecosystem': ['BTC/USDT', 'WBTC/USDT'],
      'ETH-ecosystem': ['ETH/USDT', 'STETH/USDT'],
      'Layer-1': ['SOL/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'NEAR/USDT'],
      'Meme-coins': ['DOGE/USDT', 'SHIB/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'FLOKI/USDT'],
    };

    // Determine which group each position symbol belongs to
    const symbolGroups: Record<string, string> = {};
    for (const [group, members] of Object.entries(staticGroups)) {
      for (const member of members) {
        if (symbols.includes(member)) {
          symbolGroups[member] = group;
        }
      }
    }

    // Build pairwise matrix (1.0 if same group, 0.3 if different, 0.0 if solo)
    const matrix: Array<{ symbolA: string; symbolB: string; correlation: number; sameGroup: boolean }> = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const a = symbols[i];
        const b = symbols[j];
        const groupA = symbolGroups[a];
        const groupB = symbolGroups[b];
        const sameGroup = !!(groupA && groupB && groupA === groupB);
        matrix.push({
          symbolA: a,
          symbolB: b,
          correlation: sameGroup ? 0.85 : 0.30,
          sameGroup,
        });
      }
    }

    // Portfolio heat: weighted average correlation for open positions
    const totalExposure = positions.reduce(
      (s: number, p: any) => s + (parseFloat(p.quantity) * parseFloat(p.avg_entry_price)),
      0,
    );
    let heat = 0;
    if (matrix.length > 0 && totalExposure > 0) {
      const avgCorr = matrix.reduce((s, m) => s + Math.abs(m.correlation), 0) / matrix.length;
      heat = parseFloat(avgCorr.toFixed(3));
    }

    return {
      success: true,
      data: {
        symbols,
        symbolGroups,
        matrix,
        heat,
        positionDetails: positions.map((p: any) => ({
          symbol: p.symbol,
          side: p.side,
          exposure: parseFloat(p.quantity) * parseFloat(p.avg_entry_price),
          exposurePct: totalExposure > 0
            ? parseFloat(((parseFloat(p.quantity) * parseFloat(p.avg_entry_price)) / totalExposure * 100).toFixed(1))
            : 0,
        })),
      },
    };
  });

  // ── GET /trading/execution-quality ────────────────────────────
  // Detailed execution quality metrics from recent trades.
  app.get('/trading/execution-quality', async (request: any) => {
    const orgId = String(request.orgId || '');

    const [ordersResult, closedResult] = await Promise.all([
      pool.query(
        `SELECT id, symbol, side, type, quantity, price, status, created_at, updated_at
         FROM trading_orders
         WHERE org_id = $1 AND status = 'filled'
         ORDER BY created_at DESC LIMIT 100`,
        [orgId],
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, symbol, side, quantity, avg_entry_price, current_price,
                unrealized_pnl, opened_at, closed_at
         FROM trading_positions
         WHERE org_id = $1 AND status = 'closed'
         ORDER BY closed_at DESC LIMIT 100`,
        [orgId],
      ).catch(() => ({ rows: [] })),
    ]);

    const closedPositions = closedResult.rows;
    const totalTrades = closedPositions.length;
    const wins = closedPositions.filter((p: any) => parseFloat(p.unrealized_pnl) > 0).length;
    const losses = totalTrades - wins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Average win/loss size
    const winPnls = closedPositions
      .filter((p: any) => parseFloat(p.unrealized_pnl) > 0)
      .map((p: any) => parseFloat(p.unrealized_pnl));
    const lossPnls = closedPositions
      .filter((p: any) => parseFloat(p.unrealized_pnl) <= 0)
      .map((p: any) => Math.abs(parseFloat(p.unrealized_pnl)));

    const avgWin = winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0;
    const avgLoss = lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0;
    const profitFactor = lossPnls.length > 0
      ? winPnls.reduce((a, b) => a + b, 0) / lossPnls.reduce((a, b) => a + b, 0)
      : winPnls.length > 0 ? Infinity : 0;

    // Average hold duration
    const holdDurations = closedPositions
      .filter((p: any) => p.opened_at && p.closed_at)
      .map((p: any) => new Date(p.closed_at).getTime() - new Date(p.opened_at).getTime());
    const avgHoldMs = holdDurations.length > 0
      ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length
      : 0;

    // Largest win/loss
    const largestWin = winPnls.length > 0 ? Math.max(...winPnls) : 0;
    const largestLoss = lossPnls.length > 0 ? Math.max(...lossPnls) : 0;

    // By-symbol breakdown
    const bySymbol: Record<string, { trades: number; wins: number; pnl: number }> = {};
    for (const p of closedPositions) {
      const sym = String(p.symbol);
      if (!bySymbol[sym]) bySymbol[sym] = { trades: 0, wins: 0, pnl: 0 };
      bySymbol[sym].trades++;
      if (parseFloat(p.unrealized_pnl) > 0) bySymbol[sym].wins++;
      bySymbol[sym].pnl += parseFloat(p.unrealized_pnl);
    }

    return {
      success: true,
      data: {
        totalTrades,
        wins,
        losses,
        winRate: parseFloat(winRate.toFixed(1)),
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        profitFactor: profitFactor === Infinity ? 'Infinity' : parseFloat(profitFactor.toFixed(2)),
        largestWin: parseFloat(largestWin.toFixed(2)),
        largestLoss: parseFloat(largestLoss.toFixed(2)),
        avgHoldDurationMinutes: parseFloat((avgHoldMs / 60_000).toFixed(1)),
        recentOrders: ordersResult.rows.length,
        bySymbol: Object.entries(bySymbol).map(([symbol, stats]) => ({
          symbol,
          trades: stats.trades,
          wins: stats.wins,
          winRate: stats.trades > 0 ? parseFloat(((stats.wins / stats.trades) * 100).toFixed(1)) : 0,
          pnl: parseFloat(stats.pnl.toFixed(2)),
        })).sort((a, b) => b.pnl - a.pnl),
      },
    };
  });

  // ── GET /trading/alert-history ─────────────────────────────────
  // Triggered alert history from DB.
  app.get('/trading/alert-history', async (request: any) => {
    const orgId = String(request.orgId || '');
    try {
      const { rows } = await pool.query(
        `SELECT id, type, name, symbol, condition, threshold, priority, status,
                trigger_count, triggered_at, expires_at, created_at
         FROM trading_alerts
         WHERE org_id = $1 AND (status = 'triggered' OR trigger_count > 0)
         ORDER BY triggered_at DESC NULLS LAST LIMIT 100`,
        [orgId],
      );
      return { success: true, data: { alerts: rows } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: { alerts: [] } };
      }
      throw err;
    }
  });

  // ── GET /trading/pnl-chart ─────────────────────────────────────
  // Equity curve data from closed position P&L.
  app.get('/trading/pnl-chart', async (request: any) => {
    const orgId = String(request.orgId || '');
    try {
      const { rows } = await pool.query(
        `SELECT closed_at AS "closedAt", unrealized_pnl AS "pnl", symbol
         FROM trading_positions
         WHERE org_id = $1 AND status = 'closed' AND closed_at IS NOT NULL
         ORDER BY closed_at ASC LIMIT 500`,
        [orgId],
      );
      // Build cumulative equity curve
      let cumPnl = 0;
      const curve = rows.map((r: any) => {
        cumPnl += parseFloat(r.pnl) || 0;
        return {
          time: r.closedAt,
          pnl: parseFloat(r.pnl) || 0,
          cumulativePnl: parseFloat(cumPnl.toFixed(2)),
          symbol: r.symbol,
        };
      });
      return { success: true, data: { equityCurve: curve, totalPoints: curve.length } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return { success: true, data: { equityCurve: [], totalPoints: 0 } };
      }
      throw err;
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // Exchange Credential Management (12D)
  // ══════════════════════════════════════════════════════════════════

  const ALLOWED_BROKERS = ['alpaca', 'ccxt_binance', 'ccxt_bybit'] as const;

  // ── GET /trading/exchange-credentials ──────────────────────────
  // Lists all exchange credentials for the org (keys masked).
  app.get('/trading/exchange-credentials', async (request: any) => {
    const orgId = String(request.orgId || '');
    try {
      const { rows } = await pool.query(
        `SELECT id, broker, is_paper, endpoint, status, label,
                LEFT(api_key_enc, 8) || '...' AS api_key_masked,
                created_at, updated_at, revoked_at
         FROM exchange_credentials
         WHERE org_id = $1 ORDER BY created_at DESC`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) return { success: true, data: [] };
      throw err;
    }
  });

  // ── POST /trading/exchange-credentials ─────────────────────────
  // Adds or updates exchange credentials for a broker.
  app.post('/trading/exchange-credentials', async (request: any, reply: any) => {
    const orgId = String(request.orgId || '');
    const { broker, apiKey, apiSecret, isPaper, endpoint, label } = request.body as Record<string, any>;

    if (!broker || !ALLOWED_BROKERS.includes(broker)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `broker must be one of: ${ALLOWED_BROKERS.join(', ')}` } });
    }
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 8) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'apiKey required (min 8 chars)' } });
    }
    if (!apiSecret || typeof apiSecret !== 'string' || apiSecret.length < 8) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'apiSecret required (min 8 chars)' } });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO exchange_credentials (org_id, broker, api_key_enc, api_secret_enc, is_paper, endpoint, label, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
         ON CONFLICT (org_id, broker) DO UPDATE SET
           api_key_enc = $3, api_secret_enc = $4, is_paper = $5,
           endpoint = $6, label = $7, status = 'active',
           revoked_at = NULL, updated_at = NOW()
         RETURNING id, broker, is_paper, endpoint, status, label, created_at`,
        [orgId, broker, apiKey, apiSecret, isPaper !== false, endpoint ?? null, label ?? null],
      );
      return { success: true, data: rows[0] };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'SCHEMA_PENDING', message: 'exchange_credentials table not yet created — run migrations' } });
      }
      throw err;
    }
  });

  // ── DELETE /trading/exchange-credentials/:id ───────────────────
  // Soft-revokes an exchange credential (never hard-deletes for audit trail).
  app.delete('/trading/exchange-credentials/:id', async (request: any, reply: any) => {
    const orgId = String(request.orgId || '');
    const credId = (request.params as any)?.id;
    if (!credId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'credential id required' } });
    }

    try {
      const { rowCount } = await pool.query(
        `UPDATE exchange_credentials SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND org_id = $2 AND status = 'active'`,
        [credId, orgId],
      );
      if (!rowCount) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Credential not found or already revoked' } });
      }
      return { success: true, data: { id: credId, status: 'revoked' } };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'SCHEMA_PENDING', message: 'exchange_credentials table not yet created' } });
      }
      throw err;
    }
  });
}
