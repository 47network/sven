import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function registerDbStatusRoutes(app: FastifyInstance, pool: pg.Pool) {
  function requireGlobalAdmin(request: any, reply: any): boolean {
    if (String(request.userRole || '') === 'platform_admin') return true;
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
    return false;
  }

  function requireActiveOrg(request: any, reply: any): boolean {
    if (String(request.orgId || '').trim()) return true;
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return false;
  }

  app.get('/db/schema/status', async (_request, reply) => {
    try {
      await pool.query(`SELECT 1 FROM _migrations LIMIT 1`);
      reply.send({
        success: true,
        data: {
          schema_ready: true,
        },
      });
    } catch {
      reply.status(503).send({
        success: false,
        error: { code: 'FEATURE_UNAVAILABLE', message: 'Schema readiness is unavailable' },
        data: {
          schema_ready: false,
        },
      });
    }
  });

  app.get('/db/migrations/status', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    if (!requireActiveOrg(request as any, reply)) return;

    let migrationFiles: string[] = [];
    let fileSourceAvailable = true;
    let fileSourceStatus: 'filesystem_ok' | 'filesystem_unavailable' = 'filesystem_ok';
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      const migrationsDir = join(here, '..', '..', 'db', 'migrations');
      migrationFiles = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      migrationFiles = [];
      fileSourceAvailable = false;
      fileSourceStatus = 'filesystem_unavailable';
    }
    if (!fileSourceAvailable) {
      reply.status(503).send({
        success: false,
        error: { code: 'MIGRATION_FILES_UNAVAILABLE', message: 'Migration files are unavailable' },
        data: {
          file_source_available: false,
          source_status: fileSourceStatus,
          history_source_available: null,
          total_files: 0,
        },
      });
      return;
    }

    let applied: Set<string>;
    try {
      const appliedRes = await pool.query(
        `SELECT name FROM _migrations ORDER BY applied_at ASC`,
      );
      applied = new Set(appliedRes.rows.map((r) => String(r.name)));
    } catch {
      reply.status(503).send({
        success: false,
        error: { code: 'FEATURE_UNAVAILABLE', message: 'Migration history is unavailable' },
        data: {
          file_source_available: fileSourceAvailable,
          source_status: fileSourceStatus,
          history_source_available: false,
          total_files: migrationFiles.length,
        },
      });
      return;
    }
    const pending = migrationFiles.filter((f) => !applied.has(f) && !applied.has(f.replace(/\.sql$/, '')));

    reply.send({
      success: true,
      data: {
        file_source_available: fileSourceAvailable,
        source_status: fileSourceStatus,
        history_source_available: true,
        total_files: migrationFiles.length,
        applied_count: applied.size,
        pending_count: pending.length,
      },
    });
  });
}
