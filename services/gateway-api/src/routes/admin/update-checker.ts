import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { UpdateCheckerService } from '../../services/UpdateCheckerService.js';

function resolveManualUpdateCheckCooldownMs(raw: unknown): { cooldownMs: number; invalid: boolean } {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(parsed)) {
    return { cooldownMs: 30000, invalid: raw !== undefined && raw !== null && String(raw).trim().length > 0 };
  }
  const cooldownMs = Math.min(300000, Math.max(1000, parsed));
  return { cooldownMs, invalid: false };
}

type SanitizedUpdateCheckError = {
  statusCode: number;
  code: string;
  message: string;
};

function sanitizeUpdateCheckError(err: unknown): SanitizedUpdateCheckError {
  const message = String(err instanceof Error ? err.message : err || '').trim();
  const lower = message.toLowerCase();
  if (lower.includes('update_check_disabled') || lower.includes('checker is disabled')) {
    return { statusCode: 409, code: 'UPDATE_CHECK_DISABLED', message: 'Update checker is disabled by policy' };
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
    return { statusCode: 504, code: 'UPDATE_CHECK_TIMEOUT', message: 'Update feed request timed out' };
  }
  if (lower.includes('update_feed_unsafe_target') || lower.includes('unsafe target')) {
    return { statusCode: 400, code: 'UPDATE_CHECK_UNSAFE_TARGET', message: 'Configured update feed URL is not allowed' };
  }
  if (lower.includes('json') || lower.includes('unexpected token') || lower.includes('parse')) {
    return { statusCode: 502, code: 'UPDATE_CHECK_FEED_PARSE_FAILED', message: 'Failed to parse update feed response' };
  }
  if (
    lower.includes('update_feed_request_failed') ||
    lower.includes('update feed error') ||
    lower.includes('econn') ||
    lower.includes('enotfound') ||
    lower.includes('refused')
  ) {
    return { statusCode: 502, code: 'UPDATE_CHECK_UPSTREAM_UNAVAILABLE', message: 'Update feed is unavailable' };
  }
  return { statusCode: 500, code: 'UPDATE_CHECK_FAILED', message: 'Update check failed' };
}

export async function registerUpdateCheckerRoutes(app: FastifyInstance, pool: pg.Pool) {
  const service = new UpdateCheckerService(pool);
  const manualCooldownResolution = resolveManualUpdateCheckCooldownMs(process.env.UPDATE_CHECKER_MANUAL_COOLDOWN_MS);
  const manualCooldownMs = manualCooldownResolution.cooldownMs;
  if (manualCooldownResolution.invalid) {
    app.log.warn(
      { value: process.env.UPDATE_CHECKER_MANUAL_COOLDOWN_MS, cooldownMs: manualCooldownMs },
      'Invalid UPDATE_CHECKER_MANUAL_COOLDOWN_MS; using bounded default'
    );
  }
  let manualCheckInFlight: Promise<Awaited<ReturnType<UpdateCheckerService['checkNow']>>> | null = null;
  let lastManualCheckStartedAt = 0;
  function requireGlobalAdmin(request: any, reply: any): boolean {
    if (String(request.userRole || '').trim() === 'platform_admin') return true;
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

  app.get('/update-checker/status', async (_request, reply) => {
    const request = _request as any;
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const includeFullFeedUrl = request.query?.include_feed_url === 'true';
    const allowFeedUrlDebugScope = String(process.env.SVEN_UPDATE_CHECKER_DEBUG_SCOPE || '').toLowerCase() === 'true';
    const exposeFeedUrl = includeFullFeedUrl && allowFeedUrlDebugScope && String(request.userRole || '').trim() === 'platform_admin';
    if (includeFullFeedUrl && !exposeFeedUrl) {
      app.log.warn({ user_role: request.userRole || 'unknown' }, 'Rejected full update feed URL visibility request');
    } else if (exposeFeedUrl) {
      app.log.info({ user_role: request.userRole || 'admin' }, 'Full update feed URL visibility enabled for debug scope');
    }
    const status = await service.getStatus({ includeFullFeedUrl: exposeFeedUrl });
    reply.send({ success: true, data: status });
  });

  app.post('/update-checker/check', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    if (!requireActiveOrg(request as any, reply)) return;
    const currentStatus = await service.getStatus();
    if (!currentStatus.enabled) {
      reply.status(409).send({
        success: false,
        error: { code: 'UPDATE_CHECK_DISABLED', message: 'Update checker is disabled by policy' },
      });
      return;
    }
    if (manualCheckInFlight) {
      reply.status(409).send({
        success: false,
        error: { code: 'UPDATE_CHECK_IN_PROGRESS', message: 'Update check already in progress' },
      });
      return;
    }
    const now = Date.now();
    const elapsedMs = now - lastManualCheckStartedAt;
    if (lastManualCheckStartedAt > 0 && elapsedMs < manualCooldownMs) {
      const retryAfterMs = manualCooldownMs - elapsedMs;
      reply.status(429).send({
        success: false,
        error: { code: 'UPDATE_CHECK_COOLDOWN', message: `Manual update check is rate-limited; retry in ${retryAfterMs}ms` },
        data: {
          retry_after_ms: retryAfterMs,
        },
      });
      return;
    }
    lastManualCheckStartedAt = now;
    manualCheckInFlight = service.checkNow().finally(() => {
      manualCheckInFlight = null;
    });
    try {
      const status = await manualCheckInFlight;
      reply.send({ success: true, data: status });
    } catch (err) {
      app.log.warn({ err }, 'Manual update check failed');
      const sanitized = sanitizeUpdateCheckError(err);
      reply.status(sanitized.statusCode).send({
        success: false,
        error: { code: sanitized.code, message: sanitized.message },
      });
    }
  });

  app.post('/update-checker/dismiss', async (request, reply) => {
    if (!requireGlobalAdmin(request as any, reply)) return;
    if (!requireActiveOrg(request as any, reply)) return;
    const body = request.body as { version?: string };
    const version = String(body?.version || '').trim();
    if (!version) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'version is required' },
      });
      return;
    }
    await service.dismiss(version);
    reply.send({ success: true, data: { dismissed: version } });
  });
}
