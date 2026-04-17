// ---------------------------------------------------------------------------
// @sven/trading-platform — Order Management System (OMS)
// ---------------------------------------------------------------------------
// Order types, order lifecycle state machine, position tracking, portfolio
// state, P&L calculations, 47Token internal currency system.
// ---------------------------------------------------------------------------

/* ── Order Types ───────────────────────────────────────────────────────── */

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' | 'iceberg' | 'twap';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTD';
export type ExchangeTarget = 'internal' | 'binance' | 'bybit' | 'paper';

export interface Order {
  id: string;
  strategyId: string;
  symbol: string;
  exchange: ExchangeTarget;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  trailPct?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  fillPrice?: number;
  fillQuantity?: number;
  commission?: number;
  slippage?: number;
  parentOrderId?: string;
  rejectionReason?: string;
  exchangeOrderId?: string;
  metadata?: Record<string, unknown>;
}

/* ── Order State Machine ───────────────────────────────────────────────── */

export type OrderTransition =
  | 'submit'
  | 'partial_fill'
  | 'fill'
  | 'cancel'
  | 'reject'
  | 'expire';

const VALID_TRANSITIONS: Record<OrderStatus, OrderTransition[]> = {
  pending: ['submit', 'cancel', 'reject'],
  submitted: ['partial_fill', 'fill', 'cancel', 'reject', 'expire'],
  partial: ['partial_fill', 'fill', 'cancel'],
  filled: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

const NEXT_STATUS: Record<OrderTransition, OrderStatus> = {
  submit: 'submitted',
  partial_fill: 'partial',
  fill: 'filled',
  cancel: 'cancelled',
  reject: 'rejected',
  expire: 'expired',
};

export interface OrderEvent {
  id: string;
  orderId: string;
  eventType: OrderTransition;
  timestamp: Date;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  details?: Record<string, unknown>;
}

export function canTransition(current: OrderStatus, transition: OrderTransition): boolean {
  return VALID_TRANSITIONS[current]?.includes(transition) ?? false;
}

export function applyTransition(order: Order, transition: OrderTransition): { order: Order; event: OrderEvent } | { error: string } {
  if (!canTransition(order.status, transition)) {
    return { error: `Invalid transition "${transition}" from status "${order.status}"` };
  }

  const oldStatus = order.status;
  const newStatus = NEXT_STATUS[transition];
  const now = new Date();

  const updated: Order = {
    ...order,
    status: newStatus,
    updatedAt: now,
  };

  if (transition === 'submit') updated.submittedAt = now;
  if (transition === 'fill') updated.filledAt = now;
  if (transition === 'cancel') updated.cancelledAt = now;

  const event: OrderEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderId: order.id,
    eventType: transition,
    timestamp: now,
    oldStatus,
    newStatus,
  };

  return { order: updated, event };
}

/* ── Order Factory ─────────────────────────────────────────────────────── */

export function createOrder(params: {
  strategyId: string;
  symbol: string;
  exchange: ExchangeTarget;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  trailPct?: number;
  timeInForce?: TimeInForce;
  parentOrderId?: string;
}): Order {
  const now = new Date();
  return {
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    strategyId: params.strategyId,
    symbol: params.symbol,
    exchange: params.exchange,
    side: params.side,
    type: params.type,
    quantity: params.quantity,
    price: params.price,
    stopPrice: params.stopPrice,
    trailPct: params.trailPct,
    timeInForce: params.timeInForce ?? 'GTC',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    parentOrderId: params.parentOrderId,
  };
}

/* ── Position Tracking ─────────────────────────────────────────────────── */

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: Date;
  lastUpdateAt: Date;
  realizedPnl: number;
  commission: number;
  orderId: string;
}

export function calculateUnrealizedPnl(pos: Position): number {
  const direction = pos.side === 'long' ? 1 : -1;
  return direction * (pos.currentPrice - pos.entryPrice) * pos.quantity;
}

export function calculatePnlPercent(pos: Position): number {
  if (pos.entryPrice === 0) return 0;
  const direction = pos.side === 'long' ? 1 : -1;
  return direction * ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
}

/* ── Portfolio State ───────────────────────────────────────────────────── */

export interface PortfolioState {
  totalCapital: number;
  availableCapital: number;
  frozenCapital: number;       // locked in open orders
  positions: Position[];
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalCommission: number;
  exposurePct: number;
  openOrderCount: number;
  lastUpdateAt: Date;
}

