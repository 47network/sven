// ---------------------------------------------------------------------------
// /analytics — Portfolio Analytics Dashboard
// ---------------------------------------------------------------------------
'use client';

import { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, PieChart, Activity,
  Shield, AlertTriangle, ArrowUpDown,
} from 'lucide-react';
import { cn, formatUsd, formatPct } from '@/lib/utils';
import { useTradingStore } from '@/lib/store';
import Link from 'next/link';

function MetricCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon?: React.ElementType; color?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase text-gray-500 tracking-wider">{label}</span>
        {Icon && <Icon className={cn('w-4 h-4', color ?? 'text-gray-500')} />}
      </div>
      <div className="text-xl font-mono font-bold text-gray-100">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data, height = 80 }: { data: number[]; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  const barW = Math.max(2, Math.min(12, 600 / data.length - 1));

  return (
    <svg viewBox={`0 0 ${data.length * (barW + 1)} ${height}`} className="w-full" style={{ height }}>
      {data.map((val, i) => {
        const barH = (Math.abs(val) / max) * (height / 2);
        const y = val >= 0 ? height / 2 - barH : height / 2;
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={y}
            width={barW}
            height={barH}
            fill={val >= 0 ? '#22c55e' : '#ef4444'}
            opacity={0.7}
          />
        );
      })}
      <line x1="0" y1={height / 2} x2={data.length * (barW + 1)} y2={height / 2} stroke="#374151" strokeWidth="0.5" />
    </svg>
  );
}

