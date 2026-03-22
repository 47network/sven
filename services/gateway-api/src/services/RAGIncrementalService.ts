import { getPool } from '../db/pool.js';
import crypto from 'crypto';

/**
 * RAG Incremental Service
 * Hash-based change detection for incremental indexing
 * Tracks file content hashes to skip unchanged files
 */

const pool = getPool();

interface RAGFileHash {
  id: string;
  sourceId: string;
  filePath: string;
  contentHash: string;
  indexHash: string;
  isChanged: boolean;
  lastIndexedAt: Date;
  chunkCount: number;
  processedSizeBytes: number;
  indexedSuccessfully: boolean;
}

/**
 * Generate SHA256 hash of content
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Track content hash for file
 */
export async function trackFileHash(
  sourceId: string,
  filePath: string,
  contentHash: string,
  chunkCount: number = 0,
  processedSizeBytes: number = 0
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO rag_section_hashes (source_id, file_path, content_hash, chunk_count, processed_size_bytes, is_changed, change_detected_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (source_id, file_path) DO UPDATE
       SET content_hash = $3,
           chunk_count = $4,
           processed_size_bytes = $5,
           is_changed = rag_section_hashes.is_changed OR rag_section_hashes.content_hash IS DISTINCT FROM EXCLUDED.content_hash,
           change_detected_at = CASE
             WHEN rag_section_hashes.content_hash IS DISTINCT FROM EXCLUDED.content_hash
               THEN CURRENT_TIMESTAMP
             ELSE rag_section_hashes.change_detected_at
           END,
           updated_at = CURRENT_TIMESTAMP`,
      [sourceId, filePath, contentHash, chunkCount, processedSizeBytes]
    );
  } catch (error) {
    console.error(`Failed to track file hash for ${filePath}:`, error);
  }
}

/**
 * Update index hash after successful indexing
 */
export async function updateIndexHash(
  sourceId: string,
  filePath: string,
  indexHash: string
): Promise<void> {
  try {
    await pool.query(
      `UPDATE rag_section_hashes
       SET index_hash = $1, is_changed = FALSE, last_indexed_at = CURRENT_TIMESTAMP,
           change_detected_at = NULL, indexed_successfully = TRUE, error_message = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE source_id = $2 AND file_path = $3`,
      [indexHash, sourceId, filePath]
    );
  } catch (error) {
    console.error(`Failed to update index hash for ${filePath}:`, error);
  }
}

/**
 * Detect which files have changed and need re-indexing
 */
export async function detectChanges(sourceId: string): Promise<RAGFileHash[]> {
  try {
    const result = await pool.query(
      `SELECT id, source_id, file_path, content_hash, index_hash, is_changed,
              last_indexed_at, chunk_count, processed_size_bytes, indexed_successfully
       FROM rag_section_hashes
       WHERE source_id = $1 AND is_changed = TRUE
       ORDER BY processed_size_bytes DESC`,
      [sourceId]
    );

    return result.rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      filePath: r.file_path,
      contentHash: r.content_hash,
      indexHash: r.index_hash,
      isChanged: r.is_changed,
      lastIndexedAt: r.last_indexed_at,
      chunkCount: r.chunk_count,
      processedSizeBytes: r.processed_size_bytes,
      indexedSuccessfully: r.indexed_successfully,
    }));
  } catch (error) {
    console.error(`Failed to detect changes for ${sourceId}:`, error);
    return [];
  }
}

/**
 * Check if file needs re-indexing (content hash mismatch)
 */
export async function fileNeedsReindexing(
  sourceId: string,
  filePath: string,
  currentContentHash: string
): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT content_hash FROM rag_section_hashes
       WHERE source_id = $1 AND file_path = $2`,
      [sourceId, filePath]
    );

    if (result.rows.length === 0) {
      // New file
      return true;
    }

    const storedHash = result.rows[0].content_hash;
    return storedHash !== currentContentHash;
  } catch (error) {
    console.error(`Failed to check if file needs reindexing:`, error);
    return true; // Assume needs indexing on error
  }
}

/**
 * Get files that need re-indexing from a list
 */
export async function skipUnchangedFiles(
  sourceId: string,
  files: Array<{ path: string; content: string }>
): Promise<Array<{ path: string; content: string; hash: string }>> {
  try {
    const filesToIndex: Array<{ path: string; content: string; hash: string }> = [];

    for (const file of files) {
      const contentHash = hashContent(file.content);
      const needsReindex = await fileNeedsReindexing(sourceId, file.path, contentHash);

      if (needsReindex) {
        filesToIndex.push({
          path: file.path,
          content: file.content,
          hash: contentHash,
        });
      }
    }

    return filesToIndex;
  } catch (error) {
    console.error('Failed to filter unchanged files:', error);
    return files.map((f) => ({
      ...f,
      hash: hashContent(f.content),
    }));
  }
}

/**
 * Compare content and index hashes for diff detection
 */
