/**
 * File history snapshots — modification tracking with undo support.
 *
 * Tracks file modifications made by agents/tools, records before/after
 * snapshots, and supports rollback. Uses a bounded ring buffer to
 * control memory usage.
 *
 * Prior art: undo/redo stacks (1970s), git object store, VSCode
 * local history, Emacs auto-save, database WAL logs.
 */

import { createLogger } from './logger.js';

const logger = createLogger('file-history');

// ──── Types ──────────────────────────────────────────────────────

export interface FileSnapshot {
  /** Unique snapshot identifier */
  snapshotId: string;
  /** File path (relative to workspace root) */
  filePath: string;
  /** Content before the change (null for new files) */
  beforeContent: string | null;
  /** Content after the change (null for deleted files) */
  afterContent: string | null;
  /** Type of modification */
  operation: FileOperation;
  /** Who made the change */
  actorId: string;
  /** Which tool or operation caused this */
  toolName?: string;
  /** Task ID that triggered this change */
  taskId?: string;
  /** Correlation ID for grouping related changes */
  correlationId?: string;
  /** When the change was made */
  timestamp: number;
  /** Whether this snapshot has been rolled back */
  rolledBack: boolean;
  /** Character count delta */
  charDelta: number;
  /** Line count delta */
  lineDelta: number;
}

export type FileOperation = 'create' | 'modify' | 'delete' | 'rename';

export interface FileHistoryConfig {
  /** Maximum number of snapshots to retain per file */
  maxSnapshotsPerFile: number;
  /** Maximum total snapshots across all files */
  maxTotalSnapshots: number;
  /** Maximum content size to snapshot (bytes). Larger files store hash only */
  maxContentSize: number;
  /** Whether to compute and store diffs instead of full content */
  storeDiffs: boolean;
}

export interface FileHistoryStats {
  totalSnapshots: number;
  filesTracked: number;
  totalCharDelta: number;
  totalLineDelta: number;
  oldestSnapshotAge: number;
  newestSnapshotAge: number;
}

// ──── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: FileHistoryConfig = {
  maxSnapshotsPerFile: 50,
  maxTotalSnapshots: 500,
  maxContentSize: 512 * 1024, // 512KB
  storeDiffs: false,
};

// ──── ID Generation ──────────────────────────────────────────────

let snapshotCounter = 0;

function generateSnapshotId(): string {
  const ts = Date.now().toString(36);
  const seq = (snapshotCounter++).toString(36).padStart(4, '0');
  return `snap-${ts}-${seq}`;
}

// ──── Line/Char Counting ─────────────────────────────────────────

function countLines(content: string | null): number {
  if (!content) return 0;
  return content.split('\n').length;
}

// ──── File History Manager ───────────────────────────────────────

/**
 * FileHistoryManager tracks file modifications made during agent
 * sessions. It records before/after snapshots for undo support
 * and provides audit-trail-style queries.
 */
export class FileHistoryManager {
  /** File path → ordered list of snapshots (oldest first) */
  private snapshots: Map<string, FileSnapshot[]> = new Map();
  private totalCount = 0;
  private config: FileHistoryConfig;

