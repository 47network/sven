'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { KatexText } from '@/components/KatexText';
import { api } from '@/lib/api';
import {
  useAgentState,
  useCancelQueuedMessage,
  useChat,
  useChatMessages,
  useDebugContext,
  usePauseAgent,
  useResumeAgent,
  useNudgeAgent,
  useSendChatMessage,
} from '@/lib/hooks';
import { Bug, ClipboardCopy, MessageSquare, Pause, Play, RefreshCcw, RotateCw, Send, X } from 'lucide-react';
import { toast } from 'sonner';

type ActionButtonSpec = {
  id: string;
  label: string;
  action: string;
  url?: string;
  command?: string;
  text?: string;
  approvalId?: string;
  payload?: Record<string, unknown>;
  style?: string;
};

function normalizeAction(raw?: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'deny' || value === 'reject') return 'reject';
  if (value === 'approve') return 'approve';
  if (value === 'open_link' || value === 'open' || value === 'link') return 'open_link';
  if (value === 'run_command' || value === 'command') return 'run_command';
  if (value === 'quick_reply' || value === 'reply') return 'reply';
  if (value === 'dismiss' || value === 'close') return 'dismiss';
  return value || 'action';
}

function extractActionButtons(blocks: unknown[]): ActionButtonSpec[] {
  const buttons: ActionButtonSpec[] = [];
  const pushButton = (btn: unknown, index: number) => {
    const typedBtn = (btn && typeof btn === 'object') ? (btn as Record<string, unknown>) : {};
    const label = String(typedBtn.label || typedBtn.title || typedBtn.text || typedBtn.id || '').trim();
    if (!label) return;
    const action = normalizeAction(String(typedBtn.action || typedBtn.type || typedBtn.id || ''));
    const approvalId = typedBtn.approval_id || (
      (action === 'approve' || action === 'reject') ? typedBtn.value : undefined
    );
    const text = typedBtn.text || (action === 'reply' ? typedBtn.value : undefined);
    const command = typedBtn.command || (action === 'run_command' ? typedBtn.value : undefined);
    buttons.push({
      id: String(typedBtn.id || `${label}-${index}`),
      label,
      action,
      url: typeof typedBtn.url === 'string' ? typedBtn.url : undefined,
      command: typeof command === 'string' ? command : undefined,
      text: typeof text === 'string' ? text : undefined,
      approvalId: typeof approvalId === 'string' ? approvalId : undefined,
      payload: (typedBtn.payload && typeof typedBtn.payload === 'object')
        ? (typedBtn.payload as Record<string, unknown>)
        : undefined,
      style: typeof typedBtn.style === 'string' ? typedBtn.style : undefined,
    });
  };

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const typed = block as { type?: string; content?: Record<string, unknown>; buttons?: unknown[] };
    if (typed.type === 'actions') {
      const list = Array.isArray(typed.buttons)
        ? typed.buttons
        : (Array.isArray(typed.content?.buttons) ? typed.content.buttons : []);
      list.forEach((btn, index) => pushButton(btn, index));
    }
    if (typed.type === 'tool_card') {
      const content = typed.content || {};
      if (content?.status === 'pending_approval' && content?.approval_id) {
        const approvalId = String(content.approval_id);
        buttons.push({
          id: `approve-${approvalId}`,
          label: 'Approve',
          action: 'approve',
          approvalId,
        });
        buttons.push({
          id: `reject-${approvalId}`,
          label: 'Reject',
          action: 'reject',
          approvalId,
        });
      }
    }
  }

  return buttons;
}

