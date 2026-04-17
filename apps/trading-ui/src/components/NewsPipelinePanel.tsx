// ---------------------------------------------------------------------------
// News-to-Trade Pipeline Visualization
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Newspaper, AlertTriangle, TrendingUp, TrendingDown, Minus, Globe, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import type { NewsItem } from '../lib/types';

interface Props {
  newsItems: NewsItem[];
}

const impactLabel = (level: number) => {
  if (level >= 0.8) return { text: 'CRITICAL', color: 'text-bear', bg: 'bg-bear/10' };
  if (level >= 0.6) return { text: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-400/10' };
  if (level >= 0.4) return { text: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
  return { text: 'LOW', color: 'text-surface-400', bg: 'bg-surface-800/50' };
};

const sentimentIcon = (score: number) => {
  if (score > 0.2) return <TrendingUp className="w-3.5 h-3.5 text-bull" />;
  if (score < -0.2) return <TrendingDown className="w-3.5 h-3.5 text-bear" />;
  return <Minus className="w-3.5 h-3.5 text-surface-400" />;
};

const categoryIcon = (cat: string) => {
  if (cat === 'geopolitical') return <Globe className="w-3.5 h-3.5" />;
  if (cat === 'security') return <Shield className="w-3.5 h-3.5" />;
  return <Newspaper className="w-3.5 h-3.5" />;
};

export function NewsPipelinePanel({ newsItems }: Props) {
  const [expanded, setExpanded] = useState(true);
  const recent = newsItems.slice(0, 8);

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">News-to-Trade Pipeline</h3>
          {recent.some((n) => n.impact.level >= 0.8) && (
            <AlertTriangle className="w-4 h-4 text-bear animate-pulse" />
          )}
        </div>
        <span className="text-xs text-surface-400">{newsItems.length} events</span>
      </div>

      {recent.length === 0 ? (
        <div className="text-center py-4 text-surface-500 text-sm">
          No news events captured yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {recent.map((item, idx) => {
            const impact = impactLabel(item.impact.level);
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-lg p-2.5 border transition-colors',
                  item.impact.level >= 0.8 ? 'border-bear/30 bg-bear/5' :
                  item.impact.level >= 0.6 ? 'border-orange-400/20 bg-orange-400/5' :
                  'border-surface-700 bg-surface-800/30',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{sentimentIcon(item.sentimentScore)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-surface-300 line-clamp-2">{item.event}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', impact.color, impact.bg)}>
                        {impact.text}
                      </span>
                      {item.impact.category && (
                        <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
                          {categoryIcon(item.impact.category)}
                          {item.impact.category}
                        </span>
                      )}
                      {item.entities.symbols.length > 0 && (
                        <span className="text-[10px] text-surface-400">
                          {item.entities.symbols.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
