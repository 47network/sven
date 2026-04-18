'use client';

import { ChevronDown, ChevronUp, X } from 'lucide-react';

type Props = {
    query: string;
    resultCount: number;
    activeIndex?: number;
    onChange: (q: string) => void;
    onNext?: () => void;
    onPrev?: () => void;
    onClose?: () => void;
};

export default function ChatSearchBar({
    query,
    resultCount,
    activeIndex = 0,
    onChange,
    onNext,
    onPrev,
    onClose,
}: Props) {
    return (
        <div className="mx-3 mt-3 rounded-xl border border-[var(--border)] px-4 py-2">
            <div className="flex items-center gap-2">
                <input
                    className="input w-full"
                    placeholder="Search in this chat…"
                    value={query}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (e.shiftKey) {
                                onPrev?.();
                            } else {
                                onNext?.();
                            }
                        }
                        if (e.key === 'Escape') {
                            onClose?.();
                        }
                    }}
                    autoFocus
                />
                <button
                    type="button"
                    className="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Previous match (Shift+Enter)"
                    aria-label="Previous match"
                    onClick={onPrev}
                    disabled={resultCount === 0}
                >
                    <ChevronUp className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Next match (Enter)"
                    aria-label="Next match"
                    onClick={onNext}
                    disabled={resultCount === 0}
                >
                    <ChevronDown className="h-4 w-4" />
                </button>
                {onClose && (
                    <button
                        type="button"
                        className="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Close search"
                        aria-label="Close search"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            {query && (
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    {resultCount > 0 ? `${activeIndex + 1}/${resultCount}` : '0'} result{resultCount !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}
