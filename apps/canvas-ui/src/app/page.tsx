'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useInfiniteChats, useCreateChat, useRenameChat, useDeleteChat } from '@/lib/hooks';
import type { ChatSummary } from '@/lib/api';
import { PageSpinner } from '@/components/Spinner';
import { MessageSquare, Users, Hash, Lock, Plus, Pencil, Trash2, Trophy, ShieldCheck, Workflow } from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { extractApiErrorMessage } from '@/lib/error';
import {
  RELEASE_NARRATIVE_COPY,
  RELEASE_NARRATIVE_LABELS,
} from '@sven/shared/community/release-narrative';

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  dm: Lock,
  group: Users,
  hq: Hash,
};

type CapabilityProof = {
  status: 'pass' | 'fail' | 'unknown';
  summary: {
    total_rows: number;
    proven_pass_rows: number;
    coverage_percent: number;
    partial_rows: number;
    unproven_rows: number;
  };
};

export default function ChatsPage() {
  const {
    data: chats,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteChats();
  const createChat = useCreateChat();
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const router = useRouter();
  const chatRows = chats?.pages.flatMap((page) => page.rows) ?? [];
  const [renameTarget, setRenameTarget] = useState<ChatSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatSummary | null>(null);
  const [capabilityProof, setCapabilityProof] = useState<CapabilityProof | null>(null);

  useEffect(() => {
    if (!renameTarget) return;
    setRenameValue(renameTarget.name);
  }, [renameTarget]);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/capability-proof', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setCapabilityProof((json?.data || null) as CapabilityProof | null);
      })
      .catch(() => {
        if (!active) return;
        setCapabilityProof(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateChat() {
    try {
      const res = await createChat.mutateAsync({});
      const chatId = String(res.data?.id ?? '');
      if (chatId) {
        toast.success('Chat created');
        router.push(`/c/${chatId}`);
      } else {
        toast.error('Chat creation failed');
      }
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Chat creation failed'));
    }
  }

  async function submitRenameChat() {
    if (!renameTarget) return;
    const nextName = renameValue.trim();
    if (!nextName || nextName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      await renameChat.mutateAsync({ chatId: renameTarget.id, name: nextName });
      toast.success('Chat renamed');
      setRenameTarget(null);
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Rename failed'));
    }
  }

  async function submitDeleteChat() {
    if (!deleteTarget) return;
    try {
      await deleteChat.mutateAsync({ chatId: deleteTarget.id });
      toast.success('Chat removed');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Delete failed'));
    }
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="px-6 py-5">
          <div className="premium-panel-strong flex items-center justify-between px-5 py-4">
            <div>
              <span className="premium-kicker">Canvas Hub</span>
              <h1 className="premium-heading text-2xl font-bold tracking-tight">Sven Conversations</h1>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">Private, real-time, account-scoped AI collaboration.</p>
            </div>
            <div className="flex items-center gap-2">
              {capabilityProof?.summary?.total_rows ? (
                <span className="badge badge-info inline-flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  {capabilityProof.summary.proven_pass_rows}/{capabilityProof.summary.total_rows} proven
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => router.push('/community')}
                className="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {RELEASE_NARRATIVE_LABELS.communityOperations}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateChat()}
                disabled={createChat.isPending}
                className="btn btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </button>
              <span className="badge badge-info">{chatRows.length} loaded chats</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="premium-panel px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg)]">
                <Workflow className="h-3.5 w-3.5 text-cyan-300" />
                Runtime
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{RELEASE_NARRATIVE_COPY.runtimeCardDescription}</p>
            </div>
            <div className="premium-panel px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg)]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Trust
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{RELEASE_NARRATIVE_COPY.trustCardDescription}</p>
            </div>
            <div className="premium-panel px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fg)]">
                <Trophy className="h-3.5 w-3.5 text-violet-300" />
                {RELEASE_NARRATIVE_LABELS.capabilityProof}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                {capabilityProof?.summary?.total_rows
                  ? `${capabilityProof.summary.coverage_percent}% coverage with ${capabilityProof.summary.partial_rows + capabilityProof.summary.unproven_rows} open gaps.`
                  : RELEASE_NARRATIVE_COPY.capabilityCardFallback}
              </p>
            </div>
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <PageSpinner />
          ) : chatRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--fg-muted)]">
              <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">No chats yet</p>
              <button
                type="button"
                onClick={() => void handleCreateChat()}
                disabled={createChat.isPending}
                className="btn btn-primary mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                Start first chat
              </button>
            </div>
          ) : (
            <ul className="space-y-2 px-4 pb-4">
              {chatRows.map((chat) => {
                const Icon = TYPE_ICONS[chat.type] || MessageSquare;
                return (
                  <li key={chat.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/c/${chat.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/c/${chat.id}`);
                        }
                      }}
                      className="premium-panel-strong flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:border-cyan-300/70 hover:bg-white/80 dark:hover:bg-slate-900/70"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
                        <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{chat.name}</span>
                          <span className="badge badge-neutral text-[10px]">{chat.type}</span>
                        </div>
                        <div className="text-xs text-[var(--fg-muted)] mt-0.5">
                          {chat.message_count} messages
                          {chat.last_message_at && (
                            <span className="ml-2">• last {relativeTime(chat.last_message_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-2 flex items-center gap-1">
                        <button
                          type="button"
                          title="Rename"
                          className="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenameTarget(chat);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-100/70 dark:text-rose-400 dark:hover:bg-rose-900/40"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget(chat);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {hasNextPage && (
                <li className="pt-2">
                  <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="btn btn-secondary w-full disabled:opacity-60"
                  >
                    {isFetchingNextPage ? 'Loading more...' : 'Load more'}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="premium-panel-strong w-full max-w-md px-5 py-4">
            <h2 className="text-base font-semibold">Rename chat</h2>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Update the conversation title.
            </p>
            <input
              autoFocus
              className="input mt-3 w-full"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setRenameTarget(null);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitRenameChat();
                }
              }}
              placeholder="Chat title"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitRenameChat()}
                disabled={renameChat.isPending}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="premium-panel-strong w-full max-w-md px-5 py-4">
            <h2 className="text-base font-semibold text-rose-400">Delete chat</h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              Delete <span className="font-medium text-[var(--fg)]">{deleteTarget.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn border border-rose-400/30 bg-rose-600/85 text-white hover:bg-rose-600 disabled:opacity-60"
                onClick={() => void submitDeleteChat()}
                disabled={deleteChat.isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
