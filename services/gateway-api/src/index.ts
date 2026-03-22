import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { createLogger } from '@sven/shared';
import { API_CONTRACT_HEADER, API_CONTRACT_VERSION } from './contracts/api-contract.js';
import { closePool, getPool } from './db/pool.js';
import { getNatsConnection } from './nats/client.js';
import { ensureStreams } from './nats/streams.js';
import { startOutboxSubscriber } from './workers/outbox-subscriber.js';
import { startMemoryConsolidationWorker } from './workers/memory-consolidation-worker.js';
import {
  startEntityLifecycleSubscriber,
  stopEntityLifecycleSubscriber,
} from './workers/entity-lifecycle-subscriber.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAdapterRoutes } from './routes/adapter.js';
import { registerOutboxRoutes } from './routes/outbox.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerIncidentRoutes } from './routes/incidents.js';
import { registerCanvasRoutes } from './routes/canvas.js';
import { registerRegistryRoutes } from './routes/registry.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerBrowserToolRoutes } from './routes/browser-tools.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerEmailRoutes } from './routes/email.js';
import { registerStreamRoutes } from './routes/streams.js';
import { registerPushRoutes } from './routes/push.js';
import { registerMcpServerRoutes } from './routes/mcp-server.js';
import { registerUiPreferencesRoutes } from './routes/ui-preferences.js';
import { registerUserSettingsRoutes } from './routes/user-settings.js';
import { registerDeploymentRoutes } from './routes/deployment.js';
import { registerDeviceAgentRoutes } from './routes/devices.js';
import { registerOpenAIRoutes } from './routes/openai-compat.js';
import { registerSchedulerRoutes } from './routes/scheduler.js';
import { registerMetricsRoutes } from './routes/metrics.js';
import { registerEntityRoutes } from './routes/entity.js';
import { registerA2ARoutes } from './routes/a2a.js';
import { registerPublicCommunityRoutes } from './routes/admin/community.js';
import { TailscaleService } from './services/TailscaleService.js';
import { loadConfigFile } from './config.js';
import { initDiscoveryService } from './services/DiscoveryService.js';
import { UpdateCheckerService } from './services/UpdateCheckerService.js';
import { syncBackupCronJobs } from './services/BackupService.js';
import { scheduleRetentionCleanup } from './services/PrivacyService.js';
import { getRequestCorrelationId } from './lib/correlation.js';
import { assessStartupHardeningRisk, evaluateStartupHardeningEnforcement } from './lib/startup-hardening.js';
import { IntegrationRuntimeReconciler } from './services/IntegrationRuntimeReconciler.js';
import { runFilesystemMigration } from './services/FilesystemMigrationService.js';
import { runMigrations } from './db/migrate.js';

const logger = createLogger('gateway-api');

const DEFAULT_ALLOWED_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*47matrix\.online$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];

function parseCorsOrigin() {
  const configured = process.env.CORS_ORIGIN;
  if (!configured || configured.trim() === '') return DEFAULT_ALLOWED_ORIGINS;
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isAutoMigrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.SVEN_DB_AUTO_MIGRATE_ON_START || '').trim().toLowerCase();
  if (!raw) return true;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseTrustProxySetting(
  value: string | undefined,
): boolean | number | string[] {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') {
    return false;
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') {
    return true;
  }
  if (/^\d+$/.test(raw)) {
    return Math.max(0, Number(raw));
  }
  const cidrOrIpList = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return cidrOrIpList.length > 0 ? cidrOrIpList : false;
}

function requireCookieSecret(): string {
  const secret = String(process.env.COOKIE_SECRET || '').trim();
  const lowered = secret.toLowerCase();
  const weakDefault = lowered === 'sven-dev-secret'
    || lowered === 'sven-dev-secret-change-me'
    || lowered === 'change-me'
    || lowered === 'changeme'
    || lowered === 'default';
  if (!secret || secret.length < 32 || weakDefault) {
    throw new Error('COOKIE_SECRET is required and must not use insecure default values');
  }
  return secret;
}

function requireTokenExchangeSecretForStartup(env: NodeJS.ProcessEnv = process.env): void {
  if (isTruthy(env.AUTH_DISABLE_TOKEN_EXCHANGE)) return;
  if (!isHardenedOrProductionProfile(env)) return;

  const secret = String(env.DEEPLINK_SECRET || '').trim();
  const lowered = secret.toLowerCase();
  const weakDefault = lowered === 'sven-dev-secret'
    || lowered === 'sven-dev-secret-change-me'
    || lowered === 'change-me'
    || lowered === 'changeme'
    || lowered === 'default';
  if (!secret || secret.length < 32 || weakDefault) {
    throw new Error('DEEPLINK_SECRET is required (>=32 chars, non-default) when token exchange is enabled');
  }
}

