'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useApprovals, useChats, useVoteApproval } from '@/lib/hooks';
import type { ApprovalRecord, ApprovalsQuery, ChatSummary } from '@/lib/api';
import { api } from '@/lib/api';
import { PageSpinner } from '@/components/Spinner';
import {
  Shield, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  AlertTriangle, ExternalLink, Copy, Search, CheckSquare, Download,
} from 'lucide-react';
import { cn, relativeTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { extractApiErrorMessage } from '@/lib/error';

type Tab = 'pending' | 'history';
const APPROVALS_PAGE_LIMIT = 30;
type BulkVoteStatus = 'pending' | 'success' | 'error';

function mergeById(previous: ApprovalRecord[], incoming: ApprovalRecord[]): ApprovalRecord[] {
  const merged: ApprovalRecord[] = [];
  const seen = new Set<string>();
  for (const row of [...previous, ...incoming]) {
    const id = String(row?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
  }
  return merged;
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [chatIdFilter, setChatIdFilter] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [pendingOffset, setPendingOffset] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [pendingRows, setPendingRows] = useState<ApprovalRecord[]>([]);
  const [historyRows, setHistoryRows] = useState<ApprovalRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [votingId, setVotingId] = useState<string | null>(null);
  const [bulkDecision, setBulkDecision] = useState<'approve' | 'deny' | null>(null);
  const [bulkStatusById, setBulkStatusById] = useState<Record<string, BulkVoteStatus>>({});
  const [historyExportFormat, setHistoryExportFormat] = useState<'json' | 'csv' | null>(null);
  const chatsQuery = useChats();
  const chats = chatsQuery.data || [];

  const commonFilters: Pick<ApprovalsQuery, 'query' | 'requester' | 'limit' | 'chat_id'> = {
    query: query.trim() || undefined,
    chat_id: chatIdFilter || undefined,
    requester: mineOnly ? 'me' : 'all',
    limit: APPROVALS_PAGE_LIMIT,
  };

  const pendingQuery = useApprovals({
    ...commonFilters,
    status: 'pending',
    offset: pendingOffset,
  });
  const historyQuery = useApprovals({
    ...commonFilters,
    status: 'history',
    offset: historyOffset,
  });
  const voteMutation = useVoteApproval();

  useEffect(() => {
    setPendingOffset(0);
    setHistoryOffset(0);
    setPendingRows([]);
    setHistoryRows([]);
    setSelectedIds(new Set());
    setBulkStatusById({});
  }, [query, mineOnly, chatIdFilter]);

  useEffect(() => {
    if (tab !== 'pending') {
      setSelectedIds(new Set());
      setBulkStatusById({});
    }
  }, [tab]);

  useEffect(() => {
    const incoming = pendingQuery.data?.rows || [];
    if (!incoming.length && pendingOffset > 0) return;
    setPendingRows((prev) => mergeById(pendingOffset === 0 ? [] : prev, incoming));
  }, [pendingQuery.data, pendingOffset]);

  useEffect(() => {
    const incoming = historyQuery.data?.rows || [];
    if (!incoming.length && historyOffset > 0) return;
    setHistoryRows((prev) => mergeById(historyOffset === 0 ? [] : prev, incoming));
  }, [historyQuery.data, historyOffset]);

  useEffect(() => {
    const validIds = new Set(pendingRows.map((row) => row.id));
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [pendingRows]);

  async function handleVote(id: string, decision: 'approve' | 'deny') {
    setVotingId(id);
    try {
      await voteMutation.mutateAsync({ id, decision });
      toast.success(`Approval ${decision}d`);
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Vote failed'));
    } finally {
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setVotingId((prev) => (prev === id ? null : prev));
    }
  }

  const handleBulkVote = useCallback(async (decision: 'approve' | 'deny') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDecision(decision);
    setBulkStatusById(Object.fromEntries(ids.map((id) => [id, 'pending'])) as Record<string, BulkVoteStatus>);
    let successCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        await voteMutation.mutateAsync({ id, decision });
        setBulkStatusById((prev) => ({ ...prev, [id]: 'success' }));
        successCount += 1;
      } catch {
        setBulkStatusById((prev) => ({ ...prev, [id]: 'error' }));
        failCount += 1;
      }
    }
    if (successCount > 0 && failCount === 0) {
      toast.success(`${decision === 'approve' ? 'Approved' : 'Denied'} ${successCount} approval${successCount !== 1 ? 's' : ''}`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`${successCount} succeeded, ${failCount} failed`);
    } else {
      toast.error('Bulk vote failed');
    }
    setSelectedIds(new Set());
    setBulkDecision(null);
  }, [selectedIds, voteMutation]);

  const exportHistory = useCallback(async (format: 'json' | 'csv') => {
    if (historyExportFormat) return;
    setHistoryExportFormat(format);
    try {
      const file = await api.approvals.export({
        status: 'history',
        query: query.trim() || undefined,
        chat_id: chatIdFilter || undefined,
        requester: mineOnly ? 'me' : undefined,
        format,
        max_rows: 10000,
      });
      const fallbackName = format === 'csv'
        ? 'approvals-history-export.csv'
        : 'approvals-history-export.json';
      const filename = file.filename || fallbackName;
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`History ${format.toUpperCase()} export downloaded`);
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error, `History ${format.toUpperCase()} export failed`));
    } finally {
      setHistoryExportFormat(null);
    }
  }, [query, mineOnly, chatIdFilter, historyExportFormat]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(pendingRows.map((row) => row.id)));
  }, [pendingRows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  function loadMore() {
    const nextOffset = tab === 'pending'
      ? pendingQuery.data?.page?.next_offset
      : historyQuery.data?.page?.next_offset;
    if (typeof nextOffset !== 'number') return;
    if (tab === 'pending') setPendingOffset(nextOffset);
    else setHistoryOffset(nextOffset);
  }

  const activeQuery = tab === 'pending' ? pendingQuery : historyQuery;
  const items = tab === 'pending' ? pendingRows : historyRows;
  const isLoading = activeQuery.isLoading && items.length === 0;
  const canLoadMore = Boolean(activeQuery.data?.page?.has_more);
  const selectedCount = selectedIds.size;
  const isBulkBusy = bulkDecision != null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (tab !== 'pending') return;
      if (isEditableTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      const hasMod = event.ctrlKey || event.metaKey;

      if (hasMod && event.shiftKey && key === 'a') {
        if (selectedCount === 0 || isBulkBusy) return;
        event.preventDefault();
        void handleBulkVote('approve');
        return;
      }
      if (hasMod && event.shiftKey && key === 'd') {
        if (selectedCount === 0 || isBulkBusy) return;
        event.preventDefault();
        void handleBulkVote('deny');
        return;
      }
      if (hasMod && key === 'a') {
        event.preventDefault();
        selectAllVisible();
        return;
      }
      if (key === 'escape' && selectedCount > 0) {
        event.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab, selectedCount, isBulkBusy, handleBulkVote, selectAllVisible, clearSelection]);

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4 space-y-3">
          <h1 className="text-xl font-bold">Approvals</h1>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Search tool, scope, or details…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)] bg-transparent"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                />
                Mine only
              </label>
              <select
                className="input h-9 min-w-[220px] py-1 text-xs"
                value={chatIdFilter}
                onChange={(e) => setChatIdFilter(e.target.value)}
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
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTab('pending')}
              className={cn(
                'btn btn-sm',
                tab === 'pending' ? 'btn-primary' : 'btn-secondary',
              )}
            >
              Pending
              {pendingRows.length > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                  {pendingRows.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('history')}
              className={cn(
                'btn btn-sm',
                tab === 'history' ? 'btn-primary' : 'btn-secondary',
              )}
            >
              History
            </button>
          </div>
          {tab === 'history' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={historyExportFormat !== null}
                onClick={() => void exportHistory('json')}
              >
                <Download className="h-3.5 w-3.5" />
                {historyExportFormat === 'json' ? 'Exporting JSON…' : 'Export JSON'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={historyExportFormat !== null}
                onClick={() => void exportHistory('csv')}
              >
                <Download className="h-3.5 w-3.5" />
                {historyExportFormat === 'csv' ? 'Exporting CSV…' : 'Export CSV'}
              </button>
            </div>
          )}
          {tab === 'pending' && pendingRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={selectAllVisible}
                disabled={isBulkBusy}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select all visible
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={clearSelection}
                disabled={selectedCount === 0 || isBulkBusy}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-sm border border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                disabled={selectedCount === 0 || isBulkBusy}
                onClick={() => void handleBulkVote('approve')}
              >
                {isBulkBusy && bulkDecision === 'approve' ? 'Approving…' : `Approve selected (${selectedCount})`}
              </button>
              <button
                type="button"
                className="btn btn-sm border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                disabled={selectedCount === 0 || isBulkBusy}
                onClick={() => void handleBulkVote('deny')}
              >
                {isBulkBusy && bulkDecision === 'deny' ? 'Denying…' : `Deny selected (${selectedCount})`}
              </button>
              <span className="text-[10px] text-[var(--fg-muted)]">
                Shortcuts: Ctrl/Cmd+A select, Esc clear, Ctrl/Cmd+Shift+A approve, Ctrl/Cmd+Shift+D deny
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <PageSpinner />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--fg-muted)]">
              <Shield className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">
                {tab === 'pending'
                  ? 'No pending approvals'
                  : 'No approval history'}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {items.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  onVote={tab === 'pending' ? handleVote : undefined}
                  votingId={votingId}
                  selectable={tab === 'pending'}
                  selected={selectedIds.has(approval.id)}
                  onToggleSelect={toggleSelected}
                  bulkBusy={isBulkBusy}
                  bulkStatus={bulkStatusById[approval.id]}
                />
              ))}
              {canLoadMore && (
                <div className="pt-2">
                  <button
                    type="button"
                    className="btn btn-secondary w-full disabled:opacity-60"
                    disabled={activeQuery.isFetching}
                    onClick={loadMore}
                  >
                    {activeQuery.isFetching ? 'Loading…' : `Load more ${tab}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ── Approval Card ──

function ApprovalCard({
  approval,
  onVote,
  votingId,
  selectable,
  selected,
  onToggleSelect,
  bulkBusy,
  bulkStatus,
}: {
  approval: ApprovalRecord;
  onVote?: (id: string, decision: 'approve' | 'deny') => void;
  votingId?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  bulkBusy?: boolean;
  bulkStatus?: BulkVoteStatus;
}) {
  const [expanded, setExpanded] = useState(false);
  const isVoting = votingId === approval.id;

  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string }> = {
    pending: { icon: Clock, color: 'text-amber-600' },
    approved: { icon: CheckCircle2, color: 'text-green-600' },
    denied: { icon: XCircle, color: 'text-red-600' },
    expired: { icon: AlertTriangle, color: 'text-slate-400' },
  };

  const config = statusConfig[approval.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const details = asRecord(approval.details);
  const hasDetails = Boolean(details && Object.keys(details).length > 0);
  const detailRunId = extractStringField(details, ['tool_run_id', 'run_id']);
  const detailMessageId = extractStringField(details, ['message_id', 'context_message_id']);
  const diffText = extractStringField(details, ['diff']);
  const haAction = asRecord(details?.['ha_action']);
  const calendarChange = details?.['calendar_change'];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start gap-3">
        {selectable && onToggleSelect && (
          <label className="mt-0.5 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] bg-transparent"
              checked={Boolean(selected)}
              onChange={() => onToggleSelect(approval.id)}
              aria-label={`Select approval ${approval.id}`}
            />
          </label>
        )}
        <StatusIcon className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{approval.tool_name}</span>
            <span className="badge badge-info text-[10px]">{approval.scope}</span>
            <span className={cn('badge text-[10px]', {
              'badge-warning': approval.status === 'pending',
              'badge-success': approval.status === 'approved',
              'badge-danger': approval.status === 'denied',
              'badge-neutral': approval.status === 'expired',
            })}>
              {approval.status}
            </span>
            {bulkStatus && (
              <span className={cn('badge text-[10px]', {
                'badge-warning': bulkStatus === 'pending',
                'badge-success': bulkStatus === 'success',
                'badge-danger': bulkStatus === 'error',
              })}>
                bulk {bulkStatus}
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--fg-muted)] mt-1">
            Quorum: {approval.votes_approve}/{approval.quorum_required}
            <span className="mx-1">•</span>
            {relativeTime(approval.created_at)}
            {approval.expires_at && (
              <>
                <span className="mx-1">•</span>
                Expires {formatDate(approval.expires_at)}
              </>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-[var(--fg-muted)] font-mono truncate max-w-[280px]">
              {approval.id}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(String(approval.id || ''));
                  toast.success('Approval ID copied');
                } catch {
                  toast.error('Copy failed');
                }
              }}
            >
              <Copy className="h-3 w-3" />
              ID
            </button>
          </div>
          {approval.chat_id && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Link
                href={`/c/${approval.chat_id}`}
                className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline"
              >
                Open related chat
                <ExternalLink className="h-3 w-3" />
              </Link>
              {detailMessageId && (
                <Link
                  href={`/c/${approval.chat_id}?m=${encodeURIComponent(detailMessageId)}`}
                  className="inline-flex items-center gap-1 rounded border border-cyan-300/30 px-2 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-900/20"
                >
                  Context
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {detailRunId && (
                <Link
                  href={`/runs/${detailRunId}`}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Run
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Vote buttons */}
        {onVote && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onVote(approval.id, 'approve')}
              disabled={Boolean(votingId) || Boolean(bulkBusy)}
              className="btn btn-sm border border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isVoting ? 'Voting...' : 'Approve'}
            </button>
            <button
              onClick={() => onVote(approval.id, 'deny')}
              disabled={Boolean(votingId) || Boolean(bulkBusy)}
              className="btn btn-sm border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              <XCircle className="h-3.5 w-3.5" />
              Deny
            </button>
          </div>
        )}
      </div>

      {/* Expandable details / diff preview */}
      {hasDetails && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
                  toast.success('Approval details copied');
                } catch {
                  toast.error('Copy failed');
                }
              }}
            >
              <Copy className="h-3 w-3" />
              Copy JSON
            </button>
          </div>

          {expanded && (
            <div className="mt-2 space-y-2">
              {/* Diff preview for git/calendar/files */}
              {diffText && (
                <div className="rounded-lg overflow-hidden border border-[var(--border)]">
                  <div className="bg-slate-800 px-3 py-1.5 text-xs text-slate-400">Diff Preview</div>
                  <div className="max-h-64 overflow-auto bg-slate-900 p-3 text-xs font-mono">
                    {renderDiffLines(diffText).map((line, index) => (
                      <div key={`${index}-${line}`} className={cn('whitespace-pre', diffLineClass(line))}>
                        {line || ' '}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[var(--border)] bg-slate-900 px-3 py-1.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(diffText);
                          toast.success('Diff copied');
                        } catch {
                          toast.error('Copy failed');
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy diff
                    </button>
                  </div>
                </div>
              )}

              {/* HA action preview */}
              {haAction ? (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Home Assistant Action
                  </p>
                  <p className="text-sm mt-1">
                    {String(haAction.domain || 'unknown')}.{String(haAction.service || 'unknown')}
                  </p>
                  {Boolean(haAction?.entity_id) && (
                    <p className="text-xs text-[var(--fg-muted)] mt-1">
                      Entity: {String(haAction.entity_id)}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Calendar change preview */}
              {Boolean(calendarChange) && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                    Calendar Change
                  </p>
                  <pre className="text-xs mt-1 overflow-x-auto font-mono">
                    {JSON.stringify(calendarChange, null, 2)}
                  </pre>
                </div>
              )}

              {/* Generic details fallback */}
              {!diffText && !haAction && !calendarChange && (
                <pre className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs overflow-x-auto font-mono">
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderDiffLines(diff: string): string[] {
  const lines = String(diff || '').split(/\r?\n/);
  const maxLines = 900;
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines), `... (${lines.length - maxLines} lines truncated)`];
}

function diffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
    return 'text-cyan-300';
  }
  if (line.startsWith('+')) {
    return 'text-emerald-300';
  }
  if (line.startsWith('-')) {
    return 'text-rose-300';
  }
  return 'text-slate-300';
}

function extractStringField(input: unknown, keys: string[]): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}
