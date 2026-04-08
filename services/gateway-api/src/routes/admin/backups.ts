import { FastifyInstance, FastifyRequest } from 'fastify';
import { createReadStream } from 'fs';
import pg from 'pg';
import * as BackupService from '../../services/BackupService.js';
import * as RestoreService from '../../services/RestoreService.js';

function mapBackupErrorCodeByStatus(statusCode: number): string {
  if (statusCode === 400) return 'VALIDATION';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 413) return 'PAYLOAD_TOO_LARGE';
  return 'INTERNAL_ERROR';
}

function logBackupRouteError(app: FastifyInstance, error: unknown, message: string): string {
  app.log.error({ err: error, route: 'admin.backups' }, message);
  return message;
}

function parseBackupListLimit(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  if (parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function normalizeBackupBody<T extends object>(
  body: unknown,
): { ok: true; value: Partial<T> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as Partial<T> };
}

function getAuthenticatedActorId(request: FastifyRequest): string | null {
  const actor = String((request as any).userId || '').trim();
  if (actor.length === 0) return null;
  return actor;
}

/**
 * Register backup and disaster recovery routes
 */
export async function registerBackupRoutes(app: FastifyInstance, pool: pg.Pool) {
  function responseAlreadyCommitted(reply: any): boolean {
    return Boolean(reply.sent || reply.raw?.headersSent || reply.raw?.writableEnded || reply.raw?.destroyed);
  }

  function requireGlobalAdmin(request: any, reply: any): boolean {
    if (responseAlreadyCommitted(reply)) return false;
    if (String(request.userRole || '').trim() === 'platform_admin') return true;
    void reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
    return false;
  }

  app.addHook('preHandler', async (request, reply) => {
    if (responseAlreadyCommitted(reply)) return reply;
    if (!requireGlobalAdmin(request as any, reply)) return reply;
  });
  app.addHook('preHandler', async (request, reply) => {
    if (responseAlreadyCommitted(reply)) return reply;
    if ((request as any).orgId) return;
    return reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
  });

  // Normalize legacy backup/restore status envelopes to the shared admin success/error contract
  // before Fastify serializes and finalizes headers.
  app.addHook('preSerialization', async (request, reply, payload) => {
    const routePath = String(request.raw.url || '').toLowerCase();
    const bypassNormalizedRoutes =
      routePath.startsWith('/v1/admin/backup') ||
      routePath.startsWith('/v1/admin/backups') ||
      routePath.startsWith('/v1/admin/restore') ||
      routePath.startsWith('/v1/admin/restores') ||
      routePath.startsWith('/v1/admin/restore-points') ||
      routePath.startsWith('/v1/admin/restore-partial') ||
      routePath.startsWith('/v1/admin/snapshot') ||
      routePath.startsWith('/v1/admin/archive') ||
      routePath.startsWith('/v1/admin/metrics/') ||
      routePath.startsWith('/v1/admin/health-report') ||
      routePath.startsWith('/v1/admin/procedure/') ||
      routePath.startsWith('/v1/admin/dr-drill');
    if (bypassNormalizedRoutes) {
      return payload;
    }
    return payload;
  });

  // ============== BACKUP MANAGEMENT ==============

  /**
   * GET /backup/status - Get overall backup system status
   */
  app.get('/backup/status', async (request: FastifyRequest, reply) => {
    try {
      const backupStatus = await BackupService.getBackupStatus();
      const health = await RestoreService.generateBackupHealthReport();

      return reply.send({
        success: true,
        data: {
          metrics: {
            ...backupStatus,
            health,
          },
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: logBackupRouteError(app, error, 'Backup admin operation failed'),
        },
      });
    }
  });

  /**
   * POST /backup/start - Start a new backup job
   */
  app.post('/backup/start', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{ configId?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { configId } = body.value;

      if (typeof configId !== 'string' || configId.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'configId is required and must be a non-empty string',
        });
      }

      const backup = await BackupService.startDatabaseBackup(configId.trim());

      return reply.send({
        status: 'ok',
        backup,
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /backup/configs - List backup configurations
   */
  app.get('/backup/configs', async (_request: FastifyRequest, reply) => {
    try {
      const configs = await BackupService.listBackupConfigs();
      return reply.send({
        success: true,
        data: {
          configs,
        },
      });
    } catch (error) {
      const code = String((error as Error & { code?: string })?.code || '');
      if (code === 'RESTORE_SIMULATION_FORBIDDEN') {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'FEATURE_UNAVAILABLE',
            message: 'Restore execution mode is unavailable for production profiles',
          },
        });
      }
      if (code === 'RESTORE_LIVE_NOT_IMPLEMENTED') {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'FEATURE_UNAVAILABLE',
            message: 'Live restore execution mode is not available in this build',
          },
        });
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: logBackupRouteError(app, error, 'Backup admin operation failed'),
        },
      });
    }
  });

  /**
   * PUT /backup/configs/:configId - Update backup configuration
   */
  app.put('/backup/configs/:configId', async (request: FastifyRequest, reply) => {
    try {
      const configId = (request as any).params?.configId;
      const body = normalizeBackupBody<{
        enabled?: unknown;
        scheduleCron?: unknown;
        retentionDays?: unknown;
        storagePath?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { enabled, scheduleCron, retentionDays, storagePath } = body.value;
      if (!configId) {
        return reply.status(400).send({
          status: 'error',
          message: 'configId is required',
        });
      }
      const updated = await BackupService.updateBackupConfig(configId, {
        enabled: typeof enabled === 'boolean' ? enabled : undefined,
        schedule_cron: typeof scheduleCron === 'string' ? scheduleCron : undefined,
        retention_days: typeof retentionDays === 'number' ? retentionDays : undefined,
        storage_path: typeof storagePath === 'string' ? storagePath : undefined,
      });
      reply.send({
        status: 'ok',
        updated,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /backup/upload - Upload backup archive for restore
   */
  app.post('/backup/upload', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{
        fileName?: unknown;
        contentBase64?: unknown;
        configId?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { fileName, contentBase64, configId } = body.value;
      if (!contentBase64) {
        return reply.status(400).send({
          status: 'error',
          message: 'contentBase64 is required',
        });
      }
      const MAX_BACKUP_BASE64_LENGTH = 134_217_728; // ~100 MB decoded
      const base64Str = String(contentBase64);
      if (base64Str.length > MAX_BACKUP_BASE64_LENGTH) {
        return reply.status(413).send({
          status: 'error',
          message: `Uploaded file exceeds limit (${MAX_BACKUP_BASE64_LENGTH} base64 chars)`,
        });
      }
      const backup = await BackupService.registerUploadedBackup({
        fileName: String(fileName || ''),
        contentBase64: base64Str,
        configId: configId as string | undefined,
      });
      reply.send({
        status: 'ok',
        backup,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload backup';
      if (typeof message === 'string' && message.startsWith('UPLOAD_TOO_LARGE:')) {
        const limit = Number(message.split(':')[1] || 0);
        return reply.status(413).send({
          status: 'error',
          message: `Uploaded file exceeds limit (${limit || 0} bytes)`,
        });
      }
      if (message === 'INVALID_UPLOAD_BASE64') {
        return reply.status(400).send({
          status: 'error',
          message: 'contentBase64 must be valid base64',
        });
      }
      if ((error as Error & { code?: string })?.code === 'INVALID_UPLOAD_ARCHIVE') {
        return reply.status(400).send({
          status: 'error',
          message: 'Uploaded archive must contain a valid manifest.json (version 1.0)',
        });
      }
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /backup/:backupId - Get backup job status
   */
  app.get('/backup/:backupId', async (request: FastifyRequest, reply) => {
    try {
      const backupId = (request as any).params?.backupId;
      const backup = await BackupService.getBackupJobStatus(backupId);

      if (!backup) {
        return reply.status(404).send({
          status: 'error',
          message: 'Backup not found',
        });
      }

      reply.send({
        status: 'ok',
        backup,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /backup/:backupId/download - Download backup archive
   */
  app.get('/backup/:backupId/download', async (request: FastifyRequest, reply) => {
    try {
      const backupId = (request as any).params?.backupId;
      const archivePath = await BackupService.getBackupArchivePath(backupId);
      if (!archivePath) {
        return reply.status(404).send({
          status: 'error',
          message: 'Backup archive not found',
        });
      }
      const fileName = archivePath.split(/[\\/]/).pop() || `backup-${backupId}.tar.gz`;
      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
      return reply.send(createReadStream(archivePath));
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /backup/:backupId/verify - Verify backup integrity
   */
  app.post('/backup/:backupId/verify', async (request: FastifyRequest, reply) => {
    try {
      const backupId = (request as any).params?.backupId;
      const verified = await BackupService.verifyBackupIntegrity(backupId);

      reply.send({
        status: 'ok',
        verified,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /backups - List all backups
   */
  app.get('/backups', async (request: FastifyRequest, reply) => {
    try {
      const limit = parseBackupListLimit((request as any).query?.limit, 50, 1, 500);
      if (limit === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'limit must be a finite integer between 1 and 500',
          },
        });
      }
      const backups = await BackupService.listBackups(limit);

      return reply.send({
        success: true,
        data: {
          backups,
          count: backups.length,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: logBackupRouteError(app, error, 'Backup admin operation failed'),
        },
      });
    }
  });

  // ============== SNAPSHOT MANAGEMENT ==============

  /**
   * POST /snapshot - Create a snapshot from a backup
   */
  app.post('/snapshot', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{
        backupJobId?: unknown;
        description?: unknown;
        tags?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { backupJobId, description, tags } = body.value;

      if (!backupJobId || !description) {
        return reply.status(400).send({
          status: 'error',
          message: 'backupJobId and description are required',
        });
      }

      const tagsValue = Array.isArray(tags) ? tags : [];
      const snapshot = await BackupService.createSnapshot(String(backupJobId), String(description), tagsValue);

      reply.send({
        status: 'ok',
        snapshot,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  // ============== ARCHIVE MANAGEMENT ==============

  /**
   * POST /archive - Archive a backup for long-term storage
   */
  app.post('/archive', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{
        backupJobId?: unknown;
        complianceCategory?: unknown;
        retentionYears?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { backupJobId, complianceCategory, retentionYears } = body.value;

      if (!backupJobId || !complianceCategory) {
        return reply.status(400).send({
          status: 'error',
          message: 'backupJobId and complianceCategory are required',
        });
      }

      const archive = await BackupService.archiveBackup(
        String(backupJobId),
        String(complianceCategory),
        Number.isFinite(Number(retentionYears)) ? Number(retentionYears) : 7
      );

      reply.send({
        status: 'ok',
        archive,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  // ============== RESTORE OPERATIONS ==============

  /**
   * GET /restore-points - List available restore points
   */
  app.get('/restore-points', async (request: FastifyRequest, reply) => {
    try {
      const limit = parseBackupListLimit((request as any).query?.limit, 50, 1, 500);
      if (limit === null) {
        return reply.status(400).send({
          status: 'error',
          message: 'limit must be a finite integer between 1 and 500',
        });
      }
      const restorePoints = await RestoreService.listAvailableRestorePoints(limit);

      reply.send({
        status: 'ok',
        restorePoints,
        count: restorePoints.length,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /restore - Initiate a restore operation
   */
  app.post('/restore', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{
        backupJobId?: unknown;
        targetEnvironment?: unknown;
        reason?: unknown;
        userId?: unknown;
        initiatedBy?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { backupJobId, targetEnvironment, reason } = body.value;
      const actorUserId = getAuthenticatedActorId(request);
      if (!actorUserId) {
        return reply.status(403).send({
          status: 'error',
          message: 'Authenticated actor required',
        });
      }
      if (body.value.userId !== undefined) {
        const requestedUserId = String(body.value.userId || '').trim();
        if (!requestedUserId || requestedUserId !== actorUserId) {
          return reply.status(400).send({
            status: 'error',
            message: 'userId must match authenticated actor',
          });
        }
      }
      if (body.value.initiatedBy !== undefined) {
        const requestedActor = String(body.value.initiatedBy || '').trim();
        if (!requestedActor || requestedActor !== actorUserId) {
          return reply.status(400).send({
            status: 'error',
            message: 'initiatedBy must match authenticated actor',
          });
        }
      }

      if (!backupJobId || !targetEnvironment) {
        return reply.status(400).send({
          status: 'error',
          message: 'backupJobId and targetEnvironment are required',
        });
      }
      if (typeof targetEnvironment !== 'string' || targetEnvironment.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'targetEnvironment must be a non-empty string',
        });
      }

      const restore = await BackupService.startRestore(
        String(backupJobId),
        targetEnvironment.trim(),
        actorUserId,
        typeof reason === 'string' && reason.trim().length > 0
          ? reason.trim()
          : 'manual restore'
      );

      reply.send({
        status: 'ok',
        restore,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /restore/:restoreId - Get restore job status
   */
  app.get('/restore/:restoreId', async (request: FastifyRequest, reply) => {
    try {
      const restoreId = (request as any).params?.restoreId;
      const restore = await BackupService.getRestoreJobStatus(restoreId);

      if (!restore) {
        return reply.status(404).send({
          status: 'error',
          message: 'Restore job not found',
        });
      }

      reply.send({
        status: 'ok',
        restore,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /restore/:restoreId/verify - Verify restored data integrity
   */
  app.post('/restore/:restoreId/verify', async (request: FastifyRequest, reply) => {
    try {
      const restoreId = (request as any).params?.restoreId;
      const verification = await RestoreService.verifyRestoreDataIntegrity(restoreId);

      reply.send({
        status: 'ok',
        verification,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /restore/:restoreId/cancel - Cancel an in-progress restore
   */
  app.post('/restore/:restoreId/cancel', async (request: FastifyRequest, reply) => {
    try {
      const restoreId = (request as any).params?.restoreId;
      const body = normalizeBackupBody<{ reason?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { reason } = body.value;

      const result = await RestoreService.cancelRestore(restoreId, reason ? String(reason) : 'User cancelled');

      reply.send({
        status: 'ok',
        result,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /restores - List all restore jobs
   */
  app.get('/restores', async (request: FastifyRequest, reply) => {
    try {
      const limit = parseBackupListLimit((request as any).query?.limit, 50, 1, 500);
      if (limit === null) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'limit must be a finite integer between 1 and 500',
          },
        });
      }
      const restores = await BackupService.listRestoreJobs(limit);

      return reply.send({
        success: true,
        data: {
          restores,
          count: restores.length,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: logBackupRouteError(app, error, 'Backup admin operation failed'),
        },
      });
    }
  });

  // ============== PARTIAL RESTORE ==============

  /**
   * POST /restore-partial - Restore specific tables only
   */
  app.post('/restore-partial', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{
        backupJobId?: unknown;
        tablesToRestore?: unknown;
        targetEnvironment?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { backupJobId, tablesToRestore, targetEnvironment } =
        body.value;
      const actorUserId = getAuthenticatedActorId(request);
      if (!actorUserId) {
        return reply.status(403).send({
          status: 'error',
          message: 'Authenticated actor required',
        });
      }

      if (!backupJobId || !Array.isArray(tablesToRestore) || tablesToRestore.length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'backupJobId and tablesToRestore are required',
        });
      }
      const parsedTables = tablesToRestore
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (parsedTables.length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'tablesToRestore must include at least one non-empty table name',
        });
      }
      if (typeof targetEnvironment !== 'string' || targetEnvironment.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'targetEnvironment is required and must be a non-empty string',
        });
      }

      const result = await RestoreService.initiatePartialRestore(
        String(backupJobId),
        parsedTables,
        targetEnvironment.trim(),
        actorUserId
      );

      reply.send({
        status: 'ok',
        result,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  // ============== METRICS & REPORTING ==============

  /**
   * GET /metrics/rpo - Get Recovery Point Objective metrics
   */
  app.get('/metrics/rpo', async (request: FastifyRequest, reply) => {
    try {
      const metrics = await RestoreService.calculateRPOMetrics();

      reply.send({
        status: 'ok',
        metrics,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /metrics/rto - Get Recovery Time Objective metrics
   */
  app.get('/metrics/rto', async (request: FastifyRequest, reply) => {
    try {
      const metrics = await RestoreService.calculateRTOMetrics();

      reply.send({
        status: 'ok',
        metrics,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /metrics/restore-stats - Get restore statistics
   */
  app.get('/metrics/restore-stats', async (request: FastifyRequest, reply) => {
    try {
      const stats = await RestoreService.getRestoreStatistics();

      reply.send({
        status: 'ok',
        stats,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /health-report - Generate backup health report
   */
  app.get('/health-report', async (request: FastifyRequest, reply) => {
    try {
      const report = await RestoreService.generateBackupHealthReport();

      reply.send({
        status: 'ok',
        report,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  // ============== PROCEDURES & DOCUMENTATION ==============

  /**
   * GET /procedure/restore - Get restore procedure documentation
   */
  app.get('/procedure/restore', async (request: FastifyRequest, reply) => {
    try {
      const procedure = await BackupService.getRestoreProcedure();

      reply.send({
        status: 'ok',
        procedure,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * GET /procedure/restore-safe - Get safe restore procedure with safeguards
   */
  app.get('/procedure/restore-safe', async (request: FastifyRequest, reply) => {
    try {
      const procedure = await RestoreService.getRestoreProcedureWithSafeguards();

      reply.send({
        status: 'ok',
        procedure,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  // ============== DISASTER RECOVERY DRILLS ==============

  /**
   * POST /dr-drill - Schedule a disaster recovery drill
   */
  app.post('/dr-drill', async (request: FastifyRequest, reply) => {
    try {
      const body = normalizeBackupBody<{
        name?: unknown;
        description?: unknown;
        scope?: unknown;
        affectedSystems?: unknown;
        scheduledDate?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { name, description, scope, affectedSystems, scheduledDate } =
        body.value;

      if (!name || !scope) {
        return reply.status(400).send({
          status: 'error',
          message: 'name and scope are required',
        });
      }
      if (typeof scheduledDate !== 'string' || scheduledDate.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'scheduledDate is required and must be an ISO date-time string',
        });
      }
      const scheduledAt = new Date(scheduledDate);
      if (!Number.isFinite(scheduledAt.getTime())) {
        return reply.status(400).send({
          status: 'error',
          message: 'scheduledDate must be a valid ISO date-time string',
        });
      }
      if (scheduledAt.getTime() <= Date.now()) {
        return reply.status(400).send({
          status: 'error',
          message: 'scheduledDate must be in the future',
        });
      }

      const drill = await BackupService.scheduleDRDrill(
        String(name),
        String(description || ''),
        String(scope),
        Array.isArray(affectedSystems) ? affectedSystems : [],
        scheduledAt
      );

      reply.send({
        status: 'ok',
        drill,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /dr-drill/:drillId/start - Start a DR drill
   */
  app.post('/dr-drill/:drillId/start', async (request: FastifyRequest, reply) => {
    try {
      const drillId = (request as any).params?.drillId;
      const body = normalizeBackupBody<{ leadPerson?: unknown }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { leadPerson } = body.value;
      if (typeof leadPerson !== 'string' || leadPerson.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'leadPerson is required and must be a non-empty string',
        });
      }

      const result = await BackupService.startDRDrill(drillId, leadPerson.trim());

      reply.send({
        status: 'ok',
        result,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });

  /**
   * POST /dr-drill/:drillId/complete - Complete a DR drill with results
   */
  app.post('/dr-drill/:drillId/complete', async (request: FastifyRequest, reply) => {
    try {
      const drillId = (request as any).params?.drillId;
      const body = normalizeBackupBody<{
        success?: unknown;
        findings?: unknown;
        recommendations?: unknown;
        actionItems?: unknown;
      }>(request.body);
      if (!body.ok) {
        return reply.status(400).send({ status: 'error', message: body.message });
      }
      const { success: successRaw, findings: findingsRaw, recommendations: recommendationsRaw, actionItems: actionItemsRaw } = body.value;
      if (typeof successRaw !== 'boolean') {
        return reply.status(400).send({
          status: 'error',
          message: 'success must be a boolean',
        });
      }
      if (typeof findingsRaw !== 'string' || findingsRaw.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'findings is required and must be a non-empty string',
        });
      }
      if (typeof recommendationsRaw !== 'string' || recommendationsRaw.trim().length === 0) {
        return reply.status(400).send({
          status: 'error',
          message: 'recommendations is required and must be a non-empty string',
        });
      }

      const result = await BackupService.completeDRDrill(
        drillId,
        successRaw,
        findingsRaw.trim(),
        recommendationsRaw.trim(),
        Array.isArray(actionItemsRaw) ? actionItemsRaw : []
      );

      reply.send({
        status: 'ok',
        result,
      });
    } catch (error) {
      reply.status(500).send({
        status: 'error',
        message: logBackupRouteError(app, error, 'Backup admin operation failed'),
      });
    }
  });
}
