'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bot, Copy, Download, User } from 'lucide-react';
import { MarkdownBlock } from '@/components/blocks/MarkdownBlock';
import { toast } from 'sonner';

type SharedMessage = {
  id: string;
  role: string;
  text: string;
  timestamp: string;
};

type SharedResponse = {
  title: string;
  messages: SharedMessage[];
};

function formatTimestamp(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
}

function toSharedTranscriptMarkdown(chat: SharedResponse): string {
  const lines: string[] = [];
  lines.push(`# ${chat.title || 'Shared Conversation'}`);
  lines.push('');
  for (const msg of chat.messages || []) {
    const who = msg.role === 'assistant' ? 'Sven' : 'User';
    const ts = formatTimestamp(msg.timestamp);
    lines.push(`## ${who}${ts ? ` (${ts})` : ''}`);
    lines.push('');
    lines.push(String(msg.text || '').trim() || '[empty]');
    lines.push('');
  }
  return lines.join('\n');
}

export default function SharedChatPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chat, setChat] = useState<SharedResponse | null>(null);

  async function copyTranscript() {
    if (!chat) return;
    try {
      await navigator.clipboard.writeText(toSharedTranscriptMarkdown(chat));
      toast.success('Transcript copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  function downloadTranscript() {
    if (!chat) return;
    const text = toSharedTranscriptMarkdown(chat);
    const safeName = (chat.title || 'shared-conversation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'shared-conversation';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/v1/shared/${encodeURIComponent(params.token)}`);
        const body = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: { message?: string };
          data?: SharedResponse;
        };
        if (!mounted) return;
        if (!res.ok || !body?.success || !body?.data) {
          setError(body?.error?.message || 'Shared conversation is not available.');
          setChat(null);
          return;
        }
        setChat(body.data);
      } catch {
        if (!mounted) return;
        setError('Failed to load shared conversation.');
        setChat(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, [params.token]);

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_500px_at_50%_-20%,rgba(14,165,168,0.18),transparent_60%),linear-gradient(180deg,#020617_0%,#0b1220_60%,#0f172a_100%)] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="premium-panel-strong mb-4 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Shared Conversation</div>
              <h1 className="mt-1 text-xl font-semibold text-slate-100">{chat?.title || 'Conversation'}</h1>
              <div className="mt-1 text-xs text-slate-400">
                Read-only view
                {chat && <span className="ml-2">• {chat.messages.length} messages</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-slate-600/40 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                onClick={() => void copyTranscript()}
                disabled={!chat}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-slate-600/40 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                onClick={() => downloadTranscript()}
                disabled={!chat}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
        </header>

        {loading && (
          <div className="premium-panel-strong px-5 py-6 text-sm text-slate-300">Loading conversation…</div>
        )}

        {!loading && error && (
          <div className="premium-panel-strong flex items-start gap-3 border border-rose-400/25 px-5 py-4 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && chat && (
          <section className="space-y-3">
            {chat.messages.length === 0 ? (
              <div className="premium-panel-strong px-5 py-6 text-sm text-slate-300">No messages in this shared chat.</div>
            ) : (
              chat.messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <article key={msg.id} className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isAssistant ? 'bg-cyan-500/15 text-cyan-300' : 'bg-slate-700/70 text-slate-200'
                      }`}
                    >
                      {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="max-w-[85%]">
                      <div className={`mb-1 text-[11px] ${isAssistant ? 'text-cyan-200/80' : 'text-slate-300/80'}`}>
                        {isAssistant ? 'Sven' : 'User'}
                        <span className="ml-2 text-slate-500">{formatTimestamp(msg.timestamp)}</span>
                      </div>
                      <div
                        className={`rounded-2xl border px-4 py-2.5 text-sm ${
                          isAssistant
                            ? 'border-cyan-300/20 bg-slate-900/70'
                            : 'border-slate-600/40 bg-slate-800/70'
                        }`}
                      >
                        {isAssistant ? <MarkdownBlock content={msg.text} /> : <p className="whitespace-pre-wrap">{msg.text}</p>}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        )}

        <div className="mt-8 text-center text-xs text-slate-400">
          Open full app:
          <Link href="/login" className="ml-1 text-cyan-300 hover:text-cyan-200">
            sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
