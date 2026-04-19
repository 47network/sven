'use client';

import { Bot, BookmarkPlus, BookmarkX, Copy, Reply, ThumbsDown, ThumbsUp, User, Wand2 } from 'lucide-react';
import { cn, formatDate, relativeTime } from '@/lib/utils';
import { BlockRenderer, type CanvasBlock } from '@/components/blocks';
import { MarkdownBlock } from '@/components/blocks/MarkdownBlock';
import { useCreateMemory, useDeleteMemory } from '@/lib/hooks';
import { toast } from 'sonner';
import { memo, useState } from 'react';

export type ChatMessage = {
    id: string;
    chat_id?: string;
    role: string;
    text: string;
    sender_user_id: string;
    sender_name: string;
    created_at: string;
    content_type: string;
    blocks: CanvasBlock[];
    user_feedback?: 'up' | 'down' | null;
    status?: 'queued' | 'sent' | 'failed' | 'streaming' | string;
    queue_id?: string | null;
    queue_position?: number | null;
};

type Props = {
    message: ChatMessage;
    isMe: boolean;
    isNew: boolean;
    isSearchFocused?: boolean;
    onCopy: (text: string) => Promise<void>;
    onReply: (message: ChatMessage) => void;
    onRemix: (message: ChatMessage) => void;
    onFeedback?: (message: ChatMessage, feedback: 'up' | 'down') => void;
    onCancelQueued?: (message: ChatMessage) => void;
};

function getCopyPayload(message: ChatMessage): string {
    const direct = String(message.text || '').trim();
    if (direct) return direct;
    if (!Array.isArray(message.blocks) || message.blocks.length === 0) return '';
    const lines: string[] = [];
    for (const block of message.blocks) {
        if (!block || typeof block !== 'object') continue;
        const content = (block as { content?: unknown }).content;
        if (typeof content === 'string' && content.trim()) {
            lines.push(content.trim());
            continue;
        }
        if (content && typeof content === 'object') {
            const value = (content as { text?: unknown; content?: unknown; title?: unknown }).text
                ?? (content as { content?: unknown }).content
                ?? (content as { title?: unknown }).title;
            if (typeof value === 'string' && value.trim()) {
                lines.push(value.trim());
            }
        }
    }
    return lines.join('\n\n').trim();
}

