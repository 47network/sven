'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createChart, type IChartApi, type ISeriesApi, ColorType, CrosshairMode, type CandlestickData, type Time, type HistogramData } from 'lightweight-charts';
import { useTradingStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { Timeframe, Candle } from '@/lib/types';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

function candleToChartData(c: Candle): CandlestickData {
  return {
    time: (c.timestamp / 1000) as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function candleToVolumeData(c: Candle): HistogramData {
  return {
    time: (c.timestamp / 1000) as Time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
  };
}

export function Chart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const { candles, activeSymbol, activeTimeframe, setActiveTimeframe } = useTradingStore();

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    /* Destroy previous chart */
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(107, 114, 128, 0.08)' },
        horzLines: { color: 'rgba(107, 114, 128, 0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(34, 211, 238, 0.3)', width: 1, style: 3 },
        horzLine: { color: 'rgba(34, 211, 238, 0.3)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(107, 114, 128, 0.15)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(107, 114, 128, 0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e80',
      wickDownColor: '#ef444480',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    /* Resize observer */
    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []);

  /* Init chart once */
  useEffect(() => {
    const cleanup = initChart();
    return () => cleanup?.();
  }, [initChart]);

  /* Update data when candles change */
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const chartData = candles.map(candleToChartData);
    const volumeData = candles.map(candleToVolumeData);

    candleSeriesRef.current.setData(chartData);
    volumeSeriesRef.current.setData(volumeData);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, activeSymbol]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Timeframe bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800/30 bg-surface/30">
        <span className="text-xs text-gray-500 mr-2">Timeframe</span>
        {TIMEFRAMES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveTimeframe(value)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              activeTimeframe === value
                ? 'bg-brand-400/15 text-brand-300 border border-brand-400/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-raised/30 border border-transparent',
            )}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-gray-600 font-mono">
          {activeSymbol} · {activeTimeframe.toUpperCase()} · {candles.length} bars
        </span>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
