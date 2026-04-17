'use client';

import { useTradingStore } from '@/lib/store';
import { cn, formatUsd, formatPct, formatNumber, timeAgo } from '@/lib/utils';
import {
  Brain, Wallet, TrendingUp, TrendingDown, Minus,
  Shield, Target, BarChart3, Zap, Activity,
  Eye, Radio,
} from 'lucide-react';
import type { SvenActivity } from '@/lib/types';

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Brain; label: string }> = {
  idle: { color: 'text-gray-400', icon: Eye, label: 'Idle — Waiting' },
  analyzing: { color: 'text-amber-400', icon: Brain, label: 'Analyzing Markets' },
  trading: { color: 'text-green-400', icon: Zap, label: 'Executing Trades' },
  monitoring: { color: 'text-brand-400', icon: Radio, label: 'Live Monitoring' },
};

const ACTIVITY_ICONS: Record<string, typeof Brain> = {
  signal: Target,
  order: BarChart3,
  risk_check: Shield,
  prediction: Brain,
  news: TrendingUp,
  strategy: Activity,
  rebalance: Wallet,
};

function SvenBrainCard() {
  const { svenStatus, activities } = useTradingStore();
  const cfg = STATUS_CONFIG[svenStatus] ?? STATUS_CONFIG.idle;
  const Icon = cfg.icon;
  const recent = activities.slice(0, 8);

  return (
    <div className="glass-panel p-3">
      {/* Status header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          svenStatus === 'trading' ? 'bg-green-500/15 animate-pulse-glow' :
            svenStatus === 'analyzing' ? 'bg-amber-500/15' : 'bg-brand-400/15',
        )}>
          <Icon className={cn('w-4 h-4', cfg.color)} />
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-200">Sven AI</div>
          <div className={cn('text-[10px] font-medium', cfg.color)}>{cfg.label}</div>
        </div>
        <div className={cn(
          'ml-auto w-2 h-2 rounded-full',
          svenStatus === 'idle' ? 'bg-gray-500' : 'bg-green-400 animate-pulse',
        )} />
      </div>

      {/* Activity feed */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {recent.map((act) => {
          const ActIcon = ACTIVITY_ICONS[act.type] ?? Activity;
          return (
            <div key={act.id} className="flex items-start gap-2 py-1 animate-fade-in">
              <ActIcon className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-gray-400 leading-relaxed flex-1">{act.message}</p>
              <span className="text-[9px] text-gray-600 shrink-0">{timeAgo(act.timestamp)}</span>
            </div>
          );
        })}
        {recent.length === 0 && (
          <div className="text-center text-[10px] text-gray-600 py-4">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioCard() {
  const { totalCapital, availableCapital, totalPnl, totalPnlPct, dailyPnl, dailyPnlPct, positions } = useTradingStore();

  const totalExposure = positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  const exposurePct = totalCapital > 0 ? (totalExposure / totalCapital) * 100 : 0;

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-brand-400" />
        <span className="text-xs font-semibold text-gray-200">Portfolio</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="stat-label">Total Capital</div>
          <div className="text-sm font-mono font-semibold text-gray-100">{formatUsd(totalCapital, 0)}</div>
        </div>
        <div>
          <div className="stat-label">Available</div>
          <div className="text-sm font-mono font-semibold text-gray-300">{formatUsd(availableCapital, 0)}</div>
        </div>
        <div>
          <div className="stat-label">Total P&L</div>
          <div className={cn('text-sm font-mono font-semibold', totalPnl >= 0 ? 'text-bull' : 'text-bear')}>
            {formatUsd(totalPnl)} <span className="text-[10px]">({formatPct(totalPnlPct)})</span>
          </div>
        </div>
        <div>
          <div className="stat-label">Daily P&L</div>
          <div className={cn('text-sm font-mono font-semibold', dailyPnl >= 0 ? 'text-bull' : 'text-bear')}>
            {formatUsd(dailyPnl)} <span className="text-[10px]">({formatPct(dailyPnlPct)})</span>
          </div>
        </div>
      </div>

      {/* Exposure bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500">Exposure</span>
          <span className="text-[10px] font-mono text-gray-400">{formatPct(exposurePct).replace('+', '')}</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              exposurePct > 80 ? 'bg-red-500' : exposurePct > 50 ? 'bg-amber-500' : 'bg-brand-400',
            )}
            style={{ width: `${Math.min(exposurePct, 100)}%` }}
          />
        </div>
      </div>

      {/* Open positions count */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-gray-500">Open Positions</span>
        <span className="text-xs font-mono text-gray-300">{positions.length}</span>
      </div>
    </div>
  );
}

function QuickStats() {
  const { signals, predictions, orders } = useTradingStore();
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const longSignals = signals.filter((s) => s.direction === 'long').length;
  const shortSignals = signals.filter((s) => s.direction === 'short').length;

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-brand-400" />
        <span className="text-xs font-semibold text-gray-200">Quick Stats</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Active Signals</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-bull">{longSignals}L</span>
            <span className="text-[10px] text-gray-600">/</span>
            <span className="text-[10px] text-bear">{shortSignals}S</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Predictions</span>
          <span className="text-xs font-mono text-gray-300">{predictions.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Pending Orders</span>
          <span className={cn('text-xs font-mono', pendingOrders > 0 ? 'text-amber-400' : 'text-gray-400')}>
            {pendingOrders}
          </span>
        </div>
      </div>
    </div>
  );
}

export function RightPanel() {
  return (
    <aside className="w-64 border-l border-gray-800/60 bg-surface/50 flex flex-col gap-2 p-2 overflow-y-auto shrink-0">
      <SvenBrainCard />
      <PortfolioCard />
      <QuickStats />
    </aside>
  );
}
