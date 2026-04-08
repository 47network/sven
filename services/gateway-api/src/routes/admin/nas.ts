/**
 * NAS File Management Admin Routes
 * Handle file search, read, write, and delete operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../db.js';
import path from 'node:path';
import {
  searchFiles,
  readFilePreview,
  readFile,
  listDirectoryPage,
  writeFile,
  deleteFile,
  getFileStats,
  validateNasPath,
} from '@sven/shared/integrations/nas';
import { getIncidentStatus } from '../../services/IncidentService.js';

interface SearchRequest {
  path: string;
  pattern?: string;
  max_results?: number;
}

interface ReadRequest {
  path: string;
  preview_only?: boolean;
}

interface ListRequest {
  path: string;
  limit?: number;
  cursor?: string;
}

interface WriteRequest {
  path: string;
  content: string;
  append?: boolean;
  create_dirs?: boolean;
  approval_id?: string;
}

interface DeleteRequest {
  path: string;
  recursive?: boolean;
  approval_id?: string;
}

interface StatsRequest {
  path: string;
}

function sendNasInternalError(reply: FastifyReply, message: string) {
  return reply.status(500).send({ error: message });
}

async function ensureIncidentWriteAllowed(reply: FastifyReply): Promise<boolean> {
  const status = await getIncidentStatus();
  if (!status.killSwitchActive && !status.lockdownActive && !status.forensicsActive) {
    return true;
  }
  reply.status(423).send({
    error: 'INCIDENT_WRITE_BLOCKED: write operations are blocked while incident controls are active',
    incident_status: status.status,
  });
  return false;
}

const DEFAULT_NAS_SEARCH_MAX_RESULTS = 100;
const MIN_NAS_SEARCH_MAX_RESULTS = 1;
const MAX_NAS_SEARCH_MAX_RESULTS = 1000;

function normalizeNasBody<T extends object>(
  body: unknown,
): { ok: true; value: Partial<T> } | { ok: false } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false };
  }
  return { ok: true, value: body as Partial<T> };
}

function isExactOrChildPath(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidate = path.posix.normalize(candidatePath);
  const normalizedRoot = path.posix.normalize(rootPath);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function normalizeNasVirtualPath(filePath: string): string {
  // NAS API paths are virtual POSIX-style paths, independent of host OS path semantics.
  const normalized = path.posix.normalize(String(filePath || '').replace(/\\/g, '/'));
  if (!normalized.startsWith('/')) {
    return `/${normalized}`;
  }
  return normalized;
}

function requiresNasMutationApproval(filePath: string, userId: string): boolean {
  const normalized = normalizeNasVirtualPath(filePath);
  const userRoot = normalizeNasVirtualPath(`/nas/users/${userId}`);
  return isExactOrChildPath(normalized, userRoot);
}

export async function registerNasRoutes(fastify: FastifyInstance, db: Database) {
  async function isNasApprovalValid(approvalId: string, userId: string): Promise<boolean> {
    const res = await db.query(
      `SELECT id
       FROM approvals
       WHERE id = $1
         AND requester_user_id = $2
         AND status = 'approved'
         AND expires_at > NOW()
         AND scope IN ('nas', 'nas.write', 'nas.delete', 'nas.file_write', 'nas.file_delete')
       LIMIT 1`,
      [approvalId, userId],
    );
    return res.rows.length > 0;
  }

  /**
   * Search for files matching a pattern
   */
  fastify.post<{ Body: SearchRequest }>('/nas/search', async (request: FastifyRequest<{ Body: SearchRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsedBody = normalizeNasBody<SearchRequest>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ error: 'request body must be a JSON object' });
    }
    const { path: searchPath, pattern, max_results } = parsedBody.value;

    if (!searchPath) {
      return reply.status(400).send({ error: 'path is required' });
    }
    if (pattern !== undefined && typeof pattern !== 'string') {
      return reply.status(400).send({ error: 'pattern must be a string when provided' });
    }
    if (
      max_results !== undefined &&
      (!Number.isInteger(max_results) || max_results < MIN_NAS_SEARCH_MAX_RESULTS || max_results > MAX_NAS_SEARCH_MAX_RESULTS)
    ) {
      return reply.status(400).send({
        error: `max_results must be an integer between ${MIN_NAS_SEARCH_MAX_RESULTS} and ${MAX_NAS_SEARCH_MAX_RESULTS} when provided`,
      });
    }

    // Treat search pattern as a plain substring (not regex) to avoid regex parser/runtime error exposure.
    const patternStr = pattern || '';
    if (patternStr.length > 256) {
      return reply.status(400).send({ error: 'pattern must be <= 256 characters' });
    }
    const maxResults = max_results ?? DEFAULT_NAS_SEARCH_MAX_RESULTS;

    try {
      const validation = validateNasPath(searchPath, userId, false);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      const results = await searchFiles(searchPath, patternStr, userId, maxResults);

      // Log search operation
      try {
        await db.query(
          `INSERT INTO nas_operations (user_id, operation_type, path, status, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'search', searchPath, 'success', JSON.stringify({ pattern: patternStr, results_count: results.length })]
        );
      } catch (logError) {
        fastify.log.warn({ err: logError }, 'Failed to log NAS operation');
      }

      return reply.send({ results });
    } catch (error) {
      fastify.log.error({ err: error }, 'NAS search failed');
      return sendNasInternalError(reply, 'Search failed');
    }
  });

  /**
   * List directory contents
   */
  fastify.post<{ Body: ListRequest }>('/nas/list', async (request: FastifyRequest<{ Body: ListRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsedBody = normalizeNasBody<ListRequest>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ error: 'request body must be a JSON object' });
    }
    const { path: dirPath, limit, cursor } = parsedBody.value;

    if (!dirPath) {
      return reply.status(400).send({ error: 'path is required' });
    }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
      return reply.status(400).send({ error: 'limit must be an integer between 1 and 500' });
    }
    if (cursor !== undefined && typeof cursor !== 'string') {
      return reply.status(400).send({ error: 'cursor must be a string when provided' });
    }
    const pageLimit = limit ?? 100;

    try {
      const validation = validateNasPath(dirPath, userId, false);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      const page = await listDirectoryPage(dirPath, userId, pageLimit, cursor);

      return reply.send({
        entries: page.entries,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
        limit: pageLimit,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'NAS list failed');
      return sendNasInternalError(reply, 'List failed');
    }
  });

  /**
   * Get file preview (first 8KB)
   */
  fastify.post<{ Body: ReadRequest }>('/nas/preview', async (request: FastifyRequest<{ Body: ReadRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsedBody = normalizeNasBody<ReadRequest>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ error: 'request body must be a JSON object' });
    }
    const { path: filePath, preview_only } = parsedBody.value;

    if (!filePath) {
      return reply.status(400).send({ error: 'path is required' });
    }
    if (preview_only !== undefined && typeof preview_only !== 'boolean') {
      return reply.status(400).send({ error: 'preview_only must be a boolean when provided' });
    }
    const previewOnly = preview_only !== false;

    try {
      const validation = validateNasPath(filePath, userId, false);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      if (previewOnly) {
        const preview = await readFilePreview(filePath, userId);
        return reply.send({ ...preview, preview_only: true });
      }

      const content = await readFile(filePath, userId);
      const stats = await getFileStats(filePath, userId);
      return reply.send({
        ...stats,
        preview_only: false,
        content_encoding: 'base64',
        content_base64: content.toString('base64'),
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'NAS preview failed');
      return sendNasInternalError(reply, 'Preview failed');
    }
  });

  /**
   * Get file statistics
   */
  fastify.post<{ Body: StatsRequest }>('/nas/stats', async (request: FastifyRequest<{ Body: StatsRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsedBody = normalizeNasBody<StatsRequest>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ error: 'request body must be a JSON object' });
    }
    const { path: filePath } = parsedBody.value;

    if (!filePath) {
      return reply.status(400).send({ error: 'path is required' });
    }

    try {
      const validation = validateNasPath(filePath, userId, false);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      const stats = await getFileStats(filePath, userId);

      return reply.send(stats);
    } catch (error) {
      fastify.log.error({ err: error }, 'NAS stats failed');
      return sendNasInternalError(reply, 'Stats failed');
    }
  });

  /**
   * Write file (requires approval for user paths)
   */
  fastify.post<{ Body: WriteRequest }>('/nas/write', async (request: FastifyRequest<{ Body: WriteRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsedBody = normalizeNasBody<WriteRequest>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ error: 'request body must be a JSON object' });
    }
    const { path: filePath, content, append, create_dirs, approval_id } = parsedBody.value;

    if (!filePath || content === undefined) {
      return reply.status(400).send({ error: 'path and content are required' });
    }
    if (!(await ensureIncidentWriteAllowed(reply))) {
      return;
    }

    try {
      const validation = validateNasPath(filePath, userId, true);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      if (requiresNasMutationApproval(filePath, userId)) {
        const approvalId = String(approval_id || '').trim();
        if (!approvalId || !(await isNasApprovalValid(approvalId, userId))) {
          return reply.status(409).send({
            error: 'APPROVAL_REQUIRED: write to user NAS path requires valid approved approval_id',
          });
        }
      }

      const result = await writeFile(filePath, content, userId, { append, createDirs: create_dirs });

      // Log write operation
      try {
        await db.query(
          `INSERT INTO nas_operations (user_id, operation_type, path, status, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, append ? 'append' : 'write', filePath, 'success', JSON.stringify({ size: result.size })]
        );
      } catch (logError) {
        fastify.log.warn({ err: logError }, 'Failed to log NAS operation');
      }

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'NAS write failed');
      return sendNasInternalError(reply, 'Write failed');
    }
  });

  /**
   * Delete file or directory
   */
  fastify.post<{ Body: DeleteRequest }>('/nas/delete', async (request: FastifyRequest<{ Body: DeleteRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsedBody = normalizeNasBody<DeleteRequest>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ error: 'request body must be a JSON object' });
    }
    const { path: filePath, recursive, approval_id } = parsedBody.value;

    if (!filePath) {
      return reply.status(400).send({ error: 'path is required' });
    }
    if (!(await ensureIncidentWriteAllowed(reply))) {
      return;
    }

    try {
      const validation = validateNasPath(filePath, userId, true);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      if (requiresNasMutationApproval(filePath, userId)) {
        const approvalId = String(approval_id || '').trim();
        if (!approvalId || !(await isNasApprovalValid(approvalId, userId))) {
          return reply.status(409).send({
            error: 'APPROVAL_REQUIRED: delete on user NAS path requires valid approved approval_id',
          });
        }
      }

      const result = await deleteFile(filePath, userId, recursive);

      // Log delete operation
      try {
        await db.query(
          `INSERT INTO nas_operations (user_id, operation_type, path, status)
           VALUES ($1, $2, $3, $4)`,
          [userId, 'delete', filePath, 'success']
        );
      } catch (logError) {
        fastify.log.warn({ err: logError }, 'Failed to log NAS operation');
      }

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'NAS delete failed');
      return sendNasInternalError(reply, 'Delete failed');
    }
  });
}
