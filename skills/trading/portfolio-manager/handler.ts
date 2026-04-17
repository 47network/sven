import {
  computePortfolioState,
  computeTradePerformance,
  createTokenAccount,
  freezeFunds,
  releaseFunds,
  calculateUnrealizedPnl,
  calculatePnlPercent,
  TOKEN_CONFIG,
  type Position,
  type TokenAccount,
} from '@sven/trading-platform/oms';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'portfolio_state': {
      const capital = (input.capital as number) ?? 100_000;
      const rawPositions = (input.positions as Array<{
        symbol: string;
        side: string;
        quantity: number;
        entryPrice: number;
        currentPrice: number;
      }>) ?? [];
      const openOrderCount = (input.open_order_count as number) ?? 0;

      const positions: Position[] = rawPositions.map((p) => ({
        orderId: `ord-${p.symbol}`,
        symbol: p.symbol,
        side: p.side as 'long' | 'short',
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        openedAt: new Date(),
        lastUpdateAt: new Date(),
        realizedPnl: 0,
        commission: 0,
      }));

      const portfolio = computePortfolioState(capital, positions, openOrderCount);
      return {
        result: {
          totalCapital: portfolio.totalCapital,
          availableCapital: portfolio.availableCapital,
          frozenCapital: portfolio.frozenCapital,
          totalUnrealizedPnl: portfolio.totalUnrealizedPnl,
          positionCount: positions.length,
          exposurePct: portfolio.exposurePct,
          lastUpdateAt: portfolio.lastUpdateAt,
        },
      };
    }

    case 'positions': {
      const rawPositions = (input.positions as Array<{
        symbol: string;
        side: string;
        quantity: number;
        entryPrice: number;
        currentPrice: number;
      }>) ?? [];

      const positions: Position[] = rawPositions.map((p) => ({
        orderId: `ord-${p.symbol}`,
        symbol: p.symbol,
        side: p.side as 'long' | 'short',
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        openedAt: new Date(),
        lastUpdateAt: new Date(),
        realizedPnl: 0,
        commission: 0,
      }));

      return {
        result: {
          count: positions.length,
          positions: positions.map((p) => ({
            symbol: p.symbol,
            side: p.side,
            quantity: p.quantity,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            unrealizedPnl: calculateUnrealizedPnl(p).toFixed(2),
            pnlPct: calculatePnlPercent(p).toFixed(2) + '%',
          })),
        },
      };
    }

    case 'trade_performance': {
      const closedPnls = (input.closed_pnls as number[]) ?? [];
      const initialCapital = (input.initial_capital as number) ?? 100_000;
      const holdingPeriods = (input.holding_periods as number[]) ?? undefined;

      if (closedPnls.length === 0) return { error: 'No closed P&L records provided' };

      const perf = computeTradePerformance(closedPnls, initialCapital, holdingPeriods);
      return {
        result: {
          totalReturn: perf.totalReturn,
          totalReturnPct: perf.totalReturnPct,
          avgTradeReturn: perf.avgTradeReturn,
          bestTrade: perf.bestTrade,
          worstTrade: perf.worstTrade,
          winRate: perf.winRate,
          winningTrades: perf.winningTrades,
          losingTrades: perf.losingTrades,
          totalTrades: perf.totalTrades,
          profitFactor: perf.profitFactor,
          sharpeRatio: perf.sharpeRatio,
          sortinoRatio: perf.sortinoRatio,
          maxDrawdown: perf.maxDrawdown,
        },
      };
    }

    case 'token_info': {
      return {
        result: {
          ticker: TOKEN_CONFIG.ticker,
          name: TOKEN_CONFIG.name,
          initialSupply: TOKEN_CONFIG.initialSupply,
          svenStartingAllowance: TOKEN_CONFIG.svenStartingAllowance,
          usdPeg: TOKEN_CONFIG.usdPeg,
          defaultTradingFee: TOKEN_CONFIG.defaultTradingFee,
        },
      };
    }

    case 'create_token_account': {
      const owner = (input.owner as string) ?? 'sven';
      const initialBalance = input.initial_balance as number | undefined;
      const account: TokenAccount = createTokenAccount(owner, initialBalance);
      return {
        result: {
          id: account.id,
          owner: account.owner,
          balance: account.balance,
          frozen: account.frozen,
          createdAt: account.createdAt,
        },
      };
    }

    case 'freeze_funds': {
      const accountInput = input.account as { id: string; owner: string; balance: number; frozen: number; createdAt: string } | undefined;
      const amount = input.amount as number;
      if (!accountInput) return { error: 'Missing account object' };
      if (!amount || amount <= 0) return { error: 'Invalid freeze amount' };

      const account: TokenAccount = {
        id: accountInput.id,
        owner: accountInput.owner,
        balance: accountInput.balance,
        frozen: accountInput.frozen,
        createdAt: new Date(accountInput.createdAt),
        updatedAt: new Date(),
      };

      const result = freezeFunds(account, amount);
      if ('error' in result) return { error: result.error };
      return {
        result: {
          id: result.id,
          balance: result.balance,
          frozen: result.frozen,
        },
      };
    }

    case 'release_funds': {
      const accountInput = input.account as { id: string; owner: string; balance: number; frozen: number; createdAt: string } | undefined;
      const amount = input.amount as number;
      if (!accountInput) return { error: 'Missing account object' };
      if (!amount || amount <= 0) return { error: 'Invalid release amount' };

      const account: TokenAccount = {
        id: accountInput.id,
        owner: accountInput.owner,
        balance: accountInput.balance,
        frozen: accountInput.frozen,
        createdAt: new Date(accountInput.createdAt),
        updatedAt: new Date(),
      };

      const result = releaseFunds(account, amount);
      return {
        result: {
          id: result.id,
          balance: result.balance,
          frozen: result.frozen,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: portfolio_state, positions, trade_performance, token_info, create_token_account, freeze_funds, release_funds` };
  }
}
