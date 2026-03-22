'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import AppShell from '@/components/AppShell';
import {
  useChat,
  useMessages,
  useSendMessage,
  useCancelQueuedMessage,
  useMe,
  useMessageFeedback,
  useAgentState,
  usePauseAgent,
  useResumeAgent,
  useNudgeAgent,
  useSetMessageFeedback,
  useShareChat,
  useShareStatus,
  useUnshareChat,
} from '@/lib/hooks';
import { api, type A2uiStateRecord, type MessageRecord } from '@/lib/api';
import { PageSpinner } from '@/components/Spinner';
import type { CanvasBlock } from '@/components/blocks';
import { formatDate } from '@/lib/utils';
import { extractApiErrorMessage } from '@/lib/error';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatSearchBar from '@/components/chat/ChatSearchBar';
import A2uiPanel from '@/components/chat/A2uiPanel';
import MessageBubble, { type ChatMessage } from '@/components/chat/MessageBubble';
import ComposerBar from '@/components/chat/ComposerBar';
import { Bot, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type ComposerCommand = { name: string; description: string; template: string };

const COMPOSER_COMMANDS: ComposerCommand[] = [
  { name: '/summarize', description: 'Summarize recent context in this chat', template: '/summarize last 30 messages' },
  { name: '/plan', description: 'Ask Sven for an execution plan', template: '/plan objective: ' },
  { name: '/rewrite', description: 'Rewrite selected text with constraints', template: '/rewrite tone:professional constraints:' },
  { name: '/json', description: 'Force JSON output shape', template: '/json schema: {"type":"object"}' },
  { name: '/risk', description: 'Quick risk review before executing', template: '/risk action:' },
];

type FeedbackValue = 'up' | 'down';

function toMessages(value: unknown, feedbackByMessage?: Record<string, FeedbackValue>): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => {
      const id = String(item.id ?? '');
      const rawFeedback = item.user_feedback;
      const dbFeedback = rawFeedback === 'up' || rawFeedback === 'down' ? rawFeedback : null;
      return {
        id,
        chat_id: String(item.chat_id ?? ''),
        role: String(item.role ?? ''),
        text: String(item.text ?? ''),
        sender_user_id: String(item.sender_user_id ?? ''),
        sender_name: String(item.sender_name ?? ''),
        created_at: String(item.created_at ?? ''),
        content_type: String(item.content_type ?? 'text'),
        blocks: Array.isArray(item.blocks) ? (item.blocks as CanvasBlock[]) : [],
        user_feedback: feedbackByMessage?.[id] ?? dbFeedback,
        status: String(item.status ?? 'sent'),
        queue_id: item.queue_id == null ? null : String(item.queue_id),
        queue_position: typeof item.queue_position === 'number'
          ? item.queue_position
          : (item.queue_position == null ? null : Number(item.queue_position)),
      };
    });
}

function sanitizeA2uiHtml(input: string): string {
  if (!input || typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta, base').forEach((el) => el.remove());
  const allowedDataAttrs = new Set(['data-a2ui-action', 'data-a2ui-payload']);
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'style') { el.removeAttribute(attr.name); continue; }
      if ((name === 'href' || name === 'src') && (value.startsWith('javascript:') || value.startsWith('data:text/html'))) { el.removeAttribute(attr.name); continue; }
      if (name.startsWith('data-') && !allowedDataAttrs.has(name)) el.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}

function dateKey(inputDate: string): string {
  const date = new Date(inputDate);
  if (Number.isNaN(date.getTime())) return 'unknown-date';
  return date.toISOString().slice(0, 10);
}

