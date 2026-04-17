// ---------------------------------------------------------------------------
// MiroFish Simulation Panel — Multi-agent consensus visualization
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Users, TrendingUp, TrendingDown, BarChart3, Cpu, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface TopStrategy {
  strategy: string;
  avgPnl: number;
  count: number;
}

interface MiroFishResult {
  symbol: string;
  agentCount: number;
  timesteps: number;
  consensusDirection: 'up' | 'down' | 'neutral';
  consensusStrength: number;
  bullishAgents: number;
  bearishAgents: number;
  neutralAgents: number;
  topStrategies: TopStrategy[];
  completedAt: string;
}

interface Props {
  result: MiroFishResult | null;
  symbol: string;
  isLoading?: boolean;
}

const strategyEmoji: Record<string, string> = {
  momentum: '🚀',
  mean_reversion: '🔄',
  sentiment: '💬',
  fundamental: '📊',
  technical: '📈',
  contrarian: '🔮',
  random_walk: '🎲',
};

export function MiroFishPanel({ result, symbol, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false);

  const bullPct = result ? result.bullishAgents / result.agentCount : 0;
  const bearPct = result ? result.bearishAgents / result.agentCount : 0;
  const neutralPct = result ? result.neutralAgents / result.agentCount : 0;

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">MiroFish Simulation</h3>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-surface-400 hover:text-white"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {result && result.agentCount > 0 ? (
        <>
          {/* Consensus bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                {result.consensusDirection === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-bull" />
                ) : result.consensusDirection === 'down' ? (
                  <TrendingDown className="w-4 h-4 text-bear" />
                ) : (
                  <BarChart3 className="w-4 h-4 text-neutral" />
                )}
                <span className={cn(
                  'font-semibold',
                  result.consensusDirection === 'up' && 'text-bull',
                  result.consensusDirection === 'down' && 'text-bear',
                  result.consensusDirection === 'neutral' && 'text-neutral',
                )}>
                  {result.consensusDirection === 'up' ? 'BULLISH' : result.consensusDirection === 'down' ? 'BEARISH' : 'NEUTRAL'}
                </span>
              </div>
              <span className="text-surface-400 text-xs">
                {(result.consensusStrength * 100).toFixed(0)}% strength
              </span>
            </div>

            {/* Agent distribution bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-surface-800">
              <div
                className="bg-bull transition-all duration-500"
                style={{ width: `${bullPct * 100}%` }}
                title={`${result.bullishAgents} bullish agents`}
              />
              <div
                className="bg-surface-500 transition-all duration-500"
                style={{ width: `${neutralPct * 100}%` }}
                title={`${result.neutralAgents} neutral agents`}
              />
              <div
                className="bg-bear transition-all duration-500"
                style={{ width: `${bearPct * 100}%` }}
                title={`${result.bearishAgents} bearish agents`}
              />
            </div>
            <div className="flex justify-between text-xs text-surface-400">
              <span className="text-bull">{result.bullishAgents} bulls</span>
              <span>{result.neutralAgents} neutral</span>
              <span className="text-bear">{result.bearishAgents} bears</span>
            </div>
          </div>

          {/* Agent stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-surface-800/50 p-2">
              <div className="text-xs text-surface-400">Agents</div>
              <div className="text-sm font-mono text-white">{result.agentCount.toLocaleString()}</div>
            </div>
            <div className="rounded bg-surface-800/50 p-2">
              <div className="text-xs text-surface-400">Steps</div>
              <div className="text-sm font-mono text-white">{result.timesteps}</div>
            </div>
            <div className="rounded bg-surface-800/50 p-2">
              <div className="text-xs text-surface-400">Strategies</div>
              <div className="text-sm font-mono text-white">{result.topStrategies.length}</div>
            </div>
          </div>

          {/* Top strategies */}
          {expanded && result.topStrategies.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-surface-700">
              <div className="flex items-center gap-1 text-xs text-surface-400 mb-2">
                <Trophy className="w-3 h-3" />
                <span>Top performing strategies</span>
              </div>
              {result.topStrategies.map((s, i) => (
                <div key={s.strategy} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-center">{strategyEmoji[s.strategy] ?? '📌'}</span>
                    <span className="text-surface-300 capitalize">{s.strategy.replace('_', ' ')}</span>
                    <span className="text-surface-500">({s.count})</span>
                  </div>
                  <span className={cn(
                    'font-mono',
                    s.avgPnl > 0 ? 'text-bull' : s.avgPnl < 0 ? 'text-bear' : 'text-neutral',
                  )}>
                    {s.avgPnl >= 0 ? '+' : ''}{s.avgPnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {expanded && (
            <div className="text-xs text-surface-500 pt-2 border-t border-surface-700">
              <div className="flex items-center gap-1 mb-1">
                <Cpu className="w-3 h-3" />
                <span>Simulation completed: {new Date(result.completedAt).toLocaleTimeString()}</span>
              </div>
              MiroFish spawns {result.agentCount.toLocaleString()} independent AI agents, each with
              a different trading strategy. They trade the same market data and vote on
              direction. Consensus emerges from evolutionary survival — agents that lose money
              get their voting weight reduced.
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4 text-surface-500 text-sm">
          {isLoading ? 'Running multi-agent simulation...' : 'No simulation results. Feed candle data to run.'}
        </div>
      )}
    </div>
  );
}