function ExposurePieChart({ items }: { items: Array<{ label: string; pct: number; color: string }> }) {
  let cumulative = 0;
  const total = items.reduce((s, i) => s + Math.abs(i.pct), 0) || 1;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="-1 -1 2 2" className="w-32 h-32" transform="rotate(-90)">
        {items.map((item, i) => {
          const pct = Math.abs(item.pct) / total;
          const start = cumulative;
          cumulative += pct;
          const x1 = Math.cos(2 * Math.PI * start);
          const y1 = Math.sin(2 * Math.PI * start);
          const x2 = Math.cos(2 * Math.PI * cumulative);
          const y2 = Math.sin(2 * Math.PI * cumulative);
          const largeArc = pct > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} L 0 0`}
              fill={item.color}
              opacity={0.8}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-gray-300">{item.label}</span>
            <span className="font-mono text-gray-500">{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ASSET_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb923c', '#facc15', '#34d399', '#22d3ee'];

export default function AnalyticsPage() {
  const {
    positions, totalCapital, availableCapital, totalPnl, totalPnlPct,
    dailyPnl, dailyPnlPct, candles,
  } = useTradingStore();

  // Generate daily returns from candles
  const dailyReturns = useMemo(() => {
    if (candles.length < 2) return [];
    return candles.slice(1).map((c, i) => {
      const prev = candles[i].close;
      return prev > 0 ? (c.close - prev) / prev : 0;
    });
  }, [candles]);

  // Compute rolling sharpe
  const rollingSharpe = useMemo(() => {
    const window = 30;
    const results: number[] = [];
    for (let i = window; i <= dailyReturns.length; i++) {
      const slice = dailyReturns.slice(i - window, i);
      const mean = slice.reduce((s, r) => s + r, 0) / window;
      const variance = slice.reduce((s, r) => s + (r - mean) ** 2, 0) / window;
      const std = Math.sqrt(variance);
      results.push(std > 0 ? (mean / std) * Math.sqrt(252) : 0);
    }
    return results;
  }, [dailyReturns]);

  // Compute max drawdown from candles
  const { drawdownPct, drawdownSeries } = useMemo(() => {
    if (candles.length === 0) return { drawdownPct: 0, drawdownSeries: [] as number[] };
    let peak = candles[0].close;
    let maxDD = 0;
    const series: number[] = [];
    for (const c of candles) {
      if (c.close > peak) peak = c.close;
      const dd = ((peak - c.close) / peak) * 100;
      maxDD = Math.max(maxDD, dd);
      series.push(-dd);
    }
    return { drawdownPct: maxDD, drawdownSeries: series };
  }, [candles]);

  // Annualized return
  const annReturn = useMemo(() => {
    if (dailyReturns.length === 0) return 0;
    const cumulative = dailyReturns.reduce((p, r) => p * (1 + r), 1);
    const years = dailyReturns.length / 252;
    return years > 0 ? (Math.pow(cumulative, 1 / years) - 1) * 100 : 0;
  }, [dailyReturns]);

  // Annualized volatility
  const annVol = useMemo(() => {
    if (dailyReturns.length < 2) return 0;
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / dailyReturns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
  }, [dailyReturns]);

  // Calmar ratio
  const calmar = drawdownPct > 0 ? annReturn / drawdownPct : 0;

  // Exposure breakdown from positions
  const exposureItems = useMemo(() => {
    if (positions.length === 0) return [];
    return positions.map((p, i) => ({
      label: p.symbol,
      pct: totalCapital > 0 ? (Math.abs(p.quantity * p.entryPrice) / totalCapital) * 100 : 0,
      color: ASSET_COLORS[i % ASSET_COLORS.length],
    }));
  }, [positions, totalCapital]);

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* Nav bar */}
      <nav className="h-12 border-b border-gray-800/60 bg-surface/90 backdrop-blur-sm flex items-center px-4 gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        <Link href="/sven" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sven AI</Link>
        <Link href="/backtest" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Backtest</Link>
        <span className="text-sm text-brand-400 font-semibold">Analytics</span>
        <Link href="/alerts" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Alerts</Link>
        <Link href="/credentials" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Credentials</Link>
        <Link href="/brokers" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Brokers</Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <PieChart className="w-7 h-7 text-brand-400" />
          Portfolio Analytics
        </h1>

        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          <MetricCard label="Total Capital" value={formatUsd(totalCapital)} icon={BarChart3} color="text-brand-400" />
          <MetricCard label="Available" value={formatUsd(availableCapital)} icon={Shield} color="text-blue-400" />
          <MetricCard label="Total P&L" value={formatUsd(totalPnl)} sub={formatPct(totalPnlPct)} icon={totalPnl >= 0 ? TrendingUp : TrendingDown} color={totalPnl >= 0 ? 'text-bull' : 'text-bear'} />
          <MetricCard label="Daily P&L" value={formatUsd(dailyPnl)} sub={formatPct(dailyPnlPct)} icon={Activity} color={dailyPnl >= 0 ? 'text-bull' : 'text-bear'} />
          <MetricCard label="Ann. Return" value={`${annReturn.toFixed(1)}%`} icon={TrendingUp} color={annReturn >= 0 ? 'text-bull' : 'text-bear'} />
          <MetricCard label="Ann. Volatility" value={`${annVol.toFixed(1)}%`} icon={ArrowUpDown} color="text-amber-400" />
        </div>

        {/* Risk Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <MetricCard label="Max Drawdown" value={`${drawdownPct.toFixed(2)}%`} icon={AlertTriangle} color="text-red-400" />
          <MetricCard label="Calmar Ratio" value={calmar.toFixed(2)} sub="Ann. Return / Max DD" />
          <MetricCard
            label="Sharpe (30d rolling)"
            value={rollingSharpe.length > 0 ? rollingSharpe[rollingSharpe.length - 1].toFixed(2) : '—'}
          />
          <MetricCard label="# Data Points" value={String(candles.length)} sub={`${dailyReturns.length} returns`} />
        </div>

        {/* Daily Returns Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-400" />
              Daily Returns Distribution
            </h2>
            {dailyReturns.length > 0 ? (
              <MiniBarChart data={dailyReturns.slice(-100).map((r) => r * 100)} height={100} />
            ) : (
              <div className="text-sm text-gray-500 text-center py-8">Load candle data from the dashboard first</div>
            )}
          </div>

          <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Drawdown Chart
            </h2>
            {drawdownSeries.length > 0 ? (
              <MiniBarChart data={drawdownSeries.slice(-100)} height={100} />
            ) : (
              <div className="text-sm text-gray-500 text-center py-8">No drawdown data yet</div>
            )}
          </div>
        </div>

        {/* Rolling Sharpe */}
        <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Rolling Sharpe Ratio (30-bar window)
          </h2>
          {rollingSharpe.length > 0 ? (
            <MiniBarChart data={rollingSharpe.slice(-100)} height={80} />
          ) : (
            <div className="text-sm text-gray-500 text-center py-8">Need at least 30 candles to compute rolling Sharpe</div>
          )}
        </div>

        {/* Exposure Breakdown */}
        <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-brand-400" />
            Position Exposure
          </h2>
          {exposureItems.length > 0 ? (
            <ExposurePieChart items={exposureItems} />
          ) : (
            <div className="text-sm text-gray-500 text-center py-8">No open positions</div>
          )}
        </div>
      </div>
    </div>
  );
}