export async function compareHashes(
  sourceId: string,
  filePath: string,
  currentContentHash: string,
  currentIndexHash: string
): Promise<{
  contentChanged: boolean;
  indexedChanged: boolean;
  lastIndexedAt: Date | null;
}> {
  try {
    const result = await pool.query(
      `SELECT content_hash, index_hash, last_indexed_at FROM rag_section_hashes
       WHERE source_id = $1 AND file_path = $2`,
      [sourceId, filePath]
    );

    if (result.rows.length === 0) {
      return {
        contentChanged: true,
        indexedChanged: true,
        lastIndexedAt: null,
      };
    }

    const row = result.rows[0];
    return {
      contentChanged: row.content_hash !== currentContentHash,
      indexedChanged: row.index_hash !== currentIndexHash,
      lastIndexedAt: row.last_indexed_at,
    };
  } catch (error) {
    console.error('Failed to compare hashes:', error);
    return {
      contentChanged: true,
      indexedChanged: true,
      lastIndexedAt: null,
    };
  }
}

/**
 * Get indexing statistics
 */
export async function getIndexingStats(sourceId: string): Promise<{
  totalFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  totalChunks: number;
  totalSizeBytes: number;
  lastIndexedAt: Date | null;
  successRate: number;
}> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as total_files,
              SUM(CASE WHEN is_changed THEN 1 ELSE 0 END) as changed_files,
              SUM(CASE WHEN NOT is_changed THEN 1 ELSE 0 END) as unchanged_files,
              SUM(chunk_count) as total_chunks,
              SUM(processed_size_bytes) as total_size,
              MAX(last_indexed_at) as last_indexed,
              SUM(CASE WHEN indexed_successfully THEN 1 ELSE 0 END)::FLOAT / 
                NULLIF(COUNT(*), 0) * 100 as success_rate
       FROM rag_section_hashes
       WHERE source_id = $1`,
      [sourceId]
    );

    const row = result.rows[0];
    return {
      totalFiles: parseInt(row.total_files),
      changedFiles: row.changed_files ? parseInt(row.changed_files) : 0,
      unchangedFiles: row.unchanged_files ? parseInt(row.unchanged_files) : 0,
      totalChunks: row.total_chunks ? parseInt(row.total_chunks) : 0,
      totalSizeBytes: row.total_size ? parseInt(row.total_size) : 0,
      lastIndexedAt: row.last_indexed,
      successRate: row.success_rate ? parseFloat(row.success_rate) : 0,
    };
  } catch (error) {
    console.error('Failed to get indexing stats:', error);
    return {
      totalFiles: 0,
      changedFiles: 0,
      unchangedFiles: 0,
      totalChunks: 0,
      totalSizeBytes: 0,
      lastIndexedAt: null,
      successRate: 0,
    };
  }
}

/**
 * Batch update hashes after bulk indexing
 */
export async function batchUpdateHashes(
  sourceId: string,
  updates: Array<{ filePath: string; contentHash: string; indexHash: string; success: boolean }>
): Promise<number> {
  try {
    let successCount = 0;

    for (const update of updates) {
      await pool.query(
        `UPDATE rag_section_hashes
         SET index_hash = $1, is_changed = FALSE, last_indexed_at = CURRENT_TIMESTAMP,
             change_detected_at = NULL, indexed_successfully = $2, error_message = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE source_id = $3 AND file_path = $4`,
        [update.indexHash, update.success, sourceId, update.filePath]
      );

      if (update.success) {
        successCount++;
      }
    }

    return successCount;
  } catch (error) {
    console.error('Batch hash update failed:', error);
    return 0;
  }
}

/**
 * Get all files for source
 */
export async function getSourceFiles(sourceId: string): Promise<RAGFileHash[]> {
  try {
    const result = await pool.query(
      `SELECT id, source_id, file_path, content_hash, index_hash, is_changed,
              last_indexed_at, chunk_count, processed_size_bytes, indexed_successfully
       FROM rag_section_hashes
       WHERE source_id = $1
       ORDER BY file_path ASC`,
      [sourceId]
    );

    return result.rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      filePath: r.file_path,
      contentHash: r.content_hash,
      indexHash: r.index_hash,
      isChanged: r.is_changed,
      lastIndexedAt: r.last_indexed_at,
      chunkCount: r.chunk_count,
      processedSizeBytes: r.processed_size_bytes,
      indexedSuccessfully: r.indexed_successfully,
    }));
  } catch (error) {
    console.error('Failed to get source files:', error);
    return [];
  }
}

/**
 * Mark file as having error during indexing
 */
export async function recordIndexingError(
  sourceId: string,
  filePath: string,
  errorMessage: string
): Promise<void> {
  try {
    await pool.query(
      `UPDATE rag_section_hashes
       SET indexed_successfully = FALSE, error_message = $1, updated_at = CURRENT_TIMESTAMP
       WHERE source_id = $2 AND file_path = $3`,
      [errorMessage, sourceId, filePath]
    );
  } catch (error) {
    console.error(`Failed to record indexing error for ${filePath}:`, error);
  }
}
