/* ── Sven internal trading demo data ─────────────────────────
   Market prices come from real APIs (Binance, Yahoo Finance).
   This file only contains Sven's own trading activity:
   positions, orders, signals, predictions, news, and activity feed.
   In production these come from the gateway API (/v1/trading/*).
   ──────────────────────────────────────────────────────────── */
import type {
  Position, Order, Signal,
  Prediction, NewsItem, SvenActivity,
} from './types';

export function getPositions(): Position[] {
  const now = Date.now();
  return [
    {
      symbol: 'BTC/USDT', side: 'buy', quantity: 0.5, entryPrice: 67_200, currentPrice: 68_420.50,
      stopLoss: 65_800, takeProfit: 72_000, openedAt: now - 7_200_000, lastUpdateAt: now,
      realizedPnl: 0, commission: 34.10, orderId: 'ord-001',
    },
    {
      symbol: 'ETH/USDT', side: 'buy', quantity: 5.0, entryPrice: 3_480, currentPrice: 3_542.80,
      stopLoss: 3_350, takeProfit: 3_800, openedAt: now - 14_400_000, lastUpdateAt: now,
      realizedPnl: 0, commission: 17.40, orderId: 'ord-002',
    },
    {
      symbol: 'SOL/USDT', side: 'buy', quantity: 50, entryPrice: 178.40, currentPrice: 184.65,
      stopLoss: 170, openedAt: now - 3_600_000, lastUpdateAt: now,
      realizedPnl: 0, commission: 8.92, orderId: 'ord-003',
    },
    {
      symbol: 'NVDA', side: 'buy', quantity: 10, entryPrice: 810.20, currentPrice: 824.50,
      stopLoss: 790, takeProfit: 860, openedAt: now - 86_400_000, lastUpdateAt: now,
      realizedPnl: 0, commission: 8.10, orderId: 'ord-004',
    },
  ];
}

export function getOrders(): Order[] {
  const now = Date.now();
  return [
    { id: 'ord-001', symbol: 'BTC/USDT', side: 'buy', type: 'limit', quantity: 0.5, price: 67_200, status: 'filled', filledAt: now - 7_200_000, createdAt: now - 7_260_000 },
    { id: 'ord-002', symbol: 'ETH/USDT', side: 'buy', type: 'market', quantity: 5.0, status: 'filled', filledAt: now - 14_400_000, createdAt: now - 14_400_000 },
    { id: 'ord-003', symbol: 'SOL/USDT', side: 'buy', type: 'limit', quantity: 50, price: 178.40, status: 'filled', filledAt: now - 3_600_000, createdAt: now - 3_660_000 },
    { id: 'ord-004', symbol: 'NVDA', side: 'buy', type: 'market', quantity: 10, status: 'filled', filledAt: now - 86_400_000, createdAt: now - 86_400_000 },
    { id: 'ord-005', symbol: 'AAPL', side: 'buy', type: 'limit', quantity: 20, price: 175.00, status: 'pending', createdAt: now - 1_800_000 },
    { id: 'ord-006', symbol: 'XAU/USD', side: 'sell', type: 'limit', quantity: 2, price: 2_360, status: 'pending', createdAt: now - 900_000 },
  ];
}

export function getRecentSignals(): Signal[] {
  const now = Date.now();
  return [
    { id: 'sig-001', symbol: 'BTC/USD', direction: 'long', strength: 0.82, source: 'trend-momentum', timestamp: now - 120_000 },
    { id: 'sig-002', symbol: 'ETH/USD', direction: 'long', strength: 0.64, source: 'mean-reversion', timestamp: now - 300_000 },
    { id: 'sig-003', symbol: 'SOL/USD', direction: 'long', strength: 0.91, source: 'breakout-detector', timestamp: now - 60_000 },
    { id: 'sig-004', symbol: 'TSLA', direction: 'short', strength: 0.58, source: 'sentiment-analysis', timestamp: now - 480_000 },
    { id: 'sig-005', symbol: 'EUR/USD', direction: 'neutral', strength: 0.33, source: 'macro-fundamental', timestamp: now - 720_000 },
    { id: 'sig-006', symbol: 'NVDA', direction: 'long', strength: 0.76, source: 'ml-ensemble', timestamp: now - 180_000 },
  ];
}