export default function ChatTimelinePage() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: chat, isLoading: chatLoading } = useChat(chatId);
  const { data: messagesData, isLoading: msgsLoading } = useMessages(chatId);
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const sendMutation = useSendMessage(chatId);
  const cancelQueuedMutation = useCancelQueuedMessage(chatId);
  const feedbackQuery = useMessageFeedback(chatId);
  const feedbackMutation = useSetMessageFeedback(chatId);
  const agentStateQuery = useAgentState(chatId);
  const pauseAgentMutation = usePauseAgent(chatId);
  const resumeAgentMutation = useResumeAgent(chatId);
  const nudgeAgentMutation = useNudgeAgent(chatId);
  const shareStatusQuery = useShareStatus(chatId);
  const shareMutation = useShareChat();
  const unshareMutation = useUnshareChat();

  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCursor, setSearchCursor] = useState(0);
  const [shareStatus, setShareStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareExpiresAt, setShareExpiresAt] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDaysInput, setShareDaysInput] = useState('7');
  const [unshareDialogOpen, setUnshareDialogOpen] = useState(false);
  const [olderRows, setOlderRows] = useState<MessageRecord[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [cmdIndex, setCmdIndex] = useState(0);
  const [newestMessageId, setNewestMessageId] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, FeedbackValue>>({});
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [highlightMessageId, setHighlightMessageId] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [a2ui, setA2ui] = useState<{ html: string; component: string; state: Record<string, unknown> }>({
    html: '',
    component: '',
    state: {},
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const a2uiStreamRef = useRef<EventSource | null>(null);

  const rawRows = useMemo(() => {
    const historic = olderRows;
    const latest = messagesData?.rows || [];
    const seen = new Set<string>();
    const merged: MessageRecord[] = [];
    for (const row of [...historic, ...latest]) {
      const id = String(row.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }
    return merged;
  }, [olderRows, messagesData?.rows]);

  const messages = useMemo(() => {
    const base = toMessages(rawRows, feedbackByMessage);
    if (optimisticMessages.length === 0) return base;
    const seen = new Set(base.map((m) => m.id));
    const optimisticTail = optimisticMessages.filter((m) => !seen.has(m.id));
    return [...base, ...optimisticTail];
  }, [rawRows, feedbackByMessage, optimisticMessages]);
  const queuedCount = useMemo(
    () => messages.filter((m) => m.status === 'queued').length,
    [messages],
  );
  const isAgentPaused = Boolean(agentStateQuery.data?.paused);
  const agentPauseBusy = pauseAgentMutation.isPending || resumeAgentMutation.isPending;
  const processing = Boolean(agentStateQuery.data?.processing);
  const lastUserAt = agentStateQuery.data?.last_user_message_at ? new Date(agentStateQuery.data.last_user_message_at).getTime() : 0;
  const lastAssistantAt = agentStateQuery.data?.last_assistant_message_at ? new Date(agentStateQuery.data.last_assistant_message_at).getTime() : 0;
  const isAgentStuck = !isAgentPaused
    && processing
    && lastUserAt > 0
    && lastUserAt > lastAssistantAt
    && (nowTick - lastUserAt) > 30_000;
  const targetMessageId = String(searchParams.get('m') || '').trim();
  const sanitizedA2uiHtml = useMemo(() => sanitizeA2uiHtml(a2ui.html), [a2ui.html]);

  useEffect(() => {
    if (!shareStatus) return;
    const timer = window.setTimeout(() => setShareStatus(''), 2600);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

  useEffect(() => {
    const data = shareStatusQuery.data;
    if (!data || !('active' in data)) return;
    if (data.active) {
      setShareUrl(String(data.share_url || ''));
      setShareExpiresAt(String(data.expires_at || ''));
    } else {
      setShareUrl('');
      setShareExpiresAt('');
    }
  }, [shareStatusQuery.data]);

  useEffect(() => {
    const rows = feedbackQuery.data;
    if (!Array.isArray(rows)) return;
    const next: Record<string, FeedbackValue> = {};
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const messageId = String((row as { message_id?: unknown }).message_id ?? '');
      const feedback = (row as { feedback?: unknown }).feedback;
      if (!messageId) continue;
      if (feedback === 'up' || feedback === 'down') {
        next[messageId] = feedback;
      }
    }
    setFeedbackByMessage(next);
  }, [feedbackQuery.data]);

  useEffect(() => {
    setOlderRows([]);
  }, [chatId]);

  useEffect(() => {
    setHasOlder(Boolean(messagesData?.has_more));
  }, [messagesData?.has_more]);

  useEffect(() => {
    if (isAtBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAtBottom]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!targetMessageId) return;
    const node = messageRefs.current[targetMessageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightMessageId(targetMessageId);
    const timer = window.setTimeout(() => setHighlightMessageId(''), 3000);
    router.replace(`/c/${chatId}`, { scroll: false });
    return () => window.clearTimeout(timer);
  }, [targetMessageId, chatId, router, messages.length]);

  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (newest?.id) setNewestMessageId(newest.id);
  }, [messages]);

  useEffect(() => {
    setSearchCursor(0);
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await api.a2ui.snapshot(chatId);
        const snapshot: A2uiStateRecord = snap.data;
        if (mounted) {
          setA2ui({
            html: String(snapshot.html || ''),
            component: String(snapshot.component || ''),
            state: snapshot.state || {},
          });
        }
      } catch (err) { void err; }
    })();

    const es = new EventSource(`/api/v1/chats/${encodeURIComponent(chatId)}/a2ui/stream`, { withCredentials: true });
    a2uiStreamRef.current = es;

    const applyPayload = (data: Record<string, unknown>) => {
      setA2ui({
        html: String(data.html || ''),
        component: String(data.component || ''),
        state: (data.state || {}) as Record<string, unknown>,
      });
    };

    es.addEventListener('snapshot', (e) => { try { applyPayload(JSON.parse(e.data || '{}')); } catch (err) { void err; } });
    const onUpdate = (e: MessageEvent) => { try { applyPayload(JSON.parse(e.data || '{}').payload || {}); } catch (err) { void err; } };
    es.addEventListener('push', onUpdate as EventListener);
    es.addEventListener('reset', onUpdate as EventListener);
    es.addEventListener('eval', (e) => { try { const d = JSON.parse(e.data || '{}'); applyPayload(d.payload?.ui || {}); } catch (err) { void err; } });

    return () => { mounted = false; a2uiStreamRef.current?.close(); };
  }, [chatId]);

  async function toggleAgentPause() {
    try {
      if (isAgentPaused) {
        await resumeAgentMutation.mutateAsync();
      } else {
        await pauseAgentMutation.mutateAsync();
      }
      await queryClient.invalidateQueries({ queryKey: ['agent-state', chatId] });
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Failed to update agent state'));
    }
  }

  async function nudgeAgent() {
    try {
      await nudgeAgentMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ['agent-state', chatId] });
      await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      toast.success('Nudge sent. Retrying last user message.');
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Failed to nudge agent'));
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      chat_id: chatId,
      role: 'user',
      text,
      sender_user_id: String(me?.id || 'me'),
      sender_name: String(me?.display_name || me?.username || 'You'),
      created_at: new Date().toISOString(),
      content_type: 'text',
      blocks: [],
      user_feedback: null,
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);

    sendMutation.mutate(text, {
      onSuccess: (response) => {
        const created = response.data;
        const queued = created?.queued || created?.status === 'queued';
        setOptimisticMessages((prev) => {
          const next = prev.filter((m) => m.id !== tempId);
          if (!queued || !created?.id) return next;
          return [
            ...next,
            {
              id: String(created.id),
              chat_id: String(created.chat_id ?? chatId),
              role: String(created.role || 'user'),
              text: String(created.text || ''),
              sender_user_id: String(created.sender_user_id || me?.id || 'me'),
              sender_name: String(me?.display_name || me?.username || 'You'),
              created_at: String(created.created_at || new Date().toISOString()),
              content_type: String(created.content_type || 'text'),
              blocks: Array.isArray(created.blocks) ? (created.blocks as CanvasBlock[]) : [],
              user_feedback: null,
              status: String(created.status || 'queued'),
              queue_id: created.queue_id == null ? String(created.id) : String(created.queue_id),
              queue_position: typeof created.queue_position === 'number'
                ? created.queue_position
                : (created.queue_position == null ? null : Number(created.queue_position)),
            },
          ];
        });
      },
      onError: (error) => {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(extractApiErrorMessage(error, 'Message send failed'));
      },
    });
    setInput('');
    inputRef.current?.focus();
  }

  async function handleA2uiInteract(e: React.MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest('[data-a2ui-action]') as HTMLElement | null;
    if (!el) return;
    const eventType = el.getAttribute('data-a2ui-action') || 'click';
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(el.getAttribute('data-a2ui-payload') || '{}'); } catch { payload = { raw: el.getAttribute('data-a2ui-payload') }; }
    try { await api.a2ui.interact(chatId, { event_type: eventType, payload }); } catch (err) { void err; }
  }

  async function loadOlderMessages() {
    if (loadingOlder || !hasOlder) return;
    const first = rawRows[0];
    const before = String(first?.created_at || '');
    if (!before) return;

    setLoadingOlder(true);
    try {
      const res = await api.chats.messages(chatId, { before, limit: 50 });
      const rows = res.data?.rows || [];
      setOlderRows((prev) => {
        const seen = new Set<string>();
        const merged: MessageRecord[] = [];
        for (const row of [...prev, ...rows]) {
          const id = String(row.id || '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push(row);
        }
        return merged;
      });
      setHasOlder(Boolean(res.data?.has_more));
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Failed to load older messages'));
    } finally {
      setLoadingOlder(false);
    }
  }

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  useEffect(() => {
    if (filteredMessages.length === 0) {
      setSearchCursor(0);
      return;
    }
    if (searchCursor >= filteredMessages.length) {
      setSearchCursor(filteredMessages.length - 1);
    }
  }, [filteredMessages.length, searchCursor]);

  const searchTarget = filteredMessages[searchCursor];

  useEffect(() => {
    if (!searchOpen || !searchQuery || !searchTarget?.id) return;
    const node = messageRefs.current[searchTarget.id];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchOpen, searchQuery, searchTarget?.id]);

  const commandQuery = input.startsWith('/') ? input.toLowerCase() : '';
  const commandMatches = commandQuery
    ? COMPOSER_COMMANDS.filter((cmd) => cmd.name.includes(commandQuery) || cmd.description.toLowerCase().includes(commandQuery.slice(1)))
    : [];

  function applyCommand(cmd: ComposerCommand) {
    setInput(cmd.template);
    setCmdIndex(0);
    inputRef.current?.focus();
  }

  function nextSearchMatch() {
    if (filteredMessages.length === 0) return;
    setSearchCursor((prev) => (prev + 1) % filteredMessages.length);
  }

  function prevSearchMatch() {
    if (filteredMessages.length === 0) return;
    setSearchCursor((prev) => (prev - 1 + filteredMessages.length) % filteredMessages.length);
  }

  function insertTemplate(text: string) {
    setInput((prev) => `${prev ? `${prev}\n` : ''}${text}`);
    inputRef.current?.focus();
  }

  function handleReplyTo(message: ChatMessage) {
    const preview = message.text?.trim() || '[non-text message]';
    const quoted = preview.length > 140 ? `${preview.slice(0, 140)}...` : preview;
    setReplyDraft(`Replying to ${message.sender_name || (message.role === 'assistant' ? 'Sven' : 'User')}: "${quoted}"`);
    setInput((prev) => `${prev ? `${prev}\n` : ''}> ${quoted}\n`);
    inputRef.current?.focus();
  }

  async function handleCopy(text: string) {
    if (!text.trim()) {
      toast.error('Nothing to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  function handleRemixFrom(message: ChatMessage) {
    setInput(`/rewrite based_on: """${(message.text?.trim() ?? '').slice(0, 240)}"""`);
    setReplyDraft('');
    inputRef.current?.focus();
  }

  function handleFeedback(message: ChatMessage, feedback: FeedbackValue) {
    const previous = feedbackByMessage[message.id] ?? null;
    const nextFeedback = previous === feedback ? null : feedback;

    setFeedbackByMessage((prev) => {
      const next = { ...prev };
      if (nextFeedback) {
        next[message.id] = nextFeedback;
      } else {
        delete next[message.id];
      }
      return next;
    });

    feedbackMutation.mutate(
      { messageId: message.id, feedback: nextFeedback },
      {
        onError: (error) => {
          setFeedbackByMessage((prev) => {
            const next = { ...prev };
            if (previous) {
              next[message.id] = previous;
            } else {
              delete next[message.id];
            }
            return next;
          });
          toast.error(extractApiErrorMessage(error, 'Feedback update failed'));
        },
      },
    );
  }

  function handleCancelQueued(message: ChatMessage) {
    const queueId = String(message.queue_id || message.id || '').trim();
    if (!queueId) return;
    cancelQueuedMutation.mutate(queueId, {
      onSuccess: () => {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== queueId));
        toast.success('Queued message cancelled');
      },
      onError: (error) => {
        toast.error(extractApiErrorMessage(error, 'Queue cancel failed'));
      },
    });
  }

  function handleShareChat() {
    setShareDialogOpen(true);
  }

  async function submitShareChat() {
    const trimmed = shareDaysInput.trim();
    let expiresInDays: number | undefined;
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 3650) {
        setShareStatus('Invalid expiry days');
        toast.error('Invalid expiry days');
        return;
      }
      expiresInDays = Math.floor(parsed);
    }

    try {
      const res = await shareMutation.mutateAsync({ chatId, expiresInDays });
      const url = String(res.data?.share_url || '');
      const expiresAt = String(res.data?.expires_at || '');
      if (!url) {
        setShareStatus('Share failed');
        toast.error('Share failed');
        return;
      }
      setShareDialogOpen(false);
      setShareUrl(url);
      setShareExpiresAt(expiresAt);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus('Share link copied');
        toast.success('Share link copied');
      } else {
        setShareStatus(url);
        toast.success('Share link created');
      }
    } catch (error) {
      setShareStatus('Share failed');
      toast.error(extractApiErrorMessage(error, 'Share failed'));
    }
  }

  function handleUnshareChat() {
    setUnshareDialogOpen(true);
  }

  async function submitUnshareChat() {
    try {
      await unshareMutation.mutateAsync({ chatId });
      setShareUrl('');
      setShareExpiresAt('');
      setShareStatus('Share link revoked');
      setUnshareDialogOpen(false);
      toast.success('Share link revoked');
    } catch (error) {
      setShareStatus('Revoke failed');
      toast.error(extractApiErrorMessage(error, 'Revoke failed'));
    }
  }

  async function copyTranscript() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const file = await api.chats.exportTranscript(chatId, { format: 'md', max_rows: 10000 });
      const md = await file.blob.text();
      await navigator.clipboard.writeText(md);
      toast.success('Transcript copied');
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Transcript copy failed'));
    } finally {
      setExportBusy(false);
    }
  }

  async function downloadTranscript() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const file = await api.chats.exportTranscript(chatId, { format: 'md', max_rows: 10000 });
      const filename = file.filename || 'chat-transcript.md';
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Transcript downloaded');
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Transcript download failed'));
    } finally {
      setExportBusy(false);
    }
  }

  if (chatLoading || msgsLoading) {
    return <AppShell><PageSpinner /></AppShell>;
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <ChatHeader
          chat={chat}
          searchOpen={searchOpen}
          exportBusy={exportBusy}
          shareActive={!!shareUrl}
          shareBusy={shareMutation.isPending}
          unshareBusy={unshareMutation.isPending}
          shareHint={shareStatus || 'Share chat link'}
          onBack={() => router.push('/')}
          onToggleSearch={() => setSearchOpen((s) => !s)}
          onCopyTranscript={() => void copyTranscript()}
          onDownloadTranscript={() => void downloadTranscript()}
          onShare={() => void handleShareChat()}
          onUnshare={() => void handleUnshareChat()}
          agentPaused={isAgentPaused}
          agentPauseBusy={agentPauseBusy}
          onToggleAgentPause={() => void toggleAgentPause()}
          showNudge={isAgentStuck}
          nudgeBusy={nudgeAgentMutation.isPending}
          onNudge={() => void nudgeAgent()}
        />

        {shareStatus && (
          <div className="px-4 pt-1 text-xs text-cyan-300">{shareStatus}</div>
        )}
        {shareUrl && (
          <div className="px-4 pt-1 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Active link: <span className="text-slate-300">{shareUrl}</span>
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-slate-600/40 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/70"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success('Share link copied');
                  } catch (error) {
                    toast.error(extractApiErrorMessage(error, 'Copy failed'));
                  }
                }}
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-slate-600/40 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/70"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </div>
            {shareExpiresAt && (
              <div className="mt-1 text-amber-300">
                expires {new Date(shareExpiresAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
        {isAgentPaused && (
          <div className="px-4 pt-1 text-xs text-amber-300">
            Agent paused
          </div>
        )}
        {isAgentStuck && (
          <div className="px-4 pt-1 text-xs text-amber-300">
            Agent appears stuck. You can nudge to retry the last message.
          </div>
        )}

        {searchOpen && (
          <ChatSearchBar
            query={searchQuery}
            resultCount={filteredMessages.length}
            activeIndex={Math.min(searchCursor, Math.max(filteredMessages.length - 1, 0))}
            onChange={setSearchQuery}
            onNext={nextSearchMatch}
            onPrev={prevSearchMatch}
            onClose={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />
        )}

        <div
          ref={messageScrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          }}
          className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 space-y-4"
        >
          {hasOlder && (
            <div className="flex justify-center">
              <button
                type="button"
                className="rounded-full border border-cyan-300/25 bg-slate-900/70 px-3 py-1 text-xs text-cyan-200 hover:bg-slate-800 disabled:opacity-60"
                onClick={() => void loadOlderMessages()}
                disabled={loadingOlder}
              >
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </button>
            </div>
          )}

          <A2uiPanel html={sanitizedA2uiHtml} onInteract={handleA2uiInteract} />

          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--fg-muted)]">
              <Bot className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery ? 'No messages match your search' : 'No messages yet. Say something!'}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              const curKey = dateKey(msg.created_at);
              const prevKey = index > 0 ? dateKey(filteredMessages[index - 1]?.created_at ?? '') : '';
              return (
                <div
                  key={msg.id}
                  ref={(node) => {
                    messageRefs.current[msg.id] = node;
                  }}
                >
                  {(index === 0 || curKey !== prevKey) && (
                    <div className="my-2 flex items-center justify-center">
                      <span className="date-divider-pill">{formatDate(msg.created_at)}</span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isMe={msg.sender_user_id === me?.id}
                    isNew={msg.id === newestMessageId}
                    isSearchFocused={
                      (searchOpen && !!searchQuery && searchTarget?.id === msg.id)
                      || highlightMessageId === msg.id
                    }
                    onCopy={handleCopy}
                    onReply={handleReplyTo}
                    onRemix={handleRemixFrom}
                    onFeedback={handleFeedback}
                    onCancelQueued={handleCancelQueued}
                  />
                </div>
              );
            })
          )}

          {sendMutation.isPending && (
            <div className="chat-appear flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-slate-100/90 px-4 py-2.5 text-sm dark:bg-slate-800/90">
                <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span> Sven is thinking
              </div>
            </div>
          )}

          {!isAtBottom && (
            <div className="pointer-events-none sticky bottom-3 flex justify-center">
              <button
                type="button"
                onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setIsAtBottom(true); }}
                className="pointer-events-auto rounded-full border border-cyan-300/30 bg-slate-900/85 px-3 py-1 text-xs font-medium text-cyan-200 shadow-lg backdrop-blur hover:bg-slate-800"
              >
                Jump to latest
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {queuedCount > 0 && (
          <div className="px-4 pb-2 text-xs text-amber-300">
            {queuedCount} queued message{queuedCount === 1 ? '' : 's'}
          </div>
        )}

        <ComposerBar
          input={input}
          setInput={setInput}
          replyDraft={replyDraft}
          onClearReply={() => setReplyDraft('')}
          sending={sendMutation.isPending}
          commandMatches={commandMatches}
          cmdIndex={cmdIndex}
          setCmdIndex={setCmdIndex}
          showComposerTools={showComposerTools}
          setShowComposerTools={setShowComposerTools}
          onSubmit={handleSend}
          onApplyCommand={applyCommand}
          onInsertTemplate={insertTemplate}
          inputRef={inputRef}
        />
      </div>

      {shareDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="premium-panel-strong w-full max-w-md px-5 py-4">
            <h2 className="text-base font-semibold">Share conversation</h2>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Set expiry in days, or leave blank for no expiry.
            </p>
            <input
              autoFocus
              className="input mt-3 w-full"
              value={shareDaysInput}
              onChange={(e) => setShareDaysInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShareDialogOpen(false);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitShareChat();
                }
              }}
              placeholder="e.g. 7"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShareDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitShareChat()}
                disabled={shareMutation.isPending}
              >
                Create link
              </button>
            </div>
          </div>
        </div>
      )}

      {unshareDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="premium-panel-strong w-full max-w-md px-5 py-4">
            <h2 className="text-base font-semibold text-rose-400">Revoke share link</h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              This will immediately disable the active public link.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUnshareDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn border border-rose-400/30 bg-rose-600/85 text-white hover:bg-rose-600 disabled:opacity-60"
                onClick={() => void submitUnshareChat()}
                disabled={unshareMutation.isPending}
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
