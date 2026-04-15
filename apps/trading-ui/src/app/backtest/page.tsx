// ---------------------------------------------------------------------------
// /backtest — Strategy Backtesting Console
// ---------------------------------------------------------------------------
'use client';

import { useState, useCallback } from 'react';
import {
  Play, BarChart3, TrendingUp, TrendingDown, Clock,
  ChevronDown, ArrowRight, Activity,
} from 'lucide-react';
import { cn, formatUsd, formatPct } from '@/lib/utils';
import { fetchBacktestStrategies, runBacktest, runBacktestAuto } from '@/lib/api';
import { useTradingStore } from '@/lib/store';
import Link from 'next/link';

interface BacktestResult {
  trades: Array<{
    entryTimestamp: number;
    exitTimestamp: number;
    side: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPct: number;
  }>;
  equityCurve: Array<{ timestamp: number; equity: number }>;
  performance: {
    totalPnl: number;
    totalPnlPct: number;
    winRate: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdownPct: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
  };
  monthlyReturns: Array<{ year: number; month: number; returnPct: number }>;
}

const STRATEGY_OPTIONS = [
  { value: 'sma-crossover-20-50', label: 'SMA Crossover (20/50)' },
  { value: 'sma-crossover-9-21', label: 'SMA Crossover (9/21)' },
  { value: 'rsi-30-70', label: 'RSI (30/70)' },
  { value: 'rsi-20-80', label: 'RSI (20/80)' },
  { value: 'mean-reversion-2', label: 'Mean Reversion (Z=2)' },
  { value: 'mean-reversion-1.5', label: 'Mean Reversion (Z=1.5)' },
];

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-4">
      <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">{label}</div>
      <div className={cn('text-lg font-mono font-semibold', positive === true ? 'text-bull' : positive === false ? 'text-bear' : 'text-gray-100')}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function EquityCurveChart({ data }: { data: Array<{ timestamp: number; equity: number }> }) {
  if (data.length === 0) return null;
  const min = Math.min(...data.map((d) => d.equity));
  const max = Math.max(...data.map((d) => d.equity));
  const range = max - min || 1;
  const h = 200;
  const w = 800;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.equity - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const isProfit = data[data.length - 1].equity > data[0].equity;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ecFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isProfit ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isProfit ? '#22c55e' : '#ef4444'} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#ecFill)" />
      <polyline points={points} fill="none" stroke={isProfit ? '#22c55e' : '#ef4444'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function BacktestPage() {
  const candles = useTradingStore((s) => s.candles);
  const activeSymbol = useTradingStore((s) => s.activeSymbol);

  const [strategy, setStrategy] = useState(STRATEGY_OPTIONS[0].value);
  const [capital, setCapital] = useState('100000');
  const [positionSize, setPositionSize] = useState('10');
  const [commission, setCommission] = useState('0.1');
  const [slippage, setSlippage] = useState('0.05');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [autoSymbol, setAutoSymbol] = useState('BTC/USDT');
  const [autoTimeframe, setAutoTimeframe] = useState('1h');
  const [autoBars, setAutoBars] = useState('1000');

  const handleRun = useCallback(async () => {
    if (mode === 'manual' && candles.length < 50) {
      setError('Need at least 50 candles loaded. Switch to the dashboard to load market data first, or use Auto-Fetch mode.');
      return;
    }
    setIsRunning(true);
    setError(null);
    try {
      if (mode === 'auto') {
        const res = await runBacktestAuto({
          strategy,
          symbol: autoSymbol,
          timeframe: autoTimeframe,
          bars: Number(autoBars),
          initialCapital: Number(capital),
        });
        if (res.success && res.data) {
          const d = res.data;
          setResult({
            trades: [],
            equityCurve: [],
            performance: {
              totalPnl: d.totalReturn,
              totalPnlPct: d.totalReturnPct,
              winRate: d.totalTrades > 0 ? d.winningTrades / d.totalTrades : 0,
              sharpeRatio: d.sharpeRatio,
              sortinoRatio: 0,
              maxDrawdownPct: d.maxDrawdown,
              avgWin: 0,
              avgLoss: 0,
              profitFactor: d.profitFactor,
              totalTrades: d.totalTrades,
              winningTrades: d.winningTrades,
              losingTrades: d.totalTrades - d.winningTrades,
            },
            monthlyReturns: [],
          });
        } else {
          setError('Backtest auto-fetch failed');
        }
      } else {
        const res = await runBacktest({
          strategy,
          candles: candles.map((c) => ({
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            timestamp: c.timestamp,
          })),
          initialCapital: Number(capital),
          positionSizePct: Number(positionSize),
          commissionPct: Number(commission),
          slippagePct: Number(slippage),
        });
        setResult(res as unknown as BacktestResult);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRunning(false);
    }
  }, [mode, strategy, candles, capital, positionSize, commission, slippage, autoSymbol, autoTimeframe, autoBars]);

  const perf = result?.performance;

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* Nav bar */}
      <nav className="h-12 border-b border-gray-800/60 bg-surface/90 backdrop-blur-sm flex items-center px-4 gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        <Link href="/sven" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sven AI</Link>
        <span className="text-sm text-brand-400 font-semibold">Backtest</span>
        <Link href="/analytics" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Analytics</Link>
        <Link href="/alerts" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Alerts</Link>
        <Link href="/credentials" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Credentials</Link>
        <Link href="/brokers" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Brokers</Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-brand-400" />
          Strategy Backtesting
        </h1>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setMode('auto')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'auto' ? 'bg-brand-500 text-white' : 'bg-surface-muted text-gray-400 hover:text-gray-200',
            )}
          >
            Auto-Fetch (Binance)
          </button>
          <button
            onClick={() => setMode('manual')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'manual' ? 'bg-brand-500 text-white' : 'bg-surface-muted text-gray-400 hover:text-gray-200',
            )}
          >
            Manual (Loaded Candles)
          </button>
        </div>

        {/* Config */}
        {mode === 'auto' ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
              >
                {STRATEGY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Symbol</label>
              <select
                value={autoSymbol}
                onChange={(e) => setAutoSymbol(e.target.value)}
                className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
              >
                {['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','ADA/USDT','DOGE/USDT','AVAX/USDT','DOT/USDT','LINK/USDT'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
              <select
                value={autoTimeframe}
                onChange={(e) => setAutoTimeframe(e.target.value)}
                className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
              >
                {['1m','5m','15m','1h','4h','1d'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Candles</label>
              <select
                value={autoBars}
                onChange={(e) => setAutoBars(e.target.value)}
                className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
              >
                {['100','250','500','1000','2000','5000'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Capital ($)</label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400 font-mono"
              />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
            >
              {STRATEGY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Capital ($)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Position Size %</label>
            <input
              type="number"
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Commission %</label>
            <input
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slippage %</label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full bg-surface-muted border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400 font-mono"
            />
          </div>
        </div>
        )}

        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold text-sm transition-all',
              isRunning
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-brand-500 hover:bg-brand-600 text-white',
            )}
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Run Backtest'}
          </button>
          <span className="text-xs text-gray-500">
            {candles.length} candles loaded for {activeSymbol}
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {perf && result && (
          <>
            {/* Performance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
              <StatCard label="Total P&L" value={formatUsd(perf.totalPnl)} sub={formatPct(perf.totalPnlPct)} positive={perf.totalPnl >= 0} />
              <StatCard label="Win Rate" value={formatPct(perf.winRate * 100)} positive={perf.winRate > 0.5} />
              <StatCard label="Sharpe" value={perf.sharpeRatio.toFixed(2)} positive={perf.sharpeRatio > 1} />
              <StatCard label="Sortino" value={perf.sortinoRatio.toFixed(2)} positive={perf.sortinoRatio > 1} />
              <StatCard label="Max Drawdown" value={formatPct(perf.maxDrawdownPct)} positive={false} />
              <StatCard label="Profit Factor" value={perf.profitFactor.toFixed(2)} positive={perf.profitFactor > 1} />
              <StatCard label="Total Trades" value={String(perf.totalTrades)} />
              <StatCard label="Winners" value={String(perf.winningTrades)} sub={`/ ${perf.totalTrades}`} positive={true} />
              <StatCard label="Losers" value={String(perf.losingTrades)} sub={`/ ${perf.totalTrades}`} positive={false} />
              <StatCard label="Avg Win" value={formatUsd(perf.avgWin)} positive={true} />
              <StatCard label="Avg Loss" value={formatUsd(perf.avgLoss)} positive={false} />
            </div>

            {/* Equity Curve */}
            <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-6 mb-8">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-400" />
                Equity Curve
              </h2>
              <EquityCurveChart data={result.equityCurve} />
              <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
                <span>{new Date(result.equityCurve[0]?.timestamp ?? 0).toLocaleDateString()}</span>
                <span>{new Date(result.equityCurve[result.equityCurve.length - 1]?.timestamp ?? 0).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Trade List */}
            <div className="rounded-lg bg-surface-muted border border-gray-800/50 overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-800/50">
                <h2 className="text-sm font-semibold text-gray-300">Trade Log ({result.trades.length} trades)</h2>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-muted">
                    <tr className="text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Side</th>
                      <th className="px-4 py-2 text-right">Entry</th>
                      <th className="px-4 py-2 text-right">Exit</th>
                      <th className="px-4 py-2 text-right">P&L</th>
                      <th className="px-4 py-2 text-right">P&L %</th>
                      <th className="px-4 py-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 200).map((trade, i) => (
                      <tr key={i} className="border-t border-gray-800/30 hover:bg-surface-raised/30">
                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-2">
                          <span className={cn('font-semibold', trade.side === 'long' ? 'text-bull' : 'text-bear')}>
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-300">{formatUsd(trade.entryPrice)}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-300">{formatUsd(trade.exitPrice)}</td>
                        <td className={cn('px-4 py-2 text-right font-mono font-semibold', trade.pnl >= 0 ? 'text-bull' : 'text-bear')}>
                          {formatUsd(trade.pnl)}
                        </td>
                        <td className={cn('px-4 py-2 text-right font-mono', trade.pnlPct >= 0 ? 'text-bull' : 'text-bear')}>
                          {formatPct(trade.pnlPct)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {new Date(trade.entryTimestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Returns */}
            {result.monthlyReturns.length > 0 && (
              <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-6 mt-8">
                <h2 className="text-sm font-semibold text-gray-300 mb-4">Monthly Returns</h2>
                <div className="grid grid-cols-13 gap-1 text-xs font-mono text-center">
                  <div className="text-gray-500">Year</div>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
                    <div key={m} className="text-gray-500">{m}</div>
                  ))}
                  {Array.from(new Set(result.monthlyReturns.map((r) => r.year))).map((year) => (
                    <>
                      <div key={`y-${year}`} className="text-gray-400 font-semibold">{year}</div>
                      {Array.from({ length: 12 }, (_, i) => {
                        const entry = result.monthlyReturns.find((r) => r.year === year && r.month === i + 1);
                        return (
                          <div
                            key={`${year}-${i}`}
                            className={cn(
                              'rounded px-1 py-0.5',
                              entry
                                ? entry.returnPct >= 0
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                                : 'text-gray-700',
                            )}
                          >
                            {entry ? `${entry.returnPct.toFixed(1)}%` : '—'}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
