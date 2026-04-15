'use client';

import React from 'react';
import { Film, Send, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateVideoJob } from '@/lib/hooks';
import { toast } from 'sonner';

type ComposerCommand = { name: string; description: string; template: string };

type Props = {
    input: string;
    setInput: (v: string) => void;
    replyDraft: string;
    onClearReply: () => void;
    sending: boolean;
    commandMatches: ComposerCommand[];
    cmdIndex: number;
    setCmdIndex: (i: number) => void;
    showComposerTools: boolean;
    setShowComposerTools: (v: boolean | ((prev: boolean) => boolean)) => void;
    onSubmit: (e: React.FormEvent) => void;
    onApplyCommand: (cmd: ComposerCommand) => void;
    onInsertTemplate: (text: string) => void;
    inputRef: React.RefObject<HTMLTextAreaElement>;
};

export default function ComposerBar({
    input,
    setInput,
    replyDraft,
    onClearReply,
    sending,
    commandMatches,
    cmdIndex,
    setCmdIndex,
    showComposerTools,
    setShowComposerTools,
    onSubmit,
    onApplyCommand,
    onInsertTemplate,
    inputRef,
}: Props) {
    const createVideo = useCreateVideoJob();

    const handleCreateVideo = () => {
        const prompt = input.trim().replace(/^\/video\s*/i, '');
        if (!prompt) {
            onInsertTemplate('/video prompt: ');
            return;
        }
        createVideo.mutate(
            { prompt },
            {
                onSuccess: () => {
                    toast.success('Video generation started');
                    setInput('');
                },
                onError: () => toast.error('Failed to start video generation'),
            },
        );
    };

    return (
        <form
            onSubmit={onSubmit}
            className="sticky bottom-0 px-3 sm:px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm"
        >
            {/* Reply draft banner */}
            {replyDraft && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                    <span className="truncate">{replyDraft}</span>
                    <button
                        type="button"
                        className="ml-2 rounded px-2 py-0.5 text-cyan-200 hover:bg-cyan-300/20"
                        onClick={onClearReply}
                    >
                        clear
                    </button>
                </div>
            )}

            {/* Textarea + send */}
            <div className="premium-panel-strong hover-float flex items-end gap-2 p-2.5">
                <button
                    type="button"
                    className="rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 sm:hidden"
                    title="Composer tools"
                    onClick={() => setShowComposerTools((prev) => !prev)}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                </button>
                <textarea
                    ref={inputRef}
                    className="input resize-none min-h-[40px] max-h-32 border-0 bg-transparent focus:ring-0 flex-1"
                    rows={1}
                    placeholder="Type a message…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (commandMatches.length > 0) {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setCmdIndex((cmdIndex + 1) % commandMatches.length);
                                return;
                            }
                            if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setCmdIndex((cmdIndex - 1 + commandMatches.length) % commandMatches.length);
                                return;
                            }
                            if (e.key === 'Tab') {
                                e.preventDefault();
                                onApplyCommand(commandMatches[cmdIndex] || commandMatches[0]);
                                return;
                            }
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSubmit(e as unknown as React.FormEvent);
                        }
                    }}
                />
                <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="btn btn-primary shrink-0 px-3 py-2 disabled:opacity-60"
                    aria-label="Send message"
                    title="Send message"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>

            {/* Quick template chips */}
            <div className={cn('mt-2 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1', !showComposerTools && 'sm:flex', !showComposerTools && 'hidden')}>
                {[
                    ['Summarize', '/summarize last 30 messages'],
                    ['Plan', '/plan objective: '],
                    ['Risk Check', '/risk action: '],
                    ['JSON Mode', '/json schema: {"type":"object"}'],
                ].map(([label, tpl]) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => onInsertTemplate(tpl)}
                        className="badge badge-neutral hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        {label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={handleCreateVideo}
                    disabled={createVideo.isPending}
                    className="badge badge-neutral hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-600 dark:hover:text-violet-300 inline-flex items-center gap-1"
                >
                    <Film className="h-3 w-3" />
                    Create Video
                </button>
            </div>

            {/* Slash command picker */}
            {commandMatches.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-900/80 shadow-xl">
                    {commandMatches.slice(0, 5).map((cmd, i) => (
                        <button
                            key={cmd.name}
                            type="button"
                            onClick={() => onApplyCommand(cmd)}
                            className={cn(
                                'flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors',
                                i === cmdIndex ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-300 hover:bg-slate-800',
                            )}
                        >
                            <span className="font-mono">{cmd.name}</span>
                            <span className="truncate pl-3 text-slate-400">{cmd.description}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-1 px-1 text-[11px] text-[var(--fg-muted)]">
                Enter to send · Shift+Enter for newline · Tab to apply slash command · Ctrl/⌘K search
            </div>
        </form>
    );
}
