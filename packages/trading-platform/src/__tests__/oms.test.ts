// ---------------------------------------------------------------------------
// @sven/trading-platform — OMS Unit Tests
// ---------------------------------------------------------------------------
import {
  canTransition,
  applyTransition,
  createOrder,
  calculateUnrealizedPnl,
  calculatePnlPercent,
  computePortfolioState,
  computeTradePerformance,
  createTokenAccount,
  freezeFunds,
  releaseFunds,
  TOKEN_CONFIG,
} from '../oms/index';
import type { Order, Position, TokenAccount } from '../oms/index';

/* ── Order State Machine ─────────────────────────────────── */

describe('canTransition', () => {
  it('allows submit from pending', () => {
    expect(canTransition('pending', 'submit')).toBe(true);
  });

  it('allows fill from submitted', () => {
    expect(canTransition('submitted', 'fill')).toBe(true);
  });

  it('disallows submit from filled', () => {
    expect(canTransition('filled', 'submit')).toBe(false);
  });

  it('disallows any transition from cancelled', () => {
    expect(canTransition('cancelled', 'submit')).toBe(false);
    expect(canTransition('cancelled', 'fill')).toBe(false);
  });

  it('allows cancel from submitted', () => {
    expect(canTransition('submitted', 'cancel')).toBe(true);
  });

  it('allows partial_fill from submitted', () => {
    expect(canTransition('submitted', 'partial_fill')).toBe(true);
  });

  it('allows fill from partial', () => {
    expect(canTransition('partial', 'fill')).toBe(true);
  });

  it('disallows reject from partial', () => {
    expect(canTransition('partial', 'reject')).toBe(false);
  });
});

describe('applyTransition', () => {
  let order: Order;

  beforeEach(() => {
    order = createOrder({
      strategyId: 'test',
      symbol: 'BTCUSDT',
      exchange: 'binance',
      side: 'buy',
      type: 'market',
      quantity: 1,
    });
  });

  it('transitions pending → submitted', () => {
    const result = applyTransition(order, 'submit');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.order.status).toBe('submitted');
      expect(result.event.oldStatus).toBe('pending');
      expect(result.event.newStatus).toBe('submitted');
      expect(result.order.submittedAt).toBeInstanceOf(Date);
    }
  });

  it('transitions submitted → filled', () => {
    const submitted = applyTransition(order, 'submit');
    if ('error' in submitted) throw new Error('unexpected');
    const result = applyTransition(submitted.order, 'fill');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.order.status).toBe('filled');
      expect(result.order.filledAt).toBeInstanceOf(Date);
    }
  });

  it('returns error for invalid transition', () => {
    const result = applyTransition(order, 'fill');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Invalid transition');
    }
  });

  it('transitions submitted → cancelled', () => {
    const submitted = applyTransition(order, 'submit');
    if ('error' in submitted) throw new Error('unexpected');
    const result = applyTransition(submitted.order, 'cancel');
    if ('error' in result) throw new Error('unexpected');
    expect(result.order.status).toBe('cancelled');
    expect(result.order.cancelledAt).toBeInstanceOf(Date);
  });
});

describe('createOrder', () => {
  it('creates order with correct defaults', () => {
    const order = createOrder({
      strategyId: 'test-strat',
      symbol: 'ETHUSDT',
      exchange: 'paper',
      side: 'sell',
      type: 'limit',
      quantity: 10,
      price: 3500,
    });
    expect(order.status).toBe('pending');
    expect(order.symbol).toBe('ETHUSDT');
    expect(order.side).toBe('sell');
    expect(order.type).toBe('limit');
    expect(order.quantity).toBe(10);
    expect(order.price).toBe(3500);
    expect(order.timeInForce).toBe('GTC');
    expect(order.id).toMatch(/^ord-/);
  });

  it('respects custom timeInForce', () => {
    const order = createOrder({
      strategyId: 'x',
      symbol: 'X',
      exchange: 'internal',
      side: 'buy',
      type: 'market',
      quantity: 1,
      timeInForce: 'IOC',
    });
    expect(order.timeInForce).toBe('IOC');
  });
});

/* ── Position P&L ────────────────────────────────────────── */

describe('calculateUnrealizedPnl', () => {
  const basePosition: Position = {
    symbol: 'BTCUSDT',
    side: 'long',
    quantity: 2,
    entryPrice: 50000,
    currentPrice: 52000,
    openedAt: new Date(),
    lastUpdateAt: new Date(),
    realizedPnl: 0,
    commission: 0,
    orderId: 'ord-1',
  };

  it('calculates long position profit', () => {
    expect(calculateUnrealizedPnl(basePosition)).toBe(4000);
  });

  it('calculates long position loss', () => {
    const pos = { ...basePosition, currentPrice: 48000 };
    expect(calculateUnrealizedPnl(pos)).toBe(-4000);
  });

  it('calculates short position profit', () => {
    const pos = { ...basePosition, side: 'short' as const, currentPrice: 48000 };
    expect(calculateUnrealizedPnl(pos)).toBe(4000);
  });

  it('calculates short position loss', () => {
    const pos = { ...basePosition, side: 'short' as const, currentPrice: 52000 };
    expect(calculateUnrealizedPnl(pos)).toBe(-4000);
  });

  it('returns 0 when price unchanged', () => {
    const pos = { ...basePosition, currentPrice: 50000 };
    expect(calculateUnrealizedPnl(pos)).toBe(0);
  });
});

