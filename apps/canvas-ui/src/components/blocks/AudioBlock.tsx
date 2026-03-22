'use client';

import { Volume2 } from 'lucide-react';

interface AudioBlockProps {
  content: {
    src?: string;
    artifact_id?: string;
    duration_s?: number;
    transcript?: string;
  } | string;
  metadata?: Record<string, unknown>;
}

export function AudioBlock({ content }: AudioBlockProps) {
  let src: string;
  let transcript: string | undefined;
  let duration_s: number | undefined;

  if (typeof content === 'string') {
    src = content;
  } else {
    src = content?.src || (content?.artifact_id ? `/api/v1/artifacts/${content.artifact_id}/download` : '');
    transcript = content?.transcript;
    duration_s = content?.duration_s;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-[var(--fg-muted)]" />
        <span className="text-sm font-medium">Audio</span>
        {duration_s != null && (
          <span className="text-xs text-[var(--fg-muted)]">
            {Math.floor(duration_s / 60)}:{String(Math.floor(duration_s % 60)).padStart(2, '0')}
          </span>
        )}
      </div>

      {src ? (
        <audio controls className="w-full" preload="metadata">
          <source src={src} />
        </audio>
      ) : (
        <div className="text-sm text-[var(--fg-muted)]">Audio unavailable</div>
      )}

      {transcript && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-[var(--fg-muted)]">
            Transcript
          </summary>
          <p className="mt-1 text-sm text-[var(--fg-muted)] leading-relaxed">{transcript}</p>
        </details>
      )}
    </div>
  );
}
