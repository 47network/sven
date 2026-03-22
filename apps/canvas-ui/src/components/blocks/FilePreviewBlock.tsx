'use client';

import Link from 'next/link';
import { File, FileText, FileImage, FileAudio, Download } from 'lucide-react';
import { fileSize } from '@/lib/utils';

interface FilePreviewBlockProps {
  content: {
    artifact_id?: string;
    name?: string;
    mime_type?: string;
    size_bytes?: number;
    preview_text?: string;
    download_url?: string;
  };
  metadata?: Record<string, unknown>;
}

function getFileIcon(mime?: string) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return FileImage;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) return FileText;
  return File;
}

export function FilePreviewBlock({ content }: FilePreviewBlockProps) {
  const {
    artifact_id,
    name = 'file',
    mime_type,
    size_bytes,
    preview_text,
    download_url,
  } = content || {};

  const Icon = getFileIcon(mime_type);
  const detailsHref = artifact_id ? `/artifacts/${artifact_id}` : '';
  const downloadHref = download_url || (artifact_id ? `/api/v1/artifacts/${artifact_id}/download` : '');

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className="h-5 w-5 text-[var(--fg-muted)] shrink-0" />
        <div className="flex-1 min-w-0">
          {detailsHref ? (
            <Link href={detailsHref} className="text-sm font-medium hover:text-brand-600 truncate block">
              {name}
            </Link>
          ) : (
            <span className="text-sm font-medium truncate block">{name}</span>
          )}
          <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            {mime_type && <span>{mime_type}</span>}
            {size_bytes != null && <span>• {fileSize(size_bytes)}</span>}
          </div>
        </div>
        {downloadHref && (
          <a
            href={downloadHref}
            className="rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>

      {preview_text && (
        <div className="border-t border-[var(--border)] px-4 py-2">
          <pre className="text-xs text-[var(--fg-muted)] overflow-x-auto whitespace-pre-wrap max-h-40 font-mono">
            {preview_text}
          </pre>
        </div>
      )}
    </div>
  );
}
