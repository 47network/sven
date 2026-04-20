/**
 * Coordinator multi-agent mode.
 *
 * Manages fan-out of subtasks to worker agents, aggregates results,
 * and maintains a shared scratchpad for inter-agent communication.
 * Uses NATS for task distribution when available, or direct dispatch.
 *
 * Prior art: MapReduce (2004), Actor model (1973), Apache Spark
 * task scheduling, Kubernetes Job controller, Celery canvas groups.
 */

import { createLogger } from './logger.js';
import { generateTaskId } from './task-id.js';

const logger = createLogger('coordinator');

// ──── Types ──────────────────────────────────────────────────────

export type CoordinatorTaskStatus =
  | 'pending'
  | 'dispatched'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface CoordinatorTask {
  /** Unique task identifier (type-prefixed) */
  taskId: string;
  /** Parent coordinator session that spawned this task */
  coordinatorSessionId: string;
  /** Index within the fan-out batch */
  index: number;
  /** What the worker should do */
  instruction: string;
  /** Optional context/data the worker needs */
  context?: Record<string, unknown>;
  /** Which agent/model should handle this */
  targetAgent?: string;
  /** Current status */
  status: CoordinatorTaskStatus;
  /** Worker result when completed */
  result?: string;
  /** Error message if failed */
  error?: string;
  /** When the task was created */
  createdAt: number;
  /** When the task last changed status */
  updatedAt: number;
  /** Deadline timestamp (ms) */
  deadline: number;
}

export interface CoordinatorConfig {
  /** Maximum number of concurrent workers */
  maxConcurrentWorkers: number;
  /** Default task deadline in milliseconds */
  defaultDeadlineMs: number;
  /** Maximum scratchpad entries to retain */
  maxScratchpadEntries: number;
  /** Whether to cancel remaining tasks on first failure */
  failFast: boolean;
  /** Callback to dispatch a task to a worker */
  dispatchFn: (task: CoordinatorTask) => Promise<string>;
}

export interface ScratchpadEntry {
  /** Which task wrote this entry */
  taskId: string;
  /** Entry key (for structured lookups) */
  key: string;
  /** The value */
  value: string;
  /** When this was written */
  writtenAt: number;
}

export interface CoordinatorSessionStatus {
  sessionId: string;
  totalTasks: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  cancelled: number;
  timedOut: number;
  isFinished: boolean;
  scratchpadSize: number;
}

// ──── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<CoordinatorConfig, 'dispatchFn'> = {
  maxConcurrentWorkers: 4,
  defaultDeadlineMs: 120_000, // 2 minutes
  maxScratchpadEntries: 200,
  failFast: false,
};

// ──── Coordinator Session ────────────────────────────────────────

/**
 * CoordinatorSession manages a set of fan-out tasks for a single
 * coordination request. It tracks task lifecycle, enforces deadlines,
 * and provides a shared scratchpad for inter-task data exchange.
 */
export class CoordinatorSession {
  readonly sessionId: string;
  private tasks: Map<string, CoordinatorTask> = new Map();
  private runningCount = 0;
  private scratchpad: ScratchpadEntry[] = [];
  private config: CoordinatorConfig;
  private deadlineTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private aborted = false;

  constructor(config: Partial<CoordinatorConfig> & Pick<CoordinatorConfig, 'dispatchFn'>) {
    this.sessionId = generateTaskId('coordinator_task');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fan out multiple instructions as parallel tasks.
   * Returns when all tasks are dispatched (not completed).
   */
  async fanOut(
    instructions: Array<{
      instruction: string;
      context?: Record<string, unknown>;
      targetAgent?: string;
      deadlineMs?: number;
    }>,
  ): Promise<CoordinatorTask[]> {
    if (this.aborted) {
      throw new Error('Coordinator session has been aborted');
    }

    const tasks: CoordinatorTask[] = instructions.map((inst, i) => ({
      taskId: generateTaskId('coordinator_task'),
      coordinatorSessionId: this.sessionId,
      index: i,
      instruction: inst.instruction,
      context: inst.context,
      targetAgent: inst.targetAgent,
      status: 'pending' as CoordinatorTaskStatus,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deadline: Date.now() + (inst.deadlineMs ?? this.config.defaultDeadlineMs),
    }));

    for (const task of tasks) {
      this.tasks.set(task.taskId, task);
    }

    // Dispatch up to maxConcurrentWorkers at a time
    const pending = [...tasks];
    const dispatching: Promise<void>[] = [];

    while (pending.length > 0 && !this.aborted) {
      const slotsAvailable = this.config.maxConcurrentWorkers - this.runningCount;
      if (slotsAvailable <= 0) break;

      const batch = pending.splice(0, slotsAvailable);

      for (const task of batch) {
        dispatching.push(this.dispatchTask(task));
      }
    }

    await Promise.allSettled(dispatching);

    logger.info('Fan-out dispatched', {
      sessionId: this.sessionId,
      totalTasks: tasks.length,
      dispatched: dispatching.length,
    });

    return tasks;
  }

  /**
   * Dispatch a single task to a worker.
   */
  private async dispatchTask(task: CoordinatorTask): Promise<void> {
    try {
      task.status = 'dispatched';
      this.runningCount++;
      task.updatedAt = Date.now();

      // Set deadline timer
      const timeRemaining = task.deadline - Date.now();
      if (timeRemaining > 0) {
        const timer = setTimeout(() => this.handleTimeout(task.taskId), timeRemaining);
        this.deadlineTimers.set(task.taskId, timer);
      }

      const result = await this.config.dispatchFn(task);
      this.completeTask(task.taskId, result);
    } catch (err: any) {
      this.failTask(task.taskId, err.message || 'Dispatch failed');
    }
  }

  /**
   * Report task completion (called by worker or dispatch callback).
   */
  completeTask(taskId: string, result: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'cancelled') return;

    if (task.status === 'dispatched' || task.status === 'running') {
      this.runningCount--;
    }
    task.status = 'completed';
    task.result = result;
    task.updatedAt = Date.now();
    this.clearDeadlineTimer(taskId);

    logger.info('Task completed', { sessionId: this.sessionId, taskId });

    // Dispatch next pending task if any
    this.dispatchNextPending();
  }