export function getRecentPredictions(): Prediction[] {
  const now = Date.now();
  return [
    { id: 'pred-001', createdAt: now - 60_000, model: 'bsq-transformer', symbol: 'BTC/USD', exchange: 'binance', timeframe: '1h', horizonCandles: 4, predictedClose: 69_200, predictedDirection: 'long', confidence: 0.78 },
    { id: 'pred-002', createdAt: now - 120_000, model: 'lstm-price', symbol: 'ETH/USD', exchange: 'binance', timeframe: '4h', horizonCandles: 6, predictedClose: 3_620, predictedDirection: 'long', confidence: 0.65 },
    { id: 'pred-003', createdAt: now - 180_000, model: 'bsq-transformer', symbol: 'SOL/USD', exchange: 'binance', timeframe: '1h', horizonCandles: 4, predictedClose: 192.40, predictedDirection: 'long', confidence: 0.84 },
    { id: 'pred-004', createdAt: now - 300_000, model: 'arima-classic', symbol: 'XAU/USD', exchange: 'forex', timeframe: '1d', horizonCandles: 3, predictedClose: 2_380, predictedDirection: 'long', confidence: 0.57 },
  ];
}

export function getRecentNews(): NewsItem[] {
  const now = Date.now();
  return [
    { event: 'Bitcoin ETF inflows surge to $1.2B — largest weekly inflow since launch', sentimentScore: 0.82, impact: { level: 4, category: 'regulatory' }, entities: { symbols: ['BTC'], sectors: ['crypto'], events: ['ETF'] }, isDuplicate: false, timestamp: now - 300_000 },
    { event: 'Fed signals potential rate cut in September 2024 meeting', sentimentScore: 0.65, impact: { level: 5, category: 'macro' }, entities: { symbols: ['SPX500', 'EUR/USD'], sectors: ['macro'], events: ['rate-cut'] }, isDuplicate: false, timestamp: now - 900_000 },
    { event: 'Solana TVL hits new ATH — DeFi ecosystem expansion accelerates', sentimentScore: 0.74, impact: { level: 3, category: 'ecosystem' }, entities: { symbols: ['SOL'], sectors: ['defi'], events: ['TVL'] }, isDuplicate: false, timestamp: now - 1_800_000 },
    { event: 'NVIDIA reports record Q4 earnings, beats estimates by 18%', sentimentScore: 0.88, impact: { level: 4, category: 'earnings' }, entities: { symbols: ['NVDA'], sectors: ['tech'], events: ['earnings'] }, isDuplicate: false, timestamp: now - 3_600_000 },
    { event: 'EUR/USD steady as ECB maintains hawkish stance on inflation', sentimentScore: -0.12, impact: { level: 3, category: 'macro' }, entities: { symbols: ['EUR/USD'], sectors: ['forex'], events: ['ECB'] }, isDuplicate: false, timestamp: now - 5_400_000 },
  ];
}

export function getRecentActivities(): SvenActivity[] {
  const now = Date.now();
  return [
    { id: 'act-001', type: 'signal', message: 'Generated LONG signal for SOL/USD — strength 0.91 (breakout-detector)', timestamp: now - 60_000 },
    { id: 'act-002', type: 'risk_check', message: 'Risk check passed for SOL/USD position — drawdown 3.2%, exposure 18%', timestamp: now - 55_000 },
    { id: 'act-003', type: 'order', message: 'Placed BUY LIMIT order SOL/USD × 50 @ $178.40', timestamp: now - 50_000 },
    { id: 'act-004', type: 'prediction', message: 'BSQ-Transformer predicts BTC/USD → $69,200 (4h horizon, 78% confidence)', timestamp: now - 120_000 },
    { id: 'act-005', type: 'news', message: 'High-impact news detected: Bitcoin ETF inflows $1.2B — bullish bias', timestamp: now - 300_000 },
    { id: 'act-006', type: 'strategy', message: 'Aggregated 3 signals for BTC/USD → consensus LONG (weighted: 0.76)', timestamp: now - 240_000 },
    { id: 'act-007', type: 'rebalance', message: 'Portfolio rebalanced — reduced TSLA exposure from 12% to 8%', timestamp: now - 600_000 },
    { id: 'act-008', type: 'signal', message: 'Generated LONG signal for NVDA — strength 0.76 (ml-ensemble)', timestamp: now - 180_000 },
    { id: 'act-009', type: 'prediction', message: 'ARIMA predicts XAU/USD → $2,380 (3d horizon, 57% confidence)', timestamp: now - 420_000 },
    { id: 'act-010', type: 'risk_check', message: 'Circuit breaker check: max drawdown 8.4% (limit 15%) — OK', timestamp: now - 540_000 },
  ];
}


