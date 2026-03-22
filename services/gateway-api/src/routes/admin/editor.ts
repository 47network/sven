import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createLogger } from '@sven/shared';
import { getIncidentStatus } from '../../services/IncidentService.js';

const logger = createLogger('admin-editor');
const MAX_BYTES = Number(process.env.SVEN_EDITOR_MAX_BYTES || 1_000_000);
const GIT_OUTPUT_MAX_BYTES = Math.max(16_384, Number(process.env.SVEN_EDITOR_GIT_OUTPUT_MAX_BYTES || 1_000_000));
const GIT_TIMEOUT_MS = Math.max(1_000, Number(process.env.SVEN_EDITOR_GIT_TIMEOUT_MS || 15_000));
const GIT_KILL_GRACE_MS = Math.max(250, Number(process.env.SVEN_EDITOR_GIT_KILL_GRACE_MS || 1_000));
const SEARCH_MAX_FILES_SCANNED_DEFAULT = 5_000;
const SEARCH_MAX_FILE_BYTES_DEFAULT = 256 * 1024;
const SEARCH_MAX_WALLCLOCK_MS_DEFAULT = 5_000;
const SEARCH_RG_TIMEOUT_MS_DEFAULT = 3_000;

type EditorEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  modified_at?: string | null;
};

type ResolvedEditorPath = {
  absPath: string;
  workspaceRelative: string;
  apiPath: string;
  scopeRoot: string;
  virtualRoot: string;
  allowed: boolean;
  readOnly: boolean;
};

const DELETE_CONFIRM_TOKEN = 'DELETE';
type SearchResult = { path: string; line: number; text: string };
type SearchBudgetState = { startedAtMs: number; filesScanned: number; budgetExceeded: boolean };
type SearchBudgets = {
  maxFilesScanned: number;
  maxFileBytes: number;
  maxWallClockMs: number;
  rgTimeoutMs: number;
};

type FsErrorLike = { code?: string };
type EditorErrorEnvelope = { status: number; code: string; message: string };
type MutationGuardOptions = {
  request: any;
  reply: any;
  pool: pg.Pool;
  approvalId?: string;
  resolvedTargets: ResolvedEditorPath[];
};

function normalizeEditorBody<T extends object>(
  body: unknown,
): { ok: true; value: Partial<T> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as Partial<T> };
}

