/**
 * Admin API: Calendar Account Management
 * Supports Radicale CalDAV and Google Calendar integrations
 */

import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import type pg from 'pg';
import { createLogger, resolveSecretRef } from '@sven/shared';
import {
  RadicaleCalendar,
  GoogleCalendar,
  type GoogleCalendarConfig,
  type RadicaleCalendarConfig,
} from '@sven/shared/integrations/calendar';
import {
  assertGoogleCalendarRedirectRouteConsistency,
  configureGoogleCalendarOAuthStateStore,
  getGoogleCalendarRedirectUri,
  issueGoogleCalendarOAuthState,
} from '../../services/calendar-oauth.js';
import {
  decryptCalendarOAuthSecret,
  encryptCalendarOAuthSecret,
} from '../../services/calendar-oauth-secrets.js';

const logger = createLogger('admin-calendar');
const SIMULATION_PROVIDER = 'radicale';
const SIMULATION_ACCOUNT_NAME = 'Simulated Calendar Account';
const SIMULATION_ORGANIZER = 'simulated@sven.local';
const CALENDAR_SIMULATION_ENABLED = parseBool(process.env.CALENDAR_SIMULATION_ENABLED, process.env.NODE_ENV !== 'production');

function parseBool(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return defaultValue;
}

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function currentUserId(request: any): string | null {
  const direct = String(request?.userId || '').trim();
  if (direct) return direct;
  const nested = String(request?.user?.id || '').trim();
  return nested || null;
}

function currentOrgId(request: any): string | null {
  const direct = String(request?.orgId || '').trim();
  return direct || null;
}

function sendSuccess(reply: any, data: unknown, statusCode = 200) {
  return reply.code(statusCode).send({ success: true, data });
}

function sendError(reply: any, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).send({
    success: false,
    error: { code, message },
  });
}

