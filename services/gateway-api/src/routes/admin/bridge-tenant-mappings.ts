import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { parsePaginationQuery } from './pagination.js';

const SOURCE_PLATFORM = '47dynamics';
const EXTERNAL_TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const logger = createLogger('admin-bridge-tenant-mappings');

function currentOrgId(request: any): string | null {
  return request.orgId ? String(request.orgId) : null;
}

function isPlatformAdmin(request: any): boolean {
  return String(request.userRole || '').trim() === 'platform_admin';
}

function parseBoolean(raw: unknown): boolean {
  const normalized = String(raw ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeExternalTenantId(raw: unknown): string {
  return String(raw ?? '').trim();
}

function isValidExternalTenantId(value: string): boolean {
  return value === '*' || EXTERNAL_TENANT_ID_PATTERN.test(value);
}

function normalizeMetadata(raw: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'metadata must be a JSON object when provided' };
  }
  return { ok: true, value: raw as Record<string, unknown> };
}

async function validateChatInOrg(pool: pg.Pool, chatId: string, orgId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM chats
     WHERE id = $1
       AND organization_id = $2
     LIMIT 1`,
    [chatId, orgId],
  );
  return result.rows.length > 0;
}

async function validateActiveAgent(pool: pg.Pool, agentId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM agents
     WHERE id = $1
       AND status = 'active'
     LIMIT 1`,
    [agentId],
  );
  return result.rows.length > 0;
}

export async function registerBridgeTenantMappingRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/integrations/47dynamics/tenant-mappings/health', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as {
      include_inactive?: string;
      all_orgs?: string;
      limit?: string;
    };

    const includeInactive = parseBoolean(query.include_inactive);
    const allOrgs = parseBoolean(query.all_orgs);
    const allowAllOrgs = allOrgs && isPlatformAdmin(request);
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);

    if (!allowAllOrgs && !orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    let where = `WHERE m.source_platform = $1`;
    const params: unknown[] = [SOURCE_PLATFORM];
    if (!includeInactive) {
      where += ` AND m.is_active = TRUE`;
    }
    if (!allowAllOrgs) {
      params.push(orgId);
      where += ` AND m.organization_id = $${params.length}`;
    }

    const statusRows = await pool.query(
      `SELECT
         m.external_tenant_id,
         m.organization_id,
         m.chat_id,
         m.agent_id,
         m.is_active,
         CASE WHEN c.id IS NULL THEN FALSE ELSE TRUE END AS chat_exists_in_org,
         CASE WHEN a.id IS NULL THEN FALSE ELSE TRUE END AS agent_is_active
       FROM bridge_tenant_mappings m
       LEFT JOIN chats c
         ON c.id = m.chat_id
        AND c.organization_id = m.organization_id
       LEFT JOIN agents a
         ON a.id = m.agent_id
        AND a.status = 'active'
       ${where}`,
      params,
    );

    const totalMappings = statusRows.rows.length;
    let invalidMappings = 0;
    let invalidActiveMappings = 0;
    const issues: Array<{
      external_tenant_id: string;
      organization_id: string;
      chat_id: string;
      agent_id: string;
      is_active: boolean;
      chat_exists_in_org: boolean;
      agent_is_active: boolean;
    }> = [];

    for (const row of statusRows.rows) {
      const isActive = Boolean(row.is_active);
      const chatValid = Boolean(row.chat_exists_in_org);
      const agentValid = Boolean(row.agent_is_active);
      const isValid = chatValid && agentValid;
      if (isValid) continue;

      invalidMappings += 1;
      if (isActive) invalidActiveMappings += 1;
      if (issues.length < limit) {
        issues.push({
          external_tenant_id: String(row.external_tenant_id || ''),
          organization_id: String(row.organization_id || ''),
          chat_id: String(row.chat_id || ''),
          agent_id: String(row.agent_id || ''),
          is_active: isActive,
          chat_exists_in_org: chatValid,
          agent_is_active: agentValid,
        });
      }
    }

    const strictModeReady = invalidActiveMappings === 0;
    return reply.send({
      success: true,
      data: {
        source_platform: SOURCE_PLATFORM,
        strict_mode_ready: strictModeReady,
        summary: {
          total_mappings: totalMappings,
          invalid_mappings: invalidMappings,
          invalid_active_mappings: invalidActiveMappings,
          valid_mappings: totalMappings - invalidMappings,
        },
        issues,
      },
    });
  });

  app.get('/integrations/47dynamics/tenant-mappings', async (request, reply) => {
    const orgId = currentOrgId(request);
    const query = request.query as {
      page?: string;
      per_page?: string;
      external_tenant_id?: string;
      include_inactive?: string;
      all_orgs?: string;
    };
    const pagination = parsePaginationQuery(query, { defaultPage: 1, defaultPerPage: 20, maxPerPage: 200 });
    if (!pagination.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: pagination.message } });
    }

    const includeInactive = parseBoolean(query.include_inactive);
    const allOrgs = parseBoolean(query.all_orgs);
    const allowAllOrgs = allOrgs && isPlatformAdmin(request);

    if (!allowAllOrgs && !orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    let where = `WHERE source_platform = $1`;
    const params: unknown[] = [SOURCE_PLATFORM];
    if (!includeInactive) {
      where += ` AND is_active = TRUE`;
    }
    if (!allowAllOrgs) {
      params.push(orgId);
      where += ` AND organization_id = $${params.length}`;
    }

    const externalTenantId = normalizeExternalTenantId(query.external_tenant_id);
    if (externalTenantId) {
      if (!isValidExternalTenantId(externalTenantId)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'external_tenant_id must be [a-zA-Z0-9_-]{1,64} or "*"' },
        });
      }
      params.push(externalTenantId);
      where += ` AND external_tenant_id = $${params.length}`;
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM bridge_tenant_mappings ${where}`, params);
    const total: number = countRes.rows[0]?.total ?? 0;

    const { page, perPage, offset } = pagination;
    const dataParams = [...params, perPage, offset];
    const result = await pool.query(
      `SELECT id, source_platform, external_tenant_id, organization_id, chat_id, agent_id, is_active, metadata, created_at, updated_at
       FROM bridge_tenant_mappings
       ${where}
       ORDER BY updated_at DESC, external_tenant_id ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return reply.send({
      success: true,
      data: result.rows,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    });
  });

  app.get('/integrations/47dynamics/tenant-mappings/resolve/:externalTenantId', async (request, reply) => {
    const orgId = currentOrgId(request);
    const { externalTenantId } = request.params as { externalTenantId: string };
    const tenantId = normalizeExternalTenantId(externalTenantId);
    if (!isValidExternalTenantId(tenantId) || tenantId === '*') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'externalTenantId must be [a-zA-Z0-9_-]{1,64}' },
      });
    }

    const isGlobalAdmin = isPlatformAdmin(request);
    if (!orgId && !isGlobalAdmin) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const params: unknown[] = [SOURCE_PLATFORM, tenantId];
    let orgFilter = '';
    if (!isGlobalAdmin) {
      params.push(orgId);
      orgFilter = ` AND organization_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT id, source_platform, external_tenant_id, organization_id, chat_id, agent_id, is_active, metadata, created_at, updated_at
       FROM bridge_tenant_mappings
       WHERE source_platform = $1
         AND is_active = TRUE
         AND external_tenant_id IN ($2, '*')
         ${orgFilter}
       ORDER BY CASE WHEN external_tenant_id = $2 THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
      params,
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No mapping found for external tenant id' },
      });
    }

    const resolved = result.rows[0];
    return reply.send({
      success: true,
      data: {
        ...resolved,
        resolved_via_wildcard: String(resolved.external_tenant_id) === '*',
      },
    });
  });

  app.post('/integrations/47dynamics/tenant-mappings', async (request, reply) => {
    const requestOrgId = currentOrgId(request);
    const body = (request.body || {}) as {
      external_tenant_id?: string;
      organization_id?: string;
      chat_id?: string;
      agent_id?: string;
      is_active?: boolean;
      metadata?: Record<string, unknown>;
    };

    const externalTenantId = normalizeExternalTenantId(body.external_tenant_id);
    if (!isValidExternalTenantId(externalTenantId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'external_tenant_id must be [a-zA-Z0-9_-]{1,64} or "*"' },
      });
    }
    if (externalTenantId === '*' && !isPlatformAdmin(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Wildcard mappings require platform admin privileges' },
      });
    }

    const targetOrgId = String(body.organization_id || requestOrgId || '').trim();
    if (!targetOrgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    if (targetOrgId !== requestOrgId && !isPlatformAdmin(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cross-organization mapping changes require platform admin privileges' },
      });
    }

    const chatId = String(body.chat_id || '').trim();
    if (!chatId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'chat_id is required' } });
    }
    const agentId = String(body.agent_id || '').trim();
    if (!agentId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'agent_id is required' } });
    }

    const metadata = normalizeMetadata(body.metadata);
    if (!metadata.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: metadata.message } });
    }

    if (!(await validateChatInOrg(pool, chatId, targetOrgId))) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'chat_id must belong to target organization' },
      });
    }
    if (!(await validateActiveAgent(pool, agentId))) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'agent_id must reference an active agent' },
      });
    }

    const id = uuidv7();
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;
    const actor = String((request as any).userId || '').trim() || 'system';
    const existing = await pool.query(
      `SELECT id, organization_id
       FROM bridge_tenant_mappings
       WHERE source_platform = $1
         AND external_tenant_id = $2
       LIMIT 1`,
      [SOURCE_PLATFORM, externalTenantId],
    );
    if (
      existing.rows.length > 0
      && String(existing.rows[0].organization_id || '').trim() !== targetOrgId
      && !isPlatformAdmin(request)
    ) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Mapping exists under another organization; platform admin required' },
      });
    }
    const metadataWithAudit = {
      ...metadata.value,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    };

    const upsert = await pool.query(
      `INSERT INTO bridge_tenant_mappings
         (id, source_platform, external_tenant_id, organization_id, chat_id, agent_id, is_active, metadata, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
       ON CONFLICT (source_platform, external_tenant_id)
       DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         chat_id = EXCLUDED.chat_id,
         agent_id = EXCLUDED.agent_id,
         is_active = EXCLUDED.is_active,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING id, source_platform, external_tenant_id, organization_id, chat_id, agent_id, is_active, metadata, created_at, updated_at`,
      [id, SOURCE_PLATFORM, externalTenantId, targetOrgId, chatId, agentId, isActive, JSON.stringify(metadataWithAudit)],
    );

    logger.info('Bridge tenant mapping upserted', {
      source_platform: SOURCE_PLATFORM,
      external_tenant_id: externalTenantId,
      organization_id: targetOrgId,
      chat_id: chatId,
      agent_id: agentId,
      is_active: isActive,
      actor_user_id: actor,
    });

    return reply.status(201).send({ success: true, data: upsert.rows[0] });
  });

  app.patch('/integrations/47dynamics/tenant-mappings/:externalTenantId', async (request, reply) => {
    const requestOrgId = currentOrgId(request);
    const { externalTenantId } = request.params as { externalTenantId: string };
    const tenantId = normalizeExternalTenantId(externalTenantId);
    if (!isValidExternalTenantId(tenantId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'externalTenantId must be [a-zA-Z0-9_-]{1,64} or "*"' },
      });
    }
    if (tenantId === '*' && !isPlatformAdmin(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Wildcard mappings require platform admin privileges' },
      });
    }

    const body = (request.body || {}) as {
      organization_id?: string;
      chat_id?: string;
      agent_id?: string;
      is_active?: boolean;
      metadata?: Record<string, unknown>;
    };
    const metadata = normalizeMetadata(body.metadata);
    if (!metadata.ok) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: metadata.message } });
    }

    const existing = await pool.query(
      `SELECT id, organization_id, chat_id, agent_id, is_active, metadata
       FROM bridge_tenant_mappings
       WHERE source_platform = $1
         AND external_tenant_id = $2
       LIMIT 1`,
      [SOURCE_PLATFORM, tenantId],
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Mapping not found' },
      });
    }

    const current = existing.rows[0] as {
      id: string;
      organization_id: string;
      chat_id: string;
      agent_id: string;
      is_active: boolean;
      metadata: Record<string, unknown> | null;
    };
    const isGlobalAdmin = isPlatformAdmin(request);
    if (!isGlobalAdmin && (!requestOrgId || current.organization_id !== requestOrgId)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient tenant permissions for this mapping' },
      });
    }

    const targetOrgId = String(body.organization_id || current.organization_id).trim();
    if (targetOrgId !== current.organization_id && !isGlobalAdmin) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cross-organization mapping changes require platform admin privileges' },
      });
    }

    const nextChatId = String(body.chat_id || current.chat_id).trim();
    const nextAgentId = String(body.agent_id || current.agent_id).trim();
    const nextIsActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(current.is_active);
    const actor = String((request as any).userId || '').trim() || 'system';
    const mergedMetadata = {
      ...(current.metadata || {}),
      ...(metadata.value || {}),
      updated_by: actor,
      updated_at: new Date().toISOString(),
    };

    if (!(await validateChatInOrg(pool, nextChatId, targetOrgId))) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'chat_id must belong to target organization' },
      });
    }
    if (!(await validateActiveAgent(pool, nextAgentId))) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'agent_id must reference an active agent' },
      });
    }

    const updated = await pool.query(
      `UPDATE bridge_tenant_mappings
       SET organization_id = $1,
           chat_id = $2,
           agent_id = $3,
           is_active = $4,
           metadata = $5::jsonb,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, source_platform, external_tenant_id, organization_id, chat_id, agent_id, is_active, metadata, created_at, updated_at`,
      [targetOrgId, nextChatId, nextAgentId, nextIsActive, JSON.stringify(mergedMetadata), current.id],
    );

    logger.info('Bridge tenant mapping updated', {
      source_platform: SOURCE_PLATFORM,
      external_tenant_id: tenantId,
      organization_id: targetOrgId,
      chat_id: nextChatId,
      agent_id: nextAgentId,
      is_active: nextIsActive,
      actor_user_id: actor,
    });

    return reply.send({ success: true, data: updated.rows[0] });
  });

  app.delete('/integrations/47dynamics/tenant-mappings/:externalTenantId', async (request, reply) => {
    const requestOrgId = currentOrgId(request);
    const { externalTenantId } = request.params as { externalTenantId: string };
    const tenantId = normalizeExternalTenantId(externalTenantId);
    if (!isValidExternalTenantId(tenantId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'externalTenantId must be [a-zA-Z0-9_-]{1,64} or "*"' },
      });
    }
    if (tenantId === '*' && !isPlatformAdmin(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Wildcard mappings require platform admin privileges' },
      });
    }

    const existing = await pool.query(
      `SELECT id, organization_id
       FROM bridge_tenant_mappings
       WHERE source_platform = $1
         AND external_tenant_id = $2
       LIMIT 1`,
      [SOURCE_PLATFORM, tenantId],
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Mapping not found' },
      });
    }
    const mappingOrgId = String(existing.rows[0].organization_id || '').trim();
    if (!isPlatformAdmin(request) && (!requestOrgId || requestOrgId !== mappingOrgId)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient tenant permissions for this mapping' },
      });
    }

    await pool.query(
      `UPDATE bridge_tenant_mappings
       SET is_active = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id],
    );

    logger.info('Bridge tenant mapping deactivated', {
      source_platform: SOURCE_PLATFORM,
      external_tenant_id: tenantId,
      organization_id: mappingOrgId,
      actor_user_id: String((request as any).userId || '').trim() || 'system',
    });

    return reply.send({ success: true });
  });
}
