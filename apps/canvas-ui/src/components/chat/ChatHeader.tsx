'use client';

import { ArrowLeft, Copy, Download, Link2, Pause, Play, RefreshCw, Search, Sparkles, Unlink2 } from 'lucide-react';

type Chat = { name?: string; members?: unknown[]; type?: string };

type Props = {
    chat?: Chat | null;
    searchOpen: boolean;
    shareActive?: boolean;
    shareBusy?: boolean;
    unshareBusy?: boolean;
    exportBusy?: boolean;
    shareHint?: string;
    onBack: () => void;
    onToggleSearch: () => void;
    onCopyTranscript?: () => void;
    onDownloadTranscript?: () => void;
    onShare?: () => void;
    onUnshare?: () => void;
    agentPaused?: boolean;
    agentPauseBusy?: boolean;
    onToggleAgentPause?: () => void;
    showNudge?: boolean;
    nudgeBusy?: boolean;
    onNudge?: () => void;
};

export default function ChatHeader({
    chat,
    searchOpen,
    shareActive = false,
    shareBusy = false,
    unshareBusy = false,
    exportBusy = false,
    shareHint,
    onBack,
    onToggleSearch,
    onCopyTranscript,
    onDownloadTranscript,
    onShare,
    onUnshare,
    agentPaused = false,
    agentPauseBusy = false,
    onToggleAgentPause,
    showNudge = false,
    nudgeBusy = false,
    onNudge,
}: Props) {
    return (
        <div className="premium-panel-strong hover-float mx-3 mt-3 flex items-center gap-3 px-4 py-3">
            <button
                onClick={onBack}
                className="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
                <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
                <div className="mb-1">
                    <span className="premium-kicker">
                        <Sparkles className="mr-1 h-3 w-3" /> Live Thread
                    </span>
                </div>
                <h2 className="text-sm font-semibold truncate">{chat?.name || 'Chat'}</h2>
                <div className="text-xs text-[var(--fg-muted)]">
                    {chat?.members?.length || 0} members
                    <span className="ml-2">• {chat?.type}</span>
                </div>
            </div>
            <button
                onClick={onToggleSearch}
                className={`rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 ${searchOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                aria-pressed={searchOpen}
                title="Search in chat"
            >
                <Search className="h-4 w-4" />
            </button>
            {onToggleAgentPause && (
                <button
                    onClick={onToggleAgentPause}
                    disabled={agentPauseBusy}
                    className={`rounded-md p-2 disabled:opacity-60 ${agentPaused
                        ? 'text-amber-500 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20'
                        : 'text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    title={agentPaused ? 'Resume agent' : 'Pause agent'}
                >
                    {agentPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
            )}
            {showNudge && onNudge && (
                <button
                    onClick={onNudge}
                    disabled={nudgeBusy}
                    className="rounded-md p-2 text-amber-500 hover:bg-amber-50 disabled:opacity-60 dark:text-amber-300 dark:hover:bg-amber-900/20"
                    title="Nudge agent"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            )}
            {onCopyTranscript && (
                <button
                    onClick={onCopyTranscript}
                    disabled={exportBusy}
                    className="rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800"
                    title="Copy full transcript"
                >
                    <Copy className="h-4 w-4" />
                </button>
            )}
            {onDownloadTranscript && (
                <button
                    onClick={onDownloadTranscript}
                    disabled={exportBusy}
                    className="rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800"
                    title="Download full transcript"
                >
                    <Download className="h-4 w-4" />
                </button>
            )}
            {onShare && (
                <button
                    onClick={onShare}
                    disabled={shareBusy}
                    className="rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-slate-800"
                    title={shareHint || 'Share chat link'}
                >
                    <Link2 className="h-4 w-4" />
                </button>
            )}
            {onUnshare && shareActive && (
                <button
                    onClick={onUnshare}
                    disabled={unshareBusy}
                    className="rounded-md p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-900/25"
                    title="Revoke share link"
                >
                    <Unlink2 className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