function normalizeCalendarBody(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

type CalendarSchemaCapabilities = {
  accountsOrgScoped: boolean;
  subscriptionsOrgScoped: boolean;
};

const calendarSchemaCapabilitiesCache = new WeakMap<pg.Pool, Promise<CalendarSchemaCapabilities>>();

async function hasTableColumn(pool: pg.Pool, tableName: string, columnName: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1`,
    [tableName, columnName],
  );
  return res.rows.length > 0;
}

async function getCalendarSchemaCapabilities(pool: pg.Pool): Promise<CalendarSchemaCapabilities> {
  let cached = calendarSchemaCapabilitiesCache.get(pool);
  if (!cached) {
    cached = (async () => ({
      accountsOrgScoped: await hasTableColumn(pool, 'calendar_accounts', 'organization_id'),
      subscriptionsOrgScoped: await hasTableColumn(pool, 'calendar_subscriptions', 'organization_id'),
    }))();
    calendarSchemaCapabilitiesCache.set(pool, cached);
  }
  return cached;
}

export async function registerCalendarRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  assertGoogleCalendarRedirectRouteConsistency();
  configureGoogleCalendarOAuthStateStore(pool);

  /**
   * GET /calendar/accounts - List calendar accounts for current user
   */
  app.get('/calendar/accounts', async (request, reply) => {
    try {
      const userId = currentUserId(request);
      const orgId = currentOrgId(request);
      if (!userId) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
      if (!orgId) {
        return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
      }

      const schema = await getCalendarSchemaCapabilities(pool);

      const result = await pool.query(
        schema.accountsOrgScoped
          ? `SELECT id, provider, account_name, readonly, enabled, last_sync_at, sync_error
               FROM calendar_accounts
              WHERE user_id = $1 AND organization_id = $2
              ORDER BY created_at DESC`
          : `SELECT id, provider, account_name, readonly, enabled, last_sync_at, sync_error
               FROM calendar_accounts
              WHERE user_id = $1
              ORDER BY created_at DESC`,
        schema.accountsOrgScoped ? [userId, orgId] : [userId],
      );

      return sendSuccess(reply, { accounts: result.rows });
    } catch (err) {
      logger.error('Failed to list calendar accounts', { error: String(err) });
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list calendar accounts');
    }
  });

  /**
   * POST /calendar/accounts - Add a new calendar account
   */
  app.post<{
    Body: {
      provider: string;
      account_name?: string;
      username?: string;
      password_ref?: string;
      google_email?: string;
      readonly?: boolean;
    };
  }>('/calendar/accounts', async (request, reply) => {
    try {
      const userId = currentUserId(request);
      const orgId = currentOrgId(request);
      if (!userId) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
      if (!orgId) {
        return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
      }
      const schema = await getCalendarSchemaCapabilities(pool);

      const body = normalizeCalendarBody(request.body);
      if (!body) {
        return sendError(reply, 400, 'VALIDATION', 'request body must be a JSON object');
      }
      const { provider, account_name, username, password_ref, google_email, readonly } = body as {
        provider?: string;
        account_name?: string;
        username?: string;
        password_ref?: string;
        google_email?: string;
        readonly?: boolean;
      };

      if (!provider || !['radicale', 'google'].includes(provider)) {
        return sendError(reply, 400, 'VALIDATION', 'Invalid provider');
      }

      if (provider === 'radicale' && (!username || !password_ref)) {
        return sendError(reply, 400, 'VALIDATION', 'Radicale requires username and password_ref');
      }

      const accountId = `cal_account_${uuidv7()}`;
      if (schema.accountsOrgScoped) {
        await pool.query(
          `INSERT INTO calendar_accounts (
            id, user_id, organization_id, provider, account_name, username, password_ref,
            google_email, readonly, enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`,
          [
            accountId,
            userId,
            orgId,
            provider,
            account_name || `${provider} Calendar`,
            username,
            password_ref,
            google_email,
            readonly ?? false,
          ],
        );
      } else {
        await pool.query(
          `INSERT INTO calendar_accounts (
            id, user_id, provider, account_name, username, password_ref,
            google_email, readonly, enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
          [
            accountId,
            userId,
            provider,
            account_name || `${provider} Calendar`,
            username,
            password_ref,
            google_email,
            readonly ?? false,
          ],
        );
      }

      return sendSuccess(reply, { account_id: accountId, provider }, 201);
    } catch (err) {
      logger.error('Failed to add calendar account', { error: String(err) });
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to add calendar account');
    }
  });

  /**
   * GET /calendar/accounts/:accountId/calendars - List calendars in an account
   */
  app.get<{ Params: { accountId: string } }>(
    '/calendar/accounts/:accountId/calendars',
    async (request, reply) => {
      try {
        const userId = currentUserId(request);
        const orgId = currentOrgId(request);
        const { accountId } = request.params;
        if (!userId) {
          return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
        }
        if (!orgId) {
          return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
        }
        const schema = await getCalendarSchemaCapabilities(pool);

        // Verify ownership
        const ownerResult = await pool.query(
          schema.accountsOrgScoped
            ? `SELECT provider, username, password_ref, google_email, oauth_token, oauth_refresh, oauth_expiry, readonly, metadata
                 FROM calendar_accounts
                WHERE id = $1 AND user_id = $2 AND organization_id = $3`
            : `SELECT provider, username, password_ref, google_email, oauth_token, oauth_refresh, oauth_expiry, readonly, metadata
                 FROM calendar_accounts
                WHERE id = $1 AND user_id = $2`,
          schema.accountsOrgScoped ? [accountId, userId, orgId] : [accountId, userId],
        );

        if (ownerResult.rows.length === 0) {
          return sendError(reply, 404, 'NOT_FOUND', 'Calendar account not found');
        }

        const account = ownerResult.rows[0];
        const calendars: Array<{ id: string; name: string; readonly: boolean }> = [];

        if (account.provider === 'radicale') {
          const username = String(account.username || '').trim();
          const passwordRef = String(account.password_ref || '').trim();
          if (!username || !passwordRef) {
            return sendError(reply, 400, 'CALENDAR_ACCOUNT_MISCONFIGURED', 'Radicale account requires username and password_ref');
          }

          const metadata =
            account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)
              ? (account.metadata as Record<string, unknown>)
              : {};
          const baseUrlRaw = String(
            metadata.base_url ||
              process.env.CALENDAR_RADICALE_BASE_URL ||
              process.env.RADICALE_BASE_URL ||
              'http://localhost:5232/',
          ).trim();

          const config: RadicaleCalendarConfig = {
            baseUrl: baseUrlRaw,
            username,
            passwordRef,
            readonly: Boolean(account.readonly),
          };
          const radicale = new RadicaleCalendar(config);
          await radicale.initialize(resolveSecretRef);
          const radicaleCalendars = await radicale.listCalendars();
          calendars.push(
            ...radicaleCalendars.map((calendar) => ({
              id: calendar.id,
              name: calendar.name,
              readonly: Boolean(account.readonly),
            })),
          );
        } else if (account.provider === 'google') {
          let oauthToken = '';
          let oauthRefresh = '';
          try {
            oauthToken = decryptCalendarOAuthSecret(String(account.oauth_token || ''));
            oauthRefresh = decryptCalendarOAuthSecret(String(account.oauth_refresh || ''));
          } catch (error) {
            logger.error('Failed to decrypt Google OAuth token material', {
              account_id: accountId,
              error: String(error),
            });
            return sendError(reply, 500, 'CALENDAR_OAUTH_TOKEN_DECRYPT_FAILED', 'Failed to decrypt Google OAuth token');
          }
          const oauthExpiryRaw = String(account.oauth_expiry || '').trim();
          const oauthExpiry = oauthExpiryRaw ? new Date(oauthExpiryRaw) : null;
          const oauthExpiryMs = oauthExpiry ? oauthExpiry.getTime() : Number.NaN;

          const config: GoogleCalendarConfig = {
            clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
            redirectUri: getGoogleCalendarRedirectUri(),
            accessToken: oauthToken,
            refreshToken: oauthRefresh,
          };
          const google = new GoogleCalendar(config);

          // Preemptively refresh when token is missing/expired/unknown and refresh token is available.
          const shouldRefresh =
            Boolean(oauthRefresh) &&
            (!oauthToken || !Number.isFinite(oauthExpiryMs) || oauthExpiryMs <= Date.now() + 60_000);
          if (shouldRefresh) {
            const refreshed = await google.refreshAccessToken();
            const encryptedAccessToken = encryptCalendarOAuthSecret(refreshed.accessToken);
            await pool.query(
              schema.accountsOrgScoped
                ? `UPDATE calendar_accounts
                     SET oauth_token = $1,
                         oauth_expiry = $2,
                         updated_at = NOW()
                   WHERE id = $3 AND user_id = $4 AND organization_id = $5`
                : `UPDATE calendar_accounts
                     SET oauth_token = $1,
                         oauth_expiry = $2,
                         updated_at = NOW()
                   WHERE id = $3 AND user_id = $4`,
              schema.accountsOrgScoped
                ? [encryptedAccessToken, refreshed.expiryDate, accountId, userId, orgId]
                : [encryptedAccessToken, refreshed.expiryDate, accountId, userId],
            );
            google.setTokens(refreshed.accessToken, oauthRefresh);
          }

          const googleCalendars = await google.listCalendars();
          calendars.push(...googleCalendars);
        }

        return sendSuccess(reply, { calendars });
      } catch (err) {
        logger.error('Failed to list calendars', { error: String(err) });
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list calendars');
      }
    },
  );

  /**
   * POST /calendar/subscribe - Subscribe to a calendar
   */
  app.post<{
    Body: {
      account_id: string;
      calendar_id: string;
      calendar_name?: string;
      is_primary?: boolean;
      readonly?: boolean;
    };
  }>('/calendar/subscribe', async (request, reply) => {
    try {
      const userId = currentUserId(request);
      const orgId = currentOrgId(request);
      if (!userId) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
      if (!orgId) {
        return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
      }
      const schema = await getCalendarSchemaCapabilities(pool);

      const body = normalizeCalendarBody(request.body);
      if (!body) {
        return sendError(reply, 400, 'VALIDATION', 'request body must be a JSON object');
      }
      const { account_id, calendar_id, calendar_name, is_primary, readonly } = body as {
        account_id?: string;
        calendar_id?: string;
        calendar_name?: string;
        is_primary?: boolean;
        readonly?: boolean;
      };

      if (!account_id || !calendar_id) {
        return sendError(reply, 400, 'VALIDATION', 'account_id and calendar_id required');
      }

      // Verify account ownership
      const ownerResult = await pool.query(
        schema.accountsOrgScoped
          ? `SELECT id FROM calendar_accounts WHERE id = $1 AND user_id = $2 AND organization_id = $3`
          : `SELECT id FROM calendar_accounts WHERE id = $1 AND user_id = $2`,
        schema.accountsOrgScoped ? [account_id, userId, orgId] : [account_id, userId],
      );

      if (ownerResult.rows.length === 0) {
        return sendError(reply, 403, 'FORBIDDEN', 'Calendar account not found or not owned by you');
      }

      const subscriptionId = `cal_sub_${uuidv7()}`;
      if (schema.subscriptionsOrgScoped) {
        await pool.query(
          `INSERT INTO calendar_subscriptions (
            id, account_id, organization_id, calendar_id, calendar_name, is_primary, readonly, sync_enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
          [subscriptionId, account_id, orgId, calendar_id, calendar_name || calendar_id, is_primary ?? false, readonly ?? false],
        );
      } else {
        await pool.query(
          `INSERT INTO calendar_subscriptions (
            id, account_id, calendar_id, calendar_name, is_primary, readonly, sync_enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
          [subscriptionId, account_id, calendar_id, calendar_name || calendar_id, is_primary ?? false, readonly ?? false],
        );
      }

      return sendSuccess(reply, { subscription_id: subscriptionId }, 201);
    } catch (err) {
      logger.error('Failed to subscribe to calendar', { error: String(err) });
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to subscribe to calendar');
    }
  });

  /**
   * GET /calendar/subscriptions - List subscribed calendars for current user
   */
  app.get('/calendar/subscriptions', async (request, reply) => {
    try {
      const userId = currentUserId(request);
      const orgId = currentOrgId(request);
      if (!userId) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
      if (!orgId) {
        return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
      }
      const schema = await getCalendarSchemaCapabilities(pool);

      const result = await pool.query(
        schema.accountsOrgScoped && schema.subscriptionsOrgScoped
          ? `SELECT cs.id, cs.account_id, cs.calendar_id, cs.calendar_name,
                    cs.readonly, cs.sync_enabled, ca.provider
               FROM calendar_subscriptions cs
               JOIN calendar_accounts ca ON cs.account_id = ca.id
              WHERE ca.user_id = $1 AND ca.organization_id = $2 AND cs.organization_id = $2
              ORDER BY cs.created_at DESC`
          : schema.accountsOrgScoped
            ? `SELECT cs.id, cs.account_id, cs.calendar_id, cs.calendar_name,
                      cs.readonly, cs.sync_enabled, ca.provider
                 FROM calendar_subscriptions cs
                 JOIN calendar_accounts ca ON cs.account_id = ca.id
                WHERE ca.user_id = $1 AND ca.organization_id = $2
                ORDER BY cs.created_at DESC`
            : `SELECT cs.id, cs.account_id, cs.calendar_id, cs.calendar_name,
                      cs.readonly, cs.sync_enabled, ca.provider
                 FROM calendar_subscriptions cs
                 JOIN calendar_accounts ca ON cs.account_id = ca.id
                WHERE ca.user_id = $1
                ORDER BY cs.created_at DESC`,
        schema.accountsOrgScoped ? [userId, orgId] : [userId],
      );

      return sendSuccess(reply, { subscriptions: result.rows });
    } catch (err) {
      logger.error('Failed to list calendar subscriptions', { error: String(err) });
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list calendar subscriptions');
    }
  });

  /**
   * DELETE /calendar/subscriptions/:subscriptionId - Unsubscribe from a calendar
   */
  app.delete<{ Params: { subscriptionId: string } }>(
    '/calendar/subscriptions/:subscriptionId',
    async (request, reply) => {
      try {
        const userId = currentUserId(request);
        const orgId = currentOrgId(request);
        const { subscriptionId } = request.params;
        if (!userId) {
          return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
        }
        if (!orgId) {
          return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
        }
        const schema = await getCalendarSchemaCapabilities(pool);

        // Verify ownership
        const ownerResult = await pool.query(
          schema.accountsOrgScoped && schema.subscriptionsOrgScoped
            ? `SELECT cs.id FROM calendar_subscriptions cs
                 JOIN calendar_accounts ca ON cs.account_id = ca.id
                WHERE cs.id = $1 AND ca.user_id = $2 AND ca.organization_id = $3 AND cs.organization_id = $3`
            : schema.accountsOrgScoped
              ? `SELECT cs.id FROM calendar_subscriptions cs
                   JOIN calendar_accounts ca ON cs.account_id = ca.id
                  WHERE cs.id = $1 AND ca.user_id = $2 AND ca.organization_id = $3`
              : `SELECT cs.id FROM calendar_subscriptions cs
                   JOIN calendar_accounts ca ON cs.account_id = ca.id
                  WHERE cs.id = $1 AND ca.user_id = $2`,
          schema.accountsOrgScoped ? [subscriptionId, userId, orgId] : [subscriptionId, userId],
        );

        if (ownerResult.rows.length === 0) {
          return sendError(reply, 404, 'NOT_FOUND', 'Subscription not found');
        }

        await pool.query(`DELETE FROM calendar_subscriptions WHERE id = $1`, [subscriptionId]);
        return sendSuccess(reply, { deleted: true });
      } catch (err) {
        logger.error('Failed to delete calendar subscription', { error: String(err) });
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to delete calendar subscription');
      }
    },
  );

  /**
   * GET /auth/google/start - Initiate Google Calendar OAuth flow
   */
  app.get('/auth/google/start', async (request, reply) => {
    try {
      const userId = currentUserId(request);
      const orgId = currentOrgId(request);
      if (!userId) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
      if (!orgId) {
        return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
      }

      const state = await issueGoogleCalendarOAuthState(userId, orgId);

      const config: GoogleCalendarConfig = {
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
        redirectUri: getGoogleCalendarRedirectUri(),
      };

      const google = new GoogleCalendar(config);
      const authUrl = google.getAuthorizationUrl(state);

      return sendSuccess(reply, { auth_url: authUrl });
    } catch (err) {
      logger.error('Failed to start Google OAuth', { error: String(err) });
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to start Google OAuth');
    }
  });

  /**
   * POST /calendar/events/simulate - Create a local calendar event for testing/proactive prefetch.
   */
  app.post<{
    Body: {
      title?: string;
      description?: string;
      start_time?: string;
      end_time?: string;
      location?: string;
      account_name?: string;
      calendar_name?: string;
    };
  }>('/calendar/events/simulate', async (request, reply) => {
    if (!CALENDAR_SIMULATION_ENABLED) {
      return sendError(reply, 403, 'FORBIDDEN', 'Calendar simulation endpoint disabled');
    }

    try {
      const userId = currentUserId(request);
      const orgId = currentOrgId(request);
      if (!userId) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
      if (!orgId) {
        return sendError(reply, 403, 'ORG_REQUIRED', 'Active account required');
      }

      const title = String(request.body?.title || '').trim() || 'Upcoming meeting';
      const startRaw = String(request.body?.start_time || '').trim();
      const endRaw = String(request.body?.end_time || '').trim();
      if (!startRaw || !endRaw) {
        return sendError(reply, 400, 'VALIDATION', 'start_time and end_time are required');
      }
      const startTime = new Date(startRaw);
      const endTime = new Date(endRaw);
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
        return sendError(reply, 400, 'VALIDATION', 'Invalid time range');
      }

      const accountName = String(request.body?.account_name || '').trim() || SIMULATION_ACCOUNT_NAME;
      const calendarName = String(request.body?.calendar_name || '').trim() || 'Simulated Calendar';
      const description = String(request.body?.description || '').trim() || null;
      const location = String(request.body?.location || '').trim() || null;
      const schema = await getCalendarSchemaCapabilities(pool);

      let accountId: string;
      const accountRes = await pool.query(
        schema.accountsOrgScoped
          ? `SELECT id
               FROM calendar_accounts
              WHERE user_id = $1
                AND organization_id = $2
                AND provider = $3
                AND account_name = $4
              ORDER BY created_at DESC
              LIMIT 1`
          : `SELECT id
               FROM calendar_accounts
              WHERE user_id = $1
                AND provider = $2
                AND account_name = $3
              ORDER BY created_at DESC
              LIMIT 1`,
        schema.accountsOrgScoped
          ? [userId, orgId, SIMULATION_PROVIDER, SIMULATION_ACCOUNT_NAME]
          : [userId, SIMULATION_PROVIDER, SIMULATION_ACCOUNT_NAME],
      );
      if (accountRes.rows.length > 0) {
        accountId = String(accountRes.rows[0].id);
      } else {
        accountId = `cal_account_${uuidv7()}`;
        if (schema.accountsOrgScoped) {
          await pool.query(
            `INSERT INTO calendar_accounts
               (id, user_id, organization_id, provider, account_name, readonly, enabled, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, NOW(), NOW())`,
            [accountId, userId, orgId, SIMULATION_PROVIDER, SIMULATION_ACCOUNT_NAME],
          );
        } else {
          await pool.query(
            `INSERT INTO calendar_accounts
               (id, user_id, provider, account_name, readonly, enabled, created_at, updated_at)
             VALUES ($1, $2, $3, $4, FALSE, TRUE, NOW(), NOW())`,
            [accountId, userId, SIMULATION_PROVIDER, SIMULATION_ACCOUNT_NAME],
          );
        }
      }

      let subscriptionId: string;
      const subRes = await pool.query(
        schema.subscriptionsOrgScoped
          ? `SELECT id
               FROM calendar_subscriptions
              WHERE account_id = $1
                AND organization_id = $2
                AND calendar_id LIKE 'sim-%'
              ORDER BY created_at DESC
              LIMIT 1`
          : `SELECT id
               FROM calendar_subscriptions
              WHERE account_id = $1
                AND calendar_id LIKE 'sim-%'
              ORDER BY created_at DESC
              LIMIT 1`,
        schema.subscriptionsOrgScoped ? [accountId, orgId] : [accountId],
      );
      if (subRes.rows.length > 0) {
        subscriptionId = String(subRes.rows[0].id);
      } else {
        subscriptionId = `cal_sub_${uuidv7()}`;
        if (schema.subscriptionsOrgScoped) {
          await pool.query(
            `INSERT INTO calendar_subscriptions
               (id, account_id, organization_id, calendar_id, calendar_name, is_primary, readonly, sync_enabled, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, TRUE, NOW(), NOW())`,
            [subscriptionId, accountId, orgId, `sim-${Date.now()}`, calendarName],
          );
        } else {
          await pool.query(
            `INSERT INTO calendar_subscriptions
               (id, account_id, calendar_id, calendar_name, is_primary, readonly, sync_enabled, created_at, updated_at)
             VALUES ($1, $2, $3, $4, TRUE, FALSE, TRUE, NOW(), NOW())`,
            [subscriptionId, accountId, `sim-${Date.now()}`, calendarName],
          );
        }
      }

      const eventId = `cal_evt_${uuidv7()}`;
      const eventUid = `sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const inserted = await pool.query(
        `INSERT INTO calendar_events
           (id, subscription_id, organization_id, event_uid, title, description, start_time, end_time, all_day,
            location, organizer, attendees, is_private, status, last_updated, synced_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10, ARRAY[]::text[], FALSE, 'confirmed', NOW(), NOW())
         RETURNING id, subscription_id, event_uid, title, description, start_time, end_time, location, status, synced_at`,
        [eventId, subscriptionId, orgId, eventUid, title, description, startTime.toISOString(), endTime.toISOString(), location, SIMULATION_ORGANIZER],
      );

      return sendSuccess(reply, { event: inserted.rows[0] }, 201);
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return sendError(reply, 503, 'FEATURE_UNAVAILABLE', 'Calendar schema not initialized');
      }
      logger.error('Failed to simulate calendar event', { error: String(err) });
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to simulate calendar event');
    }
  });
}
