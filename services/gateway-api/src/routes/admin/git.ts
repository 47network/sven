/**
 * Git Repository Admin Routes
 * Manage git repos, branches, PRs, and perform git operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../db.js';
import { resolveSecretRef } from '@sven/shared';
import { createGitRepo } from '@sven/shared/integrations/git';
import { v7 as uuidv7 } from 'uuid';
import { getIncidentStatus } from '../../services/IncidentService.js';

const trimSlash = (s: string) => { let i = s.length; while (i > 0 && s[i - 1] === '/') i--; return s.slice(0, i); };

interface GitRepoRequest {
  provider: 'local' | 'forgejo' | 'github';
  repoName: string;
  repoOwner?: string;
  repoUrl?: string;
  baseUrl?: string;
  sshKeyRef?: string;
  tokenRef?: string;
  defaultBranch?: string;
}

const ALLOWED_GIT_PROVIDERS = new Set(['local', 'forgejo', 'github']);
const ALLOWED_MERGE_STRATEGIES = new Set(['merge', 'squash', 'rebase']);
const GIT_REPO_SAFE_PROJECTION = `
  id,
  user_id,
  provider,
  repo_name,
  repo_owner,
  repo_url,
  default_branch,
  enabled,
  metadata,
  last_synced_at,
  created_at,
  updated_at
`;

const gitRepoOrgScopeCache = new WeakMap<object, Promise<boolean>>();

async function gitReposAreOrgScoped(db: Database): Promise<boolean> {
  let cached = gitRepoOrgScopeCache.get(db as object);
  if (!cached) {
    cached = (async () => {
      const res = await db.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'git_repos'
            AND column_name = 'organization_id'
          LIMIT 1`,
      );
      return res.rows.length > 0;
    })();
    gitRepoOrgScopeCache.set(db as object, cached);
  }
  return cached;
}

function parseRepoMetadataObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function inferForgejoBaseUrl(repoUrlRaw: unknown): string | null {
  const repoUrl = String(repoUrlRaw || '').trim();
  if (!repoUrl) return null;
  try {
    const parsed = new URL(repoUrl);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (h === 'metadata.google.internal' || h === '169.254.169.254') return true;
  const v4Parts = h.split('.');
  if (v4Parts.length === 4 && v4Parts.every(p => /^\d+$/.test(p))) {
    const [a, b] = v4Parts.map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function validateRepoUrlForProvider(provider: string, repoUrl: string): string | null {
  if (provider === 'local') {
    if (isHttpUrl(repoUrl)) {
      return 'repoUrl for local provider must be a filesystem path, not an http(s) URL';
    }
    return null;
  }
  if (provider === 'forgejo' || provider === 'github') {
    try {
      const parsed = new URL(repoUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'repoUrl for forgejo/github must be an http(s) URL';
      }
      if (isBlockedHost(parsed.hostname)) {
        return 'repoUrl cannot point to localhost, private, or metadata service addresses';
      }
      return null;
    } catch {
      return 'repoUrl for forgejo/github must be a valid URL';
    }
  }
  return null;
}

function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({
    success: false,
    error: { code, message },
  });
}

function sendSuccess(reply: FastifyReply, data: unknown, status: number = 200) {
  return reply.status(status).send({
    success: true,
    data,
  });
}

async function ensureIncidentWriteAllowed(reply: FastifyReply): Promise<boolean> {
  const status = await getIncidentStatus();
  if (!status.killSwitchActive && !status.lockdownActive && !status.forensicsActive) {
    return true;
  }
  sendError(reply, 423, 'INCIDENT_WRITE_BLOCKED', 'Write operations are blocked while incident controls are active');
  return false;
}

function currentOrgId(request: FastifyRequest): string | null {
  const orgId = String((request as any).orgId || '').trim();
  return orgId || null;
}

function normalizeGitBody(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function signalGitAuditWriteFailure(fastify: FastifyInstance, operation: string, err: unknown, context: Record<string, unknown>) {
  fastify.log.error(
    {
      err,
      operation,
      audit_write_failed: true,
      signal: 'git_audit_persistence_failure',
      ...context,
    },
    'Git audit persistence failure',
  );
}

async function loadEnabledRepoOrReply(
  db: Database,
  reply: FastifyReply,
  userId: string,
  orgId: string,
  repoId: string
): Promise<any | null> {
  const orgScoped = await gitReposAreOrgScoped(db);
  const activeRepo = await db.query(
    orgScoped
      ? 'SELECT * FROM git_repos WHERE id = $1 AND user_id = $2 AND organization_id = $3 AND enabled = true'
      : 'SELECT * FROM git_repos WHERE id = $1 AND user_id = $2 AND enabled = true',
    orgScoped ? [repoId, userId, orgId] : [repoId, userId]
  );
  if (activeRepo.rows.length > 0) {
    return activeRepo.rows[0];
  }

  const anyRepo = await db.query(
    orgScoped
      ? 'SELECT id, enabled FROM git_repos WHERE id = $1 AND user_id = $2 AND organization_id = $3'
      : 'SELECT id, enabled FROM git_repos WHERE id = $1 AND user_id = $2',
    orgScoped ? [repoId, userId, orgId] : [repoId, userId],
  );
  if (anyRepo.rows.length > 0 && anyRepo.rows[0].enabled === false) {
    sendError(reply, 404, 'DISABLED', 'Repository is disabled');
    return null;
  }

  sendError(reply, 404, 'NOT_FOUND', 'Repository not found');
  return null;
}

export async function registerGitRoutes(fastify: FastifyInstance, db: Database) {
  /**
   * List user's git repositories
   */
  fastify.get('/git/repos', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }

    try {
      const orgScoped = await gitReposAreOrgScoped(db);
      const repoRows = await db.query(
        orgScoped
          ? `SELECT ${GIT_REPO_SAFE_PROJECTION}
               FROM git_repos
              WHERE user_id = $1 AND organization_id = $2 AND enabled = true`
          : `SELECT ${GIT_REPO_SAFE_PROJECTION}
               FROM git_repos
              WHERE user_id = $1 AND enabled = true`,
        orgScoped ? [userId, orgId] : [userId],
      );
      return sendSuccess(reply, { repos: repoRows.rows, total: repoRows.rows.length });
    } catch (error) {
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list repositories');
    }
  });

  /**
   * Add a new git repository
   */
  fastify.post<{ Body: GitRepoRequest }>('/git/repos', async (request: FastifyRequest<{ Body: GitRepoRequest }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }

    const body = normalizeGitBody(request.body);
    if (!body) {
      return sendError(reply, 400, 'VALIDATION', 'request body must be a JSON object');
    }
    const { provider, repoName, repoOwner, repoUrl, baseUrl, sshKeyRef, tokenRef, defaultBranch } = body as unknown as GitRepoRequest;
    const normalizedRepoUrl = String(repoUrl || '').trim();
    const normalizedForgejoBaseUrl = trimSlash(String(baseUrl || '').trim());

    if (!provider || !repoName) {
      return sendError(reply, 400, 'VALIDATION', 'provider and repoName are required');
    }
    if (!ALLOWED_GIT_PROVIDERS.has(String(provider))) {
      return sendError(reply, 400, 'VALIDATION', 'provider must be one of local|forgejo|github');
    }
    if (!normalizedRepoUrl) {
      return sendError(reply, 400, 'VALIDATION', 'repoUrl is required');
    }
    const repoUrlValidationError = validateRepoUrlForProvider(String(provider), normalizedRepoUrl);
    if (repoUrlValidationError) {
      return sendError(reply, 400, 'VALIDATION', repoUrlValidationError);
    }

    if ((provider === 'forgejo' || provider === 'github') && !repoOwner) {
      return sendError(reply, 400, 'VALIDATION', 'repoOwner is required for forgejo/github');
    }
    if ((provider === 'forgejo' || provider === 'github') && !tokenRef) {
      return sendError(reply, 400, 'VALIDATION', 'tokenRef is required for forgejo/github');
    }
    if (provider === 'forgejo' && !normalizedForgejoBaseUrl) {
      return sendError(reply, 400, 'VALIDATION', 'baseUrl is required for forgejo');
    }

    const metadata = provider === 'forgejo'
      ? { baseUrl: normalizedForgejoBaseUrl }
      : {};

    try {
      const orgScoped = await gitReposAreOrgScoped(db);
      // Validate secret refs if provided
      if (sshKeyRef) {
        await resolveSecretRef(sshKeyRef);
      }
      if (tokenRef) {
        await resolveSecretRef(tokenRef);
      }

      const existingRepo = await db.query(
        orgScoped
          ? `SELECT id, enabled
               FROM git_repos
              WHERE user_id = $1 AND organization_id = $2 AND repo_url = $3
              LIMIT 1`
          : `SELECT id, enabled
               FROM git_repos
              WHERE user_id = $1 AND repo_url = $2
              LIMIT 1`,
        orgScoped ? [userId, orgId, normalizedRepoUrl] : [userId, normalizedRepoUrl]
      );
      if (existingRepo.rows.length > 0) {
        const existing = existingRepo.rows[0];
        if (existing.enabled === true) {
          return sendError(reply, 409, 'CONFLICT', 'Repository already exists');
        }

        const reactivated = await db.query(
          orgScoped
            ? `UPDATE git_repos
                 SET provider = $1,
                     repo_name = $2,
                     repo_owner = $3,
                     ssh_key_ref = $4,
                     token_ref = $5,
                     default_branch = $6,
                     enabled = true,
                     metadata = $7::jsonb,
                     updated_at = NOW()
               WHERE id = $8 AND user_id = $9
                 AND organization_id = $10
               RETURNING ${GIT_REPO_SAFE_PROJECTION}`
            : `UPDATE git_repos
                 SET provider = $1,
                     repo_name = $2,
                     repo_owner = $3,
                     ssh_key_ref = $4,
                     token_ref = $5,
                     default_branch = $6,
                     enabled = true,
                     metadata = $7::jsonb,
                     updated_at = NOW()
               WHERE id = $8 AND user_id = $9
               RETURNING ${GIT_REPO_SAFE_PROJECTION}`,
          orgScoped
            ? [
                provider,
                repoName,
                repoOwner || null,
                sshKeyRef || null,
                tokenRef || null,
                defaultBranch || 'main',
                JSON.stringify(metadata),
                existing.id,
                userId,
                orgId,
              ]
            : [
                provider,
                repoName,
                repoOwner || null,
                sshKeyRef || null,
                tokenRef || null,
                defaultBranch || 'main',
                JSON.stringify(metadata),
                existing.id,
                userId,
              ]
        );
        return sendSuccess(reply, reactivated.rows[0], 200);
      }

      const result = await db.query(
        orgScoped
          ? `INSERT INTO git_repos (id, user_id, organization_id, provider, repo_name, repo_owner, repo_url, ssh_key_ref, token_ref, default_branch, enabled, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11::jsonb)
               RETURNING ${GIT_REPO_SAFE_PROJECTION}`
          : `INSERT INTO git_repos (id, user_id, provider, repo_name, repo_owner, repo_url, ssh_key_ref, token_ref, default_branch, enabled, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10::jsonb)
               RETURNING ${GIT_REPO_SAFE_PROJECTION}`,
        orgScoped
          ? [uuidv7(), userId, orgId, provider, repoName, repoOwner || null, normalizedRepoUrl, sshKeyRef || null, tokenRef || null, defaultBranch || 'main', JSON.stringify(metadata)]
          : [uuidv7(), userId, provider, repoName, repoOwner || null, normalizedRepoUrl, sshKeyRef || null, tokenRef || null, defaultBranch || 'main', JSON.stringify(metadata)]
      );

      return sendSuccess(reply, result.rows[0], 201);
    } catch (error) {
      if ((error as any)?.code === '23505') {
        return sendError(reply, 409, 'CONFLICT', 'Repository already exists');
      }
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to add repository');
    }
  });

  /**
   * Get repository status
   */
  fastify.get<{ Params: { id: string } }>('/git/repos/:id/status', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }

    const { id } = request.params;

    try {
      const repoConfig = await loadEnabledRepoOrReply(db, reply, userId, orgId, id);
      if (!repoConfig) return;
      const metadata = parseRepoMetadataObject(repoConfig.metadata);
      const metadataBaseUrl = String(
        metadata.baseUrl
        || metadata.base_url
        || metadata.forgejoBaseUrl
        || metadata.forgejo_base_url
        || ''
      ).trim().replace(/\/+$/, '');
      const inferredBaseUrl = inferForgejoBaseUrl(repoConfig.repo_url);

      // Resolve credentials
      const config: Record<string, unknown> = {
        repoPath: repoConfig.repo_url,
        owner: repoConfig.repo_owner,
        repo: repoConfig.repo_name,
      };
      if (repoConfig.provider === 'forgejo') {
        const forgejoBaseUrl = metadataBaseUrl || inferredBaseUrl || '';
        if (!forgejoBaseUrl) {
          return sendError(reply, 400, 'VALIDATION', 'Forgejo base URL is required for forgejo repositories');
        }
        config.baseUrl = forgejoBaseUrl;
      }

      if (repoConfig.token_ref) {
        config.token = await resolveSecretRef(repoConfig.token_ref);
      }

      const gitRepo = createGitRepo(repoConfig.provider, config);
      const status = await (gitRepo as any).getStatus();

      return sendSuccess(reply, {
        repoId: id,
        provider: repoConfig.provider,
        ...status,
      });
    } catch (error) {
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to get repository status');
    }
  });

  /**
   * Sync repository from remote
   */
  fastify.post<{ Params: { id: string } }>('/git/repos/:id/sync', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }

    const { id } = request.params;

    let operationId: string | null = null;
    try {
      const repo = await loadEnabledRepoOrReply(db, reply, userId, orgId, id);
      if (!repo) return;

      const metadata = parseRepoMetadataObject(repo.metadata);
      const metadataBaseUrl = String(
        metadata.baseUrl || metadata.base_url || metadata.forgejoBaseUrl || metadata.forgejo_base_url || ''
      )
        .trim()
        .replace(/\/+$/, '');
      const inferredBaseUrl = inferForgejoBaseUrl(repo.repo_url);

      const config: Record<string, unknown> = {
        repoPath: repo.repo_url,
        owner: repo.repo_owner,
        repo: repo.repo_name,
      };
      if (repo.provider === 'forgejo') {
        const forgejoBaseUrl = metadataBaseUrl || inferredBaseUrl || '';
        if (!forgejoBaseUrl) {
          return sendError(reply, 400, 'VALIDATION', 'Forgejo base URL is required for forgejo repositories');
        }
        config.baseUrl = forgejoBaseUrl;
      }
      if (repo.token_ref) {
        config.token = await resolveSecretRef(repo.token_ref);
      } else if (repo.provider === 'forgejo' || repo.provider === 'github') {
        return sendError(reply, 400, 'VALIDATION', 'tokenRef is required for forgejo/github');
      }

      const gitRepo = createGitRepo(repo.provider, config) as any;
      const defaultBranch = String(repo.default_branch || 'main').trim() || 'main';
      let syncMode: 'pull' | 'status_fetch';

      try {
        const opResult = await db.query(
          `INSERT INTO git_operations (id, repo_id, operation_type, status, details, triggered_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           RETURNING id`,
          [uuidv7(), id, 'pull', 'in_progress', JSON.stringify({ provider: repo.provider, default_branch: defaultBranch }), userId]
        );
        operationId = String(opResult.rows[0]?.id || '');
      } catch (logError) {
        signalGitAuditWriteFailure(fastify, 'pull.in_progress', logError, { repo_id: id, user_id: userId, org_id: orgId });
      }

      if (typeof gitRepo.pull === 'function') {
        await gitRepo.pull(defaultBranch, 'origin');
        syncMode = 'pull';
      } else if (typeof gitRepo.getStatus === 'function') {
        await gitRepo.getStatus();
        syncMode = 'status_fetch';
      } else {
        return sendError(reply, 400, 'UNSUPPORTED_PROVIDER', `Provider "${repo.provider}" does not support repository sync`);
      }

      const orgScoped = await gitReposAreOrgScoped(db);
      await db.query(
        orgScoped
          ? 'UPDATE git_repos SET last_synced_at = NOW() WHERE id = $1 AND user_id = $2 AND organization_id = $3'
          : 'UPDATE git_repos SET last_synced_at = NOW() WHERE id = $1 AND user_id = $2',
        orgScoped ? [id, userId, orgId] : [id, userId],
      );

      if (operationId) {
        await db
          .query(
            `UPDATE git_operations
             SET status = 'success', details = $2::jsonb
             WHERE id = $1`,
            [operationId, JSON.stringify({ provider: repo.provider, default_branch: defaultBranch, sync_mode: syncMode })]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pull.success.update', logError, { repo_id: id, user_id: userId, org_id: orgId, operation_id: operationId });
          });
      } else {
        await db
          .query(
            `INSERT INTO git_operations (id, repo_id, operation_type, status, details, triggered_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
            [uuidv7(), id, 'pull', 'success', JSON.stringify({ provider: repo.provider, default_branch: defaultBranch, sync_mode: syncMode }), userId]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pull.success.insert', logError, { repo_id: id, user_id: userId, org_id: orgId });
          });
      }

      return sendSuccess(reply, { message: 'Repository sync completed' });
    } catch (error) {
      if (operationId) {
        await db
          .query(
            `UPDATE git_operations
             SET status = 'failed', error_message = $2
             WHERE id = $1`,
            [operationId, error instanceof Error ? error.message : 'Sync operation failed']
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pull.failed.update', logError, { repo_id: id, user_id: userId, org_id: orgId, operation_id: operationId });
          });
      } else {
        await db
          .query(
            `INSERT INTO git_operations (id, repo_id, operation_type, status, details, error_message, triggered_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [uuidv7(), id, 'pull', 'failed', JSON.stringify({ repo_id: id }), error instanceof Error ? error.message : 'Sync operation failed', userId]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pull.failed.insert', logError, { repo_id: id, user_id: userId, org_id: orgId });
          });
      }
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to sync repository');
    }
  });

  /**
   * Get repository's pull requests
   */
  fastify.get<{ Params: { id: string }; Querystring: { state?: string } }>('/git/repos/:id/pull-requests', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { state?: string } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }

    const { id } = request.params;
    const { state } = request.query;

    try {
      const repo = await loadEnabledRepoOrReply(db, reply, userId, orgId, id);
      if (!repo) return;

      let query = 'SELECT * FROM git_pull_requests WHERE repo_id = $1';
      const params: any[] = [id];

      if (state) {
        query += ` AND status = $${params.length + 1}`;
        params.push(state);
      }

      const prsResult = await db.query(query, params);
      return sendSuccess(reply, { pullRequests: prsResult.rows, total: prsResult.rows.length });
    } catch (error) {
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to get pull requests');
    }
  });

  /**
   * Merge a pull request (requires approval for main)
   */
  fastify.post<{ Params: { repo_id: string; pr_id: string }; Body: { mergeStrategy?: string; protectedBranchApproved?: boolean } }>(
    '/git/repos/:repo_id/pull-requests/:pr_id/merge',
    async (
      request: FastifyRequest<{ Params: { repo_id: string; pr_id: string }; Body: { mergeStrategy?: string; protectedBranchApproved?: boolean } }>,
      reply: FastifyReply
    ) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }
    if (!(await ensureIncidentWriteAllowed(reply))) {
      return;
    }

    const { repo_id, pr_id } = request.params;
    const body = normalizeGitBody(request.body);
    if (!body) {
      return sendError(reply, 400, 'VALIDATION', 'request body must be a JSON object');
    }
    const { mergeStrategy, protectedBranchApproved } = body as {
      mergeStrategy?: string;
      protectedBranchApproved?: boolean;
    };
    const mergeStrategyValue = String(mergeStrategy || 'merge').trim().toLowerCase();
    if (!ALLOWED_MERGE_STRATEGIES.has(mergeStrategyValue)) {
      return sendError(reply, 400, 'VALIDATION', 'mergeStrategy must be one of merge|squash|rebase');
    }
    if (protectedBranchApproved !== undefined && typeof protectedBranchApproved !== 'boolean') {
      return sendError(reply, 400, 'VALIDATION', 'protectedBranchApproved must be a boolean when provided');
    }

    let operationId: string | null = null;
    try {
      const repo = await loadEnabledRepoOrReply(db, reply, userId, orgId, repo_id);
      if (!repo) return;

      const prResult = await db.query('SELECT * FROM git_pull_requests WHERE id = $1 AND repo_id = $2', [pr_id, repo_id]);

      if (prResult.rows.length === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Pull request not found');
      }

      const pr = prResult.rows[0];
      if (String(pr.status || '').toLowerCase() !== 'open') {
        return sendError(reply, 409, 'INVALID_STATE', 'Pull request is not open');
      }

      // Enforce explicit approval for protected-branch merges.
      const targetBranch = String(pr.target_branch || '').trim().toLowerCase();
      if ((targetBranch === 'main' || targetBranch === 'master') && protectedBranchApproved !== true) {
        await db
          .query(
            `INSERT INTO git_operations (id, repo_id, operation_type, status, details, error_message, triggered_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [
              uuidv7(),
              repo_id,
              'pr_merge',
              'failed',
              JSON.stringify({ pr_id, merge_strategy: mergeStrategyValue, target_branch: pr.target_branch }),
              'Protected branch merge requires approval',
              userId,
            ]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pr_merge.failed.approval_required', logError, { repo_id, pr_id, user_id: userId, org_id: orgId });
          });
        return sendError(reply, 409, 'APPROVAL_REQUIRED', 'Protected branch merge requires explicit approval');
      }

      const metadata = parseRepoMetadataObject(repo.metadata);
      const metadataBaseUrl = String(
        metadata.baseUrl || metadata.base_url || metadata.forgejoBaseUrl || metadata.forgejo_base_url || ''
      )
        .trim()
        .replace(/\/+$/, '');
      const inferredBaseUrl = inferForgejoBaseUrl(repo.repo_url);

      const config: Record<string, unknown> = {
        repoPath: repo.repo_url,
        owner: repo.repo_owner,
        repo: repo.repo_name,
      };
      if (repo.provider === 'forgejo') {
        const forgejoBaseUrl = metadataBaseUrl || inferredBaseUrl || '';
        if (!forgejoBaseUrl) {
          return sendError(reply, 400, 'VALIDATION', 'Forgejo base URL is required for forgejo repositories');
        }
        config.baseUrl = forgejoBaseUrl;
      }
      if (repo.token_ref) {
        config.token = await resolveSecretRef(repo.token_ref);
      } else if (repo.provider === 'forgejo' || repo.provider === 'github') {
        return sendError(reply, 400, 'VALIDATION', 'tokenRef is required for forgejo/github');
      }

      const prNumber = Number(pr.pr_number);
      if (!Number.isInteger(prNumber) || prNumber <= 0) {
        return sendError(reply, 400, 'VALIDATION', 'Pull request number is required for merge');
      }

      const gitRepo = createGitRepo(repo.provider, config) as any;
      if (typeof gitRepo.mergePullRequest !== 'function') {
        return sendError(reply, 400, 'UNSUPPORTED_PROVIDER', `Provider "${repo.provider}" does not support pull-request merge`);
      }

      try {
        const opResult = await db.query(
          `INSERT INTO git_operations (id, repo_id, operation_type, status, details, triggered_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           RETURNING id`,
          [
            uuidv7(),
            repo_id,
            'pr_merge',
            'in_progress',
            JSON.stringify({ pr_id, merge_strategy: mergeStrategyValue, target_branch: pr.target_branch }),
            userId,
          ]
        );
        operationId = String(opResult.rows[0]?.id || '');
      } catch (logError) {
        signalGitAuditWriteFailure(fastify, 'pr_merge.in_progress', logError, { repo_id, pr_id, user_id: userId, org_id: orgId });
      }

      const mergeCommit = await gitRepo.mergePullRequest(String(prNumber), mergeStrategyValue);
      await db.query(
        `UPDATE git_pull_requests
         SET status = 'merged', merged_at = NOW()
         WHERE id = $1 AND repo_id = $2`,
        [pr_id, repo_id]
      );

      if (operationId) {
        await db
          .query(
            `UPDATE git_operations
             SET status = 'success', details = $2::jsonb
             WHERE id = $1`,
            [
              operationId,
              JSON.stringify({
                pr_id,
                merge_strategy: mergeStrategyValue,
                target_branch: pr.target_branch,
                merge_commit: String(mergeCommit || ''),
              }),
            ]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pr_merge.success.update', logError, { repo_id, pr_id, user_id: userId, org_id: orgId, operation_id: operationId });
          });
      } else {
        await db
          .query(
            `INSERT INTO git_operations (id, repo_id, operation_type, status, details, triggered_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
            [
              uuidv7(),
              repo_id,
              'pr_merge',
              'success',
              JSON.stringify({
                pr_id,
                merge_strategy: mergeStrategyValue,
                target_branch: pr.target_branch,
                merge_commit: String(mergeCommit || ''),
              }),
              userId,
            ]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pr_merge.success.insert', logError, { repo_id, pr_id, user_id: userId, org_id: orgId });
          });
      }

      return sendSuccess(reply, {
        message: 'Pull request merged',
        pr_id,
        merge_commit: String(mergeCommit || ''),
      });
    } catch (error) {
      if (operationId) {
        await db
          .query(
            `UPDATE git_operations
             SET status = 'failed', error_message = $2
             WHERE id = $1`,
            [operationId, error instanceof Error ? error.message : 'Merge operation failed']
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pr_merge.failed.update', logError, { repo_id, pr_id, user_id: userId, org_id: orgId, operation_id: operationId });
          });
      } else {
        await db
          .query(
            `INSERT INTO git_operations (id, repo_id, operation_type, status, details, error_message, triggered_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [
              uuidv7(),
              repo_id,
              'pr_merge',
              'failed',
              JSON.stringify({ pr_id, merge_strategy: mergeStrategyValue }),
              error instanceof Error ? error.message : 'Merge operation failed',
              userId,
            ]
          )
          .catch((logError) => {
            signalGitAuditWriteFailure(fastify, 'pr_merge.failed.insert', logError, { repo_id, pr_id, user_id: userId, org_id: orgId });
          });
      }
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to merge pull request');
    }
  });

  /**
   * Delete a repository
   */
  fastify.delete<{ Params: { id: string } }>('/git/repos/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = request.user?.id as string;
    const orgId = currentOrgId(request);
    if (!userId) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (!orgId) {
      return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
    }

    const { id } = request.params;

    try {
      const orgScoped = await gitReposAreOrgScoped(db);
      const result = await db.query(
        orgScoped
          ? 'UPDATE git_repos SET enabled = false WHERE id = $1 AND user_id = $2 AND organization_id = $3 RETURNING *'
          : 'UPDATE git_repos SET enabled = false WHERE id = $1 AND user_id = $2 RETURNING *',
        orgScoped ? [id, userId, orgId] : [id, userId],
      );

      if (result.rows.length === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Repository not found');
      }

      return sendSuccess(reply, { message: 'Repository disabled' });
    } catch (error) {
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to delete repository');
    }
  });
}
