'use client';

import { MarkdownBlock } from './MarkdownBlock';
import { TableBlock } from './TableBlock';
import { ChartBlock } from './ChartBlock';
import { CodeBlock } from './CodeBlock';
import { ToolCardBlock } from './ToolCardBlock';
import { FilePreviewBlock } from './FilePreviewBlock';
import { ImageBlock } from './ImageBlock';
import { AudioBlock } from './AudioBlock';
import { LinkBlock } from './LinkBlock';
import { ActionsBlock } from './ActionsBlock';
import { BrainBlock } from './BrainBlock';
import { CouncilBlock } from './CouncilBlock';
import { VideoBlock } from './VideoBlock';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

export interface CanvasBlock {
  type:
    | 'markdown' | 'table' | 'chart' | 'code'
    | 'tool_card' | 'file_preview' | 'image'
    | 'audio' | 'link' | 'actions' | 'brain' | 'council' | 'video';
  content: unknown;
  metadata?: Record<string, unknown>;
}

interface BlockRendererProps {
  block: CanvasBlock;
  chatId?: string;
  messageId?: string;
}

function formatUnknownBlock(block: unknown): string {
  try {
    const text = JSON.stringify(block, null, 2) || '';
    const limit = 20000;
    return text.length > limit ? `${text.slice(0, limit)}\n\n... (truncated)` : text;
  } catch {
    return String(block ?? '');
  }
}

/**
 * Dispatches rendering to the appropriate block component based on type.
 */
export function BlockRenderer({ block, chatId, messageId }: BlockRendererProps) {
  switch (block.type) {
    case 'markdown':
      return <MarkdownBlock content={String(block.content ?? '')} />;
    case 'table':
      return (
        <TableBlock
          content={(
            block.content && typeof block.content === 'object'
              ? block.content
              : {}
          ) as { headers?: string[]; rows?: (string | number)[][] }}
          metadata={block.metadata}
        />
      );
    case 'chart':
      return (
        <ChartBlock
          content={(
            block.content && typeof block.content === 'object'
              ? block.content
              : {}
          ) as {
            chart_type?: 'bar' | 'line' | 'pie';
            data?: Array<Record<string, unknown>>;
            title?: string;
            x_key?: string;
            y_key?: string;
          }}
          metadata={block.metadata}
        />
      );
    case 'code':
      return (
        <CodeBlock
          content={typeof block.content === 'string'
            ? block.content
            : (
              block.content && typeof block.content === 'object'
                ? block.content
                : {}
            ) as { code?: string; language?: string; filename?: string }}
          metadata={block.metadata}
        />
      );
    case 'tool_card':
      return (
        <ToolCardBlock
          content={(
            block.content && typeof block.content === 'object'
              ? block.content
              : {}
          ) as {
            tool_name?: string;
            run_id?: string;
            status?: 'running' | 'success' | 'error' | 'timeout' | 'denied' | 'blocked' | 'executed' | 'pending_approval';
            duration_ms?: number;
            inputs?: Record<string, unknown>;
            outputs?: Record<string, unknown>;
            error?: string;
            created_at?: string;
            approval_id?: string;
          }}
          metadata={block.metadata}
          chatId={chatId}
          messageId={messageId}
        />
      );
    case 'file_preview':
      return (
        <FilePreviewBlock
          content={(
            block.content && typeof block.content === 'object'
              ? block.content
              : {}
          ) as {
            artifact_id?: string;
            name?: string;
            mime_type?: string;
            size_bytes?: number;
            preview_text?: string;
            download_url?: string;
          }}
          metadata={block.metadata}
        />
      );
    case 'image':
      return (
        <ImageBlock
          content={typeof block.content === 'string'
            ? block.content
            : (
              block.content && typeof block.content === 'object'
                ? block.content
                : {}
            ) as { src?: string; alt?: string; caption?: string; artifact_id?: string }}
          metadata={block.metadata}
        />
      );
    case 'audio':
      return (
        <AudioBlock
          content={typeof block.content === 'string'
            ? block.content
            : (
              block.content && typeof block.content === 'object'
                ? block.content
                : {}
            ) as { src?: string; artifact_id?: string; duration_s?: number; transcript?: string }}
          metadata={block.metadata}
        />
      );
    case 'link':
      return (
        <LinkBlock
          content={typeof block.content === 'string'
            ? block.content
            : (
              block.content && typeof block.content === 'object'
                ? block.content
                : {}
            ) as { url?: string; title?: string; description?: string; favicon?: string; image?: string }}
          metadata={block.metadata}
        />
      );
    case 'actions':
      return (
        <ActionsBlock
          content={block.content}
          metadata={block.metadata}
          chatId={chatId}
          messageId={messageId}
        />
      );
    case 'brain':
      return (
        <BrainBlock
          content={block.content as any}
          metadata={block.metadata}
        />
      );
    case 'council':
      return (
        <CouncilBlock
          content={block.content}
          metadata={block.metadata}
        />
      );
    case 'video':
      return (
        <VideoBlock
          content={block.content}
          metadata={block.metadata}
        />
      );
    default:
      {
        const raw = formatUnknownBlock(block);
        const typeLabel = block && typeof block === 'object'
          ? String((block as unknown as { type?: unknown }).type || 'unknown')
          : 'unknown';
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-center justify-between gap-2">
              <div>
                Unknown block type: <code>{typeLabel}</code>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-amber-300/60 px-2 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(raw);
                    toast.success('Block JSON copied');
                  } catch {
                    toast.error('Copy failed');
                  }
                }}
              >
                <Copy className="h-3 w-3" />
                Copy JSON
              </button>
            </div>
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-amber-100/70 p-2 text-xs font-mono text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              {raw}
            </pre>
          </div>
        );
      }
  }
}