function inferEditorActionButton(messageId: string, text: string | null | undefined): ActionButtonSpec[] {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const match =
    raw.match(/open\s+file\s+`([^`]+)`\s+in\s+editor/i) ||
    raw.match(/open\s+file\s+([^\n]+?)\s+in\s+editor/i);
  if (!match) return [];

  const pathValue = String(match[1] || '').trim().replace(/[.,;:!?]+$/, '');
  if (!pathValue) return [];

  return [
    {
      id: `open-editor-${messageId}`,
      label: 'Open in Editor',
      action: 'open_link',
      url: `/editor?path=${encodeURIComponent(pathValue)}`,
      payload: { path: pathValue },
      style: 'primary',
    },
  ];
}

export default function AdminChatDetailPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params?.chatId ?? '';
  const { data: chat, isLoading: chatLoading } = useChat(chatId);
  const { data: messagesData, isLoading: messagesLoading } = useChatMessages(chatId);
  const sendMutation = useSendChatMessage(chatId);
  const cancelQueued = useCancelQueuedMessage(chatId);
  const agentState = useAgentState(chatId);
  const pauseAgent = usePauseAgent(chatId);
  const resumeAgent = useResumeAgent(chatId);
  const nudgeAgent = useNudgeAgent(chatId);
  const [input, setInput] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [debugTab, setDebugTab] = useState<'system' | 'memories' | 'rag' | 'conversation' | 'tools'>('system');
  const [copied, setCopied] = useState(false);
  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [confirmActions, setConfirmActions] = useState<Set<string>>(new Set());
  const [nowTick, setNowTick] = useState(() => Date.now());
  const debugQuery = useDebugContext(chatId, showDebug);
  const debug = debugQuery.data?.data;
  const isAgentPaused = Boolean(agentState.data?.paused);
  const processing = Boolean(agentState.data?.processing);
  const lastUserAt = agentState.data?.last_user_message_at ? new Date(agentState.data.last_user_message_at).getTime() : 0;
  const lastAssistantAt = agentState.data?.last_assistant_message_at ? new Date(agentState.data.last_assistant_message_at).getTime() : 0;
  const isAgentStuck = !isAgentPaused
    && processing
    && lastUserAt > 0
    && lastUserAt > lastAssistantAt
    && (nowTick - lastUserAt) > 30_000;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function toggleAgentPause() {
    try {
      if (isAgentPaused) {
        await resumeAgent.mutateAsync();
      } else {
        await pauseAgent.mutateAsync();
      }
    } catch {
      toast.error('Failed to update agent state');
    }
  }

  async function handleNudge() {
    try {
      await nudgeAgent.mutateAsync();
      toast.success('Nudge sent. Retrying last user message.');
    } catch {
      toast.error('Failed to nudge agent');
    }
  }

  async function handleAction(messageId: string, action: ActionButtonSpec) {
    const key = `${messageId}:${action.id}`;
    if (clickedActions.has(key)) return;
    const requiresConfirm =
      action.action === 'approve' ||
      action.action === 'reject' ||
      action.action === 'run_command';
    if (requiresConfirm && !confirmActions.has(key)) {
      setConfirmActions((prev) => new Set(prev).add(key));
      window.setTimeout(() => {
        setConfirmActions((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 4000);
      toast.info('Press again to confirm action');
      return;
    }
    setClickedActions((prev) => new Set(prev).add(key));
    setConfirmActions((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    try {
      if (action.action === 'open_link' && action.url) {
        window.open(action.url, '_blank', 'noopener,noreferrer');
      } else if ((action.action === 'approve' || action.action === 'reject') && action.approvalId) {
        await api.approvals.voteUser(action.approvalId, action.action === 'approve' ? 'approve' : 'deny');
      } else if (action.action === 'run_command' && action.command) {
        await sendMutation.mutateAsync(action.command);
      } else if (action.action === 'reply' && action.text) {
        await sendMutation.mutateAsync(action.text);
      }

      await api.chats.interact(chatId, 'action', {
        message_id: messageId,
        action: action.action,
        button: action,
      });
    } catch {
      toast.error('Action failed');
    }
  }

  const messages = useMemo(() => {
    const rows = messagesData?.rows ?? [];
    return rows.slice().sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ta - tb;
    });
  }, [messagesData?.rows]);

  const queuedCount = useMemo(
    () => messages.filter((m) => m.status === 'queued').length,
    [messages],
  );

  if (!chatId) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Chat not found"
        description="This route did not resolve a chat id."
      />
    );
  }

  if (chatLoading || messagesLoading) return <PageSpinner />;

  const tokenSections = [
    { key: 'system', label: 'System Prompt', tokens: Number(debug?.system_prompt?.tokens || 0), color: 'bg-cyan-500' },
    { key: 'memories', label: 'Memories', tokens: Number(debug?.memories?.tokens || 0), color: 'bg-emerald-500' },
    { key: 'rag', label: 'RAG Results', tokens: Number(debug?.rag_results?.tokens || 0), color: 'bg-indigo-500' },
    { key: 'conversation', label: 'Conversation', tokens: Number(debug?.conversation?.tokens || 0), color: 'bg-amber-500' },
    { key: 'tools', label: 'Tools', tokens: Number(debug?.tools?.tokens || 0), color: 'bg-rose-500' },
  ];
  const totalTokens = Number(debug?.totals?.tokens || tokenSections.reduce((sum, s) => sum + s.tokens, 0));
  const contextWindow = Number(debug?.totals?.context_window || 0);
  const truncated = Boolean(debug?.conversation?.truncated);

  const fullContext = useMemo(() => {
    if (!debug) return '';
    const lines: string[] = [];
    lines.push('## System Prompt');
    lines.push(String(debug.system_prompt?.text || ''));
    lines.push('');
    lines.push('## Identity Docs');
    const docs = debug.identity_docs?.rows ?? [];
    if (docs.length === 0) {
      lines.push('(none)');
    } else {
      for (const doc of docs) {
        lines.push(`- ${doc.scope || 'unknown'} (${doc.updated_at || 'unknown'})`);
        lines.push(String(doc.content || ''));
        lines.push('');
      }
    }
    lines.push('## Memories');
    const mems = debug.memories?.rows ?? [];
    if (mems.length === 0) {
      lines.push('(none)');
    } else {
      for (const mem of mems) {
        lines.push(`- ${mem.key}: ${mem.value}`);
      }
    }
    lines.push('');
    lines.push('## RAG Results');
    const rag = debug.rag_results?.rows ?? [];
    if (rag.length === 0) {
      lines.push(debug.rag_results?.note || '(none)');
    } else {
      for (const r of rag) {
        lines.push(`- ${r.source || 'rag'} (${r.score ?? 'n/a'})`);
        lines.push(String(r.text || r.content || ''));
      }
    }
    lines.push('');
    lines.push('## Conversation');
    const convo = debug.conversation?.messages ?? [];
    if (convo.length === 0) {
      lines.push('(none)');
    } else {
      for (const m of convo) {
        const role = m.role || 'unknown';
        const text = m.text || (m.blocks ? JSON.stringify(m.blocks) : '');
        lines.push(`- ${role}: ${text}`);
      }
    }
    lines.push('');
    lines.push('## Tools');
    const tools = debug.tools?.first_party ?? [];
    const mcp = debug.tools?.mcp ?? [];
    if (tools.length === 0 && mcp.length === 0) {
      lines.push('(none)');
    } else {
      for (const t of tools) {
        lines.push(`- ${t.name}: ${t.description || ''}`);
      }
      for (const t of mcp) {
        lines.push(`- ${t.qualified_name || t.tool_name}: ${t.description || ''}`);
      }
    }
    return lines.join('\n');
  }, [debug]);

  return (
    <>
      <PageHeader title={chat?.name || 'Chat'} description="Admin chat detail and queue visibility">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`btn inline-flex items-center gap-1 ${isAgentPaused ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => void toggleAgentPause()}
            disabled={pauseAgent.isPending || resumeAgent.isPending}
          >
            {isAgentPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isAgentPaused ? 'Resume Agent' : 'Pause Agent'}
          </button>
          {isAgentStuck && (
            <button
              type="button"
              className="btn btn-warning inline-flex items-center gap-1"
              onClick={() => void handleNudge()}
              disabled={nudgeAgent.isPending}
            >
              <RotateCw className="h-4 w-4" />
              Nudge Agent
            </button>
          )}
          <button
            type="button"
            className={`btn ${showDebug ? 'btn-primary' : 'btn-secondary'} inline-flex items-center gap-1`}
            onClick={() => setShowDebug((prev) => !prev)}
          >
            <Bug className="h-4 w-4" />
            {showDebug ? 'Hide Debug' : 'Debug Context'}
          </button>
          <Link href={`/trace-view?chatId=${encodeURIComponent(chatId)}`} className="btn btn-secondary">
            Trace View
          </Link>
          <Link href="/chats" className="btn btn-secondary">Back to chats</Link>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="badge badge-neutral">{chat?.id || chatId}</span>
        <span className="badge badge-info">{chat?.type || 'chat'}</span>
        {isAgentPaused && (
          <span className="badge badge-warning">Agent paused</span>
        )}
        {isAgentStuck && (
          <span className="badge badge-warning">Agent stuck &gt;30s</span>
        )}
        {queuedCount > 0 && (
          <span className="badge badge-warning">{queuedCount} queued</span>
        )}
      </div>

      {messages.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No messages yet" description="Send a message to start this thread." />
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isQueued = msg.status === 'queued';
            const isAssistant = msg.role === 'assistant';
            const actionButtons = isAssistant
              ? [
                ...(Array.isArray(msg.blocks) ? extractActionButtons(msg.blocks) : []),
                ...inferEditorActionButton(String(msg.id), msg.text),
              ]
              : [];
            return (
              <div
                key={msg.id}
                className={`rounded-lg border px-4 py-3 text-sm ${isQueued ? 'bg-amber-50/40' : 'bg-white/50 dark:bg-slate-900/50'}`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="badge badge-neutral">{isAssistant ? 'assistant' : msg.role}</span>
                  {isQueued && (
                    <span className="badge badge-warning">
                      queued{typeof msg.queue_position === 'number' ? ` · #${msg.queue_position}` : ''}
                    </span>
                  )}
                  <span>{new Date(msg.created_at || Date.now()).toLocaleString()}</span>
                  {isQueued && (
                    <button
                      type="button"
                      className="ml-auto inline-flex items-center gap-1 text-amber-700 hover:text-amber-800"
                      onClick={() => cancelQueued.mutate(String(msg.queue_id || msg.id))}
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                  )}
                </div>
                <div className={`mt-2 ${isQueued ? 'opacity-70' : ''}`}>
                  <KatexText text={String(msg.text || '')} />
                </div>
                {actionButtons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {actionButtons.map((button) => {
                      const key = `${msg.id}:${button.id}`;
                      const disabled = clickedActions.has(key);
                      const confirmPending = confirmActions.has(key);
                      const isApprove = button.action === 'approve';
                      const isReject = button.action === 'reject';
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            isApprove
                              ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : isReject
                                ? 'border-rose-300/60 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                          } ${disabled ? 'opacity-60' : ''}`}
                          disabled={disabled}
                          onClick={() => void handleAction(String(msg.id), button)}
                        >
                          {confirmPending ? `Confirm ${button.label}` : button.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDebug && (
        <div className="card mt-6 space-y-4" data-testid="context-debug-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Context Debug Panel</h3>
              <p className="text-xs text-slate-500">
                Total tokens: <span className="font-medium text-slate-900 dark:text-slate-100">{totalTokens}</span>
                {contextWindow > 0 && (
                  <> / {contextWindow} window</>
                )}
                {debug?.totals?.exceeded && (
                  <span className="ml-2 badge badge-danger">exceeded</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary inline-flex items-center gap-1"
                onClick={() => debugQuery.refetch()}
                disabled={debugQuery.isFetching}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-secondary inline-flex items-center gap-1"
                onClick={async () => {
                  if (!fullContext) return;
                  try {
                    await navigator.clipboard.writeText(fullContext);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <ClipboardCopy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy Context'}
              </button>
            </div>
          </div>

          {debugQuery.isFetching && (
            <div className="text-xs text-slate-500">Loading context...</div>
          )}
          {debugQuery.isError && (
            <div className="text-xs text-rose-500">Failed to load debug context.</div>
          )}

          <div className="space-y-2">
            {tokenSections.map((section) => {
              const pct = totalTokens > 0 ? Math.max(2, Math.round((section.tokens / totalTokens) * 100)) : 0;
              return (
                <div key={section.key}>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{section.label}</span>
                    <span>{section.tokens}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-2 rounded-full ${section.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { key: 'system', label: `System (${Number(debug?.system_prompt?.tokens || 0)})` },
              { key: 'memories', label: `Memories (${Number(debug?.memories?.tokens || 0)})` },
              { key: 'rag', label: `RAG (${Number(debug?.rag_results?.tokens || 0)})` },
              { key: 'conversation', label: `Conversation (${Number(debug?.conversation?.tokens || 0)})` },
              { key: 'tools', label: `Tools (${Number(debug?.tools?.tokens || 0)})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDebugTab(tab.key as typeof debugTab)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  debugTab === tab.key
                    ? 'bg-white shadow-sm dark:bg-slate-700'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {debugTab === 'system' && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-white/60 p-3 text-xs text-slate-700 dark:bg-slate-900/50 dark:text-slate-300 whitespace-pre-wrap">
                {debug?.system_prompt?.text || 'No system prompt available.'}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Identity Docs</p>
                <div className="mt-2 space-y-2">
                  {(debug?.identity_docs?.rows ?? []).length === 0 && (
                    <p className="text-xs text-slate-500">No identity docs found.</p>
                  )}
                  {(debug?.identity_docs?.rows ?? []).map((doc: any) => (
                    <div key={doc.id || doc.scope} className="rounded-lg border px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="badge badge-neutral">{doc.scope || 'doc'}</span>
                        <span>{doc.updated_at ? new Date(doc.updated_at).toLocaleString() : 'unknown'}</span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap">{doc.content || ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {debugTab === 'memories' && (
            <div className="space-y-2">
              {(debug?.memories?.rows ?? []).length === 0 && (
                <p className="text-xs text-slate-500">No memories loaded.</p>
              )}
              {(debug?.memories?.rows ?? []).map((mem: any) => (
                <div key={mem.id || mem.key} className="rounded-lg border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="badge badge-info">{mem.visibility || 'memory'}</span>
                    <span>{mem.updated_at ? new Date(mem.updated_at).toLocaleString() : 'unknown'}</span>
                  </div>
                  <div className="mt-2">
                    <span className="font-semibold">{mem.key}</span>
                    <span className="text-slate-500"> — {mem.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {debugTab === 'rag' && (
            <div className="space-y-2 text-xs">
              {(debug?.rag_results?.rows ?? []).length === 0 ? (
                <p className="text-slate-500">{debug?.rag_results?.note || 'No RAG results captured.'}</p>
              ) : (
                (debug?.rag_results?.rows ?? []).map((rag: any, idx: number) => (
                  <div key={rag.id || idx} className="rounded-lg border px-3 py-2">
                    <div className="text-[11px] text-slate-500">
                      {rag.source || 'rag'} · score {rag.score ?? 'n/a'}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{rag.text || rag.content || ''}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {debugTab === 'conversation' && (
            <div className="space-y-2 text-xs">
              {truncated && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-700">
                  Conversation truncated to last {debug?.conversation?.messages?.length ?? 0} of {debug?.conversation?.total_messages ?? 0} messages.
                </div>
              )}
              {(debug?.conversation?.messages ?? []).length === 0 && (
                <p className="text-slate-500">No conversation messages found.</p>
              )}
              {(debug?.conversation?.messages ?? []).map((msg: any, idx: number) => (
                <div key={msg.id || idx} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="badge badge-neutral">{msg.role || 'message'}</span>
                    <span>{msg.created_at ? new Date(msg.created_at).toLocaleString() : 'unknown'}</span>
                    {msg.synthetic && <span className="badge badge-warning">synthetic</span>}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap">{msg.text || (msg.blocks ? JSON.stringify(msg.blocks, null, 2) : '')}</div>
                </div>
              ))}
            </div>
          )}

          {debugTab === 'tools' && (
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">First-party tools</p>
                {(debug?.tools?.first_party ?? []).length === 0 && (
                  <p className="text-slate-500">No tool definitions loaded.</p>
                )}
                <div className="mt-2 space-y-2">
                  {(debug?.tools?.first_party ?? []).map((tool: any) => (
                    <div key={tool.name} className="rounded-lg border px-3 py-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{tool.name}</span>
                        <span>{tool.trust_level || 'unknown'}</span>
                      </div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">{tool.description || 'No description.'}</div>
                      {tool.inputs_schema && (
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-100 px-2 py-1 text-[11px] dark:bg-slate-800">
                          {JSON.stringify(tool.inputs_schema, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">MCP tools</p>
                {(debug?.tools?.mcp ?? []).length === 0 && (
                  <p className="text-slate-500">No MCP tools loaded.</p>
                )}
                <div className="mt-2 space-y-2">
                  {(debug?.tools?.mcp ?? []).map((tool: any) => (
                    <div key={tool.qualified_name || tool.tool_name} className="rounded-lg border px-3 py-2">
                      <div className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{tool.qualified_name || tool.tool_name}</span>
                      </div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">{tool.description || 'No description.'}</div>
                      {tool.input_schema && (
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-100 px-2 py-1 text-[11px] dark:bg-slate-800">
                          {JSON.stringify(tool.input_schema, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <form
        className="mt-6 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text) return;
          sendMutation.mutate(text);
          setInput('');
        }}
      >
        <textarea
          className="input min-h-[40px] flex-1 resize-none"
          rows={1}
          placeholder="Send a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}
