import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function slugify(input: string, sep: string): string {
  let result = '';
  let prevSep = true;
  for (const ch of input) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      result += ch;
      prevSep = false;
    } else if (!prevSep) {
      result += sep;
      prevSep = true;
    }
  }
  if (result.endsWith(sep)) result = result.slice(0, -1);
  return result;
}

function toSlug(input: string): string {
  return slugify(input.toLowerCase().trim(), '-').slice(0, 48);
}

function toTenantSchema(slug: string): string {
  const normalized = slugify(String(slug || '').toLowerCase(), '_').slice(0, 48);
  const schema = `tenant_${normalized || 'default'}`.slice(0, 63);
  return schema.replace(/_+$/g, '');
}

function assertSafeSchemaName(schema: string): boolean {
  return /^[a-z][a-z0-9_]{2,62}$/.test(schema);
}

function assertSafeDatabaseName(databaseName: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_-]{1,62}$/.test(databaseName);
}

const ALLOWED_CONNECTION_REF_SCHEMES = new Set(['env', 'vault', 'sops']);

function parseConnectionRefScheme(connectionRef: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([A-Za-z0-9._/-]{1,120})$/.exec(connectionRef);
  if (!match) return null;
  return match[1].toLowerCase();
}

function assertSafeConnectionRef(connectionRef: string): boolean {
  const scheme = parseConnectionRefScheme(connectionRef);
  return Boolean(scheme && ALLOWED_CONNECTION_REF_SCHEMES.has(scheme));
}

function sanitizeStorageMappingRow(row: Record<string, unknown>): Record<string, unknown> {
  const rawConnectionRef =
    typeof row.connection_ref === 'string'
      ? row.connection_ref.trim()
      : '';
  const scheme = rawConnectionRef ? parseConnectionRefScheme(rawConnectionRef) : null;
  const { connection_ref: _ignoredConnectionRef, ...safeRow } = row;
  return {
    ...safeRow,
    connection_ref_present: Boolean(rawConnectionRef),
    connection_ref_scheme: scheme,
  };
}

const NUMERIC_20_6_MAX_INTEGER_DIGITS = 14;
const NUMERIC_20_6_MAX_FRACTION_DIGITS = 6;
const ACCOUNT_MEMBERSHIP_ROLES = new Set(['owner', 'admin', 'operator', 'member', 'viewer']);

function normalizeNumeric20_6(
  value: unknown,
  fieldName: string,
  options?: { allowZero?: boolean },
): { ok: true; value: string } | { ok: false; message: string } {
  const allowZero = Boolean(options?.allowZero);
  const raw = typeof value === 'number' ? value.toString() : String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return { ok: false, message: `${fieldName} must be a non-negative decimal number` };
  }
  const [integerPartRaw, fractionPartRaw = ''] = raw.split('.');
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, '');
  if (integerPart.length > NUMERIC_20_6_MAX_INTEGER_DIGITS) {
    return {
      ok: false,
      message: `${fieldName} exceeds NUMERIC(20,6) maximum integer digits (${NUMERIC_20_6_MAX_INTEGER_DIGITS})`,
    };
  }
  if (fractionPartRaw.length > NUMERIC_20_6_MAX_FRACTION_DIGITS) {
    return {
      ok: false,
      message: `${fieldName} must have at most ${NUMERIC_20_6_MAX_FRACTION_DIGITS} decimal places`,
    };
  }
  const normalized = `${integerPart}.${fractionPartRaw.padEnd(NUMERIC_20_6_MAX_FRACTION_DIGITS, '0')}`;
  if (!allowZero && /^0\.0{6}$/.test(normalized)) {
    return { ok: false, message: `${fieldName} must be a positive number` };
  }
  return { ok: true, value: normalized };
}

const USAGE_METADATA_MAX_BYTES = 8 * 1024;
const USAGE_METADATA_MAX_DEPTH = 6;
const USAGE_METADATA_MAX_KEYS = 100;

