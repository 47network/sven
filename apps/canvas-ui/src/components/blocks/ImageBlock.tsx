'use client';

interface ImageBlockProps {
  content: {
    src?: string;
    alt?: string;
    caption?: string;
    artifact_id?: string;
  } | string;
  metadata?: Record<string, unknown>;
}

export function ImageBlock({ content }: ImageBlockProps) {
  let src: string;
  let alt: string;
  let caption: string | undefined;

  if (typeof content === 'string') {
    src = content;
    alt = 'Image';
  } else {
    src = content?.src || (content?.artifact_id ? `/api/v1/artifacts/${content.artifact_id}/download` : '');
    alt = content?.alt || 'Image';
    caption = content?.caption;
  }

  if (!src) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4 text-center text-sm text-[var(--fg-muted)]">
        Image unavailable
      </div>
    );
  }

  return (
    <figure className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full max-h-96 object-contain bg-slate-50 dark:bg-slate-900" />
      {caption && (
        <figcaption className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--fg-muted)] text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