const MessageBubble = memo(function MessageBubble({
    message,
    isMe,
    isNew,
    isSearchFocused = false,
    onCopy,
    onReply,
    onRemix,
    onFeedback,
    onCancelQueued,
}: Props) {
    const isAssistant = message.role === 'assistant';
    const isSystem = message.role === 'system';
    const isQueued = message.status === 'queued';
    const copyPayload = getCopyPayload(message);

    const createMemory = useCreateMemory();
    const deleteMemory = useDeleteMemory();
    const [rememberedId, setRememberedId] = useState<string | null>(null);

    if (isSystem) {
        return (
            <div className="flex justify-center">
                <div className="rounded-full border border-cyan-300/20 bg-slate-100/80 px-4 py-1.5 text-xs text-[var(--fg-muted)] dark:bg-slate-800/80">
                    {message.text}
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex gap-3', isMe && !isAssistant ? 'flex-row-reverse' : '', isNew && 'chat-appear')}>
            {/* Avatar */}
            <div
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    isAssistant
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                )}
            >
                {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>

            {/* Content */}
            <div className={cn('max-w-[75%] space-y-2', isMe && !isAssistant ? 'items-end' : '')}>
                {/* Sender info */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                        {isAssistant ? 'Sven' : message.sender_name || 'User'}
                    </span>
                    {isQueued && (
                        <span className="badge badge-warning text-[10px]">
                            Message queued{typeof message.queue_position === 'number' ? ` (position: ${message.queue_position})` : ''}
                        </span>
                    )}
                    <span className="text-[10px] text-[var(--fg-muted)]" title={formatDate(message.created_at)}>
                        {relativeTime(message.created_at)}
                    </span>
                </div>

                {/* Text content */}
                {message.content_type === 'text' && message.text && (
                    <div
                        className={cn(
                            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed hover-float',
                            isSearchFocused && 'ring-2 ring-cyan-400/80 ring-offset-2 ring-offset-transparent',
                            isMe && !isAssistant
                                ? 'user-shell'
                                : isAssistant
                                    ? 'assistant-shell'
                                    : 'bg-slate-100 dark:bg-slate-800 rounded-tl-sm',
                            isQueued && 'opacity-70',
                        )}
                    >
                        {isAssistant ? <MarkdownBlock content={message.text} /> : <p className="whitespace-pre-wrap">{message.text}</p>}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-70 sm:hover:opacity-100">
                    <button
                        type="button"
                        className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                        title="Copy"
                        aria-label="Copy"
                        onClick={() => void onCopy(copyPayload)}
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                        title="Reply"
                        aria-label="Reply"
                        onClick={() => onReply(message)}
                    >
                        <Reply className="h-3.5 w-3.5" />
                    </button>
                    {isAssistant && (
                        <button
                            type="button"
                            className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                            title="Remix prompt from this response"
                            aria-label="Remix prompt from this response"
                            onClick={() => onRemix(message)}
                        >
                            <Wand2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isAssistant && !rememberedId && (
                        <button
                            type="button"
                            className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-violet-100/70 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400"
                            title="Remember this response"
                            aria-label="Remember this response"
                            disabled={createMemory.isPending}
                            onClick={() => {
                                const content = copyPayload || message.text;
                                if (!content) return;
                                createMemory.mutate(
                                    { key: `msg-${message.id}`, value: content, scope: 'chat', chat_id: message.chat_id },
                                    {
                                        onSuccess: (res) => {
                                            setRememberedId(res?.data?.id ?? 'saved');
                                            toast.success('Memory saved');
                                        },
                                        onError: () => toast.error('Failed to save memory'),
                                    },
                                );
                            }}
                        >
                            <BookmarkPlus className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isAssistant && rememberedId && (
                        <button
                            type="button"
                            className="rounded-md p-1 text-violet-600 dark:text-violet-400 hover:bg-violet-100/70 dark:hover:bg-violet-900/30"
                            title="Forget this memory"
                            aria-label="Forget this memory"
                            disabled={deleteMemory.isPending}
                            onClick={() => {
                                if (rememberedId === 'saved') { setRememberedId(null); return; }
                                deleteMemory.mutate(rememberedId, {
                                    onSuccess: () => { setRememberedId(null); toast.success('Memory removed'); },
                                    onError: () => toast.error('Failed to remove memory'),
                                });
                            }}
                        >
                            <BookmarkX className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isAssistant && onFeedback && (
                        <>
                            <button
                                type="button"
                                className={cn(
                                    'rounded-md p-1 hover:bg-slate-200/70 dark:hover:bg-slate-700/60',
                                    message.user_feedback === 'up'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-[var(--fg-muted)]',
                                )}
                                title="Thumbs up"
                                aria-label="Thumbs up"
                                onClick={() => onFeedback(message, 'up')}
                            >
                                <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    'rounded-md p-1 hover:bg-slate-200/70 dark:hover:bg-slate-700/60',
                                    message.user_feedback === 'down'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-[var(--fg-muted)]',
                                )}
                                title="Thumbs down"
                                aria-label="Thumbs down"
                                onClick={() => onFeedback(message, 'down')}
                            >
                                <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                    {isQueued && onCancelQueued && (
                        <button
                            type="button"
                            className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                            title="Remove queued message"
                            aria-label="Remove queued message"
                            onClick={() => onCancelQueued(message)}
                        >
                            cancel
                        </button>
                    )}
                </div>

                {/* Block content */}
                {message.content_type === 'blocks' && message.blocks && (
                    <div className="space-y-2">
                        {message.blocks.map((block, i) => (
                            <BlockRenderer key={i} block={block} chatId={message.chat_id} messageId={message.id} />
                        ))}
                    </div>
                )}

                {/* File content */}
                {message.content_type === 'file' && (
                    <BlockRenderer
                        block={{ type: 'file_preview', content: { name: message.text || 'Attachment', artifact_id: message.id } }}
                        chatId={message.chat_id}
                        messageId={message.id}
                    />
                )}

                {/* Audio content */}
                {message.content_type === 'audio' && (
                    <BlockRenderer
                        block={{ type: 'audio', content: { artifact_id: message.id, transcript: message.text } }}
                        chatId={message.chat_id}
                        messageId={message.id}
                    />
                )}
            </div>
        </div>
    );
});

export default MessageBubble;
