// ═══════════════════════════════════════════════════════════════════════════
// Device agent routes — used by sven-mirror-agent and other device clients
//
// Authentication: Device API key in `Authorization: Bearer sven_dev_xxx`
//   or session auth for admin-initiated requests.
//
// Endpoints:
//   POST /v1/devices/pair/start    — begin pairing (no auth)
//   POST /v1/devices/heartbeat     — device heartbeat (device auth)
//   POST /v1/devices/events        — report event (device auth)
//   GET  /v1/devices/commands      — poll pending commands (device auth)
//   POST /v1/devices/commands/:id/ack — acknowledge command (device auth)
//   GET  /v1/devices/me            — device self-info (device auth)
// ═══════════════════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest } from 'fastify';
import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

const logger = createLogger('device-routes');
const DEVICE_COMMAND_LEASE_MS = Math.max(5_000, Number(process.env.DEVICE_COMMAND_LEASE_MS || 60_000));
const DEVICE_COMMAND_POLL_LIMIT = Math.max(1, Math.min(100, Number(process.env.DEVICE_COMMAND_POLL_LIMIT || 50)));
const DEVICE_AUTH_LEGACY_SCAN_LIMIT = Math.max(1, Math.min(50, Number(process.env.DEVICE_AUTH_LEGACY_SCAN_LIMIT || 10)));
const DEVICE_AUTH_MAX_FAILED_ATTEMPTS = Math.max(1, Number(process.env.DEVICE_AUTH_MAX_FAILED_ATTEMPTS || 20));
const DEVICE_AUTH_WINDOW_MS = Math.max(1_000, Number(process.env.DEVICE_AUTH_WINDOW_MS || 60_000));
const DEVICE_AUTH_LOCKOUT_MS = Math.max(1_000, Number(process.env.DEVICE_AUTH_LOCKOUT_MS || 60_000));
const DEVICE_PAIR_START_MAX_FAILED_ATTEMPTS = Math.max(1, Number(process.env.DEVICE_PAIR_START_MAX_FAILED_ATTEMPTS || 20));
const DEVICE_PAIR_START_WINDOW_MS = Math.max(1_000, Number(process.env.DEVICE_PAIR_START_WINDOW_MS || 60_000));
const DEVICE_PAIR_START_LOCKOUT_MS = Math.max(1_000, Number(process.env.DEVICE_PAIR_START_LOCKOUT_MS || 60_000));
const DEVICE_PAIR_START_RATE_MAX_REQUESTS = Math.max(1, Number(process.env.DEVICE_PAIR_START_RATE_MAX_REQUESTS || 30));
const DEVICE_PAIR_START_RATE_WINDOW_MS = Math.max(1_000, Number(process.env.DEVICE_PAIR_START_RATE_WINDOW_MS || 60_000));

// How long before a device is considered offline (no heartbeat)
const OFFLINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const deviceAuthFailures = new Map<string, { count: number; windowStartMs: number; lockedUntilMs: number }>();
const devicePairStartFailures = new Map<string, { count: number; windowStartMs: number; lockedUntilMs: number }>();
const devicePairStartRate = new Map<string, { count: number; windowStartMs: number }>();

interface DeviceAuthPayload {
    deviceId: string;
    orgId: string;
}

let devicesHasApiKeyLookupColumnCache: boolean | null = null;

