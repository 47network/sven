'use client';

import { useMemo } from 'react';

interface ChartBlockProps {
  content: {
    chart_type?: 'bar' | 'line' | 'pie';
    data?: Array<Record<string, unknown>>;
    title?: string;
    x_key?: string;
    y_key?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Simple chart renderer using inline SVG.
 * For full-featured charts, Recharts is available but kept out of the blocks bundle
 * to avoid SSR complexity. This provides a lightweight inline alternative.
 */
export function ChartBlock({ content }: ChartBlockProps) {
  const { chart_type = 'bar', data = [], title, x_key = 'label', y_key = 'value' } = content || {};

  const maxVal = useMemo(
    () => Math.max(...data.map((d) => Number(d[y_key]) || 0), 1),
    [data, y_key],
  );

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4 text-center text-sm text-[var(--fg-muted)]">
        No chart data
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      {title && <h4 className="mb-3 text-sm font-medium">{title}</h4>}

      {chart_type === 'bar' && (
        <div className="space-y-2">
          {data.map((d, i) => {
            const val = Number(d[y_key]) || 0;
            const pct = (val / maxVal) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 truncate text-xs text-[var(--fg-muted)]">
                  {String(d[x_key])}
                </span>
                <div className="flex-1 rounded-full bg-slate-100 dark:bg-slate-800 h-5">
                  <div
                    className="h-5 rounded-full bg-brand-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">{val}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chart_type === 'line' && (
        <svg viewBox={`0 0 ${data.length * 60} 120`} className="w-full h-32">
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            points={data
              .map((d, i) => {
                const val = Number(d[y_key]) || 0;
                const x = i * 60 + 30;
                const y = 110 - (val / maxVal) * 100;
                return `${x},${y}`;
              })
              .join(' ')}
          />
          {data.map((d, i) => {
            const val = Number(d[y_key]) || 0;
            const x = i * 60 + 30;
            const y = 110 - (val / maxVal) * 100;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="3" fill="var(--accent)" />
                <text x={x} y={118} textAnchor="middle" className="text-[8px] fill-[var(--fg-muted)]">
                  {String(d[x_key])}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {chart_type === 'pie' && (
        <div className="flex items-center gap-4">
          <div className="text-sm text-[var(--fg-muted)]">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: `hsl(${(i * 360) / data.length}, 60%, 50%)`,
                  }}
                />
                <span>
                  {String(d[x_key])}: {String(d[y_key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
