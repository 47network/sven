'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useArtifact } from '@/lib/hooks';
import { PageSpinner } from '@/components/Spinner';
import { FileText, Download, Lock, Copy, ExternalLink } from 'lucide-react';
import { formatDate, fileSize } from '@/lib/utils';
import { toast } from 'sonner';

export default function ArtifactPage() {
  const { id } = useParams<{ id: string }>();
  const { data: artifact, isLoading } = useArtifact(id);
  const [textPreview, setTextPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewIsJson, setPreviewIsJson] = useState(false);
  const [previewIsTruncated, setPreviewIsTruncated] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const mimeType = String(artifact?.mime_type || '');
  const isImage = mimeType.startsWith('image/');
  const isAudio = mimeType.startsWith('audio/');
  const isText = mimeType.startsWith('text/') || mimeType.includes('json');

  useEffect(() => {
    if (!artifact || !isText) {
      setTextPreview('');
      setPreviewError('');
      setPreviewLoading(false);
      setPreviewIsJson(false);
      setPreviewIsTruncated(false);
      setShowFullPreview(false);
      return;
    }
    if ((Number(artifact.size_bytes) || 0) > 512000) {
      setTextPreview('');
      setPreviewError('Preview disabled for files larger than 500KB.');
      setPreviewLoading(false);
      setPreviewIsJson(false);
      setPreviewIsTruncated(false);
      setShowFullPreview(false);
      return;
    }

    let canceled = false;
    setPreviewLoading(true);
    setPreviewError('');
    fetch(`/api/v1/artifacts/${encodeURIComponent(String(artifact.id || ''))}/download`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Preview failed (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (canceled) return;
        const likelyJson = mimeType.includes('json') || String(artifact.name || '').toLowerCase().endsWith('.json');
        let normalized = text;
        let formattedAsJson = false;
        if (likelyJson) {
          try {
            normalized = `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
            formattedAsJson = true;
          } catch {
            formattedAsJson = false;
          }
        }
        setPreviewIsJson(formattedAsJson);
        setPreviewIsTruncated(normalized.length > 20000);
        setShowFullPreview(false);
        setTextPreview(normalized);
      })
      .catch((error: unknown) => {
        if (canceled) return;
        setPreviewError(error instanceof Error ? error.message : 'Text preview failed');
        setPreviewIsJson(false);
        setPreviewIsTruncated(false);
        setShowFullPreview(false);
      })
      .finally(() => {
        if (!canceled) setPreviewLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [artifact, isText, mimeType]);

  const visibleTextPreview = previewIsTruncated && !showFullPreview
    ? `${textPreview.slice(0, 20000)}\n\n…(preview truncated)…`
    : textPreview;

  async function copyPreview() {
    if (!visibleTextPreview.trim()) {
      toast.error('Nothing to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(visibleTextPreview);
      toast.success('Preview copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <PageSpinner />
      </AppShell>
    );
  }

  if (!artifact) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <p className="text-[var(--fg-muted)]">Artifact not found</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950">
            <FileText className="h-6 w-6 text-brand-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{artifact.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-[var(--fg-muted)]">
              <span>{artifact.mime_type}</span>
              <span>•</span>
              <span>{fileSize(artifact.size_bytes)}</span>
              {artifact.is_private && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <Lock className="h-3.5 w-3.5" /> Private
                  </span>
                </>
              )}
            </div>
          </div>
          <a
            href={`/api/v1/artifacts/${artifact.id}/download`}
            className="btn btn-secondary"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>

        {/* Metadata */}
        <div className="card">
          <h3 className="text-sm font-medium mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--fg-muted)]">Created</span>
              <p className="font-medium">{formatDate(artifact.created_at)}</p>
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">Chat ID</span>
              <p className="font-mono text-xs flex flex-wrap items-center gap-2">
                <Link href={`/c/${artifact.chat_id}`} className="text-brand-600 hover:underline">
                  {artifact.chat_id}
                </Link>
                {artifact.message_id && (
                  <Link
                    href={`/c/${artifact.chat_id}?m=${encodeURIComponent(String(artifact.message_id || ''))}`}
                    className="inline-flex items-center gap-1 rounded border border-cyan-300/30 px-1.5 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-900/20"
                  >
                    Context
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </p>
            </div>
            {artifact.tool_run_id && (
              <div>
                <span className="text-[var(--fg-muted)]">Tool Run</span>
                <p>
                  <Link href={`/runs/${artifact.tool_run_id}`} className="text-brand-600 hover:underline text-xs font-mono">
                    {artifact.tool_run_id}
                  </Link>
                </p>
              </div>
            )}
            {artifact.enc_alg && (
              <div>
                <span className="text-[var(--fg-muted)]">Encryption</span>
                <p className="font-medium">{artifact.enc_alg} (key: {artifact.enc_kid})</p>
              </div>
            )}
            {artifact.ciphertext_sha256 && (
              <div className="col-span-2">
                <span className="text-[var(--fg-muted)]">SHA-256</span>
                <p className="font-mono text-xs break-all">{artifact.ciphertext_sha256}</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        {isImage && (
          <div className="card p-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/v1/artifacts/${artifact.id}/download`}
              alt={artifact.name}
              className="w-full max-h-[600px] object-contain bg-slate-50 dark:bg-slate-900"
            />
          </div>
        )}

        {isAudio && (
          <div className="card">
            <audio controls className="w-full" preload="metadata">
              <source src={`/api/v1/artifacts/${artifact.id}/download`} />
            </audio>
          </div>
        )}

        {isText && (
          <div className="card">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">
                Text Preview {previewIsJson ? '(JSON formatted)' : ''}
              </h3>
              <div className="flex items-center gap-2">
                {previewIsTruncated && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setShowFullPreview((prev) => !prev)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {showFullPreview ? 'Collapse' : 'Show full'}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void copyPreview()}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
            </div>
            {previewLoading ? (
              <p className="text-sm text-[var(--fg-muted)]">Loading preview…</p>
            ) : previewError ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">{previewError}</p>
            ) : (
              <pre className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto">
                {visibleTextPreview || '(Empty file)'}
              </pre>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
