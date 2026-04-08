/**
 * Background session — async task session management.
 *
 * Manages detached task execution with progress tracking, result
 * collection, and graceful cancellation. Provides the infrastructure
 * for "fire and forget" agent tasks that run independently.
 *
 * Features:
 * - Submit async tasks with timeout and progress callbacks
 * - Cancel running tasks with graceful abort
 * - Track progress (0-100) with real-time updates
 * - Collect results and errors
 * - Session scoping (tasks belong to parent sessions)
 * - Automatic cleanup of completed tasks
 * - Queue management with concurrency limits
 *
 * Prior art: Web Workers, Java ExecutorService, Python asyncio.TaskGroup,
 * Go goroutine pools, Celery task queues, Bull/BullMQ job queues,
 * background job processing (Sidekiq, Resque).
 */

import { createLogger } from './logger.js';
import { generateTaskId } from './task-id.js';

const log = createLogger('background-session');

// ── Types ─────────────────────────────────────────────────────────

export type BackgroundTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface BackgroundTask<T = unknown> {
  /** Unique task ID. */
  id: string;
  /** Task type/label. */
  type: string;
  /** Current status. */
  status: BackgroundTaskStatus;
  /** Progress 0–100. */
  progress: number;
  /** Result on completion. */
  result?: T;
  /** Error message on failure. */
  error?: string;
  /** When the task was submitted. */
  submittedAt: Date;
  /** When execution started. */
  startedAt?: Date;
  /** When execution completed/failed/cancelled. */
  completedAt?: Date;
  /** Parent session that spawned this task. */
  parentSessionId: string;
  /** Timeout in milliseconds. */
  timeoutMs: number;
}

export interface SubmitOptions {
  /** Task type/label for categorization. */
  type: string;
  /** Timeout in ms. Default 1800000 (30 min). */
  timeoutMs?: number;
  /** Parent session ID. */
  parentSessionId: string;
}

export interface BackgroundSessionConfig {
  /** Max concurrent running tasks. Default 4. */
  maxConcurrent: number;
  /** Max tasks in queue. Default 100. */
  maxQueueSize: number;
  /** Default timeout per task in ms. Default 1800000 (30 min). */
  defaultTimeoutMs: number;
  /** Cleanup completed tasks older than this (ms). Default 3600000 (1h). */
  cleanupAfterMs: number;
}

export interface SessionStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  timeout: number;
  total: number;
}

// ── Default config ────────────────────────────────────────────────

const DEFAULT_CONFIG: BackgroundSessionConfig = {
  maxConcurrent: 4,
  maxQueueSize: 100,
  defaultTimeoutMs: 30 * 60 * 1000,    // 30 minutes
  cleanupAfterMs: 60 * 60 * 1000,      // 1 hour
};

// ── Internal task wrapper ─────────────────────────────────────────

interface TaskEntry<T = unknown> {
  task: BackgroundTask<T>;
  fn: (report: (progress: number) => void) => Promise<T>;
  abortController: AbortController;
  progressListeners: Set<(progress: number) => void>;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

// ── BackgroundSessionManager ──────────────────────────────────────

export class BackgroundSessionManager {
  private readonly config: BackgroundSessionConfig;
  private readonly tasks: Map<string, TaskEntry> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<BackgroundSessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Periodic cleanup
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      Math.min(this.config.cleanupAfterMs, 600_000), // at most every 10 min
    );
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Submit a task for background execution.
   * Returns the task ID immediately.
   */
  submit<T>(
    fn: (report: (progress: number) => void) => Promise<T>,
    options: SubmitOptions,
  ): string {
    // Check queue capacity
    const queuedCount = this.countByStatus('queued');
    if (queuedCount >= this.config.maxQueueSize) {
      throw new Error(`Background queue full (${this.config.maxQueueSize})`);
    }

    const id = generateTaskId('workflow_run');
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

    const task: BackgroundTask<T> = {
      id,
      type: options.type,
      status: 'queued',
      progress: 0,
      submittedAt: new Date(),
      parentSessionId: options.parentSessionId,
      timeoutMs,
    };

    const entry: TaskEntry<T> = {
      task,
      fn,
      abortController: new AbortController(),
      progressListeners: new Set(),
    };

    this.tasks.set(id, entry as TaskEntry);

    log.info('Task submitted', {
      id,
      type: options.type,
      parentSession: options.parentSessionId,
      timeoutMs,
    });

    // Try to run immediately if capacity allows
    this.drainQueue();

    return id;
  }

  /**
   * Cancel a task. If running, signals abort. If queued, removes it.
   */
  cancel(taskId: string): boolean {
    const entry = this.tasks.get(taskId);
    if (!entry) return false;

    if (entry.task.status === 'queued') {
      entry.task.status = 'cancelled';
      entry.task.completedAt = new Date();
      log.info('Queued task cancelled', { id: taskId });
      return true;
    }

    if (entry.task.status === 'running') {
      entry.abortController.abort();
      entry.task.status = 'cancelled';
      entry.task.completedAt = new Date();
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      log.info('Running task cancelled', { id: taskId });
      this.drainQueue();
      return true;
    }

    return false; // already completed/failed/cancelled
  }

  /**
   * Get the status of a task.
   */
  getStatus<T = unknown>(taskId: string): BackgroundTask<T> | undefined {
    const entry = this.tasks.get(taskId);
    return entry?.task as BackgroundTask<T> | undefined;
  }

