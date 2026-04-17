'use client';

import { useTradingStore } from '@/lib/store';
import { cn, formatUsd, formatPct, formatCompact } from '@/lib/utils';
import {
  Activity, BarChart3, Brain, TrendingUp, TrendingDown,
  Minus, Zap, Settings, Maximize2, ShoppingCart,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-500',
  analyzing: 'bg-amber-400 animate-pulse',
  trading: 'bg-green-400 animate-pulse',
  monitoring: 'bg-brand-400',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  analyzing: 'Analyzing',
  trading: 'Executing',
  monitoring: 'Monitoring',
};

export function Header({ onTrade }: { onTrade?: () => void }) {
  const { activeSymbol, ticker, svenStatus, totalPnl, totalPnlPct, dailyPnl, dailyPnlPct } = useTradingStore();
  const price = ticker?.price ?? 0;
  const change = ticker?.changePct ?? 0;

  return (
    <header className="h-14 border-b border-gray-800/60 bg-surface/90 backdrop-blur-sm flex items-center px-4 gap-6 shrink-0">
      {/* Logo & Brand */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-100 leading-tight">Sven Trading</span>
          <span className="text-[10px] text-gray-500 leading-tight">trading.sven.systems</span>
        </div>
      </div>

      {/* Sven Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-muted border border-gray-800/50">
        <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[svenStatus])} />
        <span className="text-xs font-medium text-gray-300">Sven: {STATUS_LABELS[svenStatus]}</span>
      </div>

      {/* Active Symbol Price */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-100">{activeSymbol}</span>
        <span className="text-lg font-mono font-semibold text-gray-100">
          {price > 0 ? formatUsd(price) : '—'}
        </span>
        <span className={cn(
          'flex items-center gap-0.5 text-sm font-mono',
          change > 0 ? 'text-bull' : change < 0 ? 'text-bear' : 'text-neutral',
        )}>
          {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
            change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
              <Minus className="w-3.5 h-3.5" />}
          {formatPct(change)}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Portfolio Stats */}
      <div className="hidden lg:flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase text-gray-500 tracking-wider">Total P&L</span>
          <span className={cn('text-sm font-mono font-semibold', totalPnl >= 0 ? 'text-bull' : 'text-bear')}>
            {formatUsd(totalPnl)} ({formatPct(totalPnlPct)})
          </span>
        </div>
        <div className="w-px h-8 bg-gray-800" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase text-gray-500 tracking-wider">Daily P&L</span>
          <span className={cn('text-sm font-mono font-semibold', dailyPnl >= 0 ? 'text-bull' : 'text-bear')}>
            {formatUsd(dailyPnl)} ({formatPct(dailyPnlPct)})
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-4">
        <button
          onClick={onTrade}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 active:bg-brand-700 transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Trade
        </button>
        <button className="btn-ghost p-2 rounded-md" aria-label="Activity log">
          <Activity className="w-4 h-4" />
        </button>
        <button className="btn-ghost p-2 rounded-md" aria-label="Analytics">
          <BarChart3 className="w-4 h-4" />
        </button>
        <button className="btn-ghost p-2 rounded-md" aria-label="Fullscreen">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button className="btn-ghost p-2 rounded-md" aria-label="Settings">
          <Settings className="w-4 h-4" />
        </button>
        <div className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-400/10 border border-brand-400/20">
          <Zap className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs font-medium text-brand-300">Live</span>
        </div>
      </div>
    </header>
  );
}
