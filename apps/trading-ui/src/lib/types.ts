/* ── Trading UI Types ──────────────────────────────────────── */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
export type SignalDirection = 'long' | 'short' | 'neutral';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';

export interface Signal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  strength: number;
  source: string;
  stopLoss?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
  lastUpdateAt: number;
  realizedPnl: number;
  commission: number;
  orderId: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  status: OrderStatus;
  filledAt?: number;
  createdAt: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  requiredTimeframes: Timeframe[];
}

export interface Prediction {
  id: string;
  createdAt: number;
  model: string;
  symbol: string;
  exchange: string;
  timeframe: string;
  horizonCandles: number;
  predictedClose: number;
  predictedDirection: SignalDirection;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface NewsItem {
  event: string;
  sentimentScore: number;
  impact: { level: number; category: string };
  entities: { symbols: string[]; sectors: string[]; events: string[] };
  isDuplicate: boolean;
  timestamp: number;
}

export interface PortfolioState {
  totalCapital: number;
  availableCapital: number;
  frozenCapital: number;
  totalUnrealizedPnl: number;
  exposurePct: number;
  lastUpdateAt: number;
}

export interface TradePerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPct: number;
  avgTradeReturn: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  avgHoldingPeriodMs: number;
}

export interface RiskCheckResult {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface SvenActivity {
  id: string;
  type: 'signal' | 'order' | 'risk_check' | 'prediction' | 'news' | 'strategy' | 'rebalance';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePct: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  change24h: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  timestamp: number;
}
