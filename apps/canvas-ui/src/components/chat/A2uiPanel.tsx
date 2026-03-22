'use client';

import React from 'react';

type Props = {
    html: string;
    onInteract: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export default function A2uiPanel({ html, onInteract }: Props) {
    if (!html) return null;

    return (
        <div className="premium-panel p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Live Canvas UI
            </div>
            <div
                onClick={onInteract}
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