describe('calculatePnlPercent', () => {
  it('returns percentage for long position', () => {
    const pos: Position = {
      symbol: 'X', side: 'long', quantity: 1,
      entryPrice: 100, currentPrice: 110,
      openedAt: new Date(), lastUpdateAt: new Date(),
      realizedPnl: 0, commission: 0, orderId: 'x',
    };
    expect(calculatePnlPercent(pos)).toBeCloseTo(10);
  });

  it('returns 0 when entry price is 0', () => {
    const pos: Position = {
      symbol: 'X', side: 'long', quantity: 1,
      entryPrice: 0, currentPrice: 100,
      openedAt: new Date(), lastUpdateAt: new Date(),
      realizedPnl: 0, commission: 0, orderId: 'x',
    };
    expect(calculatePnlPercent(pos)).toBe(0);
  });
});

/* ── Portfolio State ─────────────────────────────────────── */

describe('computePortfolioState', () => {
  it('computes empty portfolio', () => {
    const state = computePortfolioState(100000, [], 0);
    expect(state.totalCapital).toBe(100000);
    expect(state.availableCapital).toBe(100000);
    expect(state.totalUnrealizedPnl).toBe(0);
    expect(state.exposurePct).toBe(0);
  });

  it('computes portfolio with positions', () => {
    const positions: Position[] = [{
      symbol: 'BTC', side: 'long', quantity: 1,
      entryPrice: 50000, currentPrice: 55000,
      openedAt: new Date(), lastUpdateAt: new Date(),
      realizedPnl: 0, commission: 10, orderId: 'x',
    }];
    const state = computePortfolioState(100000, positions, 2);
    expect(state.totalUnrealizedPnl).toBe(5000);
    expect(state.totalCapital).toBe(105000);
    expect(state.openOrderCount).toBe(2);
    expect(state.totalCommission).toBe(10);
    expect(state.frozenCapital).toBe(55000);
  });
});

/* ── Trade Performance ───────────────────────────────────── */

describe('computeTradePerformance', () => {
  it('returns empty metrics for no trades', () => {
    const perf = computeTradePerformance([], 100000);
    expect(perf.totalTrades).toBe(0);
    expect(perf.winRate).toBe(0);
    expect(perf.maxDrawdown).toBe(0);
  });

  it('computes metrics for mixed trades', () => {
    const pnls = [500, -200, 300, -100, 400];
    const perf = computeTradePerformance(pnls, 10000);
    expect(perf.totalTrades).toBe(5);
    expect(perf.winningTrades).toBe(3);
    expect(perf.losingTrades).toBe(2);
    expect(perf.winRate).toBeCloseTo(0.6);
    expect(perf.totalReturn).toBe(900);
    expect(perf.totalReturnPct).toBeCloseTo(9);
    expect(perf.bestTrade).toBe(500);
    expect(perf.worstTrade).toBe(-200);
    expect(perf.profitFactor).toBeCloseTo(4); // 1200/300
  });

  it('calculates max drawdown', () => {
    const pnls = [1000, -500, -300, 200, -100];
    const perf = computeTradePerformance(pnls, 10000);
    // equity: 10000 → 11000 → 10500 → 10200 → 10400 → 10300
    // peak: 11000, trough: 10200, dd = 800/11000 ≈ 0.0727
    expect(perf.maxDrawdown).toBeCloseTo(0.0727, 3);
  });

  it('handles all-winning trades', () => {
    const pnls = [100, 200, 300];
    const perf = computeTradePerformance(pnls, 10000);
    expect(perf.winRate).toBe(1);
    expect(perf.profitFactor).toBe(Infinity);
    expect(perf.maxDrawdown).toBe(0);
  });
});

/* ── Token Account ───────────────────────────────────────── */

describe('TokenAccount', () => {
  it('creates account with correct defaults', () => {
    const acct = createTokenAccount('sven', 100000);
    expect(acct.owner).toBe('sven');
    expect(acct.balance).toBe(100000);
    expect(acct.frozen).toBe(0);
    expect(acct.id).toMatch(/^acct-/);
  });

  it('freezes funds when sufficient balance', () => {
    const acct = createTokenAccount('sven', 10000);
    const result = freezeFunds(acct, 5000);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.frozen).toBe(5000);
    }
  });

  it('rejects freeze when insufficient balance', () => {
    const acct = createTokenAccount('sven', 1000);
    const result = freezeFunds(acct, 2000);
    expect('error' in result).toBe(true);
  });

  it('releases frozen funds', () => {
    const acct = createTokenAccount('sven', 10000);
    const frozen = freezeFunds(acct, 5000);
    if ('error' in frozen) throw new Error('unexpected');
    const released = releaseFunds(frozen, 3000);
    expect(released.frozen).toBe(2000);
  });

  it('does not go below zero on over-release', () => {
    const acct = createTokenAccount('sven', 10000);
    const frozen = freezeFunds(acct, 1000);
    if ('error' in frozen) throw new Error('unexpected');
    const released = releaseFunds(frozen, 5000);
    expect(released.frozen).toBe(0);
  });
});

describe('TOKEN_CONFIG', () => {
  it('has correct ticker and peg', () => {
    expect(TOKEN_CONFIG.ticker).toBe('47T');
    expect(TOKEN_CONFIG.usdPeg).toBe(1.00);
    expect(TOKEN_CONFIG.defaultTradingFee).toBe(0.001);
  });
});
