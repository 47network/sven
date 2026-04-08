/**
 * Concurrent tool executor with safety classification.
 *
 * Tools declare themselves as concurrent-safe or exclusive.
 * Concurrent-safe tools run in parallel; exclusive tools get sole access.
 * If any tool in a parallel batch errors, sibling tools are cancelled.
 *
 * Prior art: Thread pool executors (Java ExecutorService), Go goroutine
 * scheduling, work-stealing queues, async semaphores.
 */

import { createLogger, type Logger } from './logger.js';

export type ToolSafetyClass = 'concurrent' | 'exclusive';

export type ToolExecStatus = 'queued' | 'executing' | 'completed' | 'cancelled' | 'error';

export interface ToolExecRequest<TInput = unknown, TOutput = unknown> {
  /** Unique execution ID */
  id: string;
  /** Tool name */
  toolName: string;
  /** Tool input */
  input: TInput;
  /** Whether this tool is safe to run concurrently */
  safetyClass: ToolSafetyClass;
  /** The execution function */
  execute: (input: TInput, signal: AbortSignal) => Promise<TOutput>;
}

export interface ToolExecResult<TOutput = unknown> {
  id: string;
  toolName: string;
  status: 'success' | 'error' | 'cancelled';
  output?: TOutput;
  error?: string;
  durationMs: number;
}

interface TrackedExecution<TOutput = unknown> {
  request: ToolExecRequest<unknown, TOutput>;
  status: ToolExecStatus;
  promise?: Promise<void>;
  result?: ToolExecResult<TOutput>;
  abort: AbortController;
  startedAt?: number;
}

/**
 * Execute a batch of tool requests with concurrency control.
 *
 * - Concurrent-safe tools execute in parallel
 * - Exclusive tools execute alone
 * - If any concurrent tool errors, sibling concurrent tools are aborted
 * - Results are returned in submission order
 *
 * @param requests - Tool execution requests (ordered)
 * @param onProgress - Optional callback for real-time progress
 * @returns Results in the same order as requests
 */
export async function executeToolBatch<TOutput = unknown>(
  requests: ToolExecRequest<unknown, TOutput>[],
  onProgress?: (id: string, status: ToolExecStatus) => void,
): Promise<ToolExecResult<TOutput>[]> {
  const logger = createLogger('tool-executor');

  if (requests.length === 0) return [];

  // Single tool — fast path
  if (requests.length === 1) {
    const req = requests[0]!;
    const result = await executeSingle(req, logger);
    return [result];
  }

  // Group into runs: consecutive concurrent-safe tools form a batch;
  // each exclusive tool is its own batch.
  const batches: ToolExecRequest<unknown, TOutput>[][] = [];
  let currentBatch: ToolExecRequest<unknown, TOutput>[] = [];

  for (const req of requests) {
    if (req.safetyClass === 'exclusive') {
      // Flush any pending concurrent batch
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      // Exclusive tool is its own batch
      batches.push([req]);
    } else {
      currentBatch.push(req);
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Execute batches sequentially; tools within a concurrent batch in parallel.
  const allResults: ToolExecResult<TOutput>[] = [];

  for (const batch of batches) {
    if (batch.length === 1) {
      const result = await executeSingle(batch[0]!, logger);
      onProgress?.(batch[0]!.id, 'completed');
      allResults.push(result);
    } else {
      // Concurrent batch — run all in parallel with sibling abort
      const batchAbort = new AbortController();
      const tracked: TrackedExecution<TOutput>[] = batch.map((req) => ({
        request: req,
        status: 'queued' as ToolExecStatus,
        abort: new AbortController(),
      }));

      // Wire sibling abort: if batchAbort fires, all individual aborts fire
      batchAbort.signal.addEventListener('abort', () => {
        for (const t of tracked) {
          if (t.status === 'executing') {
            t.abort.abort();
          }
        }
      });

      const promises = tracked.map(async (t) => {
        t.status = 'executing';
        t.startedAt = Date.now();
        onProgress?.(t.request.id, 'executing');

        try {
          const output = await t.request.execute(t.request.input, t.abort.signal);
          t.result = {
            id: t.request.id,
            toolName: t.request.toolName,
            status: 'success',
            output,
            durationMs: Date.now() - t.startedAt,
          };
          t.status = 'completed';
          onProgress?.(t.request.id, 'completed');
        } catch (err: any) {
          const durationMs = Date.now() - (t.startedAt || Date.now());
          if (t.abort.signal.aborted) {
            t.result = {
              id: t.request.id,
              toolName: t.request.toolName,
              status: 'cancelled',
              error: 'Cancelled: sibling tool errored',
              durationMs,
            };
            t.status = 'cancelled';
            onProgress?.(t.request.id, 'cancelled');
          } else {
            t.result = {
              id: t.request.id,
              toolName: t.request.toolName,
              status: 'error',
              error: err.message || String(err),
              durationMs,
            };
            t.status = 'error';
            onProgress?.(t.request.id, 'error');
            // Abort siblings
            logger.warn('Tool error, aborting siblings', {
              toolName: t.request.toolName,
              error: err.message,
            });
            batchAbort.abort();
          }
        }
      });

      await Promise.allSettled(promises);

      // Collect results in order
      for (const t of tracked) {
        allResults.push(
          t.result || {
            id: t.request.id,
            toolName: t.request.toolName,
            status: 'cancelled',
            error: 'Never started',
            durationMs: 0,
          },
        );
      }
    }
  }

  return allResults;
}

async function executeSingle<TOutput>(
  req: ToolExecRequest<unknown, TOutput>,
  logger: Logger,
): Promise<ToolExecResult<TOutput>> {
  const abort = new AbortController();
  const startedAt = Date.now();
  try {
    const output = await req.execute(req.input, abort.signal);
    return {
      id: req.id,
      toolName: req.toolName,
      status: 'success',
      output,
      durationMs: Date.now() - startedAt,
    };
  } catch (err: any) {
    logger.error('Tool execution failed', {
      toolName: req.toolName,
      error: err.message,
    });
    return {
      id: req.id,
      toolName: req.toolName,
      status: 'error',
      error: err.message || String(err),
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Classify a tool as concurrent-safe or exclusive based on its properties.
 *
 * Read-only tools (fetch, search, query) are concurrent-safe.
 * Write tools (shell, file write, deployment) are exclusive.
 */
export function classifyToolSafety(
  toolName: string,
  executionMode: string,
  permissions: string[],
): ToolSafetyClass {
  // Exclusive: any tool with write permissions or shell access
  const hasWrite = permissions.some(
    (p) => p.endsWith('.write') || p.endsWith('.execute') || p.endsWith('.control'),
  );
  if (hasWrite) return 'exclusive';

  // Exclusive: shell/container execution (side effects)
  if (toolName.startsWith('native.shell')) return 'exclusive';
  if (executionMode === 'container' || executionMode === 'gvisor') return 'exclusive';

  // Concurrent: read-only operations
  if (toolName.startsWith('web.fetch') || toolName.startsWith('web.search')) return 'concurrent';
  if (toolName.startsWith('rag.')) return 'concurrent';
  if (toolName.startsWith('native.fs.read') || toolName.startsWith('native.fs.list')) return 'concurrent';

  // Default: conservative — exclusive
  return 'exclusive';
}
