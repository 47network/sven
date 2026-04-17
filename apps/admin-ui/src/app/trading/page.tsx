// ---------------------------------------------------------------------------
// /trading — Admin Trading Dashboard
// ---------------------------------------------------------------------------
'use client';

import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { SkeletonStatGrid, SkeletonCard } from '@/components/Skeleton';
import {
  useTradingDashboard,
  useTradingPnlChart,
  useTradingCorrelation,
  useTradingExecutionQuality,
  useTradingCredentials,
  useTradingBrokers,
} from '@/lib/hooks';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Wallet,
  ShieldCheck,
  Server,
  PieChart,
  Target,
} from 'lucide-react';

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
function usd(v: number): string {
  return `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(2)}`;
}

export default function TradingDashboardPage() {
  const { data: dashRaw, isLoading: dashLoading } = useTradingDashboard();
  const { data: pnlRaw, isLoading: pnlLoading } = useTradingPnlChart();
  const { data: corrRaw } = useTradingCorrelation();
  const { data: execRaw } = useTradingExecutionQuality();
  const { data: credRaw } = useTradingCredentials();
  const { data: brokersRaw } = useTradingBrokers();

  const dash = (dashRaw as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const pnlData = ((pnlRaw as Record<string, unknown>)?.data ?? []) as Array<{ date: string; equity: number }>;
  const corrData = (corrRaw as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const execData = (execRaw as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const credRows = ((credRaw as Record<string, unknown>)?.rows ?? []) as Array<Record<string, unknown>>;
  const brokerRows = ((brokersRaw as Record<string, unknown>)?.rows ?? brokersRaw ?? []) as Array<Record<string, unknown>>;

  const balance = num(dash?.balance);
  const totalPnl = num(dash?.totalPnl ?? dash?.total_pnl);
  const totalPnlPct = num(dash?.totalPnlPct ?? dash?.total_pnl_pct);
  const openPositions = num(dash?.openPositions ?? dash?.open_positions);
  const maxDrawdown = num(dash?.maxDrawdown ?? dash?.max_drawdown);
  const winRate = num(dash?.winRate ?? dash?.win_rate);
  const sharpe = num(dash?.sharpeRatio ?? dash?.sharpe_ratio);
  const loopActive = Boolean(dash?.loopActive ?? dash?.loop_active);

  const activeCreds = credRows.filter((c) => c.status !== 'revoked').length;
  const connectedBrokers = Array.isArray(brokerRows) ? brokerRows.length : 0;

  // Equity curve mini-chart (SVG)
  const eqMax = pnlData.reduce((mx, d) => Math.max(mx, d.equity), -Infinity);
  const eqMin = pnlData.reduce((mn, d) => Math.min(mn, d.equity), Infinity);
  const eqRange = eqMax - eqMin || 1;

  return (
    <>
      <PageHeader
        title="Trading Dashboard"
        description="Live trading overview, performance metrics, and broker status"
      />

      {dashLoading ? (
        <SkeletonStatGrid count={8} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Balance"
            value={usd(balance)}
            icon={Wallet}
          />
          <StatCard
            label="Total P&L"
            value={usd(totalPnl)}
            change={pct(totalPnlPct)}
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          />
          <StatCard
            label="Open Positions"
            value={String(openPositions)}
            icon={Activity}
          />
          <StatCard
            label="Max Drawdown"
            value={pct(maxDrawdown)}
            icon={BarChart3}
          />
          <StatCard
            label="Win Rate"
            value={pct(winRate)}
            icon={Target}
          />
          <StatCard
            label="Sharpe Ratio"
            value={sharpe.toFixed(2)}
            icon={PieChart}
          />
          <StatCard
            label="Exchange Keys"
            value={`${activeCreds} active`}
            icon={ShieldCheck}
          />
          <StatCard
            label="Brokers"
            value={`${connectedBrokers} connected`}
            change={loopActive ? 'Loop active' : 'Loop stopped'}
            icon={Server}
          />
        </div>
      )}

      {/* Equity Curve */}
      {pnlData.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-6 mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Equity Curve
          </h2>
          <svg viewBox="0 0 800 200" className="w-full h-48" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="var(--color-primary, #3b82f6)"
              strokeWidth="2"
              points={pnlData.map((d, i) => {
                const x = (i / (pnlData.length - 1)) * 800;
                const y = 200 - ((d.equity - eqMin) / eqRange) * 180 - 10;
                return `${x},${y}`;
              }).join(' ')}
            />
          </svg>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
            <span>{pnlData[0]?.date ?? ''}</span>
            <span>{pnlData[pnlData.length - 1]?.date ?? ''}</span>
          </div>
        </div>
      )}

      {/* Two-column: Execution Quality + Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Execution Quality */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Execution Quality
          </h2>
          {execData ? (
            <div className="space-y-3">
              {Object.entries(execData).slice(0, 8).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-mono font-semibold">
                    {typeof val === 'number' ? val.toFixed(4) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No execution data yet</p>
          )}
        </div>

        {/* Correlation Matrix */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            Correlation Matrix
          </h2>
          {corrData ? (
            <div className="overflow-auto text-xs font-mono">
              {(() => {
                const symbols = Object.keys(corrData).slice(0, 8);
                return (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="p-1" />
                        {symbols.map((s) => (
                          <th key={s} className="p-1 text-muted-foreground whitespace-nowrap">
                            {s.replace('/USDT', '')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {symbols.map((row) => (
                        <tr key={row}>
                          <td className="p-1 text-muted-foreground whitespace-nowrap">
                            {row.replace('/USDT', '')}
                          </td>
                          {symbols.map((col) => {
                            const val = num(
                              ((corrData[row] as Record<string, number>) ?? {})[col],
                            );
                            const abs = Math.abs(val);
                            return (
                              <td
                                key={col}
                                className="p-1 text-center"
                                style={{
                                  backgroundColor:
                                    val > 0
                                      ? `rgba(34,197,94,${abs * 0.4})`
                                      : val < 0
                                        ? `rgba(239,68,68,${abs * 0.4})`
                                        : 'transparent',
                                }}
                              >
                                {val.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No correlation data yet</p>
          )}
        </div>
      </div>
    </>
  );
}