async function devicesHasApiKeyLookupColumn(pool: pg.Pool): Promise<boolean> {
    if (devicesHasApiKeyLookupColumnCache !== null) {
        return devicesHasApiKeyLookupColumnCache;
    }
    const result = await pool.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'devices'
            AND column_name = 'api_key_lookup'
          LIMIT 1`,
    );
    devicesHasApiKeyLookupColumnCache = result.rows.length > 0;
    return devicesHasApiKeyLookupColumnCache;
}

function isMissingApiKeyLookupColumnError(err: unknown): boolean {
    return String((err as { code?: string })?.code || '') === '42703';
}

function computeDeviceApiKeyLookup(apiKey: string): string {
    return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex');
}

function getDeviceAuthRateKey(request: FastifyRequest): string {
    return request.ip || 'unknown';
}

function isDeviceAuthLocked(rateKey: string): number {
    const now = Date.now();
    const state = deviceAuthFailures.get(rateKey);
    if (!state) return 0;
    if (state.lockedUntilMs <= now) {
        if (now - state.windowStartMs > DEVICE_AUTH_WINDOW_MS) {
            deviceAuthFailures.delete(rateKey);
            return 0;
        }
        state.lockedUntilMs = 0;
    }
    return Math.max(0, state.lockedUntilMs - now);
}

function recordDeviceAuthFailure(rateKey: string): number {
    const now = Date.now();
    const current = deviceAuthFailures.get(rateKey);
    const base = (!current || now - current.windowStartMs > DEVICE_AUTH_WINDOW_MS)
        ? { count: 0, windowStartMs: now, lockedUntilMs: 0 }
        : current;

    base.count += 1;
    if (base.count >= DEVICE_AUTH_MAX_FAILED_ATTEMPTS) {
        base.lockedUntilMs = now + DEVICE_AUTH_LOCKOUT_MS;
    }
    deviceAuthFailures.set(rateKey, base);
    return Math.max(0, base.lockedUntilMs - now);
}

function clearDeviceAuthFailures(rateKey: string): void {
    deviceAuthFailures.delete(rateKey);
}

function getPairStartProvisioningToken(request: FastifyRequest): string {
    return String(request.headers?.['x-sven-device-provisioning-token'] || '').trim();
}

function getOrgHintFromPairStartRequest(body: { organization_id?: unknown }, request: FastifyRequest): string {
    const bodyOrg = String(body.organization_id || '').trim();
    const headerOrg = String(request.headers?.['x-sven-org-id'] || '').trim();
    return bodyOrg || headerOrg;
}

function isProductionProfile(): boolean {
    const env = String(process.env.NODE_ENV || '').trim().toLowerCase();
    if (env === 'production') return true;
    const profile = String(process.env.SVEN_HARDENING_PROFILE || process.env.SVEN_PROFILE || '').trim().toLowerCase();
    return ['strict', 'hardened', 'isolated', 'production'].includes(profile);
}

function safeProvisioningTokenEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function isPairStartLocked(rateKey: string): number {
    const now = Date.now();
    const state = devicePairStartFailures.get(rateKey);
    if (!state) return 0;
    if (state.lockedUntilMs <= now) {
        if (now - state.windowStartMs > DEVICE_PAIR_START_WINDOW_MS) {
            devicePairStartFailures.delete(rateKey);
            return 0;
        }
        state.lockedUntilMs = 0;
    }
    return Math.max(0, state.lockedUntilMs - now);
}

function recordPairStartFailure(rateKey: string): number {
    const now = Date.now();
    const current = devicePairStartFailures.get(rateKey);
    const base = (!current || now - current.windowStartMs > DEVICE_PAIR_START_WINDOW_MS)
        ? { count: 0, windowStartMs: now, lockedUntilMs: 0 }
        : current;

    base.count += 1;
    if (base.count >= DEVICE_PAIR_START_MAX_FAILED_ATTEMPTS) {
        base.lockedUntilMs = now + DEVICE_PAIR_START_LOCKOUT_MS;
    }
    devicePairStartFailures.set(rateKey, base);
    return Math.max(0, base.lockedUntilMs - now);
}

function clearPairStartFailures(rateKey: string): void {
    devicePairStartFailures.delete(rateKey);
}

function consumePairStartRate(rateKey: string): { limited: boolean; retryAfterMs: number } {
    const now = Date.now();
    const current = devicePairStartRate.get(rateKey);
    const base = (!current || now - current.windowStartMs >= DEVICE_PAIR_START_RATE_WINDOW_MS)
        ? { count: 0, windowStartMs: now }
        : current;

    base.count += 1;
    devicePairStartRate.set(rateKey, base);

    if (base.count <= DEVICE_PAIR_START_RATE_MAX_REQUESTS) {
        return { limited: false, retryAfterMs: 0 };
    }

    const retryAfterMs = Math.max(1_000, DEVICE_PAIR_START_RATE_WINDOW_MS - (now - base.windowStartMs));
    return { limited: true, retryAfterMs };
}

async function resolveAuthenticatedOrgId(request: FastifyRequest, pool: pg.Pool): Promise<string> {
    const authHeader = String(request.headers?.authorization || '').trim();
    const bearerSessionId = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieSessionId = String((request as any).cookies?.sven_session || '').trim();
    const sessionId = cookieSessionId || bearerSessionId;
    if (!sessionId) return '';

    const res = await pool.query(
        `SELECT u.active_organization_id
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1
           AND s.status = 'active'
           AND s.expires_at > NOW()
         LIMIT 1`,
        [sessionId],
    );
    return String(res.rows[0]?.active_organization_id || '').trim();
}

function normalizeDeviceBody<T extends object>(
    body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, message: 'request body must be a JSON object' };
    }
    return { ok: true, value: body as T };
}

/**
 * Authenticate a request by device API key.
 * Expects `Authorization: Bearer sven_dev_xxx`.
 * Sets request.deviceId and request.deviceOrgId on success.
 */
async function authenticateDevice(
    request: any,
    reply: any,
    pool: pg.Pool,
): Promise<DeviceAuthPayload | null> {
    const rateKey = getDeviceAuthRateKey(request);
    const retryAfterMs = isDeviceAuthLocked(rateKey);
    if (retryAfterMs > 0) {
        reply.header('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
        reply.status(429).send({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many invalid device auth attempts. Retry later.' },
        });
        return null;
    }

    const auth = request.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer sven_dev_')) {
        reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHENTICATED', message: 'Device API key required' },
        });
        return null;
    }

    const apiKey = auth.slice(7); // strip "Bearer "
    const keyLookup = computeDeviceApiKeyLookup(apiKey);
    const hasApiKeyLookupColumn = await devicesHasApiKeyLookupColumn(pool);

    const indexedRes = hasApiKeyLookupColumn
        ? await pool.query(
            `SELECT id, organization_id, api_key_hash
             FROM devices
             WHERE api_key_hash IS NOT NULL
               AND status != 'pairing'
               AND api_key_lookup = $1
             LIMIT 2`,
            [keyLookup],
        ).catch(async (err) => {
            if (!isMissingApiKeyLookupColumnError(err)) throw err;
            devicesHasApiKeyLookupColumnCache = false;
            return pool.query(
                `SELECT id, organization_id, api_key_hash
                 FROM devices
                 WHERE api_key_hash IS NOT NULL
                   AND status != 'pairing'
                 ORDER BY updated_at DESC NULLS LAST
                 LIMIT $1`,
                [DEVICE_AUTH_LEGACY_SCAN_LIMIT],
            );
        })
        : await pool.query(
            `SELECT id, organization_id, api_key_hash
             FROM devices
             WHERE api_key_hash IS NOT NULL
               AND status != 'pairing'
             ORDER BY updated_at DESC NULLS LAST
             LIMIT $1`,
            [DEVICE_AUTH_LEGACY_SCAN_LIMIT],
        );

    for (const row of indexedRes.rows) {
        const match = await bcrypt.compare(apiKey, row.api_key_hash);
        if (match) {
            clearDeviceAuthFailures(rateKey);
            request.deviceId = row.id;
            request.deviceOrgId = row.organization_id;
            return { deviceId: row.id, orgId: row.organization_id };
        }
    }

    // Bounded compatibility scan for legacy rows that predate api_key_lookup population.
    const legacyRes = hasApiKeyLookupColumn
        ? await pool.query(
            `SELECT id, organization_id, api_key_hash
             FROM devices
             WHERE api_key_hash IS NOT NULL
               AND status != 'pairing'
               AND api_key_lookup IS NULL
             ORDER BY updated_at DESC
             LIMIT $1`,
            [DEVICE_AUTH_LEGACY_SCAN_LIMIT],
        ).catch(async (err) => {
            if (!isMissingApiKeyLookupColumnError(err)) throw err;
            devicesHasApiKeyLookupColumnCache = false;
            return { rows: [] as Array<{ id: string; organization_id: string; api_key_hash: string }> };
        })
        : { rows: [] as Array<{ id: string; organization_id: string; api_key_hash: string }> };

    for (const row of legacyRes.rows) {
        const match = await bcrypt.compare(apiKey, row.api_key_hash);
        if (!match) continue;
        if (hasApiKeyLookupColumn) {
            await pool.query(
                `UPDATE devices SET api_key_lookup = $1, updated_at = now() WHERE id = $2`,
                [keyLookup, row.id],
            ).catch((err) => {
                if (isMissingApiKeyLookupColumnError(err)) {
                    devicesHasApiKeyLookupColumnCache = false;
                    return;
                }
            });
        }
        clearDeviceAuthFailures(rateKey);
        request.deviceId = row.id;
        request.deviceOrgId = row.organization_id;
        return { deviceId: row.id, orgId: row.organization_id };
    }

    const lockoutAfterMs = recordDeviceAuthFailure(rateKey);
    if (lockoutAfterMs > 0) {
        reply.header('Retry-After', String(Math.max(1, Math.ceil(lockoutAfterMs / 1000))));
        reply.status(429).send({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many invalid device auth attempts. Retry later.' },
        });
        return null;
    }
    reply.status(401).send({
        success: false,
        error: { code: 'INVALID_KEY', message: 'Invalid device API key' },
    });
    return null;
}

export async function registerDeviceAgentRoutes(app: FastifyInstance, pool: pg.Pool) {
    const requireSessionAuth = requireRole(pool, 'admin', 'user');

    // ─── POST /devices/pair/start — initiate pairing from device side ───
    // No auth required — the device shows the returned pairing code on its display.
    // Admin then confirms via POST /v1/admin/devices/:id/pair/confirm with that code.
    app.post('/v1/devices/pair/start', {
        schema: {
            body: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: { type: 'string' },
                    device_type: { type: 'string' },
                    capabilities: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    organization_id: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const rateKey = getDeviceAuthRateKey(request);
        const pairStartRate = consumePairStartRate(rateKey);
        if (pairStartRate.limited) {
            reply.header('Retry-After', String(Math.max(1, Math.ceil(pairStartRate.retryAfterMs / 1000))));
            return reply.status(429).send({
                success: false,
                error: { code: 'RATE_LIMITED', message: 'Too many pairing start requests. Retry later.' },
            });
        }

        const retryAfterMs = isPairStartLocked(rateKey);
        if (retryAfterMs > 0) {
            reply.header('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
            return reply.status(429).send({
                success: false,
                error: { code: 'RATE_LIMITED', message: 'Too many invalid pairing requests. Retry later.' },
            });
        }

        const bodyParsed = normalizeDeviceBody<{ name?: string; device_type?: string; capabilities?: string[]; organization_id?: string }>(request.body);
        if (!bodyParsed.ok) {
            return reply.status(400).send({
                success: false,
                error: { code: 'VALIDATION', message: bodyParsed.message },
            });
        }
        const body = bodyParsed.value;

        const authenticatedOrgId = await resolveAuthenticatedOrgId(request, pool);
        const orgHint = getOrgHintFromPairStartRequest(body, request);
        const orgId = authenticatedOrgId || orgHint;
        if (!orgId) {
            const lockoutAfterMs = recordPairStartFailure(rateKey);
            if (lockoutAfterMs > 0) {
                reply.header('Retry-After', String(Math.max(1, Math.ceil(lockoutAfterMs / 1000))));
            }
            return reply.status(400).send({
                success: false,
                error: { code: 'VALIDATION', message: 'organization_id is required' },
            });
        }
        if (authenticatedOrgId && orgHint && orgHint !== authenticatedOrgId) {
            const lockoutAfterMs = recordPairStartFailure(rateKey);
            if (lockoutAfterMs > 0) {
                reply.header('Retry-After', String(Math.max(1, Math.ceil(lockoutAfterMs / 1000))));
            }
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_MISMATCH', message: 'organization_id does not match active session organization' },
            });
        }

        // We create a temporary device in "pairing" status.
        // It must be associated with an explicit org.
        // For unauthenticated requests in production profiles, require provisioning token.
        const provisioningToken = getPairStartProvisioningToken(request);
        const expectedProvisioningToken = String(process.env.DEVICE_PROVISIONING_TOKEN || '').trim();
        const isAuthenticated = Boolean(authenticatedOrgId);
        if (!isAuthenticated && isProductionProfile()) {
            if (!expectedProvisioningToken || !safeProvisioningTokenEqual(provisioningToken, expectedProvisioningToken)) {
                const lockoutAfterMs = recordPairStartFailure(rateKey);
                if (lockoutAfterMs > 0) {
                    reply.header('Retry-After', String(Math.max(1, Math.ceil(lockoutAfterMs / 1000))));
                }
                return reply.status(403).send({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Provisioning token required for unauthenticated pairing in production' },
                });
            }
        }
        if (expectedProvisioningToken && provisioningToken && !safeProvisioningTokenEqual(provisioningToken, expectedProvisioningToken)) {
            const lockoutAfterMs = recordPairStartFailure(rateKey);
            if (lockoutAfterMs > 0) {
                reply.header('Retry-After', String(Math.max(1, Math.ceil(lockoutAfterMs / 1000))));
            }
            return reply.status(401).send({
                success: false,
                error: { code: 'INVALID_PROVISIONING_TOKEN', message: 'Invalid provisioning token' },
            });
        }

        const pairingCode = generatePairingCode();
        const pairingExpires = new Date(Date.now() + 15 * 60 * 1000);

        const orgRes = await pool.query(`SELECT id FROM organizations WHERE id = $1 LIMIT 1`, [orgId]);
        if (orgRes.rows.length === 0) {
            const lockoutAfterMs = recordPairStartFailure(rateKey);
            if (lockoutAfterMs > 0) {
                reply.header('Retry-After', String(Math.max(1, Math.ceil(lockoutAfterMs / 1000))));
            }
            return reply.status(404).send({
                success: false,
                error: { code: 'ORG_NOT_FOUND', message: 'Organization not found' },
            });
        }
        clearPairStartFailures(rateKey);

        const result = await pool.query(
            `INSERT INTO devices (organization_id, name, device_type, capabilities, status, pairing_code, pairing_expires)
       VALUES ($1, $2, $3, $4, 'pairing', $5, $6)
       RETURNING id, name, device_type, pairing_code, pairing_expires`,
            [
                orgId,
                (body.name || 'New Device').trim(),
                body.device_type || 'mirror',
                JSON.stringify(body.capabilities || ['display']),
                pairingCode,
                pairingExpires,
            ],
        );

        logger.info('Device pairing initiated', { deviceId: result.rows[0].id });

        reply.status(201).send({
            success: true,
            data: {
                device_id: result.rows[0].id,
                pairing_code: pairingCode,
                expires_at: pairingExpires.toISOString(),
                message: 'Display this code and have the admin confirm it in the Sven app.',
            },
        });
    });

    // ─── POST /devices/heartbeat — device heartbeat ───
    app.post('/v1/devices/heartbeat', async (request, reply) => {
        const auth = await authenticateDevice(request, reply, pool);
        if (!auth) return;

        const bodyParsed = normalizeDeviceBody<{ status?: string; metrics?: Record<string, unknown> }>(request.body);
        if (!bodyParsed.ok) {
            return reply.status(400).send({
                success: false,
                error: { code: 'VALIDATION', message: bodyParsed.message },
            });
        }
        const body = bodyParsed.value;

        await pool.query(
            `UPDATE devices SET last_seen_at = now(), status = $1, updated_at = now() WHERE id = $2`,
            [body.status || 'online', auth.deviceId],
        );

        // Check for pending commands
        const pending = await pool.query(
            `SELECT COUNT(*)::int AS count FROM device_commands WHERE device_id = $1 AND status = 'pending'`,
            [auth.deviceId],
        );

        reply.send({
            success: true,
            data: {
                acknowledged: true,
                pending_commands: pending.rows[0].count,
            },
        });
    });

    // ─── GET /devices/me — device self-info ───
    app.get('/v1/devices/me', async (request, reply) => {
        const auth = await authenticateDevice(request, reply, pool);
        if (!auth) return;

        const result = await pool.query(
            `SELECT id, name, device_type, status, capabilities, config, last_seen_at, paired_at, created_at
       FROM devices WHERE id = $1`,
            [auth.deviceId],
        );

        reply.send({ success: true, data: result.rows[0] });
    });

    // ─── POST /devices/events — report event from device ───
    app.post('/v1/devices/events', async (request, reply) => {
        const auth = await authenticateDevice(request, reply, pool);
        if (!auth) return;

        const bodyParsed = normalizeDeviceBody<{ event_type?: string; payload?: Record<string, unknown> }>(request.body);
        if (!bodyParsed.ok) {
            return reply.status(400).send({
                success: false,
                error: { code: 'VALIDATION', message: bodyParsed.message },
            });
        }
        const body = bodyParsed.value;

        if (!body.event_type) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'event_type is required' },
            });
        }

        const result = await pool.query(
            `INSERT INTO device_events (device_id, event_type, payload)
       VALUES ($1, $2, $3)
       RETURNING id, event_type, payload, created_at`,
            [auth.deviceId, body.event_type, JSON.stringify(body.payload || {})],
        );

        reply.status(201).send({ success: true, data: result.rows[0] });
    });

    // ─── GET /devices/commands — poll pending commands ───
    app.get('/v1/devices/commands', async (request, reply) => {
        const auth = await authenticateDevice(request, reply, pool);
        if (!auth) return;

        const result = await pool.query(
            `WITH candidates AS (
             SELECT id
             FROM device_commands
             WHERE device_id = $1
               AND (
                 status = 'pending'
                 OR (status = 'in_progress' AND lease_expires_at IS NOT NULL AND lease_expires_at < now())
               )
             ORDER BY created_at ASC
             LIMIT $4
             FOR UPDATE SKIP LOCKED
           )
           UPDATE device_commands dc
           SET status = 'in_progress',
               delivered_at = COALESCE(dc.delivered_at, now()),
               lease_owner = $2,
               lease_expires_at = now() + ($3::text || ' milliseconds')::interval,
               claim_attempts = COALESCE(dc.claim_attempts, 0) + 1
           FROM candidates c
           WHERE dc.id = c.id
           RETURNING dc.id, dc.command, dc.payload, dc.created_at, dc.status, dc.lease_expires_at, dc.claim_attempts`,
            [auth.deviceId, `${auth.deviceId}:${Date.now()}`, DEVICE_COMMAND_LEASE_MS, DEVICE_COMMAND_POLL_LIMIT],
        ).catch(async (err) => {
            if (String((err as { code?: string })?.code || '') !== '42703') throw err;
            return pool.query(
                `WITH candidates AS (
                 SELECT id
                 FROM device_commands
                 WHERE device_id = $1
                   AND status = 'pending'
                 ORDER BY created_at ASC
                 LIMIT $2
                 FOR UPDATE SKIP LOCKED
               )
               UPDATE device_commands dc
               SET status = 'in_progress',
                   delivered_at = COALESCE(dc.delivered_at, now())
               FROM candidates c
               WHERE dc.id = c.id
               RETURNING dc.id, dc.command, dc.payload, dc.created_at, dc.status, NULL::timestamptz AS lease_expires_at, 1::int AS claim_attempts`,
                [auth.deviceId, DEVICE_COMMAND_POLL_LIMIT],
            );
        });

        reply.send({ success: true, data: result.rows });
    });

    // ─── POST /devices/commands/:id/ack — acknowledge command ───
    app.post('/v1/devices/commands/:id/ack', async (request, reply) => {
        const auth = await authenticateDevice(request, reply, pool);
        if (!auth) return;

        const { id } = request.params as { id: string };
        const bodyParsed = normalizeDeviceBody<{ result?: Record<string, unknown>; error?: string }>(request.body);
        if (!bodyParsed.ok) {
            return reply.status(400).send({
                success: false,
                error: { code: 'VALIDATION', message: bodyParsed.message },
            });
        }
        const body = bodyParsed.value;

        const status = body.error ? 'failed' : 'acknowledged';
        const current = await pool.query(
            `SELECT status FROM device_commands WHERE id = $1 AND device_id = $2`,
            [id, auth.deviceId],
        );
        if (current.rows.length === 0) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Command not found' },
            });
        }
        if (String(current.rows[0].status || '') !== 'in_progress') {
            return reply.status(409).send({
                success: false,
                error: { code: 'INVALID_STATE', message: 'Command is not in progress' },
            });
        }

        const result = await pool.query(
            `UPDATE device_commands
           SET status = $1,
               ack_at = now(),
               lease_owner = NULL,
               lease_expires_at = NULL,
               result_payload = $4,
               error_message = $5
           WHERE id = $2 AND device_id = $3 AND status = 'in_progress'
           RETURNING id, command, status, ack_at, result_payload, error_message`,
            [status, id, auth.deviceId, JSON.stringify(body.result || {}), body.error || null],
        ).catch(async (err) => {
            if (String((err as { code?: string })?.code || '') !== '42703') throw err;
            return pool.query(
                `UPDATE device_commands
               SET status = $1,
                   ack_at = now()
               WHERE id = $2 AND device_id = $3 AND status = 'in_progress'
               RETURNING id, command, status, ack_at, NULL::jsonb AS result_payload, NULL::text AS error_message`,
                [status, id, auth.deviceId],
            );
        });

        if (result.rows.length === 0) {
            return reply.status(409).send({
                success: false,
                error: { code: 'INVALID_STATE', message: 'Command acknowledgement race detected' },
            });
        }

        reply.send({ success: true, data: result.rows[0] });
    });

    // ─── GET /devices/events/stream — SSE for real-time device events ───
    // Used by the Flutter app to get live device updates.
    // Requires session auth (admin/user).
    app.get('/v1/devices/events/stream', { preHandler: requireSessionAuth }, async (request: any, reply) => {
        const orgId = String(request.orgId || '').trim();
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }
        const requesterUserId = String(request.userId || '').trim();
        if (!requesterUserId) {
            return reply.status(401).send({
                success: false,
                error: { code: 'UNAUTHENTICATED', message: 'Session required' },
            });
        }
        const isPlatformAdmin = String(request.userRole || '').trim() === 'platform_admin';
        // This endpoint uses session auth, not device auth
        // It's accessible to logged-in users to monitor their devices
        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });

        reply.raw.write('retry: 5000\n\n');
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

        // Poll for new events every 3 seconds (simple approach)
        let lastDeviceEventTime = new Date().toISOString();
        let lastDeviceStatusTime = lastDeviceEventTime;
        const poll = setInterval(async () => {
            try {
                const events = await pool.query(
                    `SELECT de.id, de.device_id, de.event_type, de.payload, de.created_at, d.name AS device_name
           FROM device_events de
           JOIN devices d ON de.device_id = d.id
           WHERE de.created_at > $1
             AND d.organization_id = $2
             AND ($3::boolean OR d.created_by::text = $4::text)
           ORDER BY de.created_at ASC LIMIT 50`,
                    [lastDeviceEventTime, orgId, isPlatformAdmin, requesterUserId],
                );

                for (const ev of events.rows) {
                    reply.raw.write(`event: device_event\ndata: ${JSON.stringify(ev)}\n\n`);
                    lastDeviceEventTime = String(ev.created_at || lastDeviceEventTime);
                }

                // Also check device status changes
                const statusChanges = await pool.query(
                    `SELECT id, name, status, last_seen_at, updated_at
           FROM devices
           WHERE updated_at > $1
             AND organization_id = $2
             AND ($3::boolean OR created_by::text = $4::text)
           ORDER BY updated_at ASC LIMIT 20`,
                    [lastDeviceStatusTime, orgId, isPlatformAdmin, requesterUserId],
                );

                for (const dev of statusChanges.rows) {
                    reply.raw.write(`event: device_status\ndata: ${JSON.stringify(dev)}\n\n`);
                    lastDeviceStatusTime = String(dev.updated_at || lastDeviceStatusTime);
                }
            } catch {
                // connection closed or DB error
            }
        }, 3000);

        // Heartbeat
        const heartbeat = setInterval(() => {
            try {
                reply.raw.write(': heartbeat\n\n');
            } catch {
                // client disconnected
            }
        }, 15000);

        await new Promise<void>((resolve) => {
            const cleanup = () => {
                clearInterval(poll);
                clearInterval(heartbeat);
                try { reply.raw.end(); } catch { /* already closed */ }
                resolve();
            };
            reply.raw.on('close', cleanup);
            reply.raw.on('error', cleanup);
        });
    });
}

// ── Helpers ──

function generatePairingCode(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const alphabetLen = chars.length;
    const limit = 256 - (256 % alphabetLen);
    let code = '';
    const bytes = crypto.randomBytes(12);
    let j = 0;
    for (let i = 0; i < 6; ) {
        if (j >= bytes.length) j = 0;
        const b = bytes[j++];
        if (b < limit) {
            code += chars[b % alphabetLen];
            i++;
        }
    }
    return code;
}
