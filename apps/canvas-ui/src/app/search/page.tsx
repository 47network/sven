'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useChats, useSearch } from '@/lib/hooks';
import type {
  ChatSummary,
  SearchArtifactRow,
  SearchMessageRow,
  SearchToolRunRow,
} from '@/lib/api';
import { Spinner } from '@/components/Spinner';
import {
  Search as SearchIcon, MessageSquare, Wrench, FileText,
  ArrowRight, ExternalLink, File,
} from 'lucide-react';
import { relativeTime, truncate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const SEARCH_LIMITS = { messages: 20, tool_runs: 10, artifacts: 10 } as const;

type SearchOffsets = { messages: number; tool_runs: number; artifacts: number };
type SearchRows = {
  messages: SearchMessageRow[];
  tool_runs: SearchToolRunRow[];
  artifacts: SearchArtifactRow[];
};

const EMPTY_OFFSETS: SearchOffsets = { messages: 0, tool_runs: 0, artifacts: 0 };
const EMPTY_ROWS: SearchRows = { messages: [], tool_runs: [], artifacts: [] };

function mergeById<T extends { id?: unknown }>(previous: T[], incoming: T[]): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();
  for (const row of [...previous, ...incoming]) {
    const id = String(row?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
  }
  return merged;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [chatIdFilter, setChatIdFilter] = useState('');
  const [offsets, setOffsets] = useState<SearchOffsets>(EMPTY_OFFSETS);
  const [rows, setRows] = useState<SearchRows>(EMPTY_ROWS);
  const chatsQuery = useChats();
  const chats = chatsQuery.data || [];
  const { data, isLoading, isFetching } = useSearch(query, chatIdFilter || undefined, {
    limits: SEARCH_LIMITS,
    offsets,
  });
  const router = useRouter();

  useEffect(() => {
    if (!data) return;
    setRows((prev) => ({
      messages: mergeById(
        offsets.messages === 0 ? [] : prev.messages,
        Array.isArray(data.messages) ? data.messages : [],
      ),
      tool_runs: mergeById(
        offsets.tool_runs === 0 ? [] : prev.tool_runs,
        Array.isArray(data.tool_runs) ? data.tool_runs : [],
      ),
      artifacts: mergeById(
        offsets.artifacts === 0 ? [] : prev.artifacts,
        Array.isArray(data.artifacts) ? data.artifacts : [],
      ),
    }));
  }, [data, offsets.messages, offsets.tool_runs, offsets.artifacts]);

  const messages = rows.messages;
  const toolRuns = rows.tool_runs;
  const artifacts = rows.artifacts;
  const page = data?.page;
  const totalResults = messages.length + toolRuns.length + artifacts.length;

  function resetSearchState(nextQuery: string) {
    setQuery(nextQuery);
    setOffsets(EMPTY_OFFSETS);
    setRows(EMPTY_ROWS);
  }

  function setChatFilter(nextChatId: string) {
    setChatIdFilter(nextChatId);
    setOffsets(EMPTY_OFFSETS);
    setRows(EMPTY_ROWS);
  }

  function loadMore(kind: keyof SearchOffsets) {
    const nextOffset = page?.[kind]?.next_offset;
    if (typeof nextOffset !== 'number') return;
    setOffsets((prev) => ({ ...prev, [kind]: nextOffset }));
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4 space-y-3">
          <h1 className="text-xl font-bold">Search</h1>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
            <input
              className="input pl-10"
              placeholder="Search messages, tool runs, artifacts…"
              value={query}
              onChange={(e) => resetSearchState(e.target.value)}
              autoFocus
            />
            {isFetching && (
              <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--fg-muted)]">Chat</span>
            <select
              className="input h-9 min-w-[220px] py-1 text-xs"
              value={chatIdFilter}
              onChange={(e) => setChatFilter(e.target.value)}
            >
              <option value="">All chats</option>
              {chats.map((chat: ChatSummary) => {
                const id = String(chat.id || '').trim();
                if (!id) return null;
                const name = String(chat.name || id);
                return (
                  <option key={id} value={id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
          {query.length > 1 && !isLoading && (
            <p className="text-xs text-[var(--fg-muted)]">
              {totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              {chatIdFilter ? ' in selected chat' : ''}
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!query || query.length <= 1 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--fg-muted)]">
              <SearchIcon className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Type to search across your chats</p>
              <p className="text-xs mt-1">Messages, tool runs, and artifacts are all searchable</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--fg-muted)]">
              <p className="text-sm">No results found</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {/* Messages */}
              {messages.length > 0 && (
                <section className="p-4 space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Messages ({messages.length})
                  </h3>
                  {messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => router.push(`/c/${msg.chat_id}?m=${encodeURIComponent(String(msg.id || ''))}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-brand-600">{msg.chat_name}</span>
                          <span className="text-[10px] text-[var(--fg-muted)]">
                            {relativeTime(msg.created_at)}
                          </span>
                          <span className="badge badge-neutral text-[10px]">{msg.role}</span>
                        </div>
                        <p className="text-sm truncate mt-0.5">{truncate(msg.text || '', 120)}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
                    </button>
                  ))}
                  {page?.messages?.has_more && (
                    <div className="pt-1">
                      <button
                        type="button"
                        className="btn btn-secondary w-full disabled:opacity-60"
                        disabled={isFetching}
                        onClick={() => loadMore('messages')}
                      >
                        {isFetching ? 'Loading…' : 'Load more messages'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Tool Runs */}
              {toolRuns.length > 0 && (
                <section className="p-4 space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">
                    <Wrench className="h-3.5 w-3.5" />
                    Tool Runs ({toolRuns.length})
                  </h3>
                  {toolRuns.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => router.push(`/runs/${run.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/runs/${run.id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{run.tool_name}</span>
                          <span className={`badge ${run.status === 'success' ? 'badge-success' : run.status === 'error' ? 'badge-danger' : 'badge-warning'} text-[10px]`}>
                            {run.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                          {run.chat_name} • {relativeTime(run.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {run.chat_id && run.context_message_id && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-cyan-300/30 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-900/20"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/c/${run.chat_id}?m=${encodeURIComponent(String(run.context_message_id || ''))}`);
                            }}
                          >
                            Context
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                        {run.chat_id && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/c/${run.chat_id}`);
                            }}
                          >
                            Chat
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                        <ArrowRight className="h-4 w-4 text-[var(--fg-muted)]" />
                      </div>
                    </div>
                  ))}
                  {page?.tool_runs?.has_more && (
                    <div className="pt-1">
                      <button
                        type="button"
                        className="btn btn-secondary w-full disabled:opacity-60"
                        disabled={isFetching}
                        onClick={() => loadMore('tool_runs')}
                      >
                        {isFetching ? 'Loading…' : 'Load more tool runs'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Artifacts */}
              {artifacts.length > 0 && (
                <section className="p-4 space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">
                    <FileText className="h-3.5 w-3.5" />
                    Artifacts ({artifacts.length})
                  </h3>
                  {artifacts.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => router.push(`/artifacts/${art.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/artifacts/${art.id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{art.name}</span>
                          <span className="badge badge-neutral text-[10px]">{art.mime_type}</span>
                        </div>
                        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                          {art.chat_name} • {relativeTime(art.created_at)}
                        </p>
                        {art.message_id && art.chat_id && (
                          <p className="text-[10px] text-cyan-300 mt-0.5">
                            Context message available
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {art.chat_id && art.message_id && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-cyan-300/30 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-900/20"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/c/${art.chat_id}?m=${encodeURIComponent(String(art.message_id || ''))}`);
                            }}
                          >
                            Context
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                        {art.chat_id && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/c/${art.chat_id}`);
                            }}
                          >
                            Chat
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/artifacts/${art.id}`);
                          }}
                        >
                          Artifact
                          <File className="h-3 w-3" />
                        </button>
                        <ArrowRight className="h-4 w-4 text-[var(--fg-muted)]" />
                      </div>
                    </div>
                  ))}
                  {page?.artifacts?.has_more && (
                    <div className="pt-1">
                      <button
                        type="button"
                        className="btn btn-secondary w-full disabled:opacity-60"
                        disabled={isFetching}
                        onClick={() => loadMore('artifacts')}
                      >
                        {isFetching ? 'Loading…' : 'Load more artifacts'}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