  /**
   * Get all tasks, optionally filtered.
   */
  getAll(filters?: {
    status?: BackgroundTaskStatus;
    parentSessionId?: string;
    type?: string;
  }): BackgroundTask[] {
    let results = [...this.tasks.values()].map((e) => e.task);

    if (filters?.status) {
      results = results.filter((t) => t.status === filters.status);
    }
    if (filters?.parentSessionId) {
      results = results.filter((t) => t.parentSessionId === filters.parentSessionId);
    }
    if (filters?.type) {
      results = results.filter((t) => t.type === filters.type);
    }

    return results;
  }

  /**
   * Subscribe to progress updates for a task.
   * Returns an unsubscribe function.
   */
  onProgress(taskId: string, callback: (progress: number) => void): () => void {
    const entry = this.tasks.get(taskId);
    if (!entry) return () => {};

    entry.progressListeners.add(callback);
    return () => entry.progressListeners.delete(callback);
  }

  /**
   * Wait for a task to complete. Returns the result or throws on failure.
   */
  async waitFor<T = unknown>(taskId: string, pollIntervalMs = 500): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const check = (): void => {
        const entry = this.tasks.get(taskId);
        if (!entry) {
          reject(new Error(`Task ${taskId} not found`));
          return;
        }

        switch (entry.task.status) {
          case 'completed':
            resolve(entry.task.result as T);
            return;
          case 'failed':
            reject(new Error(entry.task.error ?? 'Task failed'));
            return;
          case 'cancelled':
            reject(new Error('Task was cancelled'));
            return;
          case 'timeout':
            reject(new Error('Task timed out'));
            return;
          default:
            setTimeout(check, pollIntervalMs);
        }
      };
      check();
    });
  }

  /**
   * Get aggregate stats.
   */
  getStats(): SessionStats {
    const stats: SessionStats = {
      queued: 0, running: 0, completed: 0,
      failed: 0, cancelled: 0, timeout: 0, total: 0,
    };
    for (const entry of this.tasks.values()) {
      stats[entry.task.status]++;
      stats.total++;
    }
    return stats;
  }

  /**
   * Clean up completed/failed/cancelled tasks older than cleanupAfterMs.
   */
  cleanup(olderThanMs?: number): number {
    const threshold = olderThanMs ?? this.config.cleanupAfterMs;
    const cutoff = Date.now() - threshold;
    let cleaned = 0;

    for (const [id, entry] of this.tasks) {
      const isDone = ['completed', 'failed', 'cancelled', 'timeout'].includes(entry.task.status);
      const completedAt = entry.task.completedAt?.getTime() ?? 0;
      if (isDone && completedAt < cutoff) {
        this.tasks.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info('Background tasks cleaned up', { cleaned, remaining: this.tasks.size });
    }

    return cleaned;
  }

  /**
   * Shut down the manager. Cancels all running tasks.
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    for (const [id, entry] of this.tasks) {
      if (entry.task.status === 'running' || entry.task.status === 'queued') {
        entry.abortController.abort();
        entry.task.status = 'cancelled';
        entry.task.completedAt = new Date();
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      }
    }

    log.info('Background session manager shut down', { totalTasks: this.tasks.size });
  }

  /** Active task count (queued + running). */
  get activeCount(): number {
    return this.countByStatus('queued') + this.countByStatus('running');
  }

  // ── Private helpers ───────────────────────────────────────────

  private countByStatus(status: BackgroundTaskStatus): number {
    let count = 0;
    for (const entry of this.tasks.values()) {
      if (entry.task.status === status) count++;
    }
    return count;
  }

  private drainQueue(): void {
    const running = this.countByStatus('running');
    const available = this.config.maxConcurrent - running;
    if (available <= 0) return;

    let started = 0;
    for (const entry of this.tasks.values()) {
      if (started >= available) break;
      if (entry.task.status !== 'queued') continue;

      this.executeTask(entry);
      started++;
    }
  }

  private executeTask(entry: TaskEntry): void {
    entry.task.status = 'running';
    entry.task.startedAt = new Date();

    const reportProgress = (progress: number): void => {
      entry.task.progress = Math.max(0, Math.min(100, progress));
      for (const listener of entry.progressListeners) {
        try { listener(entry.task.progress); } catch { /* ignore listener errors */ }
      }
    };

    // Set timeout
    entry.timeoutHandle = setTimeout(() => {
      if (entry.task.status === 'running') {
        entry.abortController.abort();
        entry.task.status = 'timeout';
        entry.task.error = `Task timed out after ${entry.task.timeoutMs}ms`;
        entry.task.completedAt = new Date();
        log.warn('Task timed out', {
          id: entry.task.id,
          type: entry.task.type,
          timeoutMs: entry.task.timeoutMs,
        });
        this.drainQueue();
      }
    }, entry.task.timeoutMs);

    // Execute
    entry.fn(reportProgress)
      .then((result) => {
        if (entry.task.status !== 'running') return; // cancelled/timed out
        entry.task.status = 'completed';
        entry.task.result = result;
        entry.task.progress = 100;
        entry.task.completedAt = new Date();
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);

        log.info('Task completed', {
          id: entry.task.id,
          type: entry.task.type,
          durationMs: entry.task.completedAt.getTime() - (entry.task.startedAt?.getTime() ?? 0),
        });

        this.drainQueue();
      })
      .catch((err: unknown) => {
        if (entry.task.status !== 'running') return; // cancelled/timed out
        const message = err instanceof Error ? err.message : String(err);
        entry.task.status = 'failed';
        entry.task.error = message;
        entry.task.completedAt = new Date();
        if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);

        log.error('Task failed', {
          id: entry.task.id,
          type: entry.task.type,
          error: message,
        });

        this.drainQueue();
      });
  }
}