function requiresEditorMutationApproval(target: ResolvedEditorPath): boolean {
  const normalized = String(target.workspaceRelative || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
  return normalized.startsWith('data/users/') || normalized.startsWith('config/env/');
}

async function isEditorApprovalValid(pool: pg.Pool, approvalId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT id
     FROM approvals
     WHERE id = $1
       AND requester_user_id = $2
       AND status = 'approved'
       AND expires_at > NOW()
       AND scope IN ('admin.editor', 'admin.editor.write', 'admin.write')
     LIMIT 1`,
    [approvalId, userId],
  );
  return result.rows.length > 0;
}

async function enforceEditorMutationGuards(options: MutationGuardOptions): Promise<boolean> {
  const { request, reply, pool, approvalId, resolvedTargets } = options;
  const status = await getIncidentStatus();
  if (status.killSwitchActive || status.lockdownActive || status.forensicsActive) {
    reply.status(423).send({
      success: false,
      error: {
        code: 'INCIDENT_WRITE_BLOCKED',
        message: 'Write operations are blocked while incident controls are active',
      },
      data: {
        incident_status: status.status,
      },
    });
    return false;
  }

  if (!resolvedTargets.some(requiresEditorMutationApproval)) {
    return true;
  }

  const userId = String(request.user?.id || request.userId || '').trim();
  const normalizedApprovalId = String(approvalId || '').trim();
  if (!userId || !normalizedApprovalId || !(await isEditorApprovalValid(pool, normalizedApprovalId, userId))) {
    reply.status(409).send({
      success: false,
      error: {
        code: 'APPROVAL_REQUIRED',
        message: 'Protected editor mutations require a valid approved approval_id',
      },
    });
    return false;
  }
  return true;
}

export async function registerEditorRoutes(app: FastifyInstance, _pool: pg.Pool) {
  const roots = getEditorRoots();
  const editorEnabled = String(process.env.SVEN_EDITOR_ENABLED || 'true').toLowerCase() === 'true';
  const editorMutationsInProdEnabled = String(process.env.SVEN_EDITOR_ALLOW_PROD_MUTATIONS || '').toLowerCase() === 'true';
  const productionImmutableMode = String(process.env.NODE_ENV || '').toLowerCase() === 'production' && !editorMutationsInProdEnabled;

  app.addHook('preHandler', async (request: any, reply) => {
    if (!editorEnabled) {
      reply.status(403).send({
        success: false,
        error: { code: 'FEATURE_DISABLED', message: 'Editor routes are disabled' },
      });
      return;
    }
    if (String(request.userRole || '').trim() !== 'platform_admin') {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }

    try {
      const requestRoots = await resolveEditorRootsForRequest(request, roots);
      request.editorRoots = requestRoots;
    } catch (err) {
      logger.warn('Failed to initialize tenant editor workspace root', {
        err: String(err),
        org_id: String(request.orgId || ''),
      });
      reply.status(500).send({
        success: false,
        error: { code: 'EDITOR_ROOT_INIT_FAILED', message: 'Failed to initialize editor root' },
      });
    }
  });

  app.get('/editor/tree', async (request, reply) => {
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const query = request.query as { path?: string };
    const target = String(query.path || '').trim();
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }

    try {
      const entries = await readDirectory(resolved.absPath, resolved.scopeRoot, resolved.virtualRoot);
      reply.send({ success: true, data: { entries, root: resolved.virtualRoot } });
    } catch (err) {
      logger.warn('Failed to read directory', { err: String(err), path: resolved.absPath });
      const mapped = classifyEditorFsError(err, 'Failed to read directory');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.get('/editor/file', async (request, reply) => {
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const query = request.query as { path?: string };
    const target = String(query.path || '').trim();
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }

    try {
      const stat = await fs.stat(resolved.absPath);
      if (!stat.isFile()) {
        return reply.status(400).send({ success: false, error: { code: 'NOT_FILE', message: 'Target is not a file' } });
      }
      const tooLarge = stat.size > MAX_BYTES;
      const content = tooLarge ? null : await fs.readFile(resolved.absPath, 'utf8');
      reply.send({
        success: true,
        data: {
          path: resolved.apiPath,
          content,
          size: stat.size,
          too_large: tooLarge,
          read_only: resolved.readOnly,
          modified_at: stat.mtime ? stat.mtime.toISOString() : null,
        },
      });
    } catch (err) {
      logger.warn('Failed to read file', { err: String(err), path: resolved.absPath });
      const mapped = classifyEditorFsError(err, 'Failed to read file');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.put('/editor/file', async (request, reply) => {
    if (productionImmutableMode) {
      return reply.status(403).send({
        success: false,
        error: { code: 'EDITOR_PROD_IMMUTABLE', message: 'Editor mutation routes are disabled in production mode' },
      });
    }
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const parsedBody = normalizeEditorBody<{ path?: string; content?: string; create_dirs?: boolean; approval_id?: string }>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
    }
    const body = parsedBody.value;
    const target = String(body.path || '').trim();
    const content = body.content;
    if (content === undefined) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content is required' } });
    }
    if (typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content must be a string' } });
    }
    const contentBytes = Buffer.byteLength(content, 'utf8');
    if (contentBytes > MAX_BYTES) {
      return reply.status(413).send({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `content exceeds max bytes (${MAX_BYTES})`,
        },
      });
    }
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed || resolved.readOnly) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (
      !(await enforceEditorMutationGuards({
        request,
        reply,
        pool: _pool,
        approvalId: String(body.approval_id || ''),
        resolvedTargets: [resolved],
      }))
    ) {
      return;
    }

    try {
      if (body.create_dirs) {
        await fs.mkdir(path.dirname(resolved.absPath), { recursive: true });
      }
      await fs.writeFile(resolved.absPath, content, 'utf8');
      const stat = await fs.stat(resolved.absPath);
      reply.send({
        success: true,
        data: { path: resolved.apiPath, size: stat.size, modified_at: stat.mtime.toISOString() },
      });
    } catch (err) {
      logger.warn('Failed to write file', { err: String(err), path: resolved.absPath });
      const mapped = classifyEditorFsError(err, 'Failed to write file');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.post('/editor/mkdir', async (request, reply) => {
    if (productionImmutableMode) {
      return reply.status(403).send({
        success: false,
        error: { code: 'EDITOR_PROD_IMMUTABLE', message: 'Editor mutation routes are disabled in production mode' },
      });
    }
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const parsedBody = normalizeEditorBody<{ path?: string; approval_id?: string }>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
    }
    const body = parsedBody.value;
    const target = String(body.path || '').trim();
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed || resolved.readOnly) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (
      !(await enforceEditorMutationGuards({
        request,
        reply,
        pool: _pool,
        approvalId: String(body.approval_id || ''),
        resolvedTargets: [resolved],
      }))
    ) {
      return;
    }
    try {
      await fs.mkdir(resolved.absPath, { recursive: true });
      reply.send({ success: true, data: { path: resolved.apiPath } });
    } catch (err) {
      logger.warn('Failed to create directory', { err: String(err), path: resolved.absPath });
      const mapped = classifyEditorFsError(err, 'Failed to create directory');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.delete('/editor/file', async (request, reply) => {
    if (productionImmutableMode) {
      return reply.status(403).send({
        success: false,
        error: { code: 'EDITOR_PROD_IMMUTABLE', message: 'Editor mutation routes are disabled in production mode' },
      });
    }
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const query = request.query as { path?: string; recursive?: string; confirm?: string; approval_id?: string };
    const target = String(query.path || '').trim();
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed || resolved.readOnly) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (
      !(await enforceEditorMutationGuards({
        request,
        reply,
        pool: _pool,
        approvalId: String(query.approval_id || ''),
        resolvedTargets: [resolved],
      }))
    ) {
      return;
    }
    const recursive = String(query.recursive || '') === 'true';
    if (isProtectedDeleteTarget(resolved)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ROOT_DELETE_FORBIDDEN', message: 'Refusing to delete editor root path' },
      });
    }
    try {
      const stat = await fs.stat(resolved.absPath);
      if (stat.isDirectory()) {
        if (!recursive) {
          return reply.status(400).send({ success: false, error: { code: 'DIR_DELETE', message: 'recursive required for directory delete' } });
        }
        if (String(query.confirm || '') !== DELETE_CONFIRM_TOKEN) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'DIR_DELETE_CONFIRM_REQUIRED',
              message: `confirm=${DELETE_CONFIRM_TOKEN} required for recursive directory delete`,
            },
          });
        }
        await fs.rm(resolved.absPath, { recursive: true, force: true });
      } else {
        await fs.unlink(resolved.absPath);
      }
      reply.send({ success: true, data: { path: resolved.apiPath } });
    } catch (err) {
      logger.warn('Failed to delete path', { err: String(err), path: resolved.absPath });
      const mapped = classifyEditorFsError(err, 'Failed to delete path');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.post('/editor/rename', async (request, reply) => {
    if (productionImmutableMode) {
      return reply.status(403).send({
        success: false,
        error: { code: 'EDITOR_PROD_IMMUTABLE', message: 'Editor mutation routes are disabled in production mode' },
      });
    }
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const parsedBody = normalizeEditorBody<{ from?: string; to?: string; approval_id?: string }>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
    }
    const body = parsedBody.value;
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    if (!from || !to) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'from and to are required' } });
    }
    const fromResolved = resolvePath(from, requestRoots);
    const toResolved = resolvePath(to, requestRoots);
    if (!fromResolved.allowed || !toResolved.allowed || fromResolved.readOnly || toResolved.readOnly) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (!(await isCanonicalScopeAllowed(fromResolved)) || !(await isCanonicalScopeAllowed(toResolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not writable' } });
    }
    if (
      !(await enforceEditorMutationGuards({
        request,
        reply,
        pool: _pool,
        approvalId: String(body.approval_id || ''),
        resolvedTargets: [fromResolved, toResolved],
      }))
    ) {
      return;
    }
    try {
      await fs.mkdir(path.dirname(toResolved.absPath), { recursive: true });
      await fs.rename(fromResolved.absPath, toResolved.absPath);
      reply.send({ success: true, data: { from: fromResolved.apiPath, to: toResolved.apiPath } });
    } catch (err) {
      logger.warn('Failed to rename path', { err: String(err), from: fromResolved.absPath, to: toResolved.absPath });
      const mapped = classifyEditorFsError(err, 'Failed to rename path');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.post('/editor/search', async (request, reply) => {
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const parsedBody = normalizeEditorBody<{ path?: string; query?: string; limit?: number }>(request.body);
    if (!parsedBody.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsedBody.message } });
    }
    const body = parsedBody.value;
    const target = String(body.path || '').trim();
    const query = String(body.query || '').trim();
    if (!query) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'query is required' } });
    }
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }
    const limit = Math.min(Math.max(Number(body.limit || 200), 1), 1000);
    try {
      const budgets = resolveSearchBudgets();
      const searchOutcome = await searchFiles(resolved.absPath, resolved.scopeRoot, resolved.virtualRoot, query, limit, budgets);
      reply.send({ success: true, data: { path_base: resolved.virtualRoot, budget_exhausted: searchOutcome.budgetExceeded, results: searchOutcome.results } });
    } catch (err) {
      logger.warn('Search failed', { err: String(err), path: resolved.absPath });
      const mapped = classifyEditorFsError(err, 'Search failed');
      reply.status(mapped.status).send({ success: false, error: { code: mapped.code, message: mapped.message } });
    }
  });

  app.get('/editor/git/status', async (request, reply) => {
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    try {
      const status = await gitStatus(requestRoots.root);
      reply.send({ success: true, data: { status } });
    } catch (err) {
      reply.status(500).send({ success: false, error: { code: 'GIT_STATUS_FAILED', message: 'Failed to read git status' } });
    }
  });

  app.get('/editor/git/diff', async (request, reply) => {
    const requestRoots = getEditorRootsFromRequest(request as any, roots);
    const query = request.query as { path?: string };
    const target = String(query.path || '').trim();
    const resolved = resolvePath(target, requestRoots);
    if (!resolved.allowed) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }
    if (!(await isCanonicalScopeAllowed(resolved))) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Path not allowed' } });
    }
    try {
      const diff = await gitDiff(requestRoots.root, resolved.workspaceRelative);
      reply.send({ success: true, data: { diff } });
    } catch {
      reply.status(500).send({ success: false, error: { code: 'GIT_DIFF_FAILED', message: 'Failed to read git diff' } });
    }
  });
}

function getEditorRoots(): { root: string; readOnlyRoots: string[] } {
  const root = path.resolve(process.env.SVEN_WORKSPACE_ROOT || process.cwd());
  const readOnlyRoots = String(process.env.SVEN_EDITOR_READONLY_ROOTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  return { root, readOnlyRoots };
}

function getEditorRootsFromRequest(
  request: { editorRoots?: { root: string; readOnlyRoots: string[] } },
  fallback: { root: string; readOnlyRoots: string[] },
): { root: string; readOnlyRoots: string[] } {
  return request.editorRoots || fallback;
}

async function resolveEditorRootsForRequest(
  request: { orgId?: string; editorRoots?: { root: string; readOnlyRoots: string[] } },
  base: { root: string; readOnlyRoots: string[] },
): Promise<{ root: string; readOnlyRoots: string[] }> {
  const orgId = String(request.orgId || '').trim();
  if (!orgId) return base;
  const tenantWorkspaceBase = path.resolve(process.env.SVEN_EDITOR_TENANT_ROOT || base.root);
  const tenantScopedRoot = path.resolve(tenantWorkspaceBase, sanitizePathSegment(orgId));
  await fs.mkdir(tenantScopedRoot, { recursive: true });
  return {
    root: tenantScopedRoot,
    readOnlyRoots: base.readOnlyRoots,
  };
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'default';
}

function resolvePath(input: string, roots: { root: string; readOnlyRoots: string[] }): ResolvedEditorPath {
  const target = input || '.';
  const absPath = path.isAbsolute(target) ? path.resolve(target) : path.resolve(roots.root, target);
  const withinRoot = isSubPath(absPath, roots.root);
  const readOnlyIndex = roots.readOnlyRoots.findIndex((root) => isSubPath(absPath, root));
  const withinReadOnly = readOnlyIndex >= 0;
  const allowed = withinRoot || withinReadOnly;
  const readOnly = !withinRoot && withinReadOnly;
  const scopeRoot = withinRoot
    ? roots.root
    : withinReadOnly
      ? roots.readOnlyRoots[readOnlyIndex]
      : roots.root;
  const virtualRoot = withinRoot
    ? 'workspace'
    : withinReadOnly
      ? `readonly/${readOnlyIndex + 1}`
      : 'workspace';
  const workspaceRelative = toPosix(path.relative(scopeRoot, absPath));
  const apiPath = toVirtualPath(virtualRoot, workspaceRelative);
  return { absPath, workspaceRelative, apiPath, scopeRoot, virtualRoot, allowed, readOnly };
}

async function isCanonicalScopeAllowed(resolved: ResolvedEditorPath): Promise<boolean> {
  try {
    await assertCanonicalPathWithinScope(resolved.absPath, resolved.scopeRoot);
    return true;
  } catch (err) {
    logger.warn('Rejected editor path outside canonical scope', {
      err: String(err),
      path: resolved.absPath,
      scope_root: resolved.scopeRoot,
    });
    return false;
  }
}

async function assertCanonicalPathWithinScope(absPath: string, scopeRoot: string): Promise<void> {
  const realScopeRoot = await fs.realpath(scopeRoot);
  const realCandidatePath = await resolveCanonicalPath(absPath);
  if (!isSubPath(realCandidatePath, realScopeRoot)) {
    throw new Error('PATH_OUTSIDE_CANONICAL_SCOPE');
  }
}

async function resolveCanonicalPath(absPath: string): Promise<string> {
  try {
    return await fs.realpath(absPath);
  } catch (err) {
    if (!isMissingPathError(err)) throw err;
    return resolveCanonicalPathFromNearestExistingAncestor(absPath);
  }
}

async function resolveCanonicalPathFromNearestExistingAncestor(absPath: string): Promise<string> {
  let current = path.dirname(absPath);
  for (;;) {
    try {
      const realAncestor = await fs.realpath(current);
      return path.resolve(realAncestor, path.relative(current, absPath));
    } catch (err) {
      if (!isMissingPathError(err)) throw err;
      const parent = path.dirname(current);
      if (parent === current) throw err;
      current = parent;
    }
  }
}

function isMissingPathError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT';
}

function classifyEditorFsError(err: unknown, fallbackMessage: string): EditorErrorEnvelope {
  const code = String((err as FsErrorLike)?.code || '').toUpperCase();
  if (code === 'ENOENT') {
    return { status: 404, code: 'NOT_FOUND', message: 'Path not found' };
  }
  if (code === 'ENOTDIR' || code === 'EISDIR') {
    return { status: 400, code: 'INVALID_TARGET_TYPE', message: 'Invalid path target type' };
  }
  if (code === 'EEXIST' || code === 'ENOTEMPTY') {
    return { status: 409, code: 'PATH_CONFLICT', message: 'Path conflict' };
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return { status: 403, code: 'FORBIDDEN', message: 'Path operation not permitted' };
  }
  return { status: 500, code: 'INTERNAL', message: fallbackMessage };
}

function isSubPath(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isProtectedDeleteTarget(resolved: ResolvedEditorPath): boolean {
  const normalizedRelative = toPosix(path.posix.normalize(String(resolved.workspaceRelative || '.'))).replace(/^\/+/, '');
  return normalizedRelative === '' || normalizedRelative === '.';
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function toVirtualPath(virtualRoot: string, relativePath: string): string {
  const normalized = toPosix(path.posix.normalize(String(relativePath || '.'))).replace(/^\/+/, '');
  const cleaned = normalized === '.' ? '' : normalized.split('/').filter((segment) => segment && segment !== '..').join('/');
  return cleaned ? `${virtualRoot}/${cleaned}` : virtualRoot;
}

async function readDirectory(dirPath: string, scopeRoot: string, virtualRoot: string): Promise<EditorEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: EditorEntry[] = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const abs = path.join(dirPath, entry.name);
    const stat = await fs.stat(abs);
    const relative = toPosix(path.relative(scopeRoot, abs));
    results.push({
      name: entry.name,
      path: toVirtualPath(virtualRoot, relative),
      type: entry.isDirectory() ? 'dir' : 'file',
      size: entry.isDirectory() ? undefined : stat.size,
      modified_at: stat.mtime ? stat.mtime.toISOString() : null,
    });
  }
  return results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function searchFiles(
  rootPath: string,
  scopeRoot: string,
  virtualRoot: string,
  query: string,
  limit: number,
  budgets: SearchBudgets,
): Promise<{ results: SearchResult[]; budgetExceeded: boolean }> {
  const rg = await tryRipgrep(rootPath, scopeRoot, virtualRoot, query, limit, budgets);
  if (rg) return rg;
  const state: SearchBudgetState = { startedAtMs: Date.now(), filesScanned: 0, budgetExceeded: false };
  const results: SearchResult[] = [];
  await walkAndSearch(rootPath, scopeRoot, virtualRoot, query, limit, results, budgets, state);
  return { results, budgetExceeded: state.budgetExceeded };
}

function tryRipgrep(
  rootPath: string,
  scopeRoot: string,
  virtualRoot: string,
  query: string,
  limit: number,
  budgets: SearchBudgets,
): Promise<{ results: SearchResult[]; budgetExceeded: boolean } | null> {
  return new Promise<{ results: SearchResult[]; budgetExceeded: boolean } | null>((resolve) => {
    const rg = spawn('rg', ['-n', '--color', 'never', '--hidden', '--glob', '!**/node_modules/**', '--glob', '!**/.git/**', query, rootPath]);
    const results: SearchResult[] = [];
    let buffered = '';
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        rg.kill('SIGTERM');
      } catch {
        // best effort
      }
      killTimer = setTimeout(() => {
        try {
          rg.kill('SIGKILL');
        } catch {
          try {
            rg.kill();
          } catch {
            // best effort
          }
        }
      }, 500);
    }, budgets.rgTimeoutMs);
    rg.stdout.on('data', (chunk) => {
      buffered += String(chunk);
      const lines = buffered.split('\n');
      buffered = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^(.*?):(\d+):(.*)$/);
        if (!match) continue;
        const relative = toPosix(path.relative(scopeRoot, match[1]));
        results.push({ path: toVirtualPath(virtualRoot, relative), line: Number(match[2]), text: match[3] });
        if (results.length >= limit) {
          rg.kill();
          break;
        }
      }
    });
    rg.on('error', () => resolve(null));
    rg.on('close', (code) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      if (timedOut) {
        return resolve({ results: results.slice(0, limit), budgetExceeded: true });
      }
      if (code !== 0 && results.length === 0) return resolve(null);
      resolve({ results: results.slice(0, limit), budgetExceeded: false });
    });
  });
}

async function walkAndSearch(
  dirPath: string,
  scopeRoot: string,
  virtualRoot: string,
  query: string,
  limit: number,
  results: SearchResult[],
  budgets: SearchBudgets,
  state: SearchBudgetState,
) {
  if (Date.now() - state.startedAtMs > budgets.maxWallClockMs) {
    state.budgetExceeded = true;
    return;
  }
  if (results.length >= limit) return;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (Date.now() - state.startedAtMs > budgets.maxWallClockMs) {
      state.budgetExceeded = true;
      return;
    }
    if (results.length >= limit) return;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkAndSearch(abs, scopeRoot, virtualRoot, query, limit, results, budgets, state);
    } else if (entry.isFile()) {
      state.filesScanned += 1;
      if (state.filesScanned > budgets.maxFilesScanned) {
        state.budgetExceeded = true;
        return;
      }
      const content = await readFilePrefixUtf8(abs, budgets.maxFileBytes).catch(() => null);
      if (!content) continue;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].includes(query)) {
          const relative = toPosix(path.relative(scopeRoot, abs));
          results.push({ path: toVirtualPath(virtualRoot, relative), line: i + 1, text: lines[i].slice(0, 300) });
          if (results.length >= limit) return;
        }
      }
    }
  }
}

async function readFilePrefixUtf8(filePath: string, maxBytes: number): Promise<string> {
  const fh = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await fh.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
  }
}

function resolveSearchBudgets(): SearchBudgets {
  return {
    maxFilesScanned: boundedIntFromEnv('SVEN_EDITOR_SEARCH_MAX_FILES_SCANNED', SEARCH_MAX_FILES_SCANNED_DEFAULT, 100, 100_000),
    maxFileBytes: boundedIntFromEnv('SVEN_EDITOR_SEARCH_MAX_FILE_BYTES', SEARCH_MAX_FILE_BYTES_DEFAULT, 4_096, 2_000_000),
    maxWallClockMs: boundedIntFromEnv('SVEN_EDITOR_SEARCH_MAX_WALLCLOCK_MS', SEARCH_MAX_WALLCLOCK_MS_DEFAULT, 250, 30_000),
    rgTimeoutMs: boundedIntFromEnv('SVEN_EDITOR_SEARCH_RG_TIMEOUT_MS', SEARCH_RG_TIMEOUT_MS_DEFAULT, 250, 30_000),
  };
}

function boundedIntFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function runGitCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args);
    const buffers: string[] = [];
    let totalBytes = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;

    const finalizeSuccess = (output: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      resolve(output);
    };

    const finalizeError = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      reject(err);
    };

    const appendChunk = (chunk: unknown) => {
      if (truncated) return;
      const text = String(chunk);
      const nextBytes = totalBytes + Buffer.byteLength(text, 'utf8');
      if (nextBytes > GIT_OUTPUT_MAX_BYTES) {
        const remaining = Math.max(0, GIT_OUTPUT_MAX_BYTES - totalBytes);
        const slice = remaining > 0 ? text.slice(0, remaining) : '';
        if (slice) {
          buffers.push(slice);
          totalBytes += Buffer.byteLength(slice, 'utf8');
        }
        truncated = true;
        try {
          git.kill('SIGTERM');
        } catch {
          // best effort
        }
        killTimer = setTimeout(() => {
          try {
            git.kill('SIGKILL');
          } catch {
            try {
              git.kill();
            } catch {
              // best effort
            }
          }
        }, GIT_KILL_GRACE_MS);
        return;
      }
      buffers.push(text);
      totalBytes = nextBytes;
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      try {
        git.kill('SIGTERM');
      } catch {
        // best effort
      }
      killTimer = setTimeout(() => {
        try {
          git.kill('SIGKILL');
        } catch {
          try {
            git.kill();
          } catch {
            // best effort
          }
        }
      }, GIT_KILL_GRACE_MS);
    }, GIT_TIMEOUT_MS);

    git.stdout.on('data', appendChunk);
    git.stderr.on('data', appendChunk);
    git.on('error', (err) => finalizeError(err instanceof Error ? err : new Error(String(err))));
    git.on('close', (code) => {
      const output = buffers.join('');
      if (timedOut) {
        finalizeError(new Error('GIT_COMMAND_TIMEOUT'));
        return;
      }
      if (code !== 0 && !truncated) {
        finalizeError(new Error('GIT_COMMAND_FAILED'));
        return;
      }
      if (truncated) {
        finalizeSuccess(`${output}\n...[output truncated]`);
        return;
      }
      finalizeSuccess(output);
    });
  });
}

function gitStatus(root: string) {
  return new Promise<string>((resolve, reject) => {
    runGitCommand(['-C', root, 'status', '--porcelain']).then(resolve).catch(reject);
  });
}

function gitDiff(root: string, relPath: string) {
  return new Promise<string>((resolve, reject) => {
    runGitCommand(['-C', root, 'diff', '--', relPath]).then(resolve).catch(reject);
  });
}
