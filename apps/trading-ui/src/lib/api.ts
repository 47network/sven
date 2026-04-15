/* ── API Client for trading.sven.systems ──────────────────── */
import type {
  Strategy, Signal, Order, Prediction, NewsItem,
  PortfolioState, TradePerformance, RiskCheckResult, WatchlistItem,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
  });
  // Only redirect to login for write operations (POST/PUT/PATCH/DELETE) on 401.
  // GET requests are public — guests can view without auth.
  if (res.status === 401 && typeof window !== 'undefined') {
    const method = (init?.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      throw new Error('Session required for this action');
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ── Market Data ────────────────────────────────────────────── */

export function fetchInstruments(): Promise<WatchlistItem[]> {
  return request('/v1/trading/instruments');
}

/* ── Strategies ─────────────────────────────────────────────── */

export function fetchStrategies(): Promise<Strategy[]> {
  return request('/v1/trading/strategies');
}

/* ── Signals ────────────────────────────────────────────────── */

export function aggregateSignals(signals: Signal[]): Promise<Signal | null> {
  return request('/v1/trading/signals/aggregate', {
    method: 'POST',
    body: JSON.stringify({ signals }),
  });
}

/* ── Risk ───────────────────────────────────────────────────── */

export function checkRisk(body: {
  capital: number;
  positions: unknown[];
  openOrderCount: number;
  signal: Signal;
}): Promise<{ results: RiskCheckResult[]; passed: boolean }> {
  return request('/v1/trading/risk/check', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function calculatePositionSize(body: {
  method: string;
  capital: number;
  riskPct: number;
  entryPrice: number;
  stopLossPrice: number;
}): Promise<{ size: number }> {
  return request('/v1/trading/risk/position-size', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ── Orders ─────────────────────────────────────────────────── */

export function placeOrder(body: {
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price?: number;
}): Promise<Order> {
  return request('/v1/trading/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchOrders(): Promise<Order[]> {
  return request('/v1/trading/orders');
}

export function updateOrderStatus(orderId: string, status: string): Promise<{ id: string; status: string }> {
  return request(`/v1/trading/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function closePosition(positionId: string, exitPrice?: number): Promise<{ id: string; status: string; realizedPnl: number; exitPrice: number }> {
  return request(`/v1/trading/positions/${encodeURIComponent(positionId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ exit_price: exitPrice }),
  });
}

/* ── Positions ──────────────────────────────────────────────── */

export function fetchPositions(status = 'open'): Promise<unknown[]> {
  return request(`/v1/trading/positions?status=${encodeURIComponent(status)}`);
}

/* ── Predictions (historical) ───────────────────────────────── */

export function fetchPredictions(): Promise<Prediction[]> {
  return request('/v1/trading/predictions');
}

/* ── News Events (historical) ───────────────────────────────── */

export function fetchNewsEvents(): Promise<NewsItem[]> {
  return request('/v1/trading/news');
}

/* ── Predictions ────────────────────────────────────────────── */

export function fetchMultiHorizon(body: {
  symbol: string;
  model: string;
  currentPrice: number;
  directionScores: { direction: string; score: number }[];
}): Promise<Prediction[]> {
  return request('/v1/trading/predictions/multi-horizon', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function ensembleVote(predictions: Prediction[]): Promise<Prediction> {
  return request('/v1/trading/predictions/ensemble', {
    method: 'POST',
    body: JSON.stringify({ predictions }),
  });
}

/* ── News ───────────────────────────────────────────────────── */

export function analyzeNews(body: {
  source: string;
  headline: string;
  summary?: string;
  url?: string;
}): Promise<NewsItem> {
  return request('/v1/trading/news/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ── Portfolio ──────────────────────────────────────────────── */

export function fetchPortfolioState(body: {
  capital: number;
  positions: unknown[];
  openOrderCount: number;
}): Promise<PortfolioState> {
  return request('/v1/trading/portfolio/state', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchPerformance(body: {
  closedPnls: number[];
  initialCapital: number;
  holdingPeriods?: number[];
}): Promise<TradePerformance> {
  return request('/v1/trading/portfolio/performance', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ── Broker ──────────────────────────────────────────────────── */

export function fetchBrokers(): Promise<{ brokers: string[] }> {
  return request('/v1/trading/broker/list');
}

export function connectBroker(broker: string, credentials?: Record<string, string>): Promise<{ broker: string; connected: boolean }> {
  return request('/v1/trading/broker/connect', {
    method: 'POST',
    body: JSON.stringify({ broker, credentials }),
  });
}

export function fetchBrokerAccount(broker = 'paper'): Promise<{ equity: number; cash: number; buyingPower: number }> {
  return request(`/v1/trading/broker/account?broker=${encodeURIComponent(broker)}`);
}

export function submitBrokerOrder(body: {
  broker?: string;
  symbol: string;
  side: string;
  quantity: number;
  type?: string;
  limitPrice?: number;
}): Promise<{ orderId: string; status: string }> {
  return request('/v1/trading/broker/order', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchBrokerPositions(broker = 'paper'): Promise<Array<{ symbol: string; quantity: number; avgEntry: number; marketValue: number; unrealizedPl: number }>> {
  return request(`/v1/trading/broker/positions?broker=${encodeURIComponent(broker)}`);
}

export function fetchBrokerHealth(): Promise<Record<string, boolean>> {
  return request('/v1/trading/broker/health');
}

/* ── Backtest ────────────────────────────────────────────────── */

export function fetchBacktestStrategies(): Promise<{ strategies: string[] }> {
  return request('/v1/trading/backtest/strategies');
}

export function runBacktest(body: {
  strategy: string;
  candles: Array<{ open: number; high: number; low: number; close: number; volume: number; timestamp: number }>;
  initialCapital?: number;
  positionSizePct?: number;
  commissionPct?: number;
  slippagePct?: number;
  warmupBars?: number;
}): Promise<{
  trades: Array<{ entryTimestamp: number; exitTimestamp: number; side: string; entryPrice: number; exitPrice: number; pnl: number; pnlPct: number }>;
  equityCurve: Array<{ timestamp: number; equity: number }>;
  performance: TradePerformance;
  monthlyReturns: Array<{ year: number; month: number; returnPct: number }>;
}> {
  return request('/v1/trading/backtest/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function runBacktestAuto(body: {
  strategy: string;
  symbol?: string;
  timeframe?: string;
  bars?: number;
  initialCapital?: number;
}): Promise<{
  success: boolean;
  data: {
    id: string;
    strategy: string;
    symbol: string;
    timeframe: string;
    totalTrades: number;
    winningTrades: number;
    totalReturn: number;
    totalReturnPct: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    initialCapital: number;
    meta: Record<string, unknown>;
  };
}> {
  return request('/v1/trading/backtest/run-auto', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ── Exchange Credentials ────────────────────────────────────── */

export interface ExchangeCredentialData {
  id: string;
  broker: string;
  is_paper: boolean;
  endpoint: string | null;
  status: string;
  label: string | null;
  api_key_masked: string;
  created_at: string;
  revoked_at: string | null;
}

export function fetchExchangeCredentials(): Promise<{ success: boolean; data: ExchangeCredentialData[] }> {
  return request('/v1/admin/trading/exchange-credentials');
}

export function addExchangeCredential(body: {
  broker: string;
  apiKey: string;
  apiSecret: string;
  isPaper?: boolean;
  label?: string;
}): Promise<{ success: boolean }> {
  return request('/v1/admin/trading/exchange-credentials', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function revokeExchangeCredential(id: string): Promise<{ success: boolean }> {
  return request(`/v1/admin/trading/exchange-credentials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/* ── Analytics ───────────────────────────────────────────────── */

export function fetchAnalytics(body: {
  snapshots: Array<{ timestamp: number; equity: number; cash: number; positionValue: number }>;
  positions: Array<{ symbol: string; side: string; quantity: number; currentPrice: number; sector?: string }>;
  totalEquity: number;
  returnSeries?: Record<string, number[]>;
}): Promise<{
  equityCurve: Array<{ timestamp: number; equity: number; dailyReturn: number; cumulativeReturn: number }>;
  drawdowns: Array<{ drawdownPct: number; durationMs: number; recovered: boolean }>;
  rollingMetrics: Array<{ timestamp: number; sharpe: number; sortino: number; volatility: number; winRate: number }>;
  annualizedReturn: number;
  annualizedVolatility: number;
  calmarRatio: number;
  exposure: { byAsset: Record<string, { value: number; pct: number }>; byDirection: { long: number; short: number; net: number }; leverageRatio: number };
}> {
  return request('/v1/trading/analytics/portfolio', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchExposure(body: {
  positions: Array<{ symbol: string; side: string; quantity: number; currentPrice: number; sector?: string }>;
  totalEquity: number;
}): Promise<{ byAsset: Record<string, { value: number; pct: number }>; leverageRatio: number }> {
  return request('/v1/trading/analytics/exposure', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ── Alerts ───────────────────────────────────────────────────── */

export interface AlertData {
  id: string;
  type: string;
  name: string;
  symbol?: string;
  condition: string;
  threshold: number;
  priority: string;
  status: string;
  triggerCount: number;
  createdAt: string;
}

export function fetchAlerts(status?: string): Promise<{ alerts: AlertData[] }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/v1/trading/alerts${qs}`);
}

export function createAlert(body: {
  type: string;
  symbol?: string;
  condition?: string;
  threshold: number;
  name?: string;
  priority?: string;
  direction?: string;
  deliveryChannels?: string[];
  cooldownMs?: number;
  maxTriggers?: number;
}): Promise<AlertData> {
  return request('/v1/trading/alerts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteAlert(alertId: string): Promise<{ deleted: string }> {
  return request(`/v1/trading/alerts/${encodeURIComponent(alertId)}`, {
    method: 'DELETE',
  });
}

export function disableAlert(alertId: string): Promise<{ alertId: string; status: string }> {
  return request(`/v1/trading/alerts/${encodeURIComponent(alertId)}/disable`, {
    method: 'PATCH',
  });
}

export function enableAlert(alertId: string): Promise<{ alertId: string; status: string }> {
  return request(`/v1/trading/alerts/${encodeURIComponent(alertId)}/enable`, {
    method: 'PATCH',
  });
}

/* ── Autonomous Loop Control ────────────────────────────────── */

export function startLoop(intervalMs?: number): Promise<any> {
  return request('/v1/trading/sven/loop/start', {
    method: 'POST',
    body: JSON.stringify(intervalMs ? { intervalMs } : {}),
  });
}

export function stopLoop(): Promise<any> {
  return request('/v1/trading/sven/loop/stop', {
    method: 'POST',
  });
}

export function fetchLoopStatus(): Promise<any> {
  return request('/v1/trading/sven/loop/status');
}
