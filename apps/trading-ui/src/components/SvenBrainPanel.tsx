// ---------------------------------------------------------------------------
// Sven Autonomous Brain Panel — 47Token balance, learning state, circuit breaker
// ---------------------------------------------------------------------------
'use client';

import { useState, useEffect } from 'react';
import { Brain, Coins, Shield, TrendingUp, Activity, Zap, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn, formatUsd } from '../lib/utils';

interface ModelAccuracy {
  correct: number;
  total: number;
  accuracy: number;
}

interface SvenAccountData {
  account: {
    owner: string;
    balance: number;
    frozen: number;
  };
  tokenConfig: {
    name: string;
    ticker: string;
    usdPeg: number;
    svenStartingAllowance: number;
  };
  learningMetrics: {
    sourceWeights: Record<string, number>;
    modelAccuracy: Record<string, ModelAccuracy>;
    learningIterations: number;
    learnedPatterns: number;
  };
}

interface SvenStatus {
  state: string;
  activeSymbol: string | null;
  openPositions: number;
  pendingOrders: number;
  todayPnl: number;
  todayTrades: number;
  uptime: number;
  mode: string;
  circuitBreaker: {
    tripped: boolean;
    reason: string | null;
    dailyLossPct: number;
    consecutiveLosses: number;
    currentDrawdownPct: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const stateColors: Record<string, string> = {
  idle: 'text-surface-400',
  scanning: 'text-cyan-400',
  analyzing: 'text-brand',
  deciding: 'text-yellow-400',
  executing: 'text-bull',
  monitoring: 'text-blue-400',
  learning: 'text-purple-400',
  paused: 'text-orange-400',
  error: 'text-bear',
};

const stateLabels: Record<string, string> = {
  idle: 'Idle',
  scanning: 'Scanning Markets',
  analyzing: 'Analyzing Data',
  deciding: 'Making Decision',
  executing: 'Executing Trade',
  monitoring: 'Monitoring Positions',
  learning: 'Self-Improving',
  paused: 'Paused',
  error: 'Error',
};

export function SvenBrainPanel() {
  const [account, setAccount] = useState<SvenAccountData | null>(null);
  const [status, setStatus] = useState<SvenStatus | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, statusRes] = await Promise.all([
          fetch(`${API_BASE}/v1/trading/sven/account`, { credentials: 'include' }),
          fetch(`${API_BASE}/v1/trading/sven/status`, { credentials: 'include' }),
        ]);
        if (accRes.ok) {
          const accJson = await accRes.json();
          if (accJson.success) setAccount(accJson.data);
        } else {
          // Guest fallback — fetch public status for balance display
          const pubRes = await fetch(`${API_BASE}/v1/trading/sven/public-status`);
          if (pubRes.ok) {
            const pubJson = await pubRes.json();
            if (pubJson.success) {
              setAccount({
                account: { owner: 'sven', balance: pubJson.data.balance, frozen: 0 },
                tokenConfig: { name: '47Token', ticker: '47T', usdPeg: 1, svenStartingAllowance: 100000 },
                learningMetrics: { sourceWeights: {}, modelAccuracy: {}, learningIterations: 0, learnedPatterns: 0 },
              });
            }
          }
        }
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson.success) setStatus(statusJson.data);
        } else {
          // Guest fallback — hydrate status from public endpoint
          const pubRes = await fetch(`${API_BASE}/v1/trading/sven/public-status`);
          if (pubRes.ok) {
            const pubJson = await pubRes.json();
            if (pubJson.success) {
              setStatus({
                state: pubJson.data.state ?? 'monitoring',
                activeSymbol: null,
                openPositions: pubJson.data.openPositions ?? 0,
                pendingOrders: 0,
                todayPnl: pubJson.data.dailyPnl ?? 0,
                todayTrades: pubJson.data.dailyTrades ?? 0,
                uptime: 0,
                mode: pubJson.data.mode ?? 'paper',
                circuitBreaker: { tripped: false, reason: null, dailyLossPct: 0, consecutiveLosses: 0, currentDrawdownPct: 0 },
              });
            }
          }
        }
      } catch {
        // Gateway not available — use defaults
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, []);

  const state = status?.state ?? 'monitoring';
  const cb = status?.circuitBreaker;

  return (
    <div className="glass-panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('relative', stateColors[state])}>
            <Brain className="w-5 h-5" />
            {state !== 'idle' && state !== 'paused' && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand animate-pulse" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-white">Sven Autonomous Brain</h3>
        </div>
        <span className={cn('text-xs font-mono px-2 py-0.5 rounded', stateColors[state], 'bg-surface-800')}>
          {stateLabels[state] ?? state}
        </span>
      </div>

      {/* 47Token Balance */}
      <div className="rounded-lg bg-surface-800/60 p-3 border border-brand/20">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-surface-400">47Token Balance</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-mono font-bold text-white">
            {account ? account.account.balance.toLocaleString() : '100,000'}
          </span>
          <span className="text-xs text-yellow-400">47T</span>
        </div>
        {account && account.account.frozen > 0 && (
          <div className="text-xs text-surface-400 mt-1">
            {account.account.frozen.toLocaleString()} 47T locked in orders
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-surface-800/50 p-2">
          <div className="text-xs text-surface-400">Mode</div>
          <div className="text-sm font-mono text-white capitalize">{status?.mode ?? 'paper'}</div>
        </div>
        <div className="rounded bg-surface-800/50 p-2">
          <div className="text-xs text-surface-400">Today P&L</div>
          <div className={cn('text-sm font-mono', (status?.todayPnl ?? 0) >= 0 ? 'text-bull' : 'text-bear')}>
            {formatUsd(status?.todayPnl ?? 0)}
          </div>
        </div>
        <div className="rounded bg-surface-800/50 p-2">
          <div className="text-xs text-surface-400">Positions</div>
          <div className="text-sm font-mono text-white">{status?.openPositions ?? 0}</div>
        </div>
        <div className="rounded bg-surface-800/50 p-2">
          <div className="text-xs text-surface-400">Today Trades</div>
          <div className="text-sm font-mono text-white">{status?.todayTrades ?? 0}</div>
        </div>
      </div>

      {/* Circuit Breaker */}
      {cb && cb.tripped && (
        <div className="rounded-lg bg-bear/10 border border-bear/30 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-bear mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-bear">Circuit Breaker Tripped</div>
            <div className="text-xs text-surface-300 mt-1">{cb.reason}</div>
          </div>
        </div>
      )}

      {/* Learning Metrics */}
      {expanded && account?.learningMetrics && (
        <div className="space-y-2 pt-2 border-t border-surface-700">
          <div className="flex items-center gap-1 text-xs text-surface-400">
            <Zap className="w-3 h-3" />
            <span>Self-Learning Progress</span>
            <span className="ml-auto text-surface-500">
              Iteration #{account.learningMetrics.learningIterations}
            </span>
          </div>

          {/* Source Weights */}
          <div className="space-y-1">
            {Object.entries(account.learningMetrics.sourceWeights).map(([source, weight]) => (
              <div key={source} className="flex items-center gap-2">
                <span className="text-xs text-surface-400 w-24 truncate">{source}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${weight * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-surface-300 w-10 text-right">
                  {(weight * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          {/* Model Accuracy */}
          <div className="flex items-center gap-1 text-xs text-surface-400 mt-2">
            <Activity className="w-3 h-3" />
            <span>Model Accuracy</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(account.learningMetrics.modelAccuracy).map(([model, acc]) => (
              <div key={model} className="text-xs flex justify-between bg-surface-800/40 rounded px-2 py-1">
                <span className="text-surface-400">{model}</span>
                <span className={cn(
                  'font-mono',
                  acc.total === 0 ? 'text-surface-500' : acc.accuracy >= 0.6 ? 'text-bull' : acc.accuracy >= 0.4 ? 'text-yellow-400' : 'text-bear',
                )}>
                  {acc.total === 0 ? '—' : `${(acc.accuracy * 100).toFixed(0)}%`}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xs text-surface-500 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            {account.learningMetrics.learnedPatterns} patterns discovered
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-xs text-surface-500 hover:text-surface-300 text-center"
      >
        {expanded ? 'Show less' : 'Show learning metrics'}
      </button>
    </div>
  );
}