function validateUsageMetadata(
  metadata: unknown,
): { ok: true; json: string } | { ok: false; message: string } {
  if (metadata === undefined || metadata === null) {
    return { ok: true, json: '{}' };
  }
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { ok: false, message: 'metadata must be an object' };
  }

  let keyCount = 0;
  const stack: Array<{ value: unknown; depth: number }> = [{ value: metadata, depth: 1 }];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.depth > USAGE_METADATA_MAX_DEPTH) {
      return { ok: false, message: `metadata depth must be <= ${USAGE_METADATA_MAX_DEPTH}` };
    }
    if (current.value && typeof current.value === 'object') {
      if (seen.has(current.value)) {
        return { ok: false, message: 'metadata must not contain circular references' };
      }
      seen.add(current.value);
    }
    if (!current.value || typeof current.value !== 'object') continue;

    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        stack.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }

    const entries = Object.entries(current.value as Record<string, unknown>);
    keyCount += entries.length;
    if (keyCount > USAGE_METADATA_MAX_KEYS) {
      return { ok: false, message: `metadata key count must be <= ${USAGE_METADATA_MAX_KEYS}` };
    }
    for (const [, value] of entries) {
      stack.push({ value, depth: current.depth + 1 });
    }
  }

  let serialized = '';
  try {
    serialized = JSON.stringify(metadata);
  } catch {
    return { ok: false, message: 'metadata must be JSON-serializable' };
  }
  if (Buffer.byteLength(serialized, 'utf8') > USAGE_METADATA_MAX_BYTES) {
    return { ok: false, message: `metadata must be <= ${USAGE_METADATA_MAX_BYTES} bytes` };
  }
  return { ok: true, json: serialized };
}

function parseOptionalIsoTimestamp(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const epoch = Date.parse(raw);
  if (!Number.isFinite(epoch)) return null;
  return new Date(epoch).toISOString();
}

const GOVERNANCE_ROLES = new Set(['owner', 'admin', 'operator']);

function isActiveGovernancePrincipal(role: string, status: string): boolean {
  return status === 'active' && GOVERNANCE_ROLES.has(role);
}

