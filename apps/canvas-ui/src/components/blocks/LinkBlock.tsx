'use client';

import { ExternalLink, Globe } from 'lucide-react';

interface LinkBlockProps {
  content: {
    url?: string;
    title?: string;
    description?: string;
    favicon?: string;
    image?: string;
  } | string;
  metadata?: Record<string, unknown>;
}

export function LinkBlock({ content }: LinkBlockProps) {
  let url: string;
  let title: string | undefined;
  let description: string | undefined;
  let favicon: string | undefined;
  let image: string | undefined;

  if (typeof content === 'string') {
    url = content;
    title = content;
  } else {
    url = content?.url || '#';
    title = content?.title || content?.url;
    description = content?.description;
    favicon = content?.favicon;
    image = content?.image;
  }

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (err) {
    void err;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex rounded-lg border border-[var(--border)] overflow-hidden hover:border-brand-400 transition-colors"
    >
      <div className="flex-1 p-3 space-y-1">
        <div className="flex items-center gap-2">
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" className="h-4 w-4 rounded" />
          ) : (
            <Globe className="h-4 w-4 text-[var(--fg-muted)]" />
          )}
          <span className="text-xs text-[var(--fg-muted)]">{hostname}</span>
        </div>
        <h4 className="text-sm font-medium group-hover:text-brand-600">{title}</h4>
        {description && (
          <p className="text-xs text-[var(--fg-muted)] line-clamp-2">{description}</p>
        )}
      </div>
      {image && (
        <div className="w-24 shrink-0 bg-slate-50 dark:bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-center px-3">
        <ExternalLink className="h-4 w-4 text-[var(--fg-muted)] group-hover:text-brand-600" />
      </div>
    </a>
  );
}