  constructor(config?: Partial<FileHistoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a file modification.
   */
  record(params: {
    filePath: string;
    beforeContent: string | null;
    afterContent: string | null;
    operation: FileOperation;
    actorId: string;
    toolName?: string;
    taskId?: string;
    correlationId?: string;
  }): FileSnapshot {
    const { filePath, beforeContent, afterContent, operation, actorId, toolName, taskId, correlationId } = params;

    // Truncate content if too large
    const safeBefore = beforeContent && beforeContent.length > this.config.maxContentSize
      ? null // Too large to store — log warning
      : beforeContent;
    const safeAfter = afterContent && afterContent.length > this.config.maxContentSize
      ? null
      : afterContent;

    if (
      (beforeContent && beforeContent.length > this.config.maxContentSize) ||
      (afterContent && afterContent.length > this.config.maxContentSize)
    ) {
      logger.warn('File content exceeds snapshot limit, content not stored', {
        filePath,
        beforeSize: beforeContent?.length,
        afterSize: afterContent?.length,
        maxSize: this.config.maxContentSize,
      });
    }

    const charDelta = (safeAfter?.length ?? 0) - (safeBefore?.length ?? 0);
    const lineDelta = countLines(safeAfter) - countLines(safeBefore);

    const snapshot: FileSnapshot = {
      snapshotId: generateSnapshotId(),
      filePath,
      beforeContent: safeBefore,
      afterContent: safeAfter,
      operation,
      actorId,
      toolName,
      taskId,
      correlationId,
      timestamp: Date.now(),
      rolledBack: false,
      charDelta,
      lineDelta,
    };

    // Add to per-file history
    const fileSnapshots = this.snapshots.get(filePath) || [];
    fileSnapshots.push(snapshot);

    // Enforce per-file limit (evict oldest)
    while (fileSnapshots.length > this.config.maxSnapshotsPerFile) {
      fileSnapshots.shift();
      this.totalCount--;
    }

    this.snapshots.set(filePath, fileSnapshots);
    this.totalCount++;

    // Enforce total limit (evict oldest across all files)
    this.enforceGlobalLimit();

    logger.debug('File snapshot recorded', {
      snapshotId: snapshot.snapshotId,
      filePath,
      operation,
      charDelta,
      lineDelta,
    });

    return snapshot;
  }

  /**
   * Get the last snapshot for a file (most recent modification).
   */
  getLastSnapshot(filePath: string): FileSnapshot | undefined {
    const fileSnapshots = this.snapshots.get(filePath);
    if (!fileSnapshots || fileSnapshots.length === 0) return undefined;
    return fileSnapshots[fileSnapshots.length - 1];
  }

  /**
   * Get all snapshots for a file (oldest first).
   */
  getFileHistory(filePath: string): FileSnapshot[] {
    return [...(this.snapshots.get(filePath) || [])];
  }

  /**
   * Get all snapshots across all files, ordered by timestamp (newest first).
   */
  getAllSnapshots(limit?: number): FileSnapshot[] {
    const all: FileSnapshot[] = [];
    for (const snapshots of this.snapshots.values()) {
      all.push(...snapshots);
    }
    all.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? all.slice(0, limit) : all;
  }

  /**
   * Get snapshots by correlation ID (all changes in a batch).
   */
  getByCorrelationId(correlationId: string): FileSnapshot[] {
    const results: FileSnapshot[] = [];
    for (const snapshots of this.snapshots.values()) {
      for (const snap of snapshots) {
        if (snap.correlationId === correlationId) results.push(snap);
      }
    }
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get snapshots by task ID.
   */
  getByTaskId(taskId: string): FileSnapshot[] {
    const results: FileSnapshot[] = [];
    for (const snapshots of this.snapshots.values()) {
      for (const snap of snapshots) {
        if (snap.taskId === taskId) results.push(snap);
      }
    }
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Mark a snapshot as rolled back (does NOT perform the rollback —
   * that's the caller's responsibility via the beforeContent).
   */
  markRolledBack(snapshotId: string): FileSnapshot | undefined {
    for (const snapshots of this.snapshots.values()) {
      const snap = snapshots.find((s) => s.snapshotId === snapshotId);
      if (snap) {
        snap.rolledBack = true;
        logger.info('Snapshot marked as rolled back', { snapshotId, filePath: snap.filePath });
        return snap;
      }
    }
    return undefined;
  }

  /**
   * Get the content to restore for rolling back a snapshot.
   * Returns the beforeContent (what was there before the change).
   */
  getRollbackContent(snapshotId: string): string | null | undefined {
    for (const snapshots of this.snapshots.values()) {
      const snap = snapshots.find((s) => s.snapshotId === snapshotId);
      if (snap) return snap.beforeContent;
    }
    return undefined;
  }

  /**
   * Get aggregate stats about the history.
   */
  getStats(): FileHistoryStats {
    let totalCharDelta = 0;
    let totalLineDelta = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const snapshots of this.snapshots.values()) {
      for (const snap of snapshots) {
        totalCharDelta += snap.charDelta;
        totalLineDelta += snap.lineDelta;
        if (snap.timestamp < oldestTimestamp) oldestTimestamp = snap.timestamp;
        if (snap.timestamp > newestTimestamp) newestTimestamp = snap.timestamp;
      }
    }

    const now = Date.now();
    return {
      totalSnapshots: this.totalCount,
      filesTracked: this.snapshots.size,
      totalCharDelta,
      totalLineDelta,
      oldestSnapshotAge: oldestTimestamp === Infinity ? 0 : now - oldestTimestamp,
      newestSnapshotAge: newestTimestamp === 0 ? 0 : now - newestTimestamp,
    };
  }

  /**
   * Get all tracked file paths.
   */
  getTrackedFiles(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.snapshots.clear();
    this.totalCount = 0;
  }

  /**
   * Clear history for a specific file.
   */
  clearFile(filePath: string): void {
    const count = this.snapshots.get(filePath)?.length ?? 0;
    this.snapshots.delete(filePath);
    this.totalCount -= count;
  }

  // ──── Private ────────────────────────────────────────────────

  private enforceGlobalLimit(): void {
    while (this.totalCount > this.config.maxTotalSnapshots) {
      // Find the file with the oldest snapshot
      let oldestTime = Infinity;
      let oldestFile = '';

      for (const [path, snapshots] of this.snapshots) {
        if (snapshots.length > 0 && snapshots[0].timestamp < oldestTime) {
          oldestTime = snapshots[0].timestamp;
          oldestFile = path;
        }
      }

      if (!oldestFile) break;

      const fileSnapshots = this.snapshots.get(oldestFile)!;
      fileSnapshots.shift();
      this.totalCount--;

      if (fileSnapshots.length === 0) {
        this.snapshots.delete(oldestFile);
      }
    }
  }
}
