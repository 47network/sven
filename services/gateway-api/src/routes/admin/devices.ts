// ═══════════════════════════════════════════════════════════════════════════
// Admin device management routes — CRUD, pairing, commands
// Mounted under /v1/admin (auth handled by admin index preHandler)
// ═══════════════════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-devices');
const DESKTOP_COMMANDS = new Set([
    'open_url',
    'open_app',
    'open_path',
    'type_text',
    'hotkey',
    'focus_window',
]);
const DESKTOP_HIGH_RISK_COMMANDS = new Set(['type_text', 'hotkey', 'focus_window']);
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

function parseDesktopHotkey(payload: Record<string, unknown> | undefined): string {
    if (!payload) return '';
    const keysRaw = payload.keys;
    if (typeof keysRaw === 'string') {
        return keysRaw.trim().toLowerCase();
    }
    if (Array.isArray(keysRaw)) {
        return keysRaw.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean).join('+');
    }
    return '';
}

function validateDesktopCommandPolicy(
    deviceConfigRaw: unknown,
    command: string,
    payload?: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
    if (!DESKTOP_COMMANDS.has(command)) return { ok: true };

    const deviceConfig = (deviceConfigRaw && typeof deviceConfigRaw === 'object' && !Array.isArray(deviceConfigRaw))
        ? (deviceConfigRaw as Record<string, unknown>)
        : {};
    const desktopControl = (deviceConfig.desktop_control && typeof deviceConfig.desktop_control === 'object' && !Array.isArray(deviceConfig.desktop_control))
        ? (deviceConfig.desktop_control as Record<string, unknown>)
        : {};

    const hasDesktopPolicy = Object.keys(desktopControl).length > 0;
    const enabled = desktopControl.enabled === true;
    if (DESKTOP_HIGH_RISK_COMMANDS.has(command) && !enabled) {
        return {
            ok: false,
            message: 'Desktop control disabled for high-risk actions (set config.desktop_control.enabled=true)',
        };
    }
    if (hasDesktopPolicy && desktopControl.enabled === false) {
        return {
            ok: false,
            message: 'Desktop control disabled by device policy',
        };
    }

    const allowedActions = Array.isArray(desktopControl.allowed_actions)
        ? desktopControl.allowed_actions.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
    if (allowedActions.length > 0 && !allowedActions.includes(command)) {
        return {
            ok: false,
            message: `Desktop action "${command}" not allowed by device policy`,
        };
    }

    if (command === 'hotkey') {
        const allowedHotkeys = Array.isArray(desktopControl.allowed_hotkeys)
            ? desktopControl.allowed_hotkeys.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
            : [];
        const requested = parseDesktopHotkey(payload);
        if (!requested) {
            return { ok: false, message: 'hotkey payload.keys is required' };
        }
        if (allowedHotkeys.length > 0 && !allowedHotkeys.includes(requested)) {
            return {
                ok: false,
                message: `Hotkey "${requested}" not allowed by device policy`,
            };
        }
    }

    return { ok: true };
}