export function computePortfolioState(
  capital: number,
  positions: Position[],
  openOrderCount: number,
): PortfolioState {
  let totalUnrealized = 0;
  let totalRealized = 0;
  let totalCommission = 0;
  let totalExposure = 0;

  for (const pos of positions) {
    totalUnrealized += calculateUnrealizedPnl(pos);
    totalRealized += pos.realizedPnl;
    totalCommission += pos.commission;
    totalExposure += Math.abs(pos.quantity * pos.currentPrice);
  }

  const totalVal = capital + totalUnrealized;

  return {
    totalCapital: totalVal,
    availableCapital: capital - totalExposure,
    frozenCapital: totalExposure,
    positions,
    totalUnrealizedPnl: totalUnrealized,
    totalRealizedPnl: totalRealized,
    totalCommission: totalCommission,
    exposurePct: totalVal > 0 ? totalExposure / totalVal : 0,
    openOrderCount,
    lastUpdateAt: new Date(),
  };
}

/* ── 47Token Internal Currency ─────────────────────────────────────────── */

export interface TokenAccount {
  id: string;
  owner: string;           // 'sven', 'admin', user ID
  balance: number;
  frozen: number;          // locked in open orders
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionType = 'trade' | 'fee' | 'deposit' | 'withdrawal' | 'reward';

export interface TokenTransaction {
  id: string;
  fromAccountId?: string;
  toAccountId?: string;
  amount: number;
  txType: TransactionType;
  reference?: string;
  createdAt: Date;
}

export const TOKEN_CONFIG = {
  name: '47Token',
  ticker: '47T',
  initialSupply: 1_000_000,
  svenStartingAllowance: 100_000,
  usdPeg: 1.00,               // 1 47T = $1.00 USD (paper phase)
  defaultTradingFee: 0.001,    // 0.1% per trade
} as const;

export function createTokenAccount(owner: string, initialBalance: number = 0): TokenAccount {
  return {
    id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    owner,
    balance: initialBalance,
    frozen: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function freezeFunds(account: TokenAccount, amount: number): TokenAccount | { error: string } {
  const available = account.balance - account.frozen;
  if (amount > available) {
    return { error: `Insufficient available balance: ${available.toFixed(2)} < ${amount.toFixed(2)}` };
  }
  return { ...account, frozen: account.frozen + amount, updatedAt: new Date() };
}

export function releaseFunds(account: TokenAccount, amount: number): TokenAccount {
  return {
    ...account,
    frozen: Math.max(0, account.frozen - amount),
    updatedAt: new Date(),
  };
}

/* ── Trade Performance Metrics ─────────────────────────────────────────── */

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

export function computeTradePerformance(
  closedPnls: number[],
  initialCapital: number,
  holdingPeriods: number[] = [],
): TradePerformance {
  const n = closedPnls.length;
  if (n === 0) {
    return {
      totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0,
      totalReturn: 0, totalReturnPct: 0, avgTradeReturn: 0,
      bestTrade: 0, worstTrade: 0, profitFactor: 0,
      sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0, avgHoldingPeriodMs: 0,
    };
  }

  const wins = closedPnls.filter((p) => p > 0);
  const losses = closedPnls.filter((p) => p < 0);
  const totalReturn = closedPnls.reduce((a, b) => a + b, 0);
  const avgReturn = totalReturn / n;

  // Profit factor
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Sharpe ratio (simplified: annualized assuming daily trades)
  const mean = avgReturn;
  const variance = closedPnls.reduce((s, p) => s + (p - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  // Sortino ratio (uses only downside deviation)
  const downsideVariance = closedPnls.reduce((s, p) => s + Math.min(0, p - mean) ** 2, 0) / n;
  const downsideDev = Math.sqrt(downsideVariance);
  const sortino = downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0;

  // Max drawdown from equity curve
  let peak = initialCapital;
  let maxDD = 0;
  let equity = initialCapital;
  for (const pnl of closedPnls) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalTrades: n,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: wins.length / n,
    totalReturn,
    totalReturnPct: initialCapital > 0 ? (totalReturn / initialCapital) * 100 : 0,
    avgTradeReturn: avgReturn,
    bestTrade: Math.max(...closedPnls),
    worstTrade: Math.min(...closedPnls),
    profitFactor,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    maxDrawdown: maxDD,
    avgHoldingPeriodMs: holdingPeriods.length > 0 ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length : 0,
  };
}
