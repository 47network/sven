// ---------------------------------------------------------------------------
// /sven — Dedicated Sven Autonomous Trading Control + Analytics Page
// ---------------------------------------------------------------------------
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Brain, Play, Pause, RotateCcw, TrendingUp, Activity, Shield,
  Zap, BarChart3, Cpu, AlertCircle, Power, StopCircle,
} from 'lucide-react';
import { cn, formatUsd } from '@/lib/utils';
import { SvenBrainPanel } from '@/components/SvenBrainPanel';
import { KronosPanel } from '@/components/KronosPanel';
import { MiroFishPanel } from '@/components/MiroFishPanel';
import { useTradingEvents } from '@/lib/hooks/use-trading-events';
import { useTradingStore } from '@/lib/store';
import { startLoop, stopLoop, fetchLoopStatus } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const DEFAULT_LOOP_CONFIG_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];

interface DecisionResult {
  symbol: string;
  decision: string;
  reasoning: string;
  direction?: string;
  confidence?: number;
  positionSize?: number;
}

interface LoopStatus {
  running: boolean;
  intervalMs: number;
  iterations: number;
  lastLoopAt: string | null;
}

interface BrainStatus {
  model: string;
  endpoint: string;
  lastReasoning: string | null;
}

export default function SvenControlPage() {
  useTradingEvents();

  const activities = useTradingStore((s) => s.activities);
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const ticker = useTradingStore((s) => s.ticker);

  const [kronosPrediction, setKronosPrediction] = useState<any>(null);
  const [mirofishResult, setMirofishResult] = useState<any>(null);
  const [lastDecision, setLastDecision] = useState<DecisionResult | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);
  const [isRunningKronos, setIsRunningKronos] = useState(false);
  const [isRunningMiroFish, setIsRunningMiroFish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loopStatus, setLoopStatus] = useState<LoopStatus | null>(null);
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [isTogglingLoop, setIsTogglingLoop] = useState(false);

  // Poll loop + brain status every 10s
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/v1/trading/sven/status`, { credentials: 'include' });
        const json = await res.json();
        if (!cancelled && json.success) {
          if (json.data.loop) setLoopStatus(json.data.loop);
          if (json.data.brain) setBrainStatus(json.data.brain);
        }
      } catch { /* ignore */ }
    }
    poll();
    const interval = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const toggleLoop = useCallback(async () => {
    setIsTogglingLoop(true);
    setError(null);
    try {
      if (loopStatus?.running) {
        await stopLoop();
        setLoopStatus((prev) => prev ? { ...prev, running: false } : null);
      } else {
        await startLoop(60_000);
        setLoopStatus((prev) => prev ? { ...prev, running: true } : { running: true, intervalMs: 60_000, iterations: 0, lastLoopAt: null });
      }
    } catch (err) {
      setError('Failed to toggle loop');
    } finally {
      setIsTogglingLoop(false);
    }
  }, [loopStatus?.running]);

  const triggerDecision = useCallback(async () => {
    setIsDeciding(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/trading/sven/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol: activeSymbol }),
      });
      const json = await res.json();
      if (json.success) {
        setLastDecision(json.data);
      } else {
        setError(json.error ?? 'Decision failed');
      }
    } catch (err) {
      setError('Could not reach gateway');
    } finally {
      setIsDeciding(false);
    }
  }, [activeSymbol]);

  const triggerKronos = useCallback(async () => {
    setIsRunningKronos(true);
    setError(null);
    try {
      const storeCandles = useTradingStore.getState().candles;
      const candlePayload = storeCandles.map((c: any) => ({
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: c.volume, timestamp: c.time ?? c.timestamp,
      }));
      const res = await fetch('/api/trading/kronos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeSymbol,
          candles: candlePayload,
          current_price: ticker?.price ?? (storeCandles[storeCandles.length - 1]?.close ?? 0),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setKronosPrediction(json.data);
      } else {
        setError(json.error ?? 'Kronos prediction failed');
      }
    } catch {
      setError('Kronos prediction failed');
    } finally {
      setIsRunningKronos(false);
    }
  }, [activeSymbol, ticker?.price]);

  const triggerMiroFish = useCallback(async () => {
    setIsRunningMiroFish(true);
    setError(null);
    try {
      const storeCandles = useTradingStore.getState().candles;
      const candlePayload = storeCandles.map((c: any) => ({
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: c.volume, timestamp: c.time ?? c.timestamp,
      }));
      const res = await fetch('/api/trading/mirofish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeSymbol,
          candles: candlePayload,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMirofishResult(json.data);
      } else {
        setError(json.error ?? 'MiroFish simulation failed');
      }
    } catch {
      setError('MiroFish simulation failed');
    } finally {
      setIsRunningMiroFish(false);
    }
  }, [activeSymbol]);

  const resetCircuitBreaker = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/v1/trading/sven/circuit-breaker/reset`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      setError('Could not reset circuit breaker');
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Header */}
      <header className="border-b border-surface-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-brand" />
          <div>
            <h1 className="text-lg font-bold">Sven Autonomous Trading</h1>
            <p className="text-xs text-surface-400">47Token Paper Trading · Kronos BSQ + MiroFish Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="text-xs text-surface-400 hover:text-white px-3 py-1.5 rounded border border-surface-700">
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-bear/10 border border-bear/30 p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-bear shrink-0" />
            <span className="text-sm text-bear">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs text-surface-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Autonomous Loop Control */}
        <section className="rounded-lg border border-surface-700 bg-surface-900/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-brand" />
              <h2 className="text-sm font-semibold">Sven Autonomous Loop</h2>
              <div className={cn(
                'w-2.5 h-2.5 rounded-full ml-1',
                loopStatus?.running ? 'bg-green-400 animate-pulse' : 'bg-surface-500',
              )} />
              <span className="text-xs text-surface-400">
                {loopStatus?.running ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {loopStatus && (
                <div className="flex items-center gap-4 text-xs text-surface-400">
                  <span>Iterations: <span className="text-white font-mono">{loopStatus.iterations}</span></span>
                  <span>Interval: <span className="text-white font-mono">{(loopStatus.intervalMs / 1000).toFixed(0)}s</span></span>
                  {loopStatus.lastLoopAt && (
                    <span>Last: <span className="text-white font-mono">{new Date(loopStatus.lastLoopAt).toLocaleTimeString()}</span></span>
                  )}
                </div>
              )}
              <button
                onClick={toggleLoop}
                disabled={isTogglingLoop}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 border text-sm font-medium transition-all',
                  loopStatus?.running
                    ? 'border-bear/50 bg-bear/10 text-bear hover:bg-bear/20'
                    : 'border-bull/50 bg-bull/10 text-bull hover:bg-bull/20',
                  isTogglingLoop && 'opacity-50 cursor-wait',
                )}
              >
                {loopStatus?.running ? <StopCircle className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                {isTogglingLoop ? 'Working...' : loopStatus?.running ? 'Stop Loop' : 'Start Loop'}
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap text-xs">
            {DEFAULT_LOOP_CONFIG_SYMBOLS.map((s) => (
              <span key={s} className="px-2 py-1 rounded bg-surface-800 text-surface-300 font-mono">{s}</span>
            ))}
          </div>
        </section>

        {/* Sven's Brain — LLM Reasoning */}
        {brainStatus && (
          <section className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-purple-300">Sven&apos;s Brain — GPU Reasoning</h2>
              <span className="text-xs text-surface-500 ml-auto font-mono">{brainStatus.model}</span>
            </div>
            {brainStatus.lastReasoning ? (
              <div className="text-sm text-surface-200 bg-surface-900/70 rounded p-3 leading-relaxed whitespace-pre-wrap">
                {brainStatus.lastReasoning}
              </div>
            ) : (
              <div className="text-xs text-surface-500 italic">Waiting for first loop iteration to generate reasoning...</div>
            )}
          </section>
        )}

        {/* Control Buttons */}
        <section className="grid grid-cols-4 gap-3">
          <button
            onClick={triggerDecision}
            disabled={isDeciding}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg p-4 border transition-all',
              isDeciding
                ? 'border-brand/50 bg-brand/10 cursor-wait'
                : 'border-surface-600 bg-surface-800 hover:border-brand hover:bg-brand/5',
            )}
          >
            <Play className="w-5 h-5 text-brand" />
            <span className="text-sm font-medium">{isDeciding ? 'Deciding...' : 'Trigger Decision'}</span>
          </button>

          <button
            onClick={triggerKronos}
            disabled={isRunningKronos}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg p-4 border transition-all',
              isRunningKronos
                ? 'border-purple-400/50 bg-purple-400/10 cursor-wait'
                : 'border-surface-600 bg-surface-800 hover:border-purple-400 hover:bg-purple-400/5',
            )}
          >
            <Zap className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium">{isRunningKronos ? 'Running...' : 'Run Kronos'}</span>
          </button>

          <button
            onClick={triggerMiroFish}
            disabled={isRunningMiroFish}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg p-4 border transition-all',
              isRunningMiroFish
                ? 'border-cyan-400/50 bg-cyan-400/10 cursor-wait'
                : 'border-surface-600 bg-surface-800 hover:border-cyan-400 hover:bg-cyan-400/5',
            )}
          >
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-medium">{isRunningMiroFish ? 'Simulating...' : 'Run MiroFish'}</span>
          </button>

          <button
            onClick={resetCircuitBreaker}
            className="flex items-center justify-center gap-2 rounded-lg p-4 border border-surface-600 bg-surface-800 hover:border-yellow-400 hover:bg-yellow-400/5 transition-all"
          >
            <RotateCcw className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-medium">Reset Breaker</span>
          </button>
        </section>

        {/* Last Decision */}
        {lastDecision && (
          <section className="rounded-lg border border-brand/30 bg-brand/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-semibold">Last Decision</h2>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-surface-400">Symbol</div>
                <div className="text-sm font-mono">{lastDecision.symbol}</div>
              </div>
              <div>
                <div className="text-xs text-surface-400">Action</div>
                <div className={cn(
                  'text-sm font-semibold capitalize',
                  lastDecision.decision === 'enter' ? 'text-bull' : lastDecision.decision === 'exit' ? 'text-bear' : 'text-surface-300',
                )}>
                  {lastDecision.decision}
                </div>
              </div>
              <div>
                <div className="text-xs text-surface-400">Direction</div>
                <div className={cn(
                  'text-sm font-mono capitalize',
                  lastDecision.direction === 'long' ? 'text-bull' : lastDecision.direction === 'short' ? 'text-bear' : 'text-surface-300',
                )}>
                  {lastDecision.direction ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-surface-400">Confidence</div>
                <div className="text-sm font-mono">
                  {lastDecision.confidence ? `${(lastDecision.confidence * 100).toFixed(0)}%` : '—'}
                </div>
              </div>
            </div>
            <div className="text-xs text-surface-300 bg-surface-900/50 rounded p-2 mt-2">
              {lastDecision.reasoning}
            </div>
          </section>
        )}

        {/* Main Grid: Brain | Kronos | MiroFish */}
        <div className="grid grid-cols-3 gap-4">
          <SvenBrainPanel />
          <KronosPanel
            prediction={kronosPrediction}
            currentPrice={ticker?.price ?? 0}
            symbol={activeSymbol}
            isLoading={isRunningKronos}
          />
          <MiroFishPanel
            result={mirofishResult}
            symbol={activeSymbol}
            isLoading={isRunningMiroFish}
          />
        </div>

        {/* Activity Feed */}
        <section className="rounded-lg border border-surface-700 bg-surface-900/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700">
            <Activity className="w-4 h-4 text-surface-400" />
            <h2 className="text-sm font-semibold">Sven Activity Feed</h2>
            <span className="text-xs text-surface-500 ml-auto">{activities.length} events</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-surface-800">
            {activities.length === 0 ? (
              <div className="p-4 text-center text-surface-500 text-sm">
                Waiting for Sven to start trading...
              </div>
            ) : (
              activities.slice(0, 30).map((a, idx) => (
                <div key={a.id ?? idx} className="px-4 py-2 flex items-start gap-3 hover:bg-surface-800/30">
                  <span className={cn(
                    'text-xs font-mono px-1.5 py-0.5 rounded mt-0.5 shrink-0',
                    a.type === 'order' && 'text-bull bg-bull/10',
                    a.type === 'signal' && 'text-cyan-400 bg-cyan-400/10',
                    a.type === 'risk_check' && 'text-bear bg-bear/10',
                    a.type === 'prediction' && 'text-purple-400 bg-purple-400/10',
                    a.type === 'news' && 'text-orange-400 bg-orange-400/10',
                    a.type === 'strategy' && 'text-surface-300 bg-surface-700',
                    a.type === 'rebalance' && 'text-yellow-400 bg-yellow-400/10',
                  )}>
                    {a.type}
                  </span>
                  <span className="text-xs text-surface-300 flex-1">{a.message}</span>
                  <span className="text-[10px] text-surface-500 shrink-0">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