  /**
   * Report task failure.
   */
  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'cancelled') return;

    if (task.status === 'dispatched' || task.status === 'running') {
      this.runningCount--;
    }
    task.status = 'failed';
    task.error = error;
    task.updatedAt = Date.now();
    this.clearDeadlineTimer(taskId);

    logger.warn('Task failed', { sessionId: this.sessionId, taskId, error });

    if (this.config.failFast) {
      this.abort('Fail-fast: task ' + taskId + ' failed');
    } else {
      this.dispatchNextPending();
    }
  }

  /**
   * Handle task timeout.
   */
  private handleTimeout(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return;

    if (task.status === 'dispatched' || task.status === 'running') {
      this.runningCount--;
    }
    task.status = 'timed_out';
    task.error = 'Task exceeded deadline';
    task.updatedAt = Date.now();
    this.clearDeadlineTimer(taskId);

    logger.warn('Task timed out', { sessionId: this.sessionId, taskId });
    this.dispatchNextPending();
  }

  /**
   * Dispatch the next pending task if a slot is available.
   */
  private dispatchNextPending(): void {
    if (this.aborted) return;

    if (this.runningCount >= this.config.maxConcurrentWorkers) return;

    let nextPending: CoordinatorTask | undefined;
    for (const t of this.tasks.values()) {
      if (t.status === 'pending') {
        nextPending = t;
        break;
      }
    }
    if (nextPending) {
      this.dispatchTask(nextPending);
    }
  }

  /**
   * Write to the shared scratchpad (inter-task communication).
   */
  writeScratchpad(taskId: string, key: string, value: string): void {
    // Enforce max entries
    while (this.scratchpad.length >= this.config.maxScratchpadEntries) {
      this.scratchpad.shift();
    }

    this.scratchpad.push({
      taskId,
      key,
      value,
      writtenAt: Date.now(),
    });

    logger.debug('Scratchpad write', { sessionId: this.sessionId, taskId, key });
  }

  /**
   * Read from shared scratchpad by key (returns latest entry for key).
   */
  readScratchpad(key: string): ScratchpadEntry | undefined {
    for (let i = this.scratchpad.length - 1; i >= 0; i--) {
      if (this.scratchpad[i].key === key) return this.scratchpad[i];
    }
    return undefined;
  }

  /**
   * Read all scratchpad entries for a key.
   */
  readAllScratchpad(key: string): ScratchpadEntry[] {
    return this.scratchpad.filter((e) => e.key === key);
  }

  /**
   * Cancel all remaining tasks and stop dispatching.
   */
  abort(reason: string): void {
    if (this.aborted) return;
    this.aborted = true;

    for (const [taskId, task] of this.tasks) {
      if (task.status === 'pending' || task.status === 'dispatched' || task.status === 'running') {
        if (task.status === 'dispatched' || task.status === 'running') {
          this.runningCount--;
        }
        task.status = 'cancelled';
        task.error = reason;
        task.updatedAt = Date.now();
        this.clearDeadlineTimer(taskId);
      }
    }

    logger.warn('Coordinator session aborted', { sessionId: this.sessionId, reason });
  }

  /**
   * Get overall session status.
   */
  getStatus(): CoordinatorSessionStatus {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const running = tasks.filter(
      (t) => t.status === 'dispatched' || t.status === 'running',
    ).length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const cancelled = tasks.filter((t) => t.status === 'cancelled').length;
    const timedOut = tasks.filter((t) => t.status === 'timed_out').length;

    return {
      sessionId: this.sessionId,
      totalTasks: tasks.length,
      completed,
      failed,
      running,
      pending,
      cancelled,
      timedOut,
      isFinished: running === 0 && pending === 0,
      scratchpadSize: this.scratchpad.length,
    };
  }

  /**
   * Get all task results (only completed tasks).
   */
  getResults(): Array<{ taskId: string; index: number; result: string }> {
    return Array.from(this.tasks.values())
      .filter((t) => t.status === 'completed' && t.result !== undefined)
      .sort((a, b) => a.index - b.index)
      .map((t) => ({ taskId: t.taskId, index: t.index, result: t.result! }));
  }

  /**
   * Get all tasks.
   */
  getTasks(): CoordinatorTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clean up timers.
   */
  destroy(): void {
    for (const timer of this.deadlineTimers.values()) {
      clearTimeout(timer);
    }
    this.deadlineTimers.clear();
    this.aborted = true;
  }

  private clearDeadlineTimer(taskId: string): void {
    const timer = this.deadlineTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.deadlineTimers.delete(taskId);
    }
  }
}
