'use client';

import { useState } from 'react';
import { Users, ChevronDown, ChevronUp, Star, Clock, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownBlock } from './MarkdownBlock';
import { useCouncilSession } from '@/lib/hooks';

/**
 * A.4.2 — Council response view block.
 * Shows individual model responses in tabs + peer reviews + final synthesis.
 * Rendered inline in chat when the agent uses council mode.
 */

type Opinion = {
  model: string;
  response: string;
  tokens_prompt?: number;
  tokens_completion?: number;
  latency_ms?: number;
};

type PeerReview = {
  reviewer: string;
  target: string;
  score: number;
  feedback: string;
};

type CouncilContent = {
  session_id?: string;
  query?: string;
  synthesis?: string;
  opinions?: Opinion[];
  peer_reviews?: PeerReview[];
  scores?: Record<string, number>;
  status?: string;
  strategy?: string;
  total_tokens?: { prompt?: number; completion?: number };
  total_cost?: number;
  elapsed_ms?: number;
};

function safe(content: unknown): CouncilContent {
  if (content && typeof content === 'object') return content as CouncilContent;
  return {};
}

export function CouncilBlock({
  content,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  const data = safe(content);
  const [activeTab, setActiveTab] = useState<'synthesis' | 'opinions' | 'reviews'>('synthesis');
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  // If we have a session_id, poll for updates until completed
  const sessionQ = useCouncilSession(data.session_id ?? '');
  const live = sessionQ.data;
  const resolved = live ?? data;

  const synthesis = resolved.synthesis ?? '';
  const opinions = resolved.opinions ?? [];
  const peerReviews = resolved.peer_reviews ?? [];
  const scores = resolved.scores ?? {};
  const status = resolved.status ?? 'pending';
  const strategy = resolved.strategy ?? '';
  const totalTokens = resolved.total_tokens ?? {};
  const elapsedMs = resolved.elapsed_ms ?? 0;

  const isPending = status === 'pending' || status === 'running';

  const TABS = [
    { key: 'synthesis' as const, label: 'Synthesis', count: synthesis ? 1 : 0 },
    { key: 'opinions' as const, label: 'Opinions', count: opinions.length },
    { key: 'reviews' as const, label: 'Reviews', count: peerReviews.length },
  ];

  // Sort opinions by score (highest first)
  const sortedOpinions = [...opinions].sort((a, b) => {
    const sa = scores[a.model] ?? 0;
    const sb = scores[b.model] ?? 0;
    return sb - sa;
  });

  return (
    <div className="rounded-xl border border-purple-300/30 bg-purple-50/80 dark:border-purple-700/40 dark:bg-purple-950/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-200/40 dark:border-purple-800/40">
        <Users className="h-4 w-4 text-purple-500 dark:text-purple-400" />
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
          Council Deliberation
        </span>
        {strategy && (
          <span className="text-[10px] rounded-full border border-purple-300/50 bg-purple-100/60 px-2 py-0.5 text-purple-600 dark:border-purple-700/50 dark:bg-purple-900/40 dark:text-purple-300">
            {strategy.replace(/_/g, ' ')}
          </span>
        )}
        {isPending && (
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">
            deliberating…
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-purple-500/70 dark:text-purple-400/60">
          {elapsedMs > 0 && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(elapsedMs / 1000).toFixed(1)}s</span>
          )}
          {(totalTokens.prompt || totalTokens.completion) && (
            <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{((totalTokens.prompt ?? 0) + (totalTokens.completion ?? 0)).toLocaleString()} tok</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-purple-200/30 dark:border-purple-800/30">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === t.key
                ? 'text-purple-700 border-b-2 border-purple-500 dark:text-purple-300 dark:border-purple-400'
                : 'text-purple-400 hover:text-purple-600 dark:text-purple-500 dark:hover:text-purple-300',
            )}
          >
            {t.label} {t.count > 0 && <span className="ml-1 opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* ── Synthesis ── */}
        {activeTab === 'synthesis' && (
          synthesis ? (
            <div className="prose-sm dark:prose-invert max-w-none">
              <MarkdownBlock content={synthesis} />
            </div>
          ) : isPending ? (
            <div className="text-sm text-purple-400 dark:text-purple-500 animate-pulse">
              Waiting for council synthesis…
            </div>
          ) : (
            <div className="text-sm text-purple-400">No synthesis available</div>
          )
        )}

        {/* ── Opinions ── */}
        {activeTab === 'opinions' && (
          <div className="space-y-2">
            {sortedOpinions.length === 0 ? (
              <div className="text-sm text-purple-400">{isPending ? 'Models are deliberating…' : 'No opinions recorded'}</div>
            ) : (
              sortedOpinions.map((op) => {
                const isExpanded = expandedModel === op.model;
                const score = scores[op.model];
                return (
                  <div key={op.model} className="rounded-lg border border-purple-200/40 dark:border-purple-800/40 overflow-hidden">
                    <button
                      onClick={() => setExpandedModel(isExpanded ? null : op.model)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-100/40 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      <span className="text-xs font-mono font-medium text-purple-700 dark:text-purple-300">{op.model}</span>
                      {typeof score === 'number' && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3" />{score.toFixed(2)}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-3 text-[10px] text-purple-400/70">
                        {op.latency_ms && <span>{(op.latency_ms / 1000).toFixed(1)}s</span>}
                        {(op.tokens_prompt || op.tokens_completion) && (
                          <span>{((op.tokens_prompt ?? 0) + (op.tokens_completion ?? 0)).toLocaleString()} tok</span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-purple-400" /> : <ChevronDown className="h-3.5 w-3.5 text-purple-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-purple-200/30 dark:border-purple-800/30">
                        <div className="pt-2 prose-sm dark:prose-invert max-w-none">
                          <MarkdownBlock content={op.response} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Peer Reviews ── */}
        {activeTab === 'reviews' && (
          <div className="space-y-2">
            {peerReviews.length === 0 ? (
              <div className="text-sm text-purple-400">{isPending ? 'Peer review in progress…' : 'No peer reviews'}</div>
            ) : (
              peerReviews.map((pr, i) => (
                <div key={`${pr.reviewer}-${pr.target}-${i}`} className="rounded-lg border border-purple-200/40 dark:border-purple-800/40 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-medium text-purple-600 dark:text-purple-300">{pr.reviewer}</span>
                    <span className="text-purple-400">→</span>
                    <span className="font-mono text-purple-500 dark:text-purple-400">{pr.target}</span>
                    <span className="ml-auto flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                      <Star className="h-3 w-3" />{pr.score.toFixed(1)}
                    </span>
                  </div>
                  {pr.feedback && (
                    <p className="mt-1.5 text-xs text-purple-600/80 dark:text-purple-300/70 leading-relaxed">{pr.feedback}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