export async function registerDeviceRoutes(app: FastifyInstance, pool: pg.Pool) {
    function currentOrgId(request: any): string | null {
        return request.orgId ? String(request.orgId) : null;
    }

    // ─── GET /devices — list devices ───
    app.get('/devices', async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const query = request.query as { status?: string; type?: string };
        let where = 'WHERE organization_id = $1';
        const params: unknown[] = [orgId];

        if (query.status) {
            params.push(query.status);
            where += ` AND status = $${params.length}`;
        }
        if (query.type) {
            params.push(query.type);
            where += ` AND device_type = $${params.length}`;
        }

        const result = await pool.query(
            `SELECT id, name, device_type, status, capabilities, config,
              last_seen_at, paired_at, created_at, updated_at
       FROM devices ${where}
       ORDER BY created_at DESC
       LIMIT 500`,
            params,
        );

        reply.send({ success: true, data: result.rows });
    });

    // ─── GET /devices/:id — device detail ───
    app.get('/devices/:id', async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const { id } = request.params as { id: string };
        const result = await pool.query(
            `SELECT id, name, device_type, status, capabilities, config,
              last_seen_at, paired_at, created_at, updated_at
       FROM devices WHERE id = $1 AND organization_id = $2`,
            [id, orgId],
        );

        if (result.rows.length === 0) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Device not found' },
            });
        }

        // Fetch recent events
        const events = await pool.query(
            `SELECT id, event_type, payload, created_at
       FROM device_events WHERE device_id = $1
       ORDER BY created_at DESC LIMIT 20`,
            [id],
        );

        // Fetch pending commands
        const commands = await pool.query(
            `SELECT id, command, payload, status, created_at, delivered_at, ack_at, result_payload, error_message
           FROM device_commands WHERE device_id = $1
           ORDER BY created_at DESC LIMIT 20`,
            [id],
        ).catch(async (err) => {
            if (String((err as { code?: string })?.code || '') !== '42703') throw err;
            return pool.query(
                `SELECT id, command, payload, status, created_at, delivered_at, ack_at,
                            NULL::jsonb AS result_payload, NULL::text AS error_message
                       FROM device_commands
                      WHERE device_id = $1
                      ORDER BY created_at DESC LIMIT 20`,
                [id],
            );
        });

        reply.send({
            success: true,
            data: {
                ...result.rows[0],
                recent_events: events.rows,
                recent_commands: commands.rows,
            },
        });
    });

    // ─── POST /devices — register new device (starts pairing) ───
    app.post('/devices', {
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                additionalProperties: false,
                properties: {
                    name: { type: 'string', minLength: 1 },
                    device_type: { type: 'string', enum: ['mirror', 'tablet', 'kiosk', 'sensor_hub'] },
                    capabilities: { type: 'array', items: { type: 'string' } },
                    config: { type: 'object', additionalProperties: true },
                },
            },
        },
    }, async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const body = request.body as {
            name: string;
            device_type?: string;
            capabilities?: string[];
            config?: Record<string, unknown>;
        };

        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Device name is required' },
            });
        }

        const validTypes = ['mirror', 'tablet', 'kiosk', 'sensor_hub'];
        const deviceType = body.device_type || 'mirror';
        if (!validTypes.includes(deviceType)) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: `Invalid device type. Must be one of: ${validTypes.join(', ')}` },
            });
        }

        // Generate 6-character pairing code (uppercase alphanumeric, no ambiguous chars)
        const pairingCode = generatePairingCode();
        const pairingExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        const result = await pool.query(
            `INSERT INTO devices (organization_id, name, device_type, capabilities, config, status, pairing_code, pairing_expires, created_by)
       VALUES ($1, $2, $3, $4, $5, 'pairing', $6, $7, $8)
       RETURNING id, name, device_type, status, capabilities, config, pairing_code, pairing_expires, created_at`,
            [
                orgId,
                body.name.trim(),
                deviceType,
                JSON.stringify(body.capabilities || []),
                JSON.stringify(body.config || {}),
                pairingCode,
                pairingExpires,
                request.userId,
            ],
        );

        logger.info('Device registered, pairing started', { deviceId: result.rows[0].id, name: body.name });

        reply.status(201).send({
            success: true,
            data: result.rows[0],
        });
    });

    // ─── PATCH /devices/:id — update device config ───
    app.patch('/devices/:id', {
        schema: {
            body: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: { type: 'string' },
                    device_type: { type: 'string', enum: ['mirror', 'tablet', 'kiosk', 'sensor_hub'] },
                    capabilities: { type: 'array', items: { type: 'string' } },
                    config: { type: 'object', additionalProperties: true },
                },
            },
        },
    }, async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const { id } = request.params as { id: string };
        const body = request.body as {
            name?: string;
            device_type?: string;
            capabilities?: string[];
            config?: Record<string, unknown>;
        };
        const bodyRecord = (body && typeof body === 'object') ? (body as Record<string, unknown>) : null;
        const hasName = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'name'));
        const hasDeviceType = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'device_type'));
        const hasCapabilities = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'capabilities'));
        const hasConfig = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'config'));

        if (!hasName && !hasDeviceType && !hasCapabilities && !hasConfig) {
            return reply.status(400).send({
                success: false,
                error: { code: 'VALIDATION', message: 'At least one mutable field is required' },
            });
        }

        // Build dynamic SET clause
        const sets: string[] = [];
        const params: unknown[] = [];
        let pi = 0;

        if (body.name !== undefined) {
            params.push(body.name.trim());
            sets.push(`name = $${++pi}`);
        }
        if (body.device_type !== undefined) {
            params.push(body.device_type);
            sets.push(`device_type = $${++pi}`);
        }
        if (body.capabilities !== undefined) {
            params.push(JSON.stringify(body.capabilities));
            sets.push(`capabilities = $${++pi}`);
        }
        if (body.config !== undefined) {
            params.push(JSON.stringify(body.config));
            sets.push(`config = $${++pi}`);
        }
        sets.push('updated_at = now()');

        params.push(id, orgId);
        const result = await pool.query(
            `UPDATE devices SET ${sets.join(', ')}
       WHERE id = $${pi + 1} AND organization_id = $${pi + 2}
       RETURNING id, name, device_type, status, capabilities, config, last_seen_at, paired_at, created_at, updated_at`,
            params,
        );

        if (result.rows.length === 0) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Device not found' },
            });
        }

        reply.send({ success: true, data: result.rows[0] });
    });

    // ─── DELETE /devices/:id — remove device ───
    app.delete('/devices/:id', async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const { id } = request.params as { id: string };
        const result = await pool.query(
            `DELETE FROM devices WHERE id = $1 AND organization_id = $2 RETURNING id`,
            [id, orgId],
        );

        if (result.rows.length === 0) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Device not found' },
            });
        }

        logger.info('Device deleted', { deviceId: id });
        reply.send({ success: true, data: { deleted: true } });
    });

    // ─── POST /devices/:id/command — send command to device ───
    app.post('/devices/:id/command', {
        schema: {
            body: {
                type: 'object',
                required: ['command'],
                additionalProperties: false,
                properties: {
                    command: { type: 'string', minLength: 1 },
                    payload: { type: 'object', additionalProperties: true },
                },
            },
        },
    }, async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const { id } = request.params as { id: string };
        const body = request.body as { command: string; payload?: Record<string, unknown> };

        if (!body.command) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Command is required' },
            });
        }

        // Verify device exists and belongs to org
        const device = await pool.query(
            `SELECT id, status, config FROM devices WHERE id = $1 AND organization_id = $2`,
            [id, orgId],
        );
        if (device.rows.length === 0) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Device not found' },
            });
        }

        const validCommands = [
            'display',
            'camera_snapshot',
            'camera_motion',
            'tts_speak',
            'audio_record',
            'sensor_read',
            'gpio_write',
            'open_url',
            'open_app',
            'open_path',
            'type_text',
            'hotkey',
            'focus_window',
            'reboot',
            'update_config',
            'ping',
        ];
        if (!validCommands.includes(body.command)) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: `Invalid command. Must be one of: ${validCommands.join(', ')}` },
            });
        }

        const policy = validateDesktopCommandPolicy(device.rows[0].config, body.command, body.payload);
        if (!policy.ok) {
            return reply.status(403).send({
                success: false,
                error: { code: 'DESKTOP_POLICY_DENIED', message: policy.message },
            });
        }

        const result = await pool.query(
            `INSERT INTO device_commands (device_id, command, payload, sent_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, command, payload, status, created_at`,
            [id, body.command, JSON.stringify(body.payload || {}), request.userId],
        );

        logger.info('Command queued for device', { deviceId: id, command: body.command });
        reply.status(201).send({ success: true, data: result.rows[0] });
    });

    // ─── POST /devices/:id/pair/confirm — confirm pairing (generates API key) ───
    app.post('/devices/:id/pair/confirm', {
        schema: {
            body: {
                type: 'object',
                required: ['pairing_code'],
                additionalProperties: false,
                properties: {
                    pairing_code: { type: 'string', minLength: 1 },
                },
            },
        },
    }, async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const { id } = request.params as { id: string };
        const body = request.body as { pairing_code: string };

        if (!body.pairing_code) {
            return reply.status(400).send({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Pairing code is required' },
            });
        }

        const normalizedCode = body.pairing_code.toUpperCase().trim();
        const hasApiKeyLookupColumn = await devicesHasApiKeyLookupColumn(pool);

        // Generate API key for the device
        const apiKey = `sven_dev_${crypto.randomBytes(32).toString('base64url')}`;
        const apiKeyHash = await bcrypt.hash(apiKey, 10);
        const apiKeyLookup = computeDeviceApiKeyLookup(apiKey);

        const paired = hasApiKeyLookupColumn
            ? await pool.query(
                `UPDATE devices
           SET status = 'online', api_key_hash = $1, api_key_lookup = $2, paired_at = now(),
               pairing_code = NULL, pairing_expires = NULL, last_seen_at = now(), updated_at = now()
           WHERE id = $3
             AND organization_id = $4
             AND status = 'pairing'
             AND pairing_code = $5
             AND (pairing_expires IS NULL OR pairing_expires >= now())
           RETURNING id`,
                [apiKeyHash, apiKeyLookup, id, orgId, normalizedCode],
            ).catch(async (err) => {
                if (!isMissingApiKeyLookupColumnError(err)) throw err;
                devicesHasApiKeyLookupColumnCache = false;
                return pool.query(
                    `UPDATE devices
               SET status = 'online', api_key_hash = $1, paired_at = now(),
                   pairing_code = NULL, pairing_expires = NULL, last_seen_at = now(), updated_at = now()
               WHERE id = $2
                 AND organization_id = $3
                 AND status = 'pairing'
                 AND pairing_code = $4
                 AND (pairing_expires IS NULL OR pairing_expires >= now())
               RETURNING id`,
                    [apiKeyHash, id, orgId, normalizedCode],
                );
            })
            : await pool.query(
                `UPDATE devices
           SET status = 'online', api_key_hash = $1, paired_at = now(),
               pairing_code = NULL, pairing_expires = NULL, last_seen_at = now(), updated_at = now()
           WHERE id = $2
             AND organization_id = $3
             AND status = 'pairing'
             AND pairing_code = $4
             AND (pairing_expires IS NULL OR pairing_expires >= now())
           RETURNING id`,
                [apiKeyHash, id, orgId, normalizedCode],
            );
        if (paired.rows.length === 0) {
            const device = await pool.query(
                `SELECT id, status, pairing_code, pairing_expires
           FROM devices
           WHERE id = $1 AND organization_id = $2`,
                [id, orgId],
            );
            if (device.rows.length === 0) {
                return reply.status(404).send({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Device not found or not in pairing mode' },
                });
            }
            const dev = device.rows[0];
            if (String(dev.status || '') !== 'pairing') {
                return reply.status(409).send({
                    success: false,
                    error: { code: 'PAIRING_STATE_CHANGED', message: 'Device is no longer in pairing mode' },
                });
            }
            if (dev.pairing_expires && new Date(dev.pairing_expires) < new Date()) {
                return reply.status(400).send({
                    success: false,
                    error: { code: 'CODE_EXPIRED', message: 'Pairing code has expired. Please register the device again.' },
                });
            }
            if (String(dev.pairing_code || '') !== normalizedCode) {
                return reply.status(400).send({
                    success: false,
                    error: { code: 'INVALID_CODE', message: 'Incorrect pairing code' },
                });
            }
            return reply.status(409).send({
                success: false,
                error: { code: 'PAIRING_STATE_CHANGED', message: 'Pairing state changed. Please retry device registration.' },
            });
        }

        logger.info('Device paired successfully', { deviceId: id });

        // Return the API key ONCE — it won't be retrievable again
        reply.send({
            success: true,
            data: {
                device_id: id,
                api_key: apiKey,
                message: 'Device paired. Store the API key securely — it will not be shown again.',
            },
        });
    });

    // ─── POST /devices/:id/pair/regenerate — regenerate API key ───
    app.post('/devices/:id/pair/regenerate', async (request, reply) => {
        const orgId = currentOrgId(request);
        if (!orgId) {
            return reply.status(403).send({
                success: false,
                error: { code: 'ORG_REQUIRED', message: 'Active account required' },
            });
        }

        const { id } = request.params as { id: string };
        const device = await pool.query(
            `SELECT id FROM devices WHERE id = $1 AND organization_id = $2`,
            [id, orgId],
        );
        if (device.rows.length === 0) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Device not found' },
            });
        }

        const apiKey = `sven_dev_${crypto.randomBytes(32).toString('base64url')}`;
        const apiKeyHash = await bcrypt.hash(apiKey, 10);
        const apiKeyLookup = computeDeviceApiKeyLookup(apiKey);
        const hasApiKeyLookupColumn = await devicesHasApiKeyLookupColumn(pool);

        if (hasApiKeyLookupColumn) {
            await pool.query(
                `UPDATE devices SET api_key_hash = $1, api_key_lookup = $2, updated_at = now() WHERE id = $3`,
                [apiKeyHash, apiKeyLookup, id],
            ).catch(async (err) => {
                if (!isMissingApiKeyLookupColumnError(err)) throw err;
                devicesHasApiKeyLookupColumnCache = false;
                await pool.query(
                    `UPDATE devices SET api_key_hash = $1, updated_at = now() WHERE id = $2`,
                    [apiKeyHash, id],
                );
            });
        } else {
            await pool.query(
                `UPDATE devices SET api_key_hash = $1, updated_at = now() WHERE id = $2`,
                [apiKeyHash, id],
            );
        }

        logger.info('Device API key regenerated', { deviceId: id });

        reply.send({
            success: true,
            data: {
                device_id: id,
                api_key: apiKey,
                message: 'New API key generated. Store it securely — it will not be shown again.',
            },
        });
    });
}

// ── Helpers ──

function generatePairingCode(): string {
    // 6-char uppercase, no ambiguous chars (0/O, 1/I/L)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

function computeDeviceApiKeyLookup(apiKey: string): string {
    return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex');
}