export async function registerAccountRoutes(app: FastifyInstance, pool: pg.Pool) {
  async function ensureAccountAdmin(accountId: string, actorUserId: string): Promise<boolean> {
    const membership = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1
         AND user_id = $2
         AND status = 'active'
         AND role IN ('owner', 'admin', 'operator')`,
      [accountId, actorUserId],
    );
    return membership.rows.length > 0;
  }

  app.get('/accounts', async (request, reply) => {
    const actorUserId = String((request as any).userId || '');
    const result = await pool.query(
      `SELECT
         o.id,
         o.slug,
         o.name,
         o.owner_user_id,
         o.created_at,
         o.updated_at,
         COUNT(m.user_id)::int AS member_count
       FROM organizations o
       INNER JOIN organization_memberships am
         ON am.organization_id = o.id
        AND am.user_id = $1
        AND am.status = 'active'
       LEFT JOIN organization_memberships m
         ON m.organization_id = o.id
        AND m.status = 'active'
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [actorUserId],
    );
    reply.send({ success: true, data: { rows: result.rows } });
  });

  app.post('/accounts', async (request, reply) => {
    const body = (request.body || {}) as { name?: string; slug?: string };
    const name = String(body.name || '').trim();
    if (name.length < 2) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name must be at least 2 characters' },
      });
    }

    const fallbackSlug = toSlug(name);
    let slug = toSlug(body.slug || fallbackSlug);
    if (!slug) slug = `org-${Date.now().toString(36)}`;

    const ownerUserId = String((request as any).userId || '');
    const organizationId = uuidv7();
    const schemaName = toTenantSchema(slug);
    let storageProvisioning: {
      requested_mode: 'dedicated_schema';
      effective_mode: 'shared_schema' | 'dedicated_schema';
      provisioned: boolean;
      warning: string | null;
    } = {
      requested_mode: 'dedicated_schema',
      effective_mode: 'shared_schema',
      provisioned: false,
      warning: null,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO organizations (id, slug, name, owner_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [organizationId, slug, name, ownerUserId],
      );
      await client.query(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'owner', 'active', NOW(), NOW())
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [uuidv7(), organizationId, ownerUserId],
      );
      await client.query(
        `UPDATE users
         SET active_organization_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [ownerUserId, organizationId],
      );

      await client.query(
        `INSERT INTO tenant_storage_mapping
           (id, organization_id, storage_mode, schema_name, provisioned, notes, created_at, updated_at)
         VALUES ($1, $2, 'shared_schema', NULL, FALSE, $3, NOW(), NOW())`,
        [uuidv7(), organizationId, 'default shared-schema mode'],
      );

      if (assertSafeSchemaName(schemaName)) {
        try {
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
          await client.query(
            `UPDATE tenant_storage_mapping
             SET storage_mode = 'dedicated_schema',
                 schema_name = $2,
                 provisioned = TRUE,
                 notes = $3,
                 updated_at = NOW()
             WHERE organization_id = $1`,
            [organizationId, schemaName, 'auto-provisioned schema on account create'],
          );
          storageProvisioning = {
            requested_mode: 'dedicated_schema',
            effective_mode: 'dedicated_schema',
            provisioned: true,
            warning: null,
          };
        } catch {
          storageProvisioning = {
            requested_mode: 'dedicated_schema',
            effective_mode: 'shared_schema',
            provisioned: false,
            warning: 'dedicated schema auto-provision failed; shared_schema fallback retained',
          };
        }
      } else {
        storageProvisioning = {
          requested_mode: 'dedicated_schema',
          effective_mode: 'shared_schema',
          provisioned: false,
          warning: 'dedicated schema auto-provision skipped due to invalid schema name',
        };
      }
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (String(err?.code) === '23505') {
        return reply.status(409).send({
          success: false,
          error: { code: 'SLUG_TAKEN', message: 'account slug already exists' },
        });
      }
      throw err;
    } finally {
      client.release();
    }

    reply.status(201).send({
      success: true,
      data: { id: organizationId, slug, name, owner_user_id: ownerUserId, storage_provisioning: storageProvisioning },
    });
  });

  app.post('/accounts/:id/members', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const actorUserId = String((request as any).userId || '');
    const body = (request.body || {}) as { user_id?: string; role?: string };
    const userId = String(body.user_id || '').trim();
    const requestedRole = String(body.role || '').trim();
    if (requestedRole && !ACCOUNT_MEMBERSHIP_ROLES.has(requestedRole)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'role must be one of: owner, admin, operator, member, viewer' },
      });
    }
    const role = requestedRole || 'member';

    if (!userId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'user_id is required' },
      });
    }

    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can manage members' },
      });
    }

    if (role === 'owner' || role === 'admin') {
      const actorMembership = await pool.query(
        `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
        [accountId, actorUserId],
      );
      const actorRole = actorMembership.rows[0]?.role;
      if (actorRole !== 'owner') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only account owner can assign owner or admin roles' },
        });
      }
    }

    if (userId === actorUserId && (role === 'owner' || role === 'admin')) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot self-assign elevated roles' },
      });
    }

    const targetUser = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (targetUser.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'user not found' },
      });
    }

    const existingAccount = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [accountId]);
    if (existingAccount.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'account not found' },
      });
    }

    const membershipId = uuidv7();
    await pool.query(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()`,
      [membershipId, accountId, userId, role],
    );

    await pool.query(
      `UPDATE users
       SET active_organization_id = COALESCE(active_organization_id, $2), updated_at = NOW()
       WHERE id = $1`,
      [userId, accountId],
    );

    reply.send({
      success: true,
      data: { account_id: accountId, user_id: userId, role, status: 'active' },
    });
  });

  app.post('/accounts/:id/activate', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const userId = String((request as any).userId || '');

    const membership = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [accountId, userId],
    );
    if (membership.rows.length === 0) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not a member of this account' },
      });
    }

    await pool.query(
      `UPDATE users
       SET active_organization_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, accountId],
    );

    reply.send({ success: true, data: { active_account_id: accountId } });
  });

  app.get('/accounts/:id/storage', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const actorUserId = String((request as any).userId || '');
    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can view storage mapping' },
      });
    }

    const row = await pool.query(
      `SELECT organization_id, storage_mode, schema_name, database_name, connection_ref, provisioned, notes, created_at, updated_at
       FROM tenant_storage_mapping
       WHERE organization_id = $1`,
      [accountId],
    );
    if (row.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'storage mapping not found' },
      });
    }
    reply.send({ success: true, data: sanitizeStorageMappingRow(row.rows[0] as Record<string, unknown>) });
  });

  app.put('/accounts/:id/storage', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const actorUserId = String((request as any).userId || '');
    const body = (request.body || {}) as {
      storage_mode?: string;
      schema_name?: string;
      database_name?: string;
      connection_ref?: string;
      notes?: string;
    };
    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can manage storage mapping' },
      });
    }

    const mode = String(body.storage_mode || '').trim();
    if (!['shared_schema', 'dedicated_schema', 'dedicated_database'].includes(mode)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'storage_mode must be shared_schema, dedicated_schema, or dedicated_database' },
      });
    }

    const nextSchema = mode === 'dedicated_schema'
      ? String(body.schema_name || toTenantSchema(accountId)).trim()
      : null;
    const nextDatabaseName = mode === 'dedicated_database'
      ? String(body.database_name || '').trim()
      : null;
    const nextConnectionRef = mode === 'dedicated_database'
      ? String(body.connection_ref || '').trim()
      : null;
    if (nextSchema && !assertSafeSchemaName(nextSchema)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'schema_name must match ^[a-z][a-z0-9_]{2,62}$' },
      });
    }
    if (mode === 'dedicated_database') {
      if (!nextDatabaseName || !nextConnectionRef) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'database_name and connection_ref are required for dedicated_database',
          },
        });
      }
      if (!assertSafeDatabaseName(nextDatabaseName)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'database_name must match ^[a-zA-Z][a-zA-Z0-9_-]{1,62}$',
          },
        });
      }
      if (!assertSafeConnectionRef(nextConnectionRef)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'connection_ref must use env://, vault://, or sops:// scheme with safe path characters',
          },
        });
      }
    }

    if (mode === 'dedicated_schema' && nextSchema) {
      try {
        // nextSchema is validated by assertSafeSchemaName (^[a-z][a-z0-9_]{2,62}$).
        // DDL identifiers cannot use $N params, so quote the validated identifier.
        await pool.query(`CREATE SCHEMA IF NOT EXISTS "${nextSchema.replace(/"/g, '""')}"`);
      } catch {
        return reply.status(500).send({
          success: false,
          error: { code: 'SCHEMA_PROVISION_FAILED', message: 'Failed to create tenant schema' },
        });
      }
    }

    const provisioned = mode === 'dedicated_schema';
    const notes = body.notes ? String(body.notes) : null;
    const effectiveNotes = mode === 'dedicated_database'
      ? (notes || 'dedicated_database pending connectivity/provisioning verification')
      : notes;

    const upsert = await pool.query(
      `INSERT INTO tenant_storage_mapping
         (id, organization_id, storage_mode, schema_name, database_name, connection_ref, provisioned, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET
         storage_mode = EXCLUDED.storage_mode,
         schema_name = EXCLUDED.schema_name,
         database_name = EXCLUDED.database_name,
         connection_ref = EXCLUDED.connection_ref,
         provisioned = EXCLUDED.provisioned,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING organization_id, storage_mode, schema_name, database_name, connection_ref, provisioned, notes, created_at, updated_at`,
      [
        uuidv7(),
        accountId,
        mode,
        nextSchema,
        nextDatabaseName,
        nextConnectionRef,
        provisioned,
        effectiveNotes,
      ],
    );

    reply.send({ success: true, data: sanitizeStorageMappingRow(upsert.rows[0] as Record<string, unknown>) });
  });

  app.post('/accounts/:id/usage/events', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const actorUserId = String((request as any).userId || '');
    const body = (request.body || {}) as {
      source?: string;
      metric_type?: string;
      quantity?: number;
      unit_cost_usd?: number;
      feature_key?: string;
      occurred_at?: string;
      user_id?: string;
      session_id?: string;
      model_id?: string;
      metadata?: Record<string, unknown>;
    };

    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can record usage events' },
      });
    }

    const source = String(body.source || '').trim().toLowerCase();
    const metricType = String(body.metric_type || '').trim().toLowerCase();
    const quantity = Number(body.quantity);
    const unitCostUsd = Number(body.unit_cost_usd ?? 0);
    if (!['llm', 'tool', 'storage', 'network', 'compute', 'custom'].includes(source)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'source must be one of: llm, tool, storage, network, compute, custom' },
      });
    }
    if (!['tokens', 'requests', 'seconds', 'bytes', 'usd', 'events'].includes(metricType)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'metric_type must be one of: tokens, requests, seconds, bytes, usd, events' },
      });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'quantity must be a positive number' },
      });
    }
    if (!Number.isFinite(unitCostUsd) || unitCostUsd < 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'unit_cost_usd must be >= 0' },
      });
    }

    const quantityNumericValidation = normalizeNumeric20_6(body.quantity, 'quantity', { allowZero: false });
    if (!quantityNumericValidation.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: quantityNumericValidation.message },
      });
    }
    const unitCostNumericValidation = normalizeNumeric20_6(body.unit_cost_usd ?? 0, 'unit_cost_usd', { allowZero: true });
    if (!unitCostNumericValidation.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: unitCostNumericValidation.message },
      });
    }
    const metadataValidation = validateUsageMetadata(body.metadata);
    if (!metadataValidation.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: metadataValidation.message },
      });
    }
    const occurredAtIso = body.occurred_at
      ? parseOptionalIsoTimestamp(body.occurred_at)
      : null;
    if (body.occurred_at && !occurredAtIso) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'occurred_at must be a valid ISO timestamp' },
      });
    }

    const quantityNumeric = quantityNumericValidation.value;
    const unitCostUsdNumeric = unitCostNumericValidation.value;
    const attributionUserId = String(body.user_id || '').trim();
    const attributionSessionId = String(body.session_id || '').trim();
    const attributionModelId = String(body.model_id || '').trim();

    if (attributionUserId) {
      const userInAccount = await pool.query(
        `SELECT 1
         FROM organization_memberships
         WHERE organization_id = $1
           AND user_id = $2
           AND status = 'active'
         LIMIT 1`,
        [accountId, attributionUserId],
      );
      if (userInAccount.rows.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'user_id must belong to the account' },
        });
      }
    }

    if (attributionSessionId) {
      const sessionInAccount = await pool.query(
        `SELECT 1
         FROM chats
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1`,
        [attributionSessionId, accountId],
      );
      if (sessionInAccount.rows.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'session_id must belong to the account' },
        });
      }
    }

    if (attributionModelId) {
      const modelInScope = await pool.query(
        `SELECT 1
         FROM model_registry
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1`,
        [attributionModelId, accountId],
      );
      if (modelInScope.rows.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'model_id must exist in account model catalog' },
        });
      }
    }

    try {
      const inserted = await pool.query(
        `INSERT INTO tenant_usage_events
           (id, organization_id, source, metric_type, quantity, unit_cost_usd, total_cost_usd, feature_key, user_id, session_id, model_id, metadata, occurred_at, created_at)
         VALUES
           ($1, $2, $3, $4, $5::numeric(20,6), $6::numeric(20,6), ($5::numeric(20,6) * $6::numeric(20,6))::numeric(20,6), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), $11::jsonb, COALESCE($12::timestamptz, NOW()), NOW())
         RETURNING id, organization_id, source, metric_type, quantity::float, unit_cost_usd::float, total_cost_usd::float, feature_key, user_id, session_id, model_id, metadata, occurred_at, created_at`,
        [
          uuidv7(),
          accountId,
          source,
          metricType,
          quantityNumeric,
          unitCostUsdNumeric,
          String(body.feature_key || ''),
          attributionUserId,
          attributionSessionId,
          attributionModelId,
          metadataValidation.json,
          occurredAtIso,
        ],
      );
      reply.status(201).send({ success: true, data: inserted.rows[0] });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'tenant usage metering schema not initialized' },
        });
      }
      throw err;
    }
  });

  app.get('/accounts/:id/usage/summary', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const actorUserId = String((request as any).userId || '');
    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can view usage metering' },
      });
    }

    const query = (request.query || {}) as { days?: string };
    const days = Math.min(Math.max(parseInt(String(query.days || '30'), 10) || 30, 1), 366);
    try {
      const totals = await pool.query(
        `WITH metered AS (
           SELECT
             COALESCE(SUM(quantity), 0)::float AS metered_quantity,
             COALESCE(SUM(total_cost_usd), 0)::float AS metered_cost_usd,
             COUNT(*)::int AS metered_events
           FROM tenant_usage_events
           WHERE organization_id = $1
             AND occurred_at >= NOW() - ($2 || ' days')::interval
         ),
         llm AS (
           SELECT
             COALESCE(SUM(request_tokens + response_tokens), 0)::float AS llm_tokens,
             COALESCE(SUM(total_cost), 0)::float AS llm_cost_usd,
             COUNT(*)::int AS llm_calls
           FROM model_usage_logs
           WHERE organization_id = $1
             AND created_at >= NOW() - ($2 || ' days')::interval
         )
         SELECT
           $1::text AS organization_id,
           $2::int AS window_days,
           metered.metered_quantity,
           metered.metered_cost_usd,
           metered.metered_events,
           llm.llm_tokens,
           llm.llm_cost_usd,
           llm.llm_calls,
           (metered.metered_cost_usd + llm.llm_cost_usd)::float AS total_cost_usd
         FROM metered, llm`,
        [accountId, String(days)],
      );
      const bySource = await pool.query(
        `SELECT source, metric_type,
                COALESCE(SUM(quantity), 0)::float AS quantity,
                COALESCE(SUM(total_cost_usd), 0)::float AS total_cost_usd,
                COUNT(*)::int AS events
         FROM tenant_usage_events
         WHERE organization_id = $1
           AND occurred_at >= NOW() - ($2 || ' days')::interval
         GROUP BY source, metric_type
         ORDER BY total_cost_usd DESC, events DESC`,
        [accountId, String(days)],
      );
      const byModel = await pool.query(
        `SELECT
           COALESCE(mr.name, mul.model_id) AS model_name,
           mul.model_id,
           COUNT(*)::int AS calls,
           COALESCE(SUM(mul.request_tokens + mul.response_tokens), 0)::float AS tokens,
           COALESCE(SUM(mul.total_cost), 0)::float AS total_cost_usd
         FROM model_usage_logs mul
         LEFT JOIN model_registry mr ON mr.id = mul.model_id
         WHERE mul.organization_id = $1
           AND mul.created_at >= NOW() - ($2 || ' days')::interval
         GROUP BY mr.name, mul.model_id
         ORDER BY total_cost_usd DESC, calls DESC`,
        [accountId, String(days)],
      );
      reply.send({
        success: true,
        data: {
          ...(totals.rows[0] || {
            organization_id: accountId,
            window_days: days,
            metered_quantity: 0,
            metered_cost_usd: 0,
            metered_events: 0,
            llm_tokens: 0,
            llm_cost_usd: 0,
            llm_calls: 0,
            total_cost_usd: 0,
          }),
          by_source: bySource.rows,
          by_model: byModel.rows,
        },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'tenant usage metering schema not initialized' },
        });
      }
      throw err;
    }
  });

  app.get('/accounts/:id/usage/daily', async (request, reply) => {
    const { id: accountId } = request.params as { id: string };
    const actorUserId = String((request as any).userId || '');
    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can view usage metering' },
      });
    }

    const query = (request.query || {}) as { days?: string };
    const days = Math.min(Math.max(parseInt(String(query.days || '30'), 10) || 30, 1), 366);
    try {
      const result = await pool.query(
        `WITH day_series AS (
           SELECT generate_series(
             date_trunc('day', NOW() - (($2::int - 1) || ' days')::interval),
             date_trunc('day', NOW()),
             interval '1 day'
           )::date AS day
         ),
         metered AS (
           SELECT date_trunc('day', occurred_at)::date AS day,
                  COALESCE(SUM(total_cost_usd), 0)::float AS metered_cost_usd,
                  COUNT(*)::int AS metered_events
           FROM tenant_usage_events
           WHERE organization_id = $1
             AND occurred_at >= NOW() - ($2 || ' days')::interval
           GROUP BY 1
         ),
         llm AS (
           SELECT date_trunc('day', created_at)::date AS day,
                  COALESCE(SUM(total_cost), 0)::float AS llm_cost_usd,
                  COALESCE(SUM(request_tokens + response_tokens), 0)::float AS llm_tokens
           FROM model_usage_logs
           WHERE organization_id = $1
             AND created_at >= NOW() - ($2 || ' days')::interval
           GROUP BY 1
         )
         SELECT
           ds.day::text AS day,
           COALESCE(m.metered_cost_usd, 0)::float AS metered_cost_usd,
           COALESCE(m.metered_events, 0)::int AS metered_events,
           COALESCE(l.llm_cost_usd, 0)::float AS llm_cost_usd,
           COALESCE(l.llm_tokens, 0)::float AS llm_tokens,
           (COALESCE(m.metered_cost_usd, 0) + COALESCE(l.llm_cost_usd, 0))::float AS total_cost_usd
         FROM day_series ds
         LEFT JOIN metered m ON m.day = ds.day
         LEFT JOIN llm l ON l.day = ds.day
         ORDER BY ds.day ASC`,
        [accountId, String(days)],
      );
      reply.send({
        success: true,
        data: {
          organization_id: accountId,
          window_days: days,
          rows: result.rows,
        },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({
          success: false,
          error: { code: 'FEATURE_UNAVAILABLE', message: 'tenant usage metering schema not initialized' },
        });
      }
      throw err;
    }
  });

  app.patch('/accounts/:id/members/:userId', async (request, reply) => {
    const { id: accountId, userId } = request.params as { id: string; userId: string };
    const actorUserId = String((request as any).userId || '');
    const body = (request.body || {}) as { role?: string; status?: string };

    const canManage = await ensureAccountAdmin(accountId, actorUserId);
    if (!canManage) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only account owner/admin/operator can manage members' },
      });
    }

    const requestedRole = body.role === undefined ? null : String(body.role).trim();
    if (requestedRole !== null && requestedRole !== '' && !ACCOUNT_MEMBERSHIP_ROLES.has(requestedRole)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'role must be one of: owner, admin, operator, member, viewer' },
      });
    }
    const role = requestedRole && ACCOUNT_MEMBERSHIP_ROLES.has(requestedRole)
      ? requestedRole
      : null;
    const status = body.status && ['active', 'invited', 'suspended'].includes(String(body.status))
      ? String(body.status)
      : null;
    if (!role && !status) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'role or status update is required' },
      });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orgResult = await client.query(
        `SELECT owner_user_id
         FROM organizations
         WHERE id = $1
         FOR UPDATE`,
        [accountId],
      );
      if (orgResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'account not found' },
        });
      }

      const membershipResult = await client.query(
        `SELECT role, status
         FROM organization_memberships
         WHERE organization_id = $1
           AND user_id = $2
         FOR UPDATE`,
        [accountId, userId],
      );
      if (membershipResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'membership not found' },
        });
      }

      const currentMembership = membershipResult.rows[0] as { role: string; status: string };
      const nextRole = role ?? currentMembership.role;
      const nextStatus = status ?? currentMembership.status;
      const removesGovernance =
        isActiveGovernancePrincipal(currentMembership.role, currentMembership.status) &&
        !isActiveGovernancePrincipal(nextRole, nextStatus);

      if (removesGovernance && actorUserId !== userId) {
        const remainingGovernance = await client.query(
          `SELECT COUNT(*)::int AS remaining
           FROM organization_memberships
           WHERE organization_id = $1
             AND user_id <> $2
             AND status = 'active'
             AND role IN ('owner', 'admin', 'operator')`,
          [accountId, userId],
        );
        const remaining = Number(remainingGovernance.rows[0]?.remaining || 0);
        if (remaining <= 0) {
          await client.query('ROLLBACK');
          return reply.status(409).send({
            success: false,
            error: {
              code: 'LAST_GOVERNANCE_PRINCIPAL',
              message: 'Cannot demote or suspend the last active owner/admin/operator member',
            },
          });
        }
      }

      const fields: string[] = [];
      const params: unknown[] = [];
      if (role) {
        params.push(nextRole);
        fields.push(`role = $${params.length}`);
      }
      if (status) {
        params.push(nextStatus);
        fields.push(`status = $${params.length}`);
      }
      params.push(accountId);
      params.push(userId);
      const accountIdx = params.length - 1;
      const userIdx = params.length;

      const updated = await client.query(
        `UPDATE organization_memberships
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE organization_id = $${accountIdx}
           AND user_id = $${userIdx}
         RETURNING organization_id, user_id, role, status, updated_at`,
        params,
      );
      if (updated.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'membership not found' },
        });
      }

      const currentOwnerUserId = String(orgResult.rows[0]?.owner_user_id || '').trim();
      if (nextRole === 'owner' && nextStatus === 'active' && currentOwnerUserId !== userId) {
        await client.query(
          `UPDATE organizations
           SET owner_user_id = $2, updated_at = NOW()
           WHERE id = $1`,
          [accountId, userId],
        );
      } else if (currentOwnerUserId === userId && (nextRole !== 'owner' || nextStatus !== 'active')) {
        const replacementOwner = await client.query(
          `SELECT user_id
           FROM organization_memberships
           WHERE organization_id = $1
             AND status = 'active'
             AND role IN ('owner', 'admin', 'operator')
           ORDER BY CASE role
             WHEN 'owner' THEN 0
             WHEN 'admin' THEN 1
             WHEN 'operator' THEN 2
             ELSE 99
           END,
           updated_at DESC,
           created_at DESC
           LIMIT 1`,
          [accountId],
        );
        if (replacementOwner.rows.length === 0) {
          if (actorUserId === userId) {
            await client.query('COMMIT');
            reply.send({ success: true, data: updated.rows[0] });
            return;
          }
          await client.query('ROLLBACK');
          return reply.status(409).send({
            success: false,
            error: {
              code: 'OWNER_TRANSFER_REQUIRED',
              message: 'Account must retain at least one active owner',
            },
          });
        }
        await client.query(
          `UPDATE organizations
           SET owner_user_id = $2, updated_at = NOW()
           WHERE id = $1`,
          [accountId, replacementOwner.rows[0].user_id],
        );
      }

      await client.query('COMMIT');
      reply.send({ success: true, data: updated.rows[0] });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignored: rollback best-effort after failed transaction branch
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