function isHardenedOrProductionProfile(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') return true;
  const profile = String(env.SVEN_HARDENING_PROFILE || env.SVEN_PROFILE || '').trim().toLowerCase();
  return ['strict', 'hardened', 'isolated', 'production'].includes(profile);
}

function isWidgetIngressGuardEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.WIDGET_INGRESS_REQUIRE_KEY || 'true').trim().toLowerCase();
  return raw !== 'false';
}

function isSeedBaselineEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.SVEN_ENFORCE_SEED_BASELINE || '').trim().toLowerCase();
  if (raw) {
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }
  return isHardenedOrProductionProfile(env);
}

async function verifyWidgetIngressSchemaInvariant(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!isWidgetIngressGuardEnabled(process.env)) return;

  const requiredColumns = ['id', 'organization_id', 'rate_limit_rpm', 'enabled', 'api_key_hash'];
  const tableRes = await pool.query(
    `SELECT to_regclass('public.web_widget_instances')::text AS table_name`,
  );
  const tableName = String(tableRes.rows[0]?.table_name || '').trim();
  if (!tableName) {
    throw new Error('web_widget_instances table is required when widget ingress guard is enabled');
  }

  const columnRes = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'web_widget_instances'`,
  );
  const found = new Set(columnRes.rows.map((row: any) => String(row.column_name || '').trim()));
  const missing = requiredColumns.filter((column) => !found.has(column));
  if (missing.length > 0) {
    throw new Error(`web_widget_instances schema missing required columns: ${missing.join(', ')}`);
  }
}

async function verifySeedBaselineInvariant(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  const res = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM users WHERE username = '47') AS has_admin_47,
       EXISTS(SELECT 1 FROM chats WHERE type = 'hq') AS has_hq_chat,
       EXISTS(
         SELECT 1
         FROM chat_members cm
         JOIN chats c ON c.id = cm.chat_id
         JOIN users u ON u.id = cm.user_id
         WHERE c.type = 'hq' AND u.username = '47'
       ) AS has_hq_membership,
       EXISTS(
         SELECT 1
         FROM permissions
         WHERE target_type = 'global'
           AND scope IN ('nas.read', 'nas.write', 'web.fetch', 'ha.read', 'ha.write', 'git.read', 'git.write', 'calendar.read', 'calendar.write')
       ) AS has_policy_preset,
       EXISTS(
         SELECT 1
         FROM allowlists
         WHERE type = 'nas_path'
           AND pattern = '/nas/shared'
           AND enabled = TRUE
       ) AS has_nas_seed_allowlist`,
  );

  const row = res.rows[0] || {};
  const missing: string[] = [];
  if (!row.has_admin_47) missing.push('users(username=47)');
  if (!row.has_hq_chat) missing.push('chats(type=hq)');
  if (!row.has_hq_membership) missing.push('chat_members(hq + user 47)');
  if (!row.has_policy_preset) missing.push('permissions(global policy presets)');
  if (!row.has_nas_seed_allowlist) missing.push('allowlists(nas_path=/nas/shared)');
  if (missing.length > 0) {
    throw new Error(
      `seed baseline invariant missing: ${missing.join(', ')}. Run migrations + seed before starting release-grade gateway.`,
    );
  }
}

function normalizeErrorPayloadObject(parsed: Record<string, unknown>): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const error = parsed.error as Record<string, unknown> | undefined;
  if (!error || typeof error !== 'object') return parsed;

  return {
    ...parsed,
    error: {
      code: typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR',
      message: typeof error.message === 'string' ? error.message : 'Unexpected error',
      details: Object.prototype.hasOwnProperty.call(error, 'details') ? error.details : null,
    },
  };
}

