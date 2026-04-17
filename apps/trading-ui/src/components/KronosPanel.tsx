// ---------------------------------------------------------------------------
// Kronos Prediction Panel — BSQ analysis + multi-horizon forecast
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Clock, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface Horizon {
  timeframe: string;
  horizonCandles: number;
  predictedDirection: 'up' | 'down' | 'neutral';
  predictedClose: number;
  confidence: number;
}

interface KronosPrediction {
  symbol: string;
  model: string;
  generatedAt: string;
  horizons: Horizon[];
}

interface Props {
  prediction: KronosPrediction | null;
  currentPrice: number;
  symbol: string;
  isLoading?: boolean;
}

const directionIcon = (d: string) => {
  if (d === 'up') return <TrendingUp className="w-4 h-4 text-bull" />;
  if (d === 'down') return <TrendingDown className="w-4 h-4 text-bear" />;
  return <Minus className="w-4 h-4 text-neutral" />;
};

const directionLabel = (d: string) => {
  if (d === 'up') return 'Bullish';
  if (d === 'down') return 'Bearish';
  return 'Neutral';
};

const confidenceColor = (c: number) => {
  if (c >= 0.7) return 'text-bull';
  if (c >= 0.4) return 'text-yellow-400';
  return 'text-neutral';
};

export function KronosPanel({ prediction, currentPrice, symbol, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand" />
          <h3 className="text-sm font-semibold text-white">Kronos BSQ Engine</h3>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-surface-400 hover:text-white"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Quick summary */}
      {prediction && prediction.horizons.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {prediction.horizons.map((h) => (
              <div
                key={h.timeframe}
                className={cn(
                  'rounded-lg p-2 border',
                  h.predictedDirection === 'up' && 'border-bull/30 bg-bull/5',
                  h.predictedDirection === 'down' && 'border-bear/30 bg-bear/5',
                  h.predictedDirection === 'neutral' && 'border-surface-600 bg-surface-800',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-surface-400">{h.timeframe}</span>
                  {directionIcon(h.predictedDirection)}
                </div>
                <div className="text-sm font-semibold text-white">
                  {directionLabel(h.predictedDirection)}
                </div>
                <div className={cn('text-xs font-mono', confidenceColor(h.confidence))}>
                  {(h.confidence * 100).toFixed(0)}% conf
                </div>
                {expanded && (
                  <div className="mt-1 text-xs text-surface-400">
                    Target: ${h.predictedClose.toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {expanded && (
            <div className="space-y-2 pt-2 border-t border-surface-700">
              <div className="flex items-center gap-2 text-xs text-surface-400">
                <Clock className="w-3 h-3" />
                <span>Generated: {new Date(prediction.generatedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-400">
                <Zap className="w-3 h-3" />
                <span>Model: {prediction.model} | Symbol: {prediction.symbol}</span>
              </div>
              <div className="text-xs text-surface-500">
                BSQ tokenization projects OHLCV candles onto a mathematical sphere for
                scale-invariant pattern recognition. Predictions use binary spherical
                quantization to encode market structure.
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4 text-surface-500 text-sm">
          {isLoading ? 'Running Kronos analysis...' : 'No prediction available. Feed candle data to generate.'}
        </div>
      )}
    </div>
  );
}
