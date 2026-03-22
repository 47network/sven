import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

const logger = createLogger('gateway-deployment');
const DEPLOYMENT_SETUP_ADVISORY_LOCK_KEY = 47010002;

// ─── Valid deployment modes ───
const VALID_MODES = ['personal', 'multi_user'] as const;
type DeploymentMode = (typeof VALID_MODES)[number];

/**
 * Read the current deployment mode from settings_global.
 * Defaults to 'multi_user' if not set.
 */
async function getDeploymentMode(pool: pg.Pool): Promise<DeploymentMode> {
    const res = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'deployment.mode' LIMIT 1`,
    );
    if (res.rows.length === 0) return 'multi_user';
    const raw = res.rows[0]?.value;
    const mode = typeof raw === 'string' ? raw.replace(/"/g, '') : String(raw);
    if (VALID_MODES.includes(mode as DeploymentMode)) {
        return mode as DeploymentMode;
    }
    return 'multi_user';
}

export async function registerDeploymentRoutes(
    app: FastifyInstance,
    pool: pg.Pool,
) {
    // ─── GET /v1/config/deployment ───────────────────────────────────────
    // Public endpoint — no auth required.
    // The Flutter app calls this at startup to decide which flow to show.
    app.get('/v1/config/deployment', async (_request, reply) => {
        const mode = await getDeploymentMode(pool);

        // Count users to check if setup is needed
        const usersRes = await pool.query(
            `SELECT COUNT(*)::int AS total FROM users`,
        );
        const userCount = Number(usersRes.rows[0]?.total || 0);

        reply.send({
            success: true,
            data: {
                mode,
                setup_complete: userCount > 0,
            },
        });
    });

    // ─── PUT /v1/admin/deployment ────────────────────────────────────────
    // Admin-only — change deployment mode.
    app.put(
        '/v1/admin/deployment',
        { preHandler: requireRole(pool, 'admin') },
        async (request, reply) => {
            const body = request.body as { mode?: string } | undefined;
            const mode = String(body?.mode || '').trim();

            if (!VALID_MODES.includes(mode as DeploymentMode)) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'VALIDATION',
                        message: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`,
                    },
                });
            }

            await pool.query(
                `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('deployment.mode', $1, NOW(), 'admin')
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = 'admin'`,
                [JSON.stringify(mode)],
            );

            logger.info('Deployment mode changed', { mode });
            reply.send({ success: true, data: { mode } });
        },
    );

    // ─── POST /v1/config/deployment/setup ────────────────────────────────
    // One-time setup endpoint for first launch.
    // Only works when no users exist (same guard as /v1/auth/bootstrap).
    // Creates the admin user AND sets deployment mode in one step.
    app.post('/v1/config/deployment/setup', {
        schema: {
            body: {
                type: 'object',
                required: ['mode', 'username', 'password'],
                additionalProperties: false,
                properties: {
                    mode: { type: 'string', enum: [...VALID_MODES] },
                    username: { type: 'string', minLength: 1 },
                    password: { type: 'string', minLength: 8 },
                    display_name: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const body = request.body as {
            mode?: string;
            username?: string;
            password?: string;
            display_name?: string;
        } | undefined;

        const mode = String(body?.mode || 'personal').trim();
        const username = String(body?.username || '').trim();
        const password = String(body?.password || '');
        const displayName = String(body?.display_name || username || '').trim();

        if (!VALID_MODES.includes(mode as DeploymentMode)) {
            return reply.status(400).send({
                success: false,
                error: {
                    code: 'VALIDATION',
                    message: `mode must be one of: ${VALID_MODES.join(', ')}`,
                },
            });
        }

        if (!username || !password) {
            return reply.status(400).send({
                success: false,
                error: {
                    code: 'VALIDATION',
                    message: 'username and password are required',
                },
            });
        }

        // Import bcrypt dynamically to match auth.ts pattern
        const bcrypt = await import('bcrypt');
        const { v7: uuidv7 } = await import('uuid');

        const passwordHash = await bcrypt.hash(password, 12);
        const userId = uuidv7();

        await pool.query('BEGIN');
        try {
            const lockRes = await pool.query(
                `SELECT pg_try_advisory_xact_lock($1) AS locked`,
                [DEPLOYMENT_SETUP_ADVISORY_LOCK_KEY],
            );
            if (!lockRes.rows[0]?.locked) {
                await pool.query('ROLLBACK');
                return reply.status(409).send({
                    success: false,
                    error: {
                        code: 'SETUP_IN_PROGRESS',
                        message: 'Setup is already in progress',
                    },
                });
            }

            // Only allowed when no users exist
            const usersRes = await pool.query(
                `SELECT COUNT(*)::int AS total FROM users`,
            );
            if (Number(usersRes.rows[0]?.total || 0) > 0) {
                await pool.query('ROLLBACK');
                return reply.status(409).send({
                    success: false,
                    error: {
                        code: 'SETUP_LOCKED',
                        message: 'Setup already completed — users exist',
                    },
                });
            }

            // Create admin user (no TOTP for personal mode, optional for multi-user)
            await pool.query(
                `INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at)
           VALUES ($1, $2, $3, 'admin', $4, NOW(), NOW())`,
                [userId, username, displayName, passwordHash],
            );

            // Set deployment mode
            await pool.query(
                `INSERT INTO settings_global (key, value, updated_at, updated_by)
           VALUES ('deployment.mode', $1, NOW(), 'setup')
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = 'setup'`,
                [JSON.stringify(mode)],
            );
            await pool.query('COMMIT');
        } catch (error) {
            await pool.query('ROLLBACK').catch(() => {});
            throw error;
        }

        logger.info('First-time setup completed', {
            mode,
            user_id: userId,
            username,
        });

        reply.status(201).send({
            success: true,
            data: {
                mode,
                user_id: userId,
                username,
                role: 'admin',
            },
        });
    });
}