async function main() {
  loadConfigFile();
  if (isAutoMigrationEnabled(process.env)) {
    logger.info('Running startup database migrations');
    await runMigrations();
    logger.info('Startup database migrations complete');
  } else {
    logger.warn('Startup database migrations disabled by configuration', {
      env: 'SVEN_DB_AUTO_MIGRATE_ON_START',
    });
  }
  await runFilesystemMigration(process.env);
  const hardening = assessStartupHardeningRisk(process.env);
  const hardeningEnforcement = evaluateStartupHardeningEnforcement(hardening, process.env);
  if (hardeningEnforcement.enforceFailClosed && hardeningEnforcement.blockingIssues.length > 0) {
    const issueCodes = hardeningEnforcement.blockingIssues.map((issue) => issue.code);
    logger.fatal('SECURITY STARTUP BLOCKED: critical hardening checks failed', {
      profile: hardening.profile,
      issue_codes: issueCodes,
      issues: hardeningEnforcement.blockingIssues,
    });
    throw new Error(`Startup hardening blocked boot: ${issueCodes.join(', ')}`);
  }
  if (hardening.risk) {
    logger.warn('SECURITY STARTUP RISK: running without full hardening profile', {
      profile: hardening.profile,
      issues: hardening.issues,
    });
  } else {
    logger.info('Startup hardening profile validated', { profile: hardening.profile });
  }

  const PORT = parseInt(process.env.GATEWAY_PORT || '3000', 10);
  const HOST = process.env.GATEWAY_HOST || '0.0.0.0';
  const BODY_LIMIT_BYTES = Number(process.env.API_MAX_BODY_BYTES || 10 * 1024 * 1024);
  const retentionCleanupIntervalMs = Number(
    process.env.PRIVACY_RETENTION_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000,
  );
  const retentionCleanupInitialDelayMs = Number(
    process.env.PRIVACY_RETENTION_CLEANUP_INITIAL_DELAY_MS || 2 * 60 * 1000,
  );

  const app = Fastify({
    logger: false, // we use our own structured logger
    trustProxy: parseTrustProxySetting(process.env.GATEWAY_TRUST_PROXY),
    bodyLimit: Number.isFinite(BODY_LIMIT_BYTES) && BODY_LIMIT_BYTES > 0
      ? Math.floor(BODY_LIMIT_BYTES)
      : 10 * 1024 * 1024,
  });

  // Some UI clients send `Content-Type: application/json` with an empty body
  // on DELETE requests. Fastify rejects that by default; treat empty as `{}`.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const raw = typeof body === 'string' ? body : '';
    request.rawBody = raw;
    if (raw.trim() === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Plugins
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    referrerPolicy: {
      policy: 'no-referrer',
    },
    noSniff: true,
  });
  await app.register(fastifyCors as any, {
    origin: parseCorsOrigin(),
    credentials: true,
  });
  await app.register(fastifyCookie as any, {
    secret: requireCookieSecret(),
  });
  requireTokenExchangeSecretForStartup(process.env);

  app.addHook('onRequest', async (request, _reply) => {
    request.correlationId = getRequestCorrelationId(request);
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    const request = _request;
    const rawUrl = String(request.raw?.url || '').split('?')[0];
    const requestUrl = String(request.url || '').split('?')[0];
    const routeUrl = String((request as any).routeOptions?.url || '').split('?')[0];
    const responseCommitted =
      reply.raw.headersSent
      || reply.raw.writableEnded
      || reply.raw.destroyed
      || reply.sent
      || (reply as unknown as { hijacked?: boolean }).hijacked
      || request.raw.aborted
      || request.raw.destroyed;
    const acceptsEventStream = String(request.headers.accept || '').toLowerCase().includes('text/event-stream');
    const isSseRoute =
      rawUrl.endsWith('/v1/admin/events') ||
      rawUrl.endsWith('/v1/stream') ||
      rawUrl.endsWith('/a2ui/stream') ||
      rawUrl.endsWith('/v1/entity/stream') ||
      /\/v1\/streams\/[^/]+\/sse$/.test(rawUrl) ||
      requestUrl.endsWith('/v1/admin/events') ||
      requestUrl.endsWith('/v1/stream') ||
      requestUrl.endsWith('/a2ui/stream') ||
      requestUrl.endsWith('/v1/entity/stream') ||
      /\/v1\/streams\/[^/]+\/sse$/.test(requestUrl) ||
      routeUrl === '/events' ||
      routeUrl === '/v1/stream' ||
      routeUrl.endsWith('/a2ui/stream') ||
      routeUrl === '/v1/entity/stream' ||
      routeUrl === '/v1/streams/:id/sse' ||
      acceptsEventStream;
    if (
      isSseRoute ||
      responseCommitted
    ) {
      return payload;
    }
    try {
      const correlationId = request.correlationId || String(request.id || '');
      if (correlationId) {
        reply.header('x-correlation-id', correlationId);
      }
      reply.header(API_CONTRACT_HEADER, API_CONTRACT_VERSION);

      if (payload === null || payload === undefined) return payload;
      const contentType = String(reply.getHeader('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) return payload;

      if (typeof payload === 'string') {
        const trimmed = payload.trim();
        if (!trimmed.startsWith('{')) return payload;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          if (!parsed.error || typeof parsed.error !== 'object') return payload;
          return JSON.stringify(normalizeErrorPayloadObject(parsed));
        } catch {
          return payload;
        }
      }

      if (typeof payload === 'object') {
        const parsed = payload as Record<string, unknown>;
        if (!parsed.error || typeof parsed.error !== 'object') return payload;
        return normalizeErrorPayloadObject(parsed);
      }

      return payload;
    } catch (err) {
      logger.warn('Skipping response hook decoration after response commit', {
        err: String(err),
        raw_url: rawUrl,
        request_url: requestUrl,
        route_url: routeUrl,
        response_committed: responseCommitted,
      });
      return payload;
    }
  });

  // Connect to external dependencies
  const pool = getPool();

  // Verify Postgres is reachable
  await pool.query('SELECT 1');
  logger.info('Postgres connection verified');
  try {
    await verifyWidgetIngressSchemaInvariant(pool);
    if (isWidgetIngressGuardEnabled(process.env)) {
      logger.info('Widget ingress schema invariant verified');
    }
  } catch (err) {
    if (isHardenedOrProductionProfile(process.env)) {
      throw err;
    }
    logger.warn('Widget ingress schema invariant check failed (non-blocking in non-production profile)', {
      err: String(err),
    });
  }
  try {
    await verifySeedBaselineInvariant(pool);
    logger.info('Seed baseline invariant verified');
  } catch (err) {
    if (isSeedBaselineEnforced(process.env)) {
      throw err;
    }
    logger.warn('Seed baseline invariant check failed (non-blocking in non-production profile)', {
      err: String(err),
    });
  }

  const nc = await getNatsConnection();
  const tailscale = new TailscaleService(pool, PORT);
  const integrationRuntimeReconciler = new IntegrationRuntimeReconciler(pool);

  // Ensure NATS JetStream streams and consumers exist
  await ensureStreams(nc);

  // Start background workers
  await startOutboxSubscriber(nc, pool);
  const stopMemoryConsolidationWorker = await startMemoryConsolidationWorker(pool);
  await startEntityLifecycleSubscriber(nc);
  await tailscale.configureOnStart();
  await initDiscoveryService(pool, PORT);
  await new UpdateCheckerService(pool).start();
  await syncBackupCronJobs();
  integrationRuntimeReconciler.start();
  setTimeout(() => {
    scheduleRetentionCleanup()
      .then((result) => {
        if (result.error) {
          logger.warn('Privacy retention cleanup completed with error', { error: result.error });
          return;
        }
        logger.info('Privacy retention cleanup completed', { cleaned: result.cleaned });
      })
      .catch((err) => {
        logger.warn('Privacy retention cleanup failed', { err: String(err) });
      });
  }, Math.max(0, retentionCleanupInitialDelayMs));
  setInterval(() => {
    scheduleRetentionCleanup()
      .then((result) => {
        if (result.error) {
          logger.warn('Privacy retention cleanup completed with error', { error: result.error });
          return;
        }
        logger.info('Privacy retention cleanup completed', { cleaned: result.cleaned });
      })
      .catch((err) => {
        logger.warn('Privacy retention cleanup failed', { err: String(err) });
      });
  }, Math.max(60_000, retentionCleanupIntervalMs));

  // Register routes
  await registerHealthRoutes(app, pool, nc);
  await registerAdapterRoutes(app, pool, nc);
  await registerOutboxRoutes(app, pool, nc);
  await registerAuthRoutes(app, pool);
  await registerAdminRoutes(app, pool, nc);
  await registerIncidentRoutes(app, pool, nc);
  await registerCanvasRoutes(app, pool, nc);
  await registerRegistryRoutes(app, pool);
  await registerSessionRoutes(app, pool);
  await registerBrowserToolRoutes(app, pool);
  await registerWebhookRoutes(app, pool, nc);
  await registerEmailRoutes(app, pool, nc);
  await registerStreamRoutes(app, pool);
  await registerPushRoutes(app, pool);
  await registerUiPreferencesRoutes(app, pool);
  await registerUserSettingsRoutes(app, pool);
  await registerMcpServerRoutes(app, pool);
  await registerDeploymentRoutes(app, pool);
  await registerDeviceAgentRoutes(app, pool);
  await registerOpenAIRoutes(app, pool);
  await registerSchedulerRoutes(app, pool, nc);
  await registerMetricsRoutes(app, pool);
  await registerEntityRoutes(app, pool);
  await registerA2ARoutes(app, pool);
  await registerPublicCommunityRoutes(app, pool);

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    const err = error as { message?: string; stack?: string; statusCode?: number };
    const correlationId = _request.correlationId || String(_request.id || '');
    logger.error('Unhandled error', {
      err: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      correlation_id: correlationId,
    });
    if (reply.sent) {
      return;
    }
    reply.status(err.statusCode || 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error',
        details: null,
      },
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info('Shutting down', { signal });
    integrationRuntimeReconciler.stop();
    stopMemoryConsolidationWorker();
    await stopEntityLifecycleSubscriber();
    await tailscale.resetOnShutdown();
    await app.close();
    await closePool();
    await nc.drain();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ port: PORT, host: HOST });
  logger.info(`Gateway API listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  logger.fatal('Failed to start gateway-api', { err: String(err) });
  process.exit(1);
});
