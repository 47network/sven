import { FastifyInstance } from 'fastify';
import '@fastify/cookie';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { randomBytes, createHash, createPublicKey, createVerify } from 'crypto';
import {
  assertGoogleCalendarRedirectRouteConsistency,
  configureGoogleCalendarOAuthStateStore,
  consumeGoogleCalendarOAuthState,
  completeGoogleCalendarOAuth,
} from '../services/calendar-oauth.js';
import { readTailscaleWhoisIdentity } from '../services/TailscaleService.js';

const logger = createLogger('gateway-auth');
const trimSlash = (s: string) => { let i = s.length; while (i > 0 && s[i - 1] === '/') i--; return s.slice(0, i); };

const SESSION_COOKIE = 'sven_session';
const REFRESH_TOKEN_COOKIE = 'sven_refresh';
const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (seconds)
const REFRESH_TOKEN_MAX_AGE = 90 * 24 * 60 * 60; // 90 days (seconds)

function isRequestSecure(request?: { headers?: Record<string, string | string[] | undefined> }): boolean {
  // Explicit override for non-standard setups (e.g. HTTP-only staging behind VPN)
  const override = String(process.env.AUTH_COOKIE_SECURE ?? '').trim().toLowerCase();
  if (override === 'true' || override === '1') return true;
  if (override === 'false' || override === '0') return false;

  // Respect X-Forwarded-Proto set by reverse proxy (nginx, caddy, traefik)
  if (request?.headers) {
    const proto = String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase();
    if (proto === 'https') return true;
    if (proto === 'http') return false;
  }

  // Fallback: secure in production
  return process.env.NODE_ENV === 'production';
}

function authCookieOptions(maxAge: number, request?: { headers?: Record<string, string | string[] | undefined> }) {
  return {
    path: '/',
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: 'strict' as const,
    maxAge,
  };
}
// Increase device code TTL to 30 minutes to reduce approval race time
const DEVICE_CODE_TTL_SEC = 30 * 60;
const DEVICE_CODE_POLL_SEC = 5;
const DEBUG_DEVICE_ENDPOINT = parseBool(process.env.DEBUG_DEVICE_ENDPOINT, false);
const DEBUG_DEVICE_ALLOWED_IPS = String(process.env.DEBUG_DEVICE_ALLOWED_IPS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const AUTH_BOOTSTRAP_ADVISORY_LOCK_KEY = 47010001;

// ─── Brute-force protection ───
const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED || 5);
const LOCKOUT_DURATION_MS = Number(process.env.AUTH_LOCKOUT_MS || 15 * 60 * 1000); // 15 min
const LOCKOUT_DURATION_SEC = Math.max(1, Math.ceil(LOCKOUT_DURATION_MS / 1000));
const MAX_TOTP_ATTEMPTS = 5;
const DUMMY_BCRYPT_HASH = '$2b$10$K4GEbrHmBaK8Z0dIbJZx5.X1YHRkfP/TnU0s9LS2GxJhK0Nvn5JyC';

const USER_RATE_LIMIT_ENABLED = process.env.API_USER_RATE_LIMIT_ENABLED !== 'false';
const USER_RATE_LIMIT_MAX = Math.max(1, Number(process.env.API_USER_RATE_LIMIT_MAX || 300));
const USER_RATE_LIMIT_WINDOW_SEC = Math.max(1, Number(process.env.API_USER_RATE_LIMIT_WINDOW_SEC || 60));
const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
const OIDC_MAX_CLOCK_SKEW_SEC = Math.max(0, Number(process.env.SVEN_OIDC_MAX_CLOCK_SKEW_SEC || 120));
const SSO_STRICT_ASSERTION_VALIDATION = (() => {
  const configured = String(process.env.SVEN_SSO_STRICT_ASSERTION_VALIDATION || '').trim();
  if (configured) return parseBool(configured, false);
  return isProductionLikeProfile(process.env);
})();
const DEVICE_START_RATE_MAX = Math.max(1, Number(process.env.AUTH_DEVICE_START_RATE_MAX || 20));
const DEVICE_CONFIRM_RATE_MAX = Math.max(1, Number(process.env.AUTH_DEVICE_CONFIRM_RATE_MAX || 60));
const DEVICE_TOKEN_RATE_MAX = Math.max(1, Number(process.env.AUTH_DEVICE_TOKEN_RATE_MAX || 240));
const DEVICE_FLOW_RATE_WINDOW_MS = Math.max(1000, Number(process.env.AUTH_DEVICE_RATE_WINDOW_MS || 60_000));
const DEVICE_FLOW_RATE_LOCKOUT_MS = Math.max(1000, Number(process.env.AUTH_DEVICE_RATE_LOCKOUT_MS || 120_000));
const CSRF_TRUSTED_ORIGINS = String(process.env.SVEN_CSRF_TRUSTED_ORIGINS || '')
  .split(',')
  .map((entry) => normalizeOriginValue(entry))
  .filter((entry): entry is string => Boolean(entry));
const TAILSCALE_LOGIN_HEADER = 'tailscale-user-login';

type DeviceFlowRateState = { count: number; windowStartMs: number; lockedUntilMs: number };
const deviceStartRate = new Map<string, DeviceFlowRateState>();
const deviceConfirmRate = new Map<string, DeviceFlowRateState>();
const deviceTokenRate = new Map<string, DeviceFlowRateState>();

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

async function ensureAuthSupportTables(pool: pg.Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS auth_user_rate_limits (
       user_id TEXT NOT NULL,
       window_start TIMESTAMPTZ NOT NULL,
       count INTEGER NOT NULL DEFAULT 0,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, window_start)
     )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS oidc_auth_states (
       state TEXT PRIMARY KEY,
       account_id TEXT NOT NULL,
       redirect_uri TEXT NOT NULL,
       code_verifier TEXT NOT NULL,
       nonce TEXT NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       consumed_at TIMESTAMPTZ
     )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_oidc_auth_states_expires_at
       ON oidc_auth_states (expires_at)`,
  );
}

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

function normalizeTailscaleLogin(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function extractTailscaleUsernameCandidates(login: string): string[] {
  const normalized = normalizeTailscaleLogin(login);
  if (!normalized) return [];
  const candidates = new Set<string>([normalized]);
  const localPart = normalized.split('@')[0]?.trim();
  if (localPart) candidates.add(localPart);
  return [...candidates];
}

function isLoopbackAddress(value: unknown): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '::ffff:127.0.0.1'
    || normalized === 'localhost';
}

function toSafeLocalRedirectPath(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

function normalizeOriginValue(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function extractRequestOrigin(headers: Record<string, unknown> | undefined): string | null {
  const origin = normalizeOriginValue(headers?.origin);
  if (origin) return origin;
  const referer = String(headers?.referer || '').trim();
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function inferServerOrigin(headers: Record<string, unknown> | undefined): string | null {
  const forwardedProto = String(headers?.['x-forwarded-proto'] || '').split(',')[0]?.trim().toLowerCase();
  const forwardedHost = String(headers?.['x-forwarded-host'] || '').split(',')[0]?.trim();
  const host = forwardedHost || String(headers?.host || '').trim();
  if (!host) return null;
  const proto = forwardedProto || (isProductionLikeProfile(process.env) ? 'https' : 'http');
  return normalizeOriginValue(`${proto}://${host}`);
}

function inferAdditionalServerOrigins(headers: Record<string, unknown> | undefined): string[] {
  const proto = String(headers?.['x-forwarded-proto'] || '').split(',')[0]?.trim().toLowerCase()
    || (isProductionLikeProfile(process.env) ? 'https' : 'http');
  const host = String(headers?.['x-forwarded-host'] || '').split(',')[0]?.trim()
    || String(headers?.host || '').trim();
  const forwardedPort = String(headers?.['x-forwarded-port'] || '').split(',')[0]?.trim();
  if (!host || !forwardedPort || /:\d+$/.test(host)) return [];
  const withPort = normalizeOriginValue(`${proto}://${host}:${forwardedPort}`);
  return withPort ? [withPort] : [];
}

function getCookieAuthTrustedIngressPorts(): Set<string> {
  const raw = String(process.env.SVEN_COOKIE_AUTH_TRUSTED_PORTS || '443,44747')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set(raw);
}

function originsMatchByHostAndAllowedPort(
  requestOrigin: string,
  serverOrigin: string | null,
): boolean {
  if (!serverOrigin) return false;
  try {
    const requestUrl = new URL(requestOrigin);
    const serverUrl = new URL(serverOrigin);
    if (requestUrl.protocol !== serverUrl.protocol) return false;
    if (requestUrl.hostname !== serverUrl.hostname) return false;
    const trustedPorts = getCookieAuthTrustedIngressPorts();
    const requestPort = requestUrl.port || (requestUrl.protocol === 'https:' ? '443' : '80');
    return trustedPorts.has(requestPort);
  } catch {
    return false;
  }
}

function getImplicitDevTrustedOrigins(): string[] {
  return [
    'http://localhost',
    'http://127.0.0.1',
    'http://[::1]',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
  ]
    .map((value) => normalizeOriginValue(value))
    .filter((value): value is string => Boolean(value));
}

function enforceCsrfOriginForCookieAuth(
  request: any,
  reply: any,
  options: { routeId: string; cookieSignals: Array<string | undefined | null> },
): boolean {
  const usesCookieAuth = options.cookieSignals.some((value) => String(value || '').trim().length > 0);
  if (!usesCookieAuth) return true;

  const requestOrigin = extractRequestOrigin(request?.headers);
  if (!requestOrigin) {
    reply.status(403).send({
      success: false,
      error: { code: 'CSRF_ORIGIN_REQUIRED', message: 'Origin or Referer header is required for cookie-authenticated request' },
    });
    return false;
  }

  const trusted = new Set<string>(CSRF_TRUSTED_ORIGINS);
  const serverOrigin = inferServerOrigin(request?.headers);
  if (serverOrigin) trusted.add(serverOrigin);
  for (const origin of inferAdditionalServerOrigins(request?.headers)) {
    trusted.add(origin);
  }
  if (!isProductionLikeProfile(process.env)) {
    for (const origin of getImplicitDevTrustedOrigins()) trusted.add(origin);
  }

  if (!trusted.has(requestOrigin)) {
    if (originsMatchByHostAndAllowedPort(requestOrigin, serverOrigin)) {
      return true;
    }
    logger.warn('Blocked cookie-authenticated request with untrusted origin', {
      route: options.routeId,
      origin: requestOrigin,
      server_origin: serverOrigin,
      trusted_origin_count: trusted.size,
    });
    reply.status(403).send({
      success: false,
      error: { code: 'CSRF_ORIGIN_INVALID', message: 'Request origin is not trusted for cookie-authenticated operation' },
    });
    return false;
  }
  return true;
}

function isProductionLikeProfile(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') return true;
  const profile = String(env.SVEN_HARDENING_PROFILE || env.SVEN_PROFILE || '').trim().toLowerCase();
  return ['strict', 'hardened', 'isolated', 'production'].includes(profile);
}

function isWeakTokenExchangeSecret(secret: string): boolean {
  const normalized = String(secret || '').trim();
  if (!normalized) return true;
  if (normalized.length < 32) return true;
  const lowered = normalized.toLowerCase();
  return lowered === 'sven-dev-secret'
    || lowered === 'sven-dev-secret-change-me'
    || lowered === 'change-me'
    || lowered === 'changeme'
    || lowered === 'default';
}

function getDeviceFlowRateKey(request: any): string {
  const forwardedFor = String(request?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwardedFor || String(request?.ip || 'unknown');
}

function isDebugDeviceIpAllowed(request: any): boolean {
  if (DEBUG_DEVICE_ALLOWED_IPS.length === 0) return true;
  const forwarded = String(request?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  const candidate = forwarded || String(request?.ip || '').trim();
  return Boolean(candidate) && DEBUG_DEVICE_ALLOWED_IPS.includes(candidate);
}

function consumeDeviceFlowRate(
  store: Map<string, DeviceFlowRateState>,
  rateKey: string,
  maxRequests: number,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  const current = store.get(rateKey);
  if (current && current.lockedUntilMs > now) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((current.lockedUntilMs - now) / 1000)) };
  }

  const state = (!current || now - current.windowStartMs > DEVICE_FLOW_RATE_WINDOW_MS)
    ? { count: 0, windowStartMs: now, lockedUntilMs: 0 }
    : current;

  state.count += 1;
  if (state.count > maxRequests) {
    state.lockedUntilMs = now + DEVICE_FLOW_RATE_LOCKOUT_MS;
    store.set(rateKey, state);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(DEVICE_FLOW_RATE_LOCKOUT_MS / 1000)) };
  }

  store.set(rateKey, state);
  return { allowed: true };
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildPkceCodeChallenge(codeVerifier: string): string {
  return base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
}

function decodeJwtPayloadUnsafe(jwt: string): Record<string, unknown> {
  const parts = String(jwt || '').split('.');
  if (parts.length < 2) return {};
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const raw = Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function decodeJwtPartToJson(part: string): Record<string, unknown> | null {
  const rawPart = String(part || '').trim();
  if (!rawPart) return null;
  try {
    const payload = rawPart.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const raw = Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isOidcIdTokenSignatureVerificationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = String(env.SVEN_OIDC_VERIFY_ID_TOKEN_SIGNATURE || '').trim();
  if (configured) return parseBool(configured, false);
  return isProductionLikeProfile(env);
}

function oidcVerifyAlgorithmForJwsAlg(jwsAlg: string): string | null {
  const normalized = String(jwsAlg || '').trim().toUpperCase();
  if (normalized === 'RS256') return 'RSA-SHA256';
  if (normalized === 'RS384') return 'RSA-SHA384';
  if (normalized === 'RS512') return 'RSA-SHA512';
  if (normalized === 'ES256') return 'sha256';
  if (normalized === 'ES384') return 'sha384';
  if (normalized === 'ES512') return 'sha512';
  return null;
}

async function verifyOidcIdTokenSignature(idToken: string, jwksUri: string): Promise<{
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}> {
  const token = String(idToken || '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('OIDC id_token format is invalid');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJwtPartToJson(headerPart);
  const payload = decodeJwtPartToJson(payloadPart);
  if (!header || !payload) throw new Error('OIDC id_token header/payload is invalid');

  const alg = String(header.alg || '').trim().toUpperCase();
  if (!alg || alg === 'NONE') throw new Error('OIDC id_token must use a signed algorithm');
  const verifyAlgorithm = oidcVerifyAlgorithmForJwsAlg(alg);
  if (!verifyAlgorithm) throw new Error(`OIDC id_token uses unsupported algorithm (${alg})`);

  const signatureRaw = String(signaturePart || '').replace(/-/g, '+').replace(/_/g, '/');
  const signature = Buffer.from(signatureRaw, 'base64');
  if (!signature.length) throw new Error('OIDC id_token signature is missing');

  const jwksResponse = await fetch(jwksUri, { method: 'GET', signal: AbortSignal.timeout(10000) });
  if (!jwksResponse.ok) throw new Error(`OIDC JWKS fetch failed (${jwksResponse.status})`);
  const jwks = await jwksResponse.json() as { keys?: Array<Record<string, unknown>> };
  const jwkKeys = Array.isArray(jwks.keys) ? jwks.keys : [];
  if (!jwkKeys.length) throw new Error('OIDC JWKS response has no keys');

  const kid = String(header.kid || '').trim();
  const signingInput = `${headerPart}.${payloadPart}`;
  const candidates = jwkKeys.filter((key) => {
    const use = String(key.use || '').trim().toLowerCase();
    if (use && use !== 'sig') return false;
    const keyAlg = String(key.alg || '').trim().toUpperCase();
    if (keyAlg && keyAlg !== alg) return false;
    if (kid) return String(key.kid || '').trim() === kid;
    return true;
  });
  if (!candidates.length) throw new Error('OIDC JWKS key match not found');

  for (const key of candidates) {
    try {
      const publicKey = createPublicKey({ key: key as any, format: 'jwk' });
      const verifier = createVerify(verifyAlgorithm);
      verifier.update(signingInput);
      verifier.end();
      if (verifier.verify(publicKey, signature)) {
        return { header, payload };
      }
    } catch {
      // continue on malformed candidate keys
    }
  }
  throw new Error('OIDC id_token signature verification failed');
}

function decodeBase64Utf8(input: string): string {
  return Buffer.from(String(input || ''), 'base64').toString('utf8');
}

function hasAsciiControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function normalizeTokenExchangeRedirectTarget(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '/';
  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    // ignore malformed URI sequences and rely on raw candidate only
  }
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (!normalized.startsWith('/')) continue;
    if (normalized.startsWith('//')) continue;
    if (normalized.includes('\\')) continue;
    if (hasAsciiControlChars(normalized)) continue;
    return normalized;
  }
  return '/';
}

function maskDebugToken(value: unknown): string | null {
  const token = String(value || '').trim();
  if (!token) return null;
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function parseSamlAssertionXml(xml: string): {
  subject: string;
  email?: string;
  displayName?: string;
  groups: string[];
  attributes: Record<string, unknown>;
} {
  const raw = String(xml || '');
  const subjectMatch = raw.match(/<(?:\w+:)?NameID[^>]*>([^<]+)<\/(?:\w+:)?NameID>/i);
  const subject = String(subjectMatch?.[1] || '').trim();

  const attributes: Record<string, unknown> = {};
  const groups: string[] = [];
  let email = '';
  let displayName = '';

  const attrRegex = /<(?:\w+:)?Attribute\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Attribute>/gi;
  let attrMatch: RegExpExecArray | null = attrRegex.exec(raw);
  while (attrMatch) {
    const attrTag = String(attrMatch[1] || '');
    const nameExtract = attrTag.match(/Name="([^"]+)"/);
    const name = nameExtract ? String(nameExtract[1] || '').trim() : '';
    const block = String(attrMatch[2] || '');
    const values = Array.from(block.matchAll(/<(?:\w+:)?AttributeValue[^>]*>([^<]*(?:<(?!\/(?:\w+:)?AttributeValue>)[^<]*)*)<\/(?:\w+:)?AttributeValue>/gi))
      .map((m) => String(m[1] || '').trim())
      .filter(Boolean);
    if (name && values.length > 0) {
      attributes[name] = values.length === 1 ? values[0] : values;
      const lowered = name.toLowerCase();
      if (!email && (lowered === 'email' || lowered.endsWith('/emailaddress'))) {
        email = values[0];
      }
      if (!displayName && (lowered === 'name' || lowered === 'displayname' || lowered.endsWith('/name'))) {
        displayName = values[0];
      }
      if (lowered === 'groups' || lowered.endsWith('/groups') || lowered.endsWith('/group')) {
        groups.push(...values);
      }
    }
    attrMatch = attrRegex.exec(raw);
  }

  return {
    subject,
    email: email || undefined,
    displayName: displayName || undefined,
    groups: Array.from(new Set(groups.map((g) => g.trim()).filter(Boolean))),
    attributes,
  };
}

function extractPemBody(pem: string): string {
  return String(pem || '')
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeAuthIdentity(value: unknown): string {
  return String(value || '').trim().toLowerCase().slice(0, 256);
}

function buildAuthAttemptKey(ip: string, username: unknown): string {
  const normalizedIp = String(ip || 'unknown').trim() || 'unknown';
  const normalizedUser = normalizeAuthIdentity(username);
  // Defense in depth: include stable account signal so spoofable IP alone cannot fully evade lockout.
  if (normalizedUser) {
    return `${normalizedIp}|${normalizedUser}`;
  }
  return normalizedIp;
}

async function getLoginAttemptState(pool: pg.Pool, authAttemptKey: string): Promise<{ count: number; lockedUntilMs: number }> {
  try {
    const result = await pool.query(
      `SELECT count::int AS count,
              EXTRACT(EPOCH FROM locked_until) * 1000 AS locked_until_ms
       FROM auth_login_attempts
       WHERE attempt_key = $1
       LIMIT 1`,
      [authAttemptKey],
    );
    if (result.rows.length === 0) {
      return { count: 0, lockedUntilMs: 0 };
    }
    return {
      count: Number(result.rows[0].count || 0),
      lockedUntilMs: Number(result.rows[0].locked_until_ms || 0),
    };
  } catch (err) {
    if (isSchemaCompatError(err)) {
      return { count: 0, lockedUntilMs: 0 };
    }
    throw err;
  }
}

async function isLockedOut(pool: pg.Pool, authAttemptKey: string): Promise<boolean> {
  const state = await getLoginAttemptState(pool, authAttemptKey);
  return state.lockedUntilMs > Date.now();
}

async function recordFailedLogin(pool: pg.Pool, authAttemptKey: string): Promise<{ count: number; lockedUntilMs: number }> {
  let state = { count: 0, lockedUntilMs: 0 };
  try {
    const result = await pool.query(
      `WITH upsert AS (
         INSERT INTO auth_login_attempts (attempt_key, count, locked_until, updated_at)
         VALUES ($1, 1, NULL, NOW())
         ON CONFLICT (attempt_key)
         DO UPDATE SET
           count = CASE
             WHEN auth_login_attempts.locked_until IS NOT NULL AND auth_login_attempts.locked_until > NOW() THEN auth_login_attempts.count
             WHEN auth_login_attempts.locked_until IS NOT NULL AND auth_login_attempts.locked_until <= NOW() THEN 1
             ELSE auth_login_attempts.count + 1
           END,
           locked_until = CASE
             WHEN auth_login_attempts.locked_until IS NOT NULL AND auth_login_attempts.locked_until > NOW() THEN auth_login_attempts.locked_until
             WHEN (
               CASE
                 WHEN auth_login_attempts.locked_until IS NOT NULL AND auth_login_attempts.locked_until <= NOW() THEN 1
                 ELSE auth_login_attempts.count + 1
               END
             ) >= $2
               THEN NOW() + ($3 * INTERVAL '1 second')
             ELSE NULL
           END,
           updated_at = NOW()
         RETURNING count::int AS count, EXTRACT(EPOCH FROM locked_until) * 1000 AS locked_until_ms
       )
       SELECT count, locked_until_ms FROM upsert`,
      [authAttemptKey, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_SEC],
    );
    state = {
      count: Number(result.rows[0]?.count || 0),
      lockedUntilMs: Number(result.rows[0]?.locked_until_ms || 0),
    };
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }
  if (state.lockedUntilMs > Date.now()) {
    logger.warn('Auth lockout triggered', {
      auth_attempt_key: authAttemptKey,
      attempts: state.count,
      lockout_ms: LOCKOUT_DURATION_MS,
    });
  }
  return state;
}

async function resetFailedLogin(pool: pg.Pool, authAttemptKey: string): Promise<void> {
  try {
    await pool.query(`DELETE FROM auth_login_attempts WHERE attempt_key = $1`, [authAttemptKey]);
  } catch (err) {
    if (!isSchemaCompatError(err)) throw err;
  }
}

async function setAuthRateLimitHeaders(reply: any, pool: pg.Pool, authAttemptKey: string): Promise<void> {
  const now = Date.now();
  const state = await getLoginAttemptState(pool, authAttemptKey);
  const locked = state.lockedUntilMs > now;
  const remaining = locked ? 0 : Math.max(0, MAX_FAILED_ATTEMPTS - state.count);
  const resetEpochSec = Math.ceil((locked ? state.lockedUntilMs : now + LOCKOUT_DURATION_MS) / 1000);
  reply.header('X-RateLimit-Limit', String(MAX_FAILED_ATTEMPTS));
  reply.header('X-RateLimit-Remaining', String(remaining));
  reply.header('X-RateLimit-Reset', String(resetEpochSec));
  if (locked) {
    const retryAfterSec = Math.max(1, Math.ceil((state.lockedUntilMs - now) / 1000));
    reply.header('Retry-After', String(retryAfterSec));
  }
}

type UserRateLimitDecision =
  | { allowed: true; remaining: number; resetEpochSec: number }
  | { allowed: false; remaining: number; resetEpochSec: number; retryAfterSec: number; unavailable?: false }
  | { allowed: false; unavailable: true };

async function enforceUserRateLimit(pool: pg.Pool, userId: string): Promise<UserRateLimitDecision> {
  if (!USER_RATE_LIMIT_ENABLED) {
    return { allowed: true, remaining: USER_RATE_LIMIT_MAX, resetEpochSec: Math.ceil(Date.now() / 1000) + USER_RATE_LIMIT_WINDOW_SEC };
  }
  const windowMs = USER_RATE_LIMIT_WINDOW_SEC * 1000;
  try {
    const rateRes = await pool.query(
      `WITH bounds AS (
         SELECT to_timestamp(floor(extract(epoch FROM NOW()) * 1000 / $2::numeric) * $2::numeric / 1000.0) AS window_start
       ), upsert AS (
         INSERT INTO auth_user_rate_limits (user_id, window_start, count, updated_at)
         SELECT $1, bounds.window_start, 1, NOW()
         FROM bounds
         ON CONFLICT (user_id, window_start)
         DO UPDATE SET count = auth_user_rate_limits.count + 1, updated_at = NOW()
         RETURNING count::int AS count, EXTRACT(EPOCH FROM window_start) AS window_start_epoch
       )
       SELECT count, window_start_epoch FROM upsert`,
      [userId, windowMs],
    );
    const count = Number(rateRes.rows[0]?.count || 0);
    const windowStartEpoch = Number(rateRes.rows[0]?.window_start_epoch || Math.floor(Date.now() / 1000));
    const resetEpochSec = Math.ceil(windowStartEpoch + USER_RATE_LIMIT_WINDOW_SEC);
    const remaining = Math.max(0, USER_RATE_LIMIT_MAX - count);
    if (count > USER_RATE_LIMIT_MAX) {
      const retryAfterSec = Math.max(1, resetEpochSec - Math.ceil(Date.now() / 1000));
      return { allowed: false, remaining, resetEpochSec, retryAfterSec };
    }
    return { allowed: true, remaining, resetEpochSec };
  } catch (err) {
    if (isSchemaCompatError(err)) {
      logger.warn('Per-user rate limit table unavailable; continuing with permissive fallback', {
        user_id: userId,
      });
      return {
        allowed: true,
        remaining: USER_RATE_LIMIT_MAX,
        resetEpochSec: Math.ceil(Date.now() / 1000) + USER_RATE_LIMIT_WINDOW_SEC,
      };
    }
    throw err;
  }
}

type SqlQueryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

type OidcPendingState = {
  accountId: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
};

async function persistOidcState(
  pool: pg.Pool,
  state: string,
  pending: OidcPendingState,
): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO oidc_auth_states (state, account_id, redirect_uri, code_verifier, nonce, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 millisecond'), NOW())`,
      [state, pending.accountId, pending.redirectUri, pending.codeVerifier, pending.nonce, OIDC_STATE_TTL_MS],
    );
    return true;
  } catch (err) {
    if (isSchemaCompatError(err)) return false;
    throw err;
  }
}

async function consumeOidcState(pool: pg.Pool, state: string): Promise<OidcPendingState | null | 'unavailable'> {
  try {
    const result = await pool.query(
      `UPDATE oidc_auth_states
       SET consumed_at = NOW()
       WHERE state = $1
         AND consumed_at IS NULL
         AND expires_at > NOW()
       RETURNING account_id, redirect_uri, code_verifier, nonce`,
      [state],
    );
    if (result.rows.length === 0) return null;
    return {
      accountId: String(result.rows[0].account_id || '').trim(),
      redirectUri: String(result.rows[0].redirect_uri || '').trim(),
      codeVerifier: String(result.rows[0].code_verifier || '').trim(),
      nonce: String(result.rows[0].nonce || '').trim(),
    };
  } catch (err) {
    if (isSchemaCompatError(err)) return 'unavailable';
    throw err;
  }
}

async function consumeTokenExchangeTokenOnce(
  pool: pg.Pool,
  token: string,
  userId: string,
  expiryMs: number,
): Promise<'consumed' | 'replay' | 'unavailable'> {
  const tokenHash = createHash('sha256').update(String(token || '')).digest('hex');
  const expiresAt = new Date(expiryMs);
  if (!Number.isFinite(expiresAt.getTime())) return 'replay';
  try {
    const result = await pool.query(
      `INSERT INTO auth_token_exchange_consumptions (token_hash, user_id, expires_at, consumed_at, created_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (token_hash) DO NOTHING
       RETURNING token_hash`,
      [tokenHash, userId, expiresAt.toISOString()],
    );
    return result.rows.length > 0 ? 'consumed' : 'replay';
  } catch (err) {
    if (isSchemaCompatError(err)) return 'unavailable';
    throw err;
  }
}

async function createAccessSession(pool: SqlQueryable, userId: string): Promise<string> {
  const sessionId = uuidv7();
  await pool.query(
    `INSERT INTO sessions (id, user_id, status, created_at, expires_at)
     VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '${ACCESS_TOKEN_MAX_AGE} seconds')`,
    [sessionId, userId],
  );
  return sessionId;
}

async function createRefreshSession(pool: SqlQueryable, userId: string): Promise<string> {
  const sessionId = uuidv7();
  await pool.query(
    `INSERT INTO sessions (id, user_id, status, created_at, expires_at)
     VALUES ($1, $2, 'refresh', NOW(), NOW() + INTERVAL '${REFRESH_TOKEN_MAX_AGE} seconds')`,
    [sessionId, userId],
  );
  return sessionId;
}

type AuthSsoProvider = {
  enabled: boolean;
  issuer_url?: string;
  client_id?: string;
  client_secret?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  scopes?: string;
  callback_url?: string;
  entrypoint_url?: string;
  entity_id?: string;
  cert_pem?: string;
};

type AuthSsoConfig = {
  enabled: boolean;
  fallback_local_auth: boolean;
  oidc: AuthSsoProvider;
  saml: AuthSsoProvider;
  jit: { enabled: boolean; default_role: string };
  group_mapping: Array<{ external_group: string; tenant_role: string }>;
};

function sanitizeAuthSsoConfig(raw: unknown): AuthSsoConfig {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const toProvider = (provider: unknown): AuthSsoProvider => {
    const p = provider && typeof provider === 'object' ? (provider as Record<string, unknown>) : {};
    return {
      enabled: parseBool(p.enabled, false),
      issuer_url: String(p.issuer_url || '') || undefined,
      client_id: String(p.client_id || '') || undefined,
      client_secret: String(p.client_secret || '') || undefined,
      authorization_endpoint: String(p.authorization_endpoint || '') || undefined,
      token_endpoint: String(p.token_endpoint || '') || undefined,
      userinfo_endpoint: String(p.userinfo_endpoint || '') || undefined,
      jwks_uri: String(p.jwks_uri || '') || undefined,
      scopes: String(p.scopes || '') || undefined,
      callback_url: String(p.callback_url || '') || undefined,
      entrypoint_url: String(p.entrypoint_url || '') || undefined,
      entity_id: String(p.entity_id || '') || undefined,
      cert_pem: String(p.cert_pem || '') || undefined,
    };
  };
  const jitObj = input.jit && typeof input.jit === 'object' ? (input.jit as Record<string, unknown>) : {};
  const validRoles = new Set(['owner', 'admin', 'operator', 'member', 'viewer']);
  const rawRole = String(jitObj.default_role || '').toLowerCase();
  const group_mapping = (Array.isArray(input.group_mapping) ? input.group_mapping : [])
    .map((entry) => {
      const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const external_group = String(row.external_group || '').trim();
      const tenant_role = String(row.tenant_role || '').trim().toLowerCase();
      if (!external_group || !validRoles.has(tenant_role)) return null;
      return { external_group, tenant_role };
    })
    .filter((row): row is { external_group: string; tenant_role: string } => Boolean(row));

  return {
    enabled: parseBool(input.enabled, false),
    fallback_local_auth: parseBool(input.fallback_local_auth, true),
    oidc: toProvider(input.oidc),
    saml: toProvider(input.saml),
    jit: {
      enabled: parseBool(jitObj.enabled, true),
      default_role: validRoles.has(rawRole) ? rawRole : 'member',
    },
    group_mapping,
  };
}

function redactAuthSsoConfig(input: AuthSsoConfig): AuthSsoConfig {
  const clone = JSON.parse(JSON.stringify(input)) as AuthSsoConfig;
  if (clone.oidc.client_secret) clone.oidc.client_secret = '***';
  if (clone.saml.cert_pem) clone.saml.cert_pem = '***';
  return clone;
}

async function loadOrgSsoConfig(pool: pg.Pool, orgId: string | null): Promise<AuthSsoConfig> {
  if (!orgId) {
    return sanitizeAuthSsoConfig({});
  }
  const res = await pool.query(
    `SELECT value
     FROM organization_settings
     WHERE organization_id = $1 AND key = $2
     LIMIT 1`,
    [orgId, 'auth.sso.config'],
  );
  return sanitizeAuthSsoConfig(res.rows[0]?.value || {});
}

async function resolveOidcEndpoints(provider: AuthSsoProvider): Promise<{
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string | null;
  jwksUri: string | null;
}> {
  let authorizationEndpoint = String(provider.authorization_endpoint || '').trim();
  let tokenEndpoint = String(provider.token_endpoint || '').trim();
  let userinfoEndpoint = String(provider.userinfo_endpoint || '').trim();
  let jwksUri = String(provider.jwks_uri || '').trim();

  if ((!authorizationEndpoint || !tokenEndpoint) && provider.issuer_url) {
    const issuer = trimSlash(String(provider.issuer_url));
    const wellKnownUrl = `${issuer}/.well-known/openid-configuration`;
    const discovered = await fetch(wellKnownUrl, { method: 'GET', signal: AbortSignal.timeout(10000) });
    if (!discovered.ok) {
      throw new Error(`OIDC discovery failed (${discovered.status})`);
    }
    const payload = await discovered.json() as Record<string, unknown>;
    authorizationEndpoint = authorizationEndpoint || String(payload.authorization_endpoint || '').trim();
    tokenEndpoint = tokenEndpoint || String(payload.token_endpoint || '').trim();
    userinfoEndpoint = userinfoEndpoint || String(payload.userinfo_endpoint || '').trim();
    jwksUri = jwksUri || String(payload.jwks_uri || '').trim();
  }

  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new Error('OIDC endpoints are incomplete (authorization/token)');
  }

  return {
    authorizationEndpoint,
    tokenEndpoint,
    userinfoEndpoint: userinfoEndpoint || null,
    jwksUri: jwksUri || null,
  };
}

async function touchSsoSessionLinks(pool: pg.Pool, sessionIds: string[]): Promise<void> {
  const ids = Array.from(new Set((sessionIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return;
  await pool.query(
    `UPDATE sso_session_links
     SET last_seen_at = NOW()
     WHERE session_id = ANY($1::text[])`,
    [ids],
  ).catch((err) => {
    if (isSchemaCompatError(err)) return;
    throw err;
  });
}

async function revokeSsoSessionLinksBySessionIds(pool: pg.Pool, sessionIds: string[]): Promise<void> {
  const ids = Array.from(new Set((sessionIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return;
  await pool.query(
    `UPDATE sso_session_links
     SET revoked_at = NOW(), last_seen_at = NOW()
     WHERE session_id = ANY($1::text[]) AND revoked_at IS NULL`,
    [ids],
  ).catch((err) => {
    if (isSchemaCompatError(err)) return;
    throw err;
  });
}

async function revokeSsoSessionLinksByUserId(pool: pg.Pool, userId: string): Promise<void> {
  const uid = String(userId || '').trim();
  if (!uid) return;
  await pool.query(
    `UPDATE sso_session_links
     SET revoked_at = NOW(), last_seen_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [uid],
  ).catch((err) => {
    if (isSchemaCompatError(err)) return;
    throw err;
  });
}

async function rotateSsoSessionLinksOnRefresh(
  pool: pg.Pool,
  previousSessionId: string,
  nextAccessSessionId: string,
  nextRefreshSessionId: string,
): Promise<void> {
  const prevId = String(previousSessionId || '').trim();
  const accessId = String(nextAccessSessionId || '').trim();
  const refreshId = String(nextRefreshSessionId || '').trim();
  if (!prevId || !accessId || !refreshId) return;

  const sourceRes = await pool.query(
    `SELECT organization_id, user_id, provider, subject
     FROM sso_session_links
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [prevId],
  ).catch((err) => {
    if (isSchemaCompatError(err)) return { rows: [] } as any;
    throw err;
  });

  if (!sourceRes?.rows?.length) return;
  const source = sourceRes.rows[0];
  await pool.query(
    `INSERT INTO sso_session_links
     (id, organization_id, user_id, session_id, session_kind, provider, subject, created_at, last_seen_at)
     VALUES
       ($1, $2, $3, $4, 'access', $5, $6, NOW(), NOW()),
       ($7, $2, $3, $8, 'refresh', $5, $6, NOW(), NOW())
     ON CONFLICT (session_id)
     DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       user_id = EXCLUDED.user_id,
       session_kind = EXCLUDED.session_kind,
       provider = EXCLUDED.provider,
       subject = EXCLUDED.subject,
       last_seen_at = NOW(),
       revoked_at = NULL`,
    [
      uuidv7(),
      source.organization_id,
      source.user_id,
      accessId,
      source.provider,
      source.subject,
      uuidv7(),
      refreshId,
    ],
  ).catch((err) => {
    if (isSchemaCompatError(err)) return;
    throw err;
  });
}

export async function registerAuthRoutes(app: FastifyInstance, pool: pg.Pool) {
  try {
    await ensureAuthSupportTables(pool);
  } catch (err) {
    logger.warn('Auth support table bootstrap failed; compatibility fallback remains active', {
      error: String((err as Error)?.message || err),
    });
  }
  const requireAdminAuth = requireRole(pool, 'admin');
  assertGoogleCalendarRedirectRouteConsistency();
  configureGoogleCalendarOAuthStateStore(pool);

  const roleRank: Record<string, number> = {
    viewer: 0,
    member: 1,
    operator: 2,
    admin: 3,
    owner: 4,
  };
  const resolveTenantRole = (config: AuthSsoConfig, groups: string[]): string => {
    const byGroup = new Map<string, string>();
    for (const mapping of config.group_mapping || []) {
      byGroup.set(String(mapping.external_group || '').trim().toLowerCase(), String(mapping.tenant_role || '').toLowerCase());
    }
    let bestRole = String(config.jit.default_role || 'member').toLowerCase();
    for (const group of groups) {
      const mapped = byGroup.get(String(group || '').trim().toLowerCase());
      if (!mapped) continue;
      if ((roleRank[mapped] ?? -1) > (roleRank[bestRole] ?? -1)) {
        bestRole = mapped;
      }
    }
    return roleRank[bestRole] == null ? 'member' : bestRole;
  };

  const completeSsoLogin = async (params: {
    accountId: string;
    provider: 'oidc' | 'saml';
    subject: string;
    email?: string;
    displayName?: string;
    username?: string;
    groups: string[];
    attributes?: Record<string, unknown>;
    reply: any;
    request: any;
    config: AuthSsoConfig;
  }) => {
    const { accountId, provider, subject, email, displayName, username, groups, attributes, reply, request, config } = params;
    const normalizedSubject = subject.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'subject';
    const requestedUsername = String(username || `sso_${provider}_${normalizedSubject}`)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .slice(0, 48) || `sso_${Date.now()}`;
    const displayNameSafe = String(displayName || email || requestedUsername).slice(0, 120);
    const membershipRole = resolveTenantRole(config, groups);

    const allocateUniqueSsoUsername = async (): Promise<string> => {
      const stem = requestedUsername.slice(0, 36) || 'sso_user';
      const candidates: string[] = [];
      candidates.push(stem.slice(0, 48));
      for (let attempt = 1; attempt < 20; attempt += 1) {
        const suffix = `_${randomBytes(3).toString('hex')}`;
        candidates.push(`${stem}${suffix}`.slice(0, 48));
      }

      const existing = await pool.query(
        `SELECT username
         FROM users
         WHERE username = ANY($1::text[])`,
        [candidates],
      );

      const existingSet = new Set(existing.rows.map((row) => row.username));
      for (const candidate of candidates) {
        if (!existingSet.has(candidate)) return candidate;
      }

      return `${stem}_${uuidv7().replace(/-/g, '').slice(0, 8)}`.slice(0, 48);
    };

    const existingIdentity = await pool.query(
      `SELECT user_id
       FROM sso_identities
       WHERE organization_id = $1 AND provider = $2 AND subject = $3
       LIMIT 1`,
      [accountId, provider, subject],
    ).catch((err) => {
      if (isSchemaCompatError(err)) return { rows: [] } as any;
      throw err;
    });

    let userId = String(existingIdentity?.rows?.[0]?.user_id || '');
    let effectiveUsername = requestedUsername;
    if (!userId) {
      userId = uuidv7();
      effectiveUsername = await allocateUniqueSsoUsername();
      const randomPassword = randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      await pool.query(
        `INSERT INTO users (id, username, display_name, role, password_hash, active_organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'user', $4, $5, NOW(), NOW())`,
        [userId, effectiveUsername, displayNameSafe, passwordHash, accountId],
      );
    } else {
      await pool.query(
        `UPDATE users
         SET active_organization_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [userId, accountId],
      );
    }

    await pool.query(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()`,
      [uuidv7(), accountId, userId, membershipRole],
    );

    await pool.query(
      `INSERT INTO sso_identities
       (id, organization_id, user_id, provider, subject, email, groups, attributes, last_login_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW(), NOW())
       ON CONFLICT (organization_id, provider, subject)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         email = EXCLUDED.email,
         groups = EXCLUDED.groups,
         attributes = EXCLUDED.attributes,
         last_login_at = NOW(),
         updated_at = NOW()`,
      [
        uuidv7(),
        accountId,
        userId,
        provider,
        subject,
        email || null,
        JSON.stringify(groups),
        JSON.stringify(attributes || {}),
      ],
    ).catch((err) => {
      if (isSchemaCompatError(err)) return;
      throw err;
    });

    const sessionId = await createAccessSession(pool, userId);
    const refreshToken = await createRefreshSession(pool, userId);
    await pool.query(
      `INSERT INTO sso_session_links
       (id, organization_id, user_id, session_id, session_kind, provider, subject, created_at, last_seen_at)
       VALUES ($1, $2, $3, $4, 'access', $5, $6, NOW(), NOW()),
              ($7, $2, $3, $8, 'refresh', $5, $6, NOW(), NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET last_seen_at = NOW(), revoked_at = NULL`,
      [uuidv7(), accountId, userId, sessionId, provider, subject, uuidv7(), refreshToken],
    ).catch((err) => {
      if (isSchemaCompatError(err)) return;
      throw err;
    });

    reply.setCookie(SESSION_COOKIE, sessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));

    return {
      userId,
      username: effectiveUsername,
      membershipRole,
      sessionId,
      refreshToken,
    };
  };

  const requireAuth = requireRole(pool, 'admin', 'user');

  app.get('/v1/auth/sso/status', async (request: any, reply) => {
    let orgId: string | null = null;
    const principal = await resolveActiveSessionPrincipal(
      pool,
      request.cookies?.[SESSION_COOKIE],
      request.headers?.authorization,
    );
    if (principal) {
      const orgRes = await pool.query(
        `SELECT active_organization_id
         FROM users
         WHERE id = $1`,
        [principal.userId],
      );
      orgId = String(orgRes.rows[0]?.active_organization_id || '') || null;
    }

    const config = await loadOrgSsoConfig(pool, orgId);
    const providers = [
      { provider: 'oidc', enabled: Boolean(config.enabled && config.oidc.enabled) },
      { provider: 'saml', enabled: Boolean(config.enabled && config.saml.enabled) },
    ];
    reply.send({
      success: true,
      data: {
        organization_id: orgId,
        config: redactAuthSsoConfig(config),
        providers,
        local_auth_available: Boolean(!config.enabled || config.fallback_local_auth),
      },
    });
  });

  app.post('/v1/auth/sso', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          account_id: { type: 'string' },
          provider: { type: 'string' },
          provider_id: { type: 'string' },
          email: { type: 'string' },
          display_name: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as {
      account_id?: string;
      provider?: string;
      id_token?: string;
      nonce?: string;
    };
    const provider = String(body.provider || '').trim().toLowerCase();
    if (provider !== 'oidc') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Only provider=oidc is supported for /v1/auth/sso' },
      });
    }

    const idToken = String(body.id_token || '').trim();
    if (!idToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'id_token is required' },
      });
    }

    let accountId = String(body.account_id || '').trim();
    if (!accountId) {
      const cfgRows = await pool.query(
        `SELECT organization_id, value
         FROM organization_settings
         WHERE key = $1`,
        ['auth.sso.config'],
      );
      const eligible = (cfgRows.rows || [])
        .map((row) => ({
          accountId: String(row.organization_id || '').trim(),
          config: sanitizeAuthSsoConfig(row.value),
        }))
        .filter((row) => Boolean(row.accountId && row.config.enabled && row.config.oidc.enabled));
      if (eligible.length === 1) {
        accountId = eligible[0].accountId;
      } else {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'ACCOUNT_REQUIRED',
            message: 'account_id is required when multiple OIDC-enabled organizations exist',
          },
        });
      }
    }

    const account = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [accountId]);
    if (account.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Organization not found' },
      });
    }

    const config = await loadOrgSsoConfig(pool, accountId);
    if (!(config.enabled && config.oidc.enabled)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_DISABLED', message: 'OIDC SSO is not enabled for this organization' },
      });
    }

    let idTokenClaims: Record<string, unknown> = {};
    if (isOidcIdTokenSignatureVerificationEnabled(process.env)) {
      const jwksUri = String(config.oidc.jwks_uri || '').trim();
      if (!jwksUri) {
        return reply.status(502).send({
          success: false,
          error: { code: 'OIDC_JWKS_UNAVAILABLE', message: 'OIDC jwks_uri is required for id_token verification' },
        });
      }
      try {
        idTokenClaims = (await verifyOidcIdTokenSignature(idToken, jwksUri)).payload;
      } catch (err) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_TOKEN_SIGNATURE_INVALID', message: String((err as Error)?.message || err) },
        });
      }
    } else {
      idTokenClaims = decodeJwtPayloadUnsafe(idToken);
    }

    const subject = String(idTokenClaims.sub || '').trim();
    if (!subject) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_CLAIMS_INVALID', message: 'id_token missing subject claim' },
      });
    }

    const issuer = trimSlash(String(config.oidc.issuer_url || ''));
    const tokenIssuer = trimSlash(String(idTokenClaims.iss || ''));
    if (issuer && tokenIssuer && issuer !== tokenIssuer) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_ISSUER_MISMATCH', message: 'id_token issuer does not match configured issuer' },
      });
    }

    const clientId = String(config.oidc.client_id || '').trim();
    const audClaim = idTokenClaims.aud;
    const audiences = Array.isArray(audClaim)
      ? audClaim.map((v) => String(v || '').trim()).filter(Boolean)
      : String(audClaim || '').trim()
          ? [String(audClaim || '').trim()]
          : [];
    if (clientId && audiences.length > 0 && !audiences.includes(clientId)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_AUDIENCE_MISMATCH', message: 'id_token audience does not include configured client_id' },
      });
    }

    const requestNonce = String(body.nonce || '').trim();
    const tokenNonce = String(idTokenClaims.nonce || '').trim();
    if (requestNonce && tokenNonce && requestNonce !== tokenNonce) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_NONCE_MISMATCH', message: 'id_token nonce does not match request nonce' },
      });
    }
    if (requestNonce && !tokenNonce) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_NONCE_MISSING', message: 'id_token nonce claim is required for this flow' },
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const exp = Number(idTokenClaims.exp);
    if (Number.isFinite(exp) && exp > 0 && exp + OIDC_MAX_CLOCK_SKEW_SEC < nowSec) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_TOKEN_EXPIRED', message: 'id_token is expired' },
      });
    }
    const iat = Number(idTokenClaims.iat);
    if (Number.isFinite(iat) && iat > 0 && iat - OIDC_MAX_CLOCK_SKEW_SEC > nowSec) {
      return reply.status(401).send({
        success: false,
        error: { code: 'OIDC_TOKEN_IAT_INVALID', message: 'id_token issued-at claim is in the future' },
      });
    }

    const groups = Array.isArray(idTokenClaims.groups)
      ? (idTokenClaims.groups as unknown[]).map((g) => String(g || '').trim()).filter(Boolean)
      : [];

    const completion = await completeSsoLogin({
      accountId,
      provider: 'oidc',
      subject,
      email: String(idTokenClaims.email || '').trim() || undefined,
      displayName: String(idTokenClaims.name || idTokenClaims.preferred_username || '').trim() || undefined,
      username: String(idTokenClaims.preferred_username || '').trim() || undefined,
      groups,
      attributes: idTokenClaims,
      reply,
      request,
      config,
    });

    return reply.send({
      success: true,
      data: {
        provider: 'oidc',
        user_id: completion.userId,
        username: completion.username,
        role: 'user',
        membership_role: completion.membershipRole,
        active_organization_id: accountId,
        access_token: completion.sessionId,
        refresh_token: completion.refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  app.post('/v1/auth/sso/mock/login', async (request: any, reply) => {
    if (isProductionLikeProfile(process.env)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_MOCK_FORBIDDEN', message: 'Mock SSO login is disabled in production profiles' },
      });
    }
    const mockEnabled = parseBool(process.env.SVEN_SSO_MOCK_ENABLED, false);
    if (!mockEnabled) {
      return reply.status(503).send({
        success: false,
        error: { code: 'SSO_MOCK_DISABLED', message: 'Set SVEN_SSO_MOCK_ENABLED=true to enable mock SSO login' },
      });
    }

    const body = (request.body || {}) as {
      account_id?: string;
      provider?: string;
      subject?: string;
      email?: string;
      display_name?: string;
      username?: string;
      groups?: string[] | string;
    };
    const accountId = String(body.account_id || '').trim();
    const provider = String(body.provider || 'oidc').trim().toLowerCase();
    const subject = String(body.subject || '').trim();
    if (!accountId || !subject) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'account_id and subject are required' },
      });
    }
    if (provider !== 'oidc' && provider !== 'saml') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'provider must be oidc or saml' },
      });
    }

    const account = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [accountId]);
    if (account.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'account not found' },
      });
    }

    const config = await loadOrgSsoConfig(pool, accountId);
    const providerEnabled = provider === 'oidc' ? config.oidc.enabled : config.saml.enabled;
    if (!config.enabled || !providerEnabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_DISABLED', message: `SSO provider ${provider} is not enabled for this account` },
      });
    }
    if (!config.jit.enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'JIT_DISABLED', message: 'SSO JIT provisioning is disabled' },
      });
    }

    const groups = Array.isArray(body.groups)
      ? body.groups.map((group) => String(group || '').trim()).filter(Boolean)
      : String(body.groups || '')
          .split(',')
          .map((group) => group.trim())
          .filter(Boolean);
    const completion = await completeSsoLogin({
      accountId,
      provider: provider as 'oidc' | 'saml',
      subject,
      email: body.email,
      displayName: body.display_name,
      username: body.username,
      groups,
      attributes: { mode: 'mock' },
      reply,
      request,
      config,
    });

    return reply.send({
      success: true,
      data: {
        provider,
        user_id: completion.userId,
        username: completion.username,
        role: 'user',
        membership_role: completion.membershipRole,
        active_organization_id: accountId,
        access_token: completion.sessionId,
        refresh_token: completion.refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  app.post('/v1/auth/sso/oidc/start', async (request: any, reply) => {
    const body = (request.body || {}) as { account_id?: string; redirect_uri?: string };
    const accountId = String(body.account_id || '').trim();
    if (!accountId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'account_id is required' },
      });
    }
    const account = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [accountId]);
    if (account.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'account not found' },
      });
    }

    const config = await loadOrgSsoConfig(pool, accountId);
    if (!config.enabled || !config.oidc.enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_DISABLED', message: 'OIDC is not enabled for this account' },
      });
    }
    const clientId = String(config.oidc.client_id || '').trim();
    // Always use the configured callback_url — never accept redirect_uri from the request body.
    // Accepting user-supplied redirect_uri enables open-redirect and authorization code interception.
    const redirectUri = String(config.oidc.callback_url || '').trim();
    if (!clientId || !redirectUri) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'OIDC client_id and callback_url must be configured in SSO settings' },
      });
    }

    let endpoints: { authorizationEndpoint: string; tokenEndpoint: string; userinfoEndpoint: string | null; jwksUri: string | null };
    try {
      endpoints = await resolveOidcEndpoints(config.oidc);
    } catch (err) {
      return reply.status(502).send({
        success: false,
        error: { code: 'OIDC_DISCOVERY_FAILED', message: String(err) },
      });
    }

    const state = base64UrlEncode(randomBytes(24));
    const codeVerifier = base64UrlEncode(randomBytes(48));
    const codeChallenge = buildPkceCodeChallenge(codeVerifier);
    const nonce = base64UrlEncode(randomBytes(24));
    const persisted = await persistOidcState(pool, state, {
      accountId,
      redirectUri,
      codeVerifier,
      nonce,
    });
    if (!persisted) {
      return reply.status(503).send({
        success: false,
        error: { code: 'OIDC_STATE_UNAVAILABLE', message: 'OIDC state store unavailable' },
      });
    }

    const authUrl = new URL(endpoints.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', String(config.oidc.scopes || 'openid profile email'));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return reply.send({
      success: true,
      data: {
        provider: 'oidc',
        account_id: accountId,
        authorization_url: authUrl.toString(),
        state,
        expires_in_seconds: Math.floor(OIDC_STATE_TTL_MS / 1000),
      },
    });
  });

  app.post('/v1/auth/sso/oidc/callback', async (request: any, reply) => {
    const body = (request.body || {}) as {
      state?: string;
      code?: string;
      redirect_uri?: string;
    };
    const state = String(body.state || '').trim();
    const code = String(body.code || '').trim();
    if (!state || !code) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'state and code are required' },
      });
    }
    const pending = await consumeOidcState(pool, state);
    if (pending === 'unavailable') {
      return reply.status(503).send({
        success: false,
        error: { code: 'OIDC_STATE_UNAVAILABLE', message: 'OIDC state store unavailable' },
      });
    }
    if (!pending) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_STATE', message: 'OIDC state is invalid or expired' },
      });
    }

    const config = await loadOrgSsoConfig(pool, pending.accountId);
    if (!config.enabled || !config.oidc.enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_DISABLED', message: 'OIDC is not enabled for this account' },
      });
    }

    let endpoints: { authorizationEndpoint: string; tokenEndpoint: string; userinfoEndpoint: string | null; jwksUri: string | null };
    try {
      endpoints = await resolveOidcEndpoints(config.oidc);
    } catch (err) {
      return reply.status(502).send({
        success: false,
        error: { code: 'OIDC_DISCOVERY_FAILED', message: String(err) },
      });
    }

    // Always use the redirect_uri stored during /start — never accept body override on callback.
    // The redirect_uri at token exchange must match what was sent to the authorization endpoint.
    const redirectUri = String(pending.redirectUri || config.oidc.callback_url || '').trim();
    const clientId = String(config.oidc.client_id || '').trim();
    const clientSecret = String(config.oidc.client_secret || '').trim();
    if (!redirectUri || !clientId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'OIDC callback_url and client_id must be configured in SSO settings' },
      });
    }

    const tokenPayload = new URLSearchParams();
    tokenPayload.set('grant_type', 'authorization_code');
    tokenPayload.set('code', code);
    tokenPayload.set('redirect_uri', redirectUri);
    tokenPayload.set('client_id', clientId);
    tokenPayload.set('code_verifier', pending.codeVerifier);
    if (clientSecret) tokenPayload.set('client_secret', clientSecret);

    const tokenRes = await fetch(endpoints.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenPayload.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return reply.status(502).send({
        success: false,
        error: { code: 'OIDC_TOKEN_EXCHANGE_FAILED', message: tokenText.slice(0, 400) || `status ${tokenRes.status}` },
      });
    }

    let tokenJson: Record<string, unknown> = {};
    try {
      tokenJson = tokenText ? JSON.parse(tokenText) as Record<string, unknown> : {};
    } catch {
      tokenJson = {};
    }
    const accessToken = String(tokenJson.access_token || '').trim();
    const idToken = String(tokenJson.id_token || '').trim();
    if (!accessToken && !idToken) {
      return reply.status(502).send({
        success: false,
        error: { code: 'OIDC_TOKEN_INVALID', message: 'No access_token or id_token in token response' },
      });
    }

    let idTokenClaims: Record<string, unknown> = {};
    if (idToken) {
      if (isOidcIdTokenSignatureVerificationEnabled(process.env)) {
        if (!endpoints.jwksUri) {
          return reply.status(502).send({
            success: false,
            error: { code: 'OIDC_JWKS_UNAVAILABLE', message: 'OIDC jwks_uri is required for id_token verification' },
          });
        }
        try {
          idTokenClaims = (await verifyOidcIdTokenSignature(idToken, endpoints.jwksUri)).payload;
        } catch (err) {
          return reply.status(401).send({
            success: false,
            error: { code: 'OIDC_TOKEN_SIGNATURE_INVALID', message: String((err as Error)?.message || err) },
          });
        }
      } else {
        idTokenClaims = decodeJwtPayloadUnsafe(idToken);
      }
    }
    let claims: Record<string, unknown> = {};
    if (endpoints.userinfoEndpoint && accessToken) {
      const userInfoRes = await fetch(endpoints.userinfoEndpoint, {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (userInfoRes.ok) {
        claims = await userInfoRes.json() as Record<string, unknown>;
      }
    }
    if (!claims.sub && idToken) {
      claims = { ...idTokenClaims, ...claims };
    }
    const subject = String(claims.sub || '').trim();
    if (!subject) {
      return reply.status(502).send({
        success: false,
        error: { code: 'OIDC_CLAIMS_INVALID', message: 'OIDC response missing subject claim' },
      });
    }
    if (idToken) {
      const idSub = String(idTokenClaims.sub || '').trim();
      if (idSub && idSub !== subject) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_SUBJECT_MISMATCH', message: 'id_token subject does not match resolved subject' },
        });
      }
      const issuer = trimSlash(String(config.oidc.issuer_url || ''));
      const tokenIssuer = trimSlash(String(idTokenClaims.iss || ''));
      if (issuer && tokenIssuer && issuer !== tokenIssuer) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_ISSUER_MISMATCH', message: 'id_token issuer does not match configured issuer' },
        });
      }
      const audClaim = idTokenClaims.aud;
      const audiences = Array.isArray(audClaim)
        ? audClaim.map((v) => String(v || '').trim()).filter(Boolean)
        : String(audClaim || '').trim()
            ? [String(audClaim || '').trim()]
            : [];
      if (clientId && audiences.length > 0 && !audiences.includes(clientId)) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_AUDIENCE_MISMATCH', message: 'id_token audience does not include configured client_id' },
        });
      }
      const nonce = String(idTokenClaims.nonce || '').trim();
      if (pending.nonce && nonce && nonce !== pending.nonce) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_NONCE_MISMATCH', message: 'id_token nonce does not match authorization request nonce' },
        });
      }
      if (pending.nonce && !nonce) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_NONCE_MISSING', message: 'id_token nonce claim is required for this flow' },
        });
      }
      const nowSec = Math.floor(Date.now() / 1000);
      const exp = Number(idTokenClaims.exp);
      if (Number.isFinite(exp) && exp > 0 && exp + OIDC_MAX_CLOCK_SKEW_SEC < nowSec) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_TOKEN_EXPIRED', message: 'id_token is expired' },
        });
      }
      const iat = Number(idTokenClaims.iat);
      if (Number.isFinite(iat) && iat > 0 && iat - OIDC_MAX_CLOCK_SKEW_SEC > nowSec) {
        return reply.status(401).send({
          success: false,
          error: { code: 'OIDC_TOKEN_IAT_INVALID', message: 'id_token issued-at claim is in the future' },
        });
      }
    }

    const groups = Array.isArray(claims.groups)
      ? (claims.groups as unknown[]).map((g) => String(g || '').trim()).filter(Boolean)
      : [];

    const completion = await completeSsoLogin({
      accountId: pending.accountId,
      provider: 'oidc',
      subject,
      email: String(claims.email || '').trim() || undefined,
      displayName: String(claims.name || claims.preferred_username || '').trim() || undefined,
      username: String(claims.preferred_username || '').trim() || undefined,
      groups,
      attributes: claims,
      reply,
      request,
      config,
    });

    return reply.send({
      success: true,
      data: {
        provider: 'oidc',
        user_id: completion.userId,
        username: completion.username,
        role: 'user',
        membership_role: completion.membershipRole,
        active_organization_id: pending.accountId,
        access_token: completion.sessionId,
        refresh_token: completion.refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  app.post('/v1/auth/sso/saml/start', async (request: any, reply) => {
    const body = (request.body || {}) as { account_id?: string; relay_state?: string };
    const accountId = String(body.account_id || '').trim();
    if (!accountId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'account_id is required' },
      });
    }
    const account = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [accountId]);
    if (account.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'account not found' },
      });
    }

    const config = await loadOrgSsoConfig(pool, accountId);
    if (!config.enabled || !config.saml.enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_DISABLED', message: 'SAML is not enabled for this account' },
      });
    }
    const entrypoint = String(config.saml.entrypoint_url || '').trim();
    const callbackUrl = String(config.saml.callback_url || '').trim();
    const entityId = String(config.saml.entity_id || '').trim();
    if (!entrypoint || !callbackUrl || !entityId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'SAML entrypoint_url, entity_id, and callback_url are required' },
      });
    }

    const requestId = `_${uuidv7()}`;
    const issueInstant = new Date().toISOString();
    const authnRequest = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${entrypoint}" AssertionConsumerServiceURL="${callbackUrl}">`,
      `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${entityId}</saml:Issuer>`,
      '<samlp:NameIDPolicy AllowCreate="true"/>',
      '</samlp:AuthnRequest>',
    ].join('');
    const samlRequest = Buffer.from(authnRequest, 'utf8').toString('base64');
    const relayState = String(body.relay_state || base64UrlEncode(randomBytes(16))).trim();
    const redirectUrl = new URL(entrypoint);
    redirectUrl.searchParams.set('SAMLRequest', samlRequest);
    redirectUrl.searchParams.set('RelayState', relayState);

    return reply.send({
      success: true,
      data: {
        provider: 'saml',
        account_id: accountId,
        redirect_url: redirectUrl.toString(),
        relay_state: relayState,
      },
    });
  });

  app.post('/v1/auth/sso/saml/callback', async (request: any, reply) => {
    const body = (request.body || {}) as {
      account_id?: string;
      saml_response?: string;
      relay_state?: string;
    };
    const accountId = String(body.account_id || '').trim();
    const samlResponse = String(body.saml_response || '').trim();
    if (!accountId || !samlResponse) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'account_id and saml_response are required' },
      });
    }
    const account = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [accountId]);
    if (account.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'account not found' },
      });
    }
    const config = await loadOrgSsoConfig(pool, accountId);
    if (!config.enabled || !config.saml.enabled) {
      return reply.status(403).send({
        success: false,
        error: { code: 'SSO_DISABLED', message: 'SAML is not enabled for this account' },
      });
    }

    let xml = '';
    try {
      xml = decodeBase64Utf8(samlResponse);
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'SAML_DECODE_FAILED', message: 'Invalid base64 saml_response' },
      });
    }

    const hasXmlSignature = /<(?:\w+:)?Signature\b[\s\S]*?<\/(?:\w+:)?Signature>/i.test(xml);
    const configuredCertBody = extractPemBody(String(config.saml.cert_pem || ''));
    if (SSO_STRICT_ASSERTION_VALIDATION && !hasXmlSignature) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SAML_SIGNATURE_REQUIRED', message: 'SAML assertion must include XML signature' },
      });
    }
    if (configuredCertBody) {
      const certMatch = xml.match(/<(?:\w+:)?X509Certificate[^>]*>([^<]*(?:<(?!\/(?:\w+:)?X509Certificate>)[^<]*)*)<\/(?:\w+:)?X509Certificate>/i);
      const assertionCertBody = certMatch ? String(certMatch[1] || '').replace(/\s+/g, '').trim() : '';
      if (SSO_STRICT_ASSERTION_VALIDATION && !assertionCertBody) {
        return reply.status(401).send({
          success: false,
          error: { code: 'SAML_CERT_REQUIRED', message: 'SAML assertion certificate is required' },
        });
      }
      if (assertionCertBody && configuredCertBody !== assertionCertBody) {
        return reply.status(401).send({
          success: false,
          error: { code: 'SAML_CERT_MISMATCH', message: 'SAML assertion certificate does not match configured IdP certificate' },
        });
      }
    }

    const parsed = parseSamlAssertionXml(xml);
    if (!parsed.subject) {
      return reply.status(400).send({
        success: false,
        error: { code: 'SAML_ASSERTION_INVALID', message: 'SAML assertion missing subject (NameID)' },
      });
    }
    const groups = parsed.groups;

    const completion = await completeSsoLogin({
      accountId,
      provider: 'saml',
      subject: parsed.subject,
      email: parsed.email,
      displayName: parsed.displayName,
      username: undefined,
      groups,
      attributes: {
        relay_state: String(body.relay_state || '').trim() || undefined,
        ...parsed.attributes,
      },
      reply,
      request,
      config,
    });

    return reply.send({
      success: true,
      data: {
        provider: 'saml',
        user_id: completion.userId,
        username: completion.username,
        role: 'user',
        membership_role: completion.membershipRole,
        active_organization_id: accountId,
        access_token: completion.sessionId,
        refresh_token: completion.refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  app.patch('/v1/users/me/password', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['current_password', 'new_password'],
        additionalProperties: false,
        properties: {
          current_password: { type: 'string', minLength: 1 },
          new_password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { current_password?: string; new_password?: string };
    const currentPassword = String(body.current_password || '');
    const newPassword = String(body.new_password || '');
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'current_password and new_password are required' },
      });
    }

    const userRes = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [request.userId]);
    if (userRes.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }
    const currentHash = String(userRes.rows[0].password_hash || '');
    const valid = await bcrypt.compare(currentPassword, currentHash);
    if (!valid) {
      return reply.status(401).send({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Current password is incorrect' },
      });
    }

    const nextHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE users
       SET password_hash = $2, updated_at = NOW()
       WHERE id = $1`,
      [request.userId, nextHash],
    );

    // Revoke ALL sessions (including the current one) to prevent session fixation.
    // A compromised session must not survive a credential change.
    const revokeRes = await pool.query(
      `UPDATE sessions
       SET status = 'revoked'
       WHERE user_id = $1
         AND status IN ('active', 'refresh', 'pending_totp')
       RETURNING id`,
      [request.userId],
    );
    const revokedSessionIds = (revokeRes.rows || []).map((row) => String(row.id || '').trim()).filter(Boolean);
    await revokeSsoSessionLinksBySessionIds(pool, revokedSessionIds);

    // Issue a fresh session pair so the caller remains authenticated.
    const newSessionId = await createAccessSession(pool, request.userId);
    const newRefreshToken = await createRefreshSession(pool, request.userId);
    reply.setCookie(SESSION_COOKIE, newSessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
    reply.setCookie(REFRESH_TOKEN_COOKIE, newRefreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));

    reply.send({
      success: true,
      data: {
        password_updated: true,
        session_id: newSessionId,
        refresh_token: newRefreshToken,
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  app.delete('/v1/users/me', { preHandler: requireAuth }, async (request: any, reply) => {
    const userId = String(request.userId || '').trim();
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }

    const tombstoneUsername = `deleted_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}_${Date.now()}`;
    const randomPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    await pool.query(
      `UPDATE sessions SET status = 'revoked' WHERE user_id = $1 AND status IN ('active', 'refresh', 'pending_totp')`,
      [userId],
    );
    await revokeSsoSessionLinksByUserId(pool, userId);
    await pool.query(`DELETE FROM mobile_push_tokens WHERE user_id = $1`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM chat_members WHERE user_id = $1`, [userId]).catch(() => {});

    try {
      await pool.query(
        `UPDATE users
         SET username = $2,
             display_name = 'Deleted User',
             password_hash = $3,
             totp_secret_enc = NULL,
             active_organization_id = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, tombstoneUsername, passwordHash],
      );
    } catch (err) {
      if (!isSchemaCompatError(err)) throw err;
      await pool.query(
        `UPDATE users
         SET username = $2,
             display_name = 'Deleted User',
             password_hash = $3,
             totp_secret_enc = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, tombstoneUsername, passwordHash],
      );
    }

    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    reply.send({ success: true, data: { deleted: true, anonymized: true } });
  });

  app.get('/v1/auth/google/callback', async (request: any, reply) => {
    const query = (request.query || {}) as { code?: string; state?: string };
    const code = String(query.code || '').trim();
    const state = String(query.state || '').trim();
    if (!code || !state) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Missing code or state' },
      });
    }

    const resolvedState = await consumeGoogleCalendarOAuthState(state);
    if (!resolvedState.valid || !resolvedState.userId || !resolvedState.organizationId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Google OAuth state is invalid or expired' },
      });
    }
    const sessionUserId = String(request.userId || request.user?.id || '').trim();
    if (!sessionUserId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }
    if (sessionUserId !== resolvedState.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'OAuth state user mismatch' },
      });
    }
    const sessionOrgId = String(request.orgId || '').trim();
    if (sessionOrgId && sessionOrgId !== resolvedState.organizationId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'OAuth state organization mismatch' },
      });
    }

    try {
      const completion = await completeGoogleCalendarOAuth(
        pool,
        code,
        resolvedState.userId,
        resolvedState.organizationId,
      );
      return reply.redirect(`/?calendar_account=${completion.accountId}&status=success`);
    } catch (err) {
      logger.error('Failed to handle Google OAuth callback', { error: String(err) });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to handle Google OAuth callback' },
      });
    }
  });

  // ─── POST /v1/auth/bootstrap ───
  // One-time bootstrap: only available when no users exist yet.
  app.post('/v1/auth/bootstrap', async (request, reply) => {
    const body = (request.body as {
      username?: string;
      password?: string;
      display_name?: string;
      enable_totp?: boolean;
    }) || {};

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const displayName = String(body.display_name || username || '').trim();
    const enableTotp = body.enable_totp !== false;

    if (!username || !password) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'username and password are required' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv7();
    const bootstrapOrgId = uuidv7();
    const totpSecret = enableTotp ? authenticator.generateSecret() : null;
    await pool.query('BEGIN');
    try {
      const lockRes = await pool.query(
        `SELECT pg_try_advisory_xact_lock($1) AS locked`,
        [AUTH_BOOTSTRAP_ADVISORY_LOCK_KEY],
      );
      if (!lockRes.rows[0]?.locked) {
        await pool.query('ROLLBACK');
        reply.status(409).send({
          success: false,
          error: { code: 'BOOTSTRAP_IN_PROGRESS', message: 'Bootstrap is already in progress' },
        });
        return;
      }

      const usersCount = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
      if (Number(usersCount.rows[0]?.total || 0) > 0) {
        await pool.query('ROLLBACK');
        reply.status(409).send({
          success: false,
          error: { code: 'BOOTSTRAP_LOCKED', message: 'Bootstrap is only allowed when no users exist' },
        });
        return;
      }

      await pool.query(
        `INSERT INTO users (id, username, display_name, role, password_hash, totp_secret_enc, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', $4, $5, NOW(), NOW())`,
        [userId, username, displayName, passwordHash, totpSecret],
      );

      const orgSlugRaw = String(username || `bootstrap-${userId.slice(0, 8)}`).toLowerCase();
      let orgSlugBase = '';
      { let prev = true; for (const ch of orgSlugRaw) { if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) { orgSlugBase += ch; prev = false; } else if (!prev) { orgSlugBase += '-'; prev = true; } } if (orgSlugBase.endsWith('-')) orgSlugBase = orgSlugBase.slice(0, -1); }
      orgSlugBase = orgSlugBase.slice(0, 40) || `bootstrap-${userId.slice(0, 8)}`;
      const orgSlug = `${orgSlugBase}-${Date.now().toString(36)}`.slice(0, 48);
      const orgName = `${displayName || username} Workspace`.trim().slice(0, 120) || 'Sven Workspace';

      await pool.query(
        `INSERT INTO organizations (id, slug, name, owner_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [bootstrapOrgId, orgSlug, orgName, userId],
      );
      await pool.query(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'owner', 'active', NOW(), NOW())`,
        [uuidv7(), bootstrapOrgId, userId],
      );
      await pool.query(
        `UPDATE users
         SET active_organization_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [userId, bootstrapOrgId],
      );

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK').catch(() => {});
      throw error;
    }

    const otpAuthUrl = totpSecret ? authenticator.keyuri(username, 'Sven', totpSecret) : null;
    logger.info('Bootstrap admin created', { user_id: userId, username });
    reply.status(201).send({
      success: true,
      data: {
        user_id: userId,
        username,
        role: 'admin',
        active_organization_id: bootstrapOrgId,
        totp_enabled: Boolean(totpSecret),
        totp_secret: totpSecret,
        otpauth_url: otpAuthUrl,
      },
    });
  });

  app.get('/v1/auth/tailscale/bootstrap', async (request: any, reply) => {
    const redirectPath = toSafeLocalRedirectPath(request?.query?.redirect);
    const loginRedirect = `/login?redirect=${encodeURIComponent(redirectPath)}`;

    if (!await isTailscaleIdentityBootstrapAllowed(pool)) {
      return reply.redirect(loginRedirect);
    }
    if (!requestCarriesTailscaleServeHeaders(request)) {
      return reply.redirect(loginRedirect);
    }

    const headerLogin = normalizeTailscaleLogin(request.headers?.[TAILSCALE_LOGIN_HEADER]);
    const forwardedFor = String(request.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
    const whoisIdentity = await readTailscaleWhoisIdentity(forwardedFor);
    if (!whoisIdentity || normalizeTailscaleLogin(whoisIdentity.login) !== headerLogin) {
      return reply.redirect(loginRedirect);
    }

    const user = await resolveTailscaleBootstrapUser(pool, whoisIdentity.login);
    if (!user) {
      return reply.redirect(loginRedirect);
    }

    const sessionId = await createAccessSession(pool, user.userId);
    const refreshToken = await createRefreshSession(pool, user.userId);
    reply.setCookie(SESSION_COOKIE, sessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));
    logger.info('Tailscale bootstrap session issued', { user_id: user.userId, username: user.username });
    return reply.redirect(redirectPath);
  });

  // ─── POST /v1/auth/login ───
  app.post('/v1/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: 60_000 } },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        additionalProperties: false,
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const clientIp = request.ip || 'unknown';
    const { username, password } = request.body as { username: string; password: string };
    const authAttemptKey = buildAuthAttemptKey(clientIp, username);
    await setAuthRateLimitHeaders(reply, pool, authAttemptKey);

    // Brute-force lockout check
    if (await isLockedOut(pool, authAttemptKey)) {
      await setAuthRateLimitHeaders(reply, pool, authAttemptKey);
      return reply.status(429).send({
        success: false,
        error: {
          code: 'LOCKED_OUT',
          message: 'Too many failed login attempts. Please try again later.',
        },
      });
    }

    const result = await pool.query(
      `SELECT id, username, role, password_hash, totp_secret_enc, active_organization_id
       FROM users
       WHERE username = $1`,
      [username],
    );

    const user = result.rows.length > 0 ? result.rows[0] : null;
    const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_BCRYPT_HASH);
    if (!user || !valid) {
      await recordFailedLogin(pool, authAttemptKey);
      if (await isLockedOut(pool, authAttemptKey)) {
        await setAuthRateLimitHeaders(reply, pool, authAttemptKey);
        return reply.status(429).send({
          success: false,
          error: {
            code: 'LOCKED_OUT',
            message: 'Too many failed login attempts. Please try again later.',
          },
        });
      }
      await setAuthRateLimitHeaders(reply, pool, authAttemptKey);
      reply.status(401).send({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
      });
      return;
    }

    const activeOrgId = String(user.active_organization_id || '').trim();
    if (activeOrgId) {
      const ssoConfig = await loadOrgSsoConfig(pool, activeOrgId);
      if (ssoConfig.enabled && !ssoConfig.fallback_local_auth) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'LOCAL_AUTH_DISABLED',
            message: 'Local auth is disabled for this account. Use SSO to continue.',
          },
        });
        return;
      }
    }

    // C2.1: Admin accounts can require TOTP enrollment based on policy.
    // Default: required in production, optional in non-production for local testing.
    const adminTotpRequired = await isAdminTotpEnrollmentRequired(pool);
    if (adminTotpRequired && user.role === 'admin' && !user.totp_secret_enc) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'ADMIN_TOTP_REQUIRED',
          message: 'Admin account requires TOTP enrollment before login.',
        },
      });
      return;
    }

    // Successful login — reset failed attempt counter
    await resetFailedLogin(pool, authAttemptKey);
    await setAuthRateLimitHeaders(reply, pool, authAttemptKey);

    // If TOTP is configured, require second factor
    if (user.totp_secret_enc) {
      // Create a pre-session token that requires TOTP verification
      const preSessionId = uuidv7();
      await pool.query(
        `INSERT INTO sessions (id, user_id, status, created_at, expires_at)
         VALUES ($1, $2, 'pending_totp', NOW(), NOW() + INTERVAL '5 minutes')`,
        [preSessionId, user.id],
      );

      reply.send({
        success: true,
        data: { requires_totp: true, pre_session_id: preSessionId },
      });
      return;
    }

    // No TOTP — create access + refresh sessions
    const sessionId = await createAccessSession(pool, user.id);
    const refreshToken = await createRefreshSession(pool, user.id);

    reply.setCookie(SESSION_COOKIE, sessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));

    logger.info('User logged in', { user_id: user.id, username: user.username });
    reply.send({
      success: true,
      data: {
        user_id: user.id,
        username: user.username,
        role: user.role,
        access_token: sessionId,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  // ─── POST /v1/auth/totp/verify ───
  app.post('/v1/auth/totp/verify', { config: { rateLimit: { max: 10, timeWindow: 60_000 } } }, async (request, reply) => {
    const { pre_session_id, code } = request.body as {
      pre_session_id: string;
      code: string;
    };

    const totpAttemptKey = `totp:${String(pre_session_id || '').slice(0, 128)}`;
    if (await isLockedOut(pool, totpAttemptKey)) {
      await setAuthRateLimitHeaders(reply, pool, totpAttemptKey);
      reply.status(429).send({
        success: false,
        error: { code: 'TOTP_RATE_LIMITED', message: 'Too many TOTP attempts. Try again later.' },
      });
      return;
    }

    const sessionRes = await pool.query(
      `SELECT s.id, s.user_id, u.totp_secret_enc, u.username, u.role
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.status = 'pending_totp' AND s.expires_at > NOW()`,
      [pre_session_id],
    );

    if (sessionRes.rows.length === 0) {
      reply.status(401).send({
        success: false,
        error: { code: 'INVALID_SESSION', message: 'Invalid or expired pre-session' },
      });
      return;
    }

    const session = sessionRes.rows[0];

    // Verify TOTP
    const isValid = authenticator.check(code, session.totp_secret_enc);
    if (!isValid) {
      const failState = await recordFailedLogin(pool, totpAttemptKey);
      if (failState.count >= MAX_TOTP_ATTEMPTS) {
        await pool.query(
          `UPDATE sessions SET status = 'revoked' WHERE id = $1 AND status = 'pending_totp'`,
          [pre_session_id],
        );
        logger.warn('TOTP session revoked after max attempts', { user_id: session.user_id });
      }
      await setAuthRateLimitHeaders(reply, pool, totpAttemptKey);
      reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOTP', message: 'Invalid TOTP code' },
      });
      return;
    }

    await resetFailedLogin(pool, totpAttemptKey);

    // Upgrade pre-session to access token + mint refresh token
    await pool.query(
      `UPDATE sessions SET status = 'active', expires_at = NOW() + INTERVAL '${ACCESS_TOKEN_MAX_AGE} seconds'
       WHERE id = $1`,
      [pre_session_id],
    );
    const refreshToken = await createRefreshSession(pool, session.user_id);

    reply.setCookie(SESSION_COOKIE, pre_session_id, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));

    logger.info('TOTP verified, session active', { user_id: session.user_id });
    reply.send({
      success: true,
      data: {
        user_id: session.user_id,
        username: session.username,
        role: session.role,
        access_token: pre_session_id,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  // ─── POST /v1/auth/logout ───
  app.post('/v1/auth/logout', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
      },
    },
  }, async (request, reply) => {
    const principal = await resolveActiveSessionPrincipal(
      pool,
      request.cookies?.[SESSION_COOKIE],
      request.headers?.authorization,
    );
    if (!principal) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }

    const bearer = getBearerToken(request.headers?.authorization);
    const cookieSessionId = String(request.cookies?.[SESSION_COOKIE] || '').trim();
    const cookieRefreshToken = String(request.cookies?.[REFRESH_TOKEN_COOKIE] || '').trim();
    if (!enforceCsrfOriginForCookieAuth(request, reply, {
      routeId: 'auth.logout',
      cookieSignals: [cookieSessionId, cookieRefreshToken],
    })) {
      return;
    }
    const sessionIds = Array.from(
      new Set([cookieSessionId, cookieRefreshToken, bearer].map((value) => value.trim()).filter(Boolean)),
    );

    let revokedCount = 0;
    for (const sessionId of sessionIds) {
      const result = await pool.query(`UPDATE sessions SET status = 'revoked' WHERE id = $1`, [
        sessionId,
      ]);
      revokedCount += Number(result.rowCount || 0);
    }

    await revokeSsoSessionLinksBySessionIds(pool, sessionIds);

    if (cookieSessionId) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
    }
    if (cookieRefreshToken) {
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    }

    logger.info('Session logout processed', {
      user_id: principal.userId,
      sessions_seen: sessionIds.length,
      sessions_revoked: revokedCount,
    });

    reply.send({ success: true, data: { sessions_revoked: revokedCount } });
  });

  // ─── POST /v1/auth/logout-all ───
  // Revokes all active sessions for the authenticated user.
  app.post('/v1/auth/logout-all', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
      },
    },
  }, async (request, reply) => {
    const principal = await resolveActiveSessionPrincipal(pool, request.cookies?.[SESSION_COOKIE], request.headers?.authorization);
    if (!principal) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }
    const cookieSessionId = String(request.cookies?.[SESSION_COOKIE] || '').trim();
    const cookieRefreshToken = String(request.cookies?.[REFRESH_TOKEN_COOKIE] || '').trim();
    if (!enforceCsrfOriginForCookieAuth(request, reply, {
      routeId: 'auth.logout_all',
      cookieSignals: [cookieSessionId, cookieRefreshToken],
    })) {
      return;
    }

    const revokeRes = await pool.query(
      `UPDATE sessions
       SET status = 'revoked'
       WHERE user_id = $1 AND status IN ('active', 'refresh', 'pending_totp')`,
      [principal.userId],
    );
    const revokedCount = Number(revokeRes.rowCount || 0);
    await revokeSsoSessionLinksByUserId(pool, principal.userId);

    if (principal.usedCookie) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    }

    logger.info('Session logout-all processed', {
      user_id: principal.userId,
      sessions_revoked: revokedCount,
    });
    reply.send({ success: true, data: { sessions_revoked: revokedCount } });
  });

  // ─── POST /v1/auth/refresh ───
  // Rotates a valid session id and revokes the previous one.
  app.post('/v1/auth/refresh', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          refresh_token: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const cookieRefreshToken = String(request.cookies?.[REFRESH_TOKEN_COOKIE] || '').trim();
    const body = (request.body || {}) as { refresh_token?: string; refreshToken?: string };
    const bodyToken = String(body.refresh_token || body.refreshToken || '').trim();
    const sessionId = bodyToken || cookieRefreshToken;
    if (!enforceCsrfOriginForCookieAuth(request, reply, {
      routeId: 'auth.refresh',
      cookieSignals: [cookieRefreshToken],
    })) {
      return;
    }

    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Refresh token required' },
      });
    }

    const sessionRes = await pool.query(
      `SELECT user_id, status
       FROM sessions
       WHERE id = $1 AND status = 'refresh' AND expires_at > NOW()`,
      [sessionId],
    );
    if (sessionRes.rows.length === 0) {
      return reply.status(401).send({
        success: false,
        error: { code: 'REFRESH_EXPIRED', message: 'Refresh token expired or invalid' },
      });
    }

    const userId = String(sessionRes.rows[0].user_id);
    const refreshedSessionId = await createAccessSession(pool, userId);
    const refreshedRefreshToken = await createRefreshSession(pool, userId);
    await pool.query(`UPDATE sessions SET status = 'revoked' WHERE id = $1`, [sessionId]);
    await revokeSsoSessionLinksBySessionIds(pool, [sessionId]);
    await rotateSsoSessionLinksOnRefresh(pool, sessionId, refreshedSessionId, refreshedRefreshToken);

    if (cookieRefreshToken) {
      reply.setCookie(SESSION_COOKIE, refreshedSessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
      reply.setCookie(REFRESH_TOKEN_COOKIE, refreshedRefreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));
    }

    reply.send({
      success: true,
      data: {
        access_token: refreshedSessionId,
        refresh_token: refreshedRefreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE,
      },
    });
  });

  // ─── GET /v1/auth/me ───
  app.get('/v1/auth/me', async (request, reply) => {
    const bearer = getBearerToken(request.headers?.authorization);
    const cookieSessionId = String(request.cookies?.[SESSION_COOKIE] || '').trim();
    const sessionId = cookieSessionId || bearer;
    if (!sessionId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
    }
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.display_name,
         u.bio,
         u.avatar_url,
         u.timezone,
         u.status_emoji,
         u.status_text,
         u.role,
         u.created_at,
         u.active_organization_id,
         o.name AS active_organization_name,
         o.slug AS active_organization_slug
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN organizations o ON o.id = u.active_organization_id
       WHERE s.id = $1 AND s.status = 'active' AND s.expires_at > NOW()`,
      [sessionId],
    );
    if (result.rows.length === 0) {
      return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
    }
    await touchSsoSessionLinks(pool, [sessionId]);
    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── GET /v1/users/me/profile ───
  app.get('/v1/users/me/profile', { preHandler: requireAuth }, async (request: any, reply) => {
    const res = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.display_name,
         u.bio,
         u.avatar_url,
         u.timezone,
         u.status_emoji,
         u.status_text,
         u.role,
         u.created_at,
         u.active_organization_id,
         o.name AS active_organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.active_organization_id
       WHERE u.id = $1`,
      [request.userId],
    );
    if (res.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    reply.send({ success: true, data: res.rows[0] });
  });

  // ─── PATCH /v1/users/me ───
  app.patch('/v1/users/me', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          display_name: { type: 'string', minLength: 1, maxLength: 256 },
          bio: { type: 'string', maxLength: 500 },
          avatar_url: { type: 'string', maxLength: 2048 },
          timezone: { type: 'string', maxLength: 64 },
          status_emoji: { type: 'string', maxLength: 8 },
          status_text: { type: 'string', maxLength: 128 },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];

    const allowedFields = ['display_name', 'bio', 'avatar_url', 'timezone', 'status_emoji', 'status_text'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        params.push(String(body[field]));
        sets.push(`${field} = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'At least one field required' },
      });
    }

    params.push(request.userId);
    const res = await pool.query(
      `UPDATE users
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, username, display_name, bio, avatar_url, timezone, status_emoji, status_text, role, created_at`,
      params,
    );
    if (res.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    reply.send({ success: true, data: res.rows[0] });
  });

  // ─── GET /v1/users/me/notification-preferences ───
  const NOTIF_CHANNELS = ['messages', 'approvals', 'reminders', 'agents', 'calls', 'memory'];

  app.get('/v1/users/me/notification-preferences', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId = request.userId;

    // Per-channel preferences
    const channelsRes = await pool.query(
      `SELECT channel, enabled, sound, vibrate
       FROM notification_preferences
       WHERE user_id = $1
       ORDER BY channel`,
      [userId],
    );
    const channelMap: Record<string, { enabled: boolean; sound: string; vibrate: boolean }> = {};
    for (const row of channelsRes.rows) {
      channelMap[row.channel] = { enabled: row.enabled, sound: row.sound, vibrate: row.vibrate };
    }
    // Fill defaults for any missing channels
    const channels = NOTIF_CHANNELS.map((ch) => ({
      channel: ch,
      enabled: channelMap[ch]?.enabled ?? true,
      sound: channelMap[ch]?.sound ?? 'default',
      vibrate: channelMap[ch]?.vibrate ?? true,
    }));

    // Global DND settings from users table
    const userRes = await pool.query(
      `SELECT dnd_enabled, dnd_start_hour, dnd_start_minute, dnd_end_hour, dnd_end_minute, notif_sound
       FROM users WHERE id = $1`,
      [userId],
    );
    const u = userRes.rows[0] || {};

    reply.send({
      success: true,
      data: {
        channels,
        dnd: {
          enabled: u.dnd_enabled ?? false,
          start_hour: u.dnd_start_hour ?? 22,
          start_minute: u.dnd_start_minute ?? 0,
          end_hour: u.dnd_end_hour ?? 7,
          end_minute: u.dnd_end_minute ?? 0,
        },
        global_sound: u.notif_sound ?? 'default',
      },
    });
  });

  // ─── PUT /v1/users/me/notification-preferences ───
  app.put('/v1/users/me/notification-preferences', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'object',
              required: ['channel', 'enabled'],
              properties: {
                channel: { type: 'string', maxLength: 64 },
                enabled: { type: 'boolean' },
                sound: { type: 'string', maxLength: 32 },
                vibrate: { type: 'boolean' },
              },
            },
          },
          dnd: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              start_hour: { type: 'integer', minimum: 0, maximum: 23 },
              start_minute: { type: 'integer', minimum: 0, maximum: 59 },
              end_hour: { type: 'integer', minimum: 0, maximum: 23 },
              end_minute: { type: 'integer', minimum: 0, maximum: 59 },
            },
          },
          global_sound: { type: 'string', maxLength: 32 },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId = request.userId;
    const body = (request.body || {}) as {
      channels?: Array<{ channel: string; enabled: boolean; sound?: string; vibrate?: boolean }>;
      dnd?: { enabled?: boolean; start_hour?: number; start_minute?: number; end_hour?: number; end_minute?: number };
      global_sound?: string;
    };

    // Upsert per-channel prefs
    if (body.channels && Array.isArray(body.channels)) {
      for (const ch of body.channels) {
        if (!NOTIF_CHANNELS.includes(ch.channel)) continue;
        await pool.query(
          `INSERT INTO notification_preferences (user_id, channel, enabled, sound, vibrate)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, channel)
           DO UPDATE SET enabled = $3, sound = $4, vibrate = $5`,
          [userId, ch.channel, ch.enabled, ch.sound ?? 'default', ch.vibrate ?? true],
        );
      }
    }

    // Update DND + global sound on users table
    const dndSets: string[] = [];
    const dndParams: unknown[] = [];
    if (body.dnd) {
      if (body.dnd.enabled !== undefined) { dndParams.push(body.dnd.enabled); dndSets.push(`dnd_enabled = $${dndParams.length}`); }
      if (body.dnd.start_hour !== undefined) { dndParams.push(body.dnd.start_hour); dndSets.push(`dnd_start_hour = $${dndParams.length}`); }
      if (body.dnd.start_minute !== undefined) { dndParams.push(body.dnd.start_minute); dndSets.push(`dnd_start_minute = $${dndParams.length}`); }
      if (body.dnd.end_hour !== undefined) { dndParams.push(body.dnd.end_hour); dndSets.push(`dnd_end_hour = $${dndParams.length}`); }
      if (body.dnd.end_minute !== undefined) { dndParams.push(body.dnd.end_minute); dndSets.push(`dnd_end_minute = $${dndParams.length}`); }
    }
    if (body.global_sound !== undefined) { dndParams.push(body.global_sound); dndSets.push(`notif_sound = $${dndParams.length}`); }

    if (dndSets.length > 0) {
      dndParams.push(userId);
      await pool.query(
        `UPDATE users SET ${dndSets.join(', ')}, updated_at = NOW() WHERE id = $${dndParams.length}`,
        dndParams,
      );
    }

    reply.send({ success: true });
  });

  // ─── GET /v1/users/me/theme-preferences ───
  app.get('/v1/users/me/theme-preferences', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const userId = request.userId;
    const { rows } = await pool.query(
      `SELECT theme_prefs FROM users WHERE id = $1`,
      [userId],
    );
    const prefs = rows[0]?.theme_prefs ?? {};
    reply.send({ success: true, data: prefs });
  });

  // ─── PUT /v1/users/me/theme-preferences ───
  app.put('/v1/users/me/theme-preferences', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        properties: {
          visual_mode: { type: 'string', enum: ['classic', 'cinematic'] },
          accent_preset: { type: 'string' },
          custom_accent_hex: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          font_family: { type: 'string', maxLength: 64 },
          text_scale: { type: 'number', minimum: 0.5, maximum: 2.0 },
          ui_density: { type: 'string', enum: ['compact', 'comfortable', 'spacious'] },
          high_contrast: { type: 'boolean' },
          color_blind_mode: { type: 'boolean' },
          reduce_transparency: { type: 'boolean' },
          motion_level: { type: 'string', enum: ['full', 'reduced', 'off'] },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId;
    const body = request.body as Record<string, unknown>;
    // Merge incoming keys into existing prefs (partial update).
    const { rows: existing } = await pool.query(
      `SELECT theme_prefs FROM users WHERE id = $1`,
      [userId],
    );
    const current = (existing[0]?.theme_prefs ?? {}) as Record<string, unknown>;
    const merged = { ...current, ...body };
    await pool.query(
      `UPDATE users SET theme_prefs = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(merged), userId],
    );
    reply.send({ success: true, data: merged });
  });

  // ─── GET /v1/users/me/organizations ───
  app.get('/v1/users/me/organizations', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const userId = request.userId;
    const { rows } = await pool.query(
      `SELECT o.id, o.slug, o.name, o.owner_user_id, om.role, om.status,
              o.created_at, o.updated_at
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 AND om.status = 'active'
       ORDER BY o.name ASC`,
      [userId],
    );
    // Include which org is active
    const activeRes = await pool.query(
      `SELECT active_organization_id FROM users WHERE id = $1`,
      [userId],
    );
    const activeOrgId = activeRes.rows[0]?.active_organization_id ?? null;
    reply.send({
      success: true,
      data: {
        organizations: rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          owner_user_id: r.owner_user_id,
          role: r.role,
          status: r.status,
          is_active: r.id === activeOrgId,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
        active_organization_id: activeOrgId,
      },
    });
  });

  // ─── PUT /v1/users/me/active-organization ───
  app.put('/v1/users/me/active-organization', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['organization_id'],
        properties: {
          organization_id: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId;
    const { organization_id: orgId } = request.body as { organization_id: string };
    // Verify membership
    const { rows: membership } = await pool.query(
      `SELECT id FROM organization_memberships
       WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
      [userId, orgId],
    );
    if (membership.length === 0) {
      return reply.status(403).send({
        success: false,
        error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this organization' },
      });
    }
    await pool.query(
      `UPDATE users SET active_organization_id = $1, updated_at = NOW() WHERE id = $2`,
      [orgId, userId],
    );
    reply.send({ success: true, data: { active_organization_id: orgId } });
  });

  // ─── GET /v1/users/me/activity-feed ───
  app.get('/v1/users/me/activity-feed', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const userId = request.userId;
    const { limit: rawLimit, before, unread_only: unreadOnly } = request.query as {
      limit?: string; before?: string; unread_only?: string;
    };
    const limit = Math.min(parseInt(rawLimit || '50', 10) || 50, 100);
    const params: unknown[] = [userId, limit];
    let whereExtra = '';
    if (before) {
      params.push(before);
      whereExtra += ` AND af.created_at < $${params.length}`;
    }
    if (unreadOnly === 'true') {
      whereExtra += ` AND af.read = FALSE`;
    }
    const { rows } = await pool.query(
      `SELECT af.id, af.event_type, af.title, af.body, af.resource_id,
              af.resource_type, af.metadata, af.read, af.created_at
       FROM activity_feed af
       WHERE af.user_id = $1${whereExtra}
       ORDER BY af.created_at DESC
       LIMIT $2`,
      params,
    );
    // Unread count
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS unread FROM activity_feed WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    reply.send({
      success: true,
      data: {
        events: rows,
        unread_count: countRows[0]?.unread ?? 0,
        has_more: rows.length === limit,
      },
    });
  });

  // ─── POST /v1/users/me/activity-feed/mark-read ───
  app.post('/v1/users/me/activity-feed/mark-read', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, maxItems: 100 },
          all: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId;
    const body = request.body as { ids?: string[]; all?: boolean };
    if (body.all) {
      await pool.query(
        `UPDATE activity_feed SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
        [userId],
      );
    } else if (body.ids && body.ids.length > 0) {
      // Parameterised IN clause
      const placeholders = body.ids.map((_, i) => `$${i + 2}`).join(', ');
      await pool.query(
        `UPDATE activity_feed SET read = TRUE WHERE user_id = $1 AND id IN (${placeholders})`,
        [userId, ...body.ids],
      );
    }
    reply.send({ success: true });
  });

  // ─── GET /v1/auth/token-exchange ───
  // Deep-link token exchange: validates a signed token and creates a session.
  // Tokens are HMAC-SHA256 signed: base64url(userId:expiry):signature
  app.get('/v1/auth/token-exchange', async (request, reply) => {
    const tokenExchangeDisabled = await isTokenExchangeDisabled(pool);
    if (tokenExchangeDisabled) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_DISABLED',
          message: 'Token exchange is disabled by gateway policy',
        },
      });
    }

    const { token, redirect: redirectPath } = request.query as { token: string; redirect?: string };
    const safeRedirectPath = normalizeTokenExchangeRedirectTarget(redirectPath);

    if (!token) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_TOKEN', message: 'Token required' } });
    }

    try {
      const { createHmac } = await import('crypto');
      const secret = String(process.env.DEEPLINK_SECRET || '').trim();
      if (isWeakTokenExchangeSecret(secret)) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'TOKEN_EXCHANGE_UNAVAILABLE',
            message: 'Token exchange secret is not configured or is too weak',
          },
        });
      }

      const parts = token.split('.');
      if (parts.length !== 2) throw new Error('Invalid token format');

      const [payloadB64, sig] = parts;
      const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');

      if (sig !== expectedSig) throw new Error('Invalid signature');

      const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const [userId, expiryStr] = payload.split(':');
      const expiry = parseInt(expiryStr, 10);

      if (Date.now() > expiry) throw new Error('Token expired');

      // Verify user exists
      const userRes = await pool.query(`SELECT id, role FROM users WHERE id = $1`, [userId]);
      if (userRes.rows.length === 0) throw new Error('User not found');

      const consumeStatus = await consumeTokenExchangeTokenOnce(pool, token, userId, expiry);
      if (consumeStatus === 'unavailable') {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'TOKEN_EXCHANGE_UNAVAILABLE',
            message: 'Token exchange storage is unavailable',
          },
        });
      }
      if (consumeStatus === 'replay') throw new Error('Token already consumed');

      // Create access + refresh sessions
      const sessionId = await createAccessSession(pool, userId);
      const refreshToken = await createRefreshSession(pool, userId);

      reply.setCookie(SESSION_COOKIE, sessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
      reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE, request));

      logger.info('Deep-link token exchanged', { user_id: userId });
      reply.redirect(safeRedirectPath);
    } catch (err: any) {
      logger.warn('Token exchange failed', { err: err.message });
      reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: err.message } });
    }
  });

  // ─── POST /v1/auth/device/start ───
  app.post('/v1/auth/device/start', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          client_name: { type: 'string' },
          client_type: { type: 'string' },
          scope: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const startRateGate = consumeDeviceFlowRate(
      deviceStartRate,
      getDeviceFlowRateKey(request),
      DEVICE_START_RATE_MAX,
    );
    if (!startRateGate.allowed) {
      reply.header('Retry-After', String(startRateGate.retryAfterSec));
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many device start attempts, retry later' },
      });
    }

    const body = (request.body || {}) as {
      client_name?: string;
      client_type?: string;
      scope?: string;
    };
    const deviceCode = randomBytes(24).toString('hex');
    const userCode = generateUserCode();
    const id = uuidv7();
    await pool.query(
      `INSERT INTO device_codes (id, device_code, user_code, status, client_name, client_type, scope, expires_at, created_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, NOW() + INTERVAL '${DEVICE_CODE_TTL_SEC} seconds', NOW())`,
      [
        id,
        deviceCode,
        userCode,
        body.client_name || null,
        body.client_type || null,
        body.scope || null,
      ],
    );

    const baseUrl = process.env.AUTH_DEVICE_VERIFY_URL || (process.env.PUBLIC_BASE_URL || '').trim();
    const verificationUri = baseUrl ? `${baseUrl}/login?device=1` : '/login';
    const verificationUriComplete = baseUrl
      ? `${baseUrl}/login?device=1&user_code=${encodeURIComponent(userCode)}`
      : `/login?device=1&user_code=${encodeURIComponent(userCode)}`;

    reply.send({
      success: true,
      data: {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUriComplete,
        expires_in: DEVICE_CODE_TTL_SEC,
        interval: DEVICE_CODE_POLL_SEC,
      },
    });
  });

  // ─── POST /v1/auth/device/confirm ───
  app.post('/v1/auth/device/confirm', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['user_code'],
        properties: {
          user_code: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const confirmRateGate = consumeDeviceFlowRate(
      deviceConfirmRate,
      getDeviceFlowRateKey(request),
      DEVICE_CONFIRM_RATE_MAX,
    );
    if (!confirmRateGate.allowed) {
      reply.header('Retry-After', String(confirmRateGate.retryAfterSec));
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many device confirm attempts, retry later' },
      });
    }

    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
    }
    if (!enforceCsrfOriginForCookieAuth(request, reply, {
      routeId: 'auth.device_confirm',
      cookieSignals: [sessionId],
    })) {
      return;
    }
    const userRes = await pool.query(
      `SELECT s.user_id FROM sessions s WHERE s.id = $1 AND s.status = 'active' AND s.expires_at > NOW()`,
      [sessionId],
    );
    if (userRes.rows.length === 0) {
      return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
    }
    const userId = userRes.rows[0].user_id;
    const { user_code } = request.body as { user_code?: string };
    if (!user_code) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'user_code is required' } });
    }

    const res = await pool.query(
      `UPDATE device_codes
       SET status = 'approved', user_id = $2, approved_at = NOW()
       WHERE user_code = $1 AND status = 'pending' AND expires_at > NOW()
       RETURNING id`,
      [user_code, userId],
    );
    if (res.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired code' } });
    }
    reply.send({ success: true, data: { approved: true } });
  });

  // ─── POST /v1/auth/device/token ───
  app.post('/v1/auth/device/token', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['device_code'],
        properties: {
          device_code: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tokenRateGate = consumeDeviceFlowRate(
      deviceTokenRate,
      getDeviceFlowRateKey(request),
      DEVICE_TOKEN_RATE_MAX,
    );
    if (!tokenRateGate.allowed) {
      reply.header('Retry-After', String(tokenRateGate.retryAfterSec));
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many device token attempts, retry later' },
      });
    }

    const { device_code } = request.body as { device_code?: string };
    if (!device_code) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'device_code is required' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, status, user_id, expires_at
         FROM device_codes
         WHERE device_code = $1
         FOR UPDATE`,
        [device_code],
      );
      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Device code not found' } });
      }
      const row = res.rows[0];
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await client.query('ROLLBACK');
        logger.info('device/token: expired', { device_code });
        return reply.status(410).send({ success: false, error: { code: 'EXPIRED', message: 'Device code expired' } });
      }
      if (row.status !== 'approved') {
        await client.query('ROLLBACK');
        logger.info('device/token: not approved yet', { device_code, status: row.status });
        return reply.send({ success: true, data: { status: row.status } });
      }
      if (!row.user_id) {
        await client.query('ROLLBACK');
        logger.error('device/token: approved but no user assigned', { device_code, row });
        return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'No user assigned' } });
      }

      const consumeRes = await client.query(
        `UPDATE device_codes
         SET status = 'consumed'
         WHERE id = $1
           AND status = 'approved'
         RETURNING id`,
        [row.id],
      );
      if (consumeRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(409).send({
          success: false,
          error: { code: 'CONFLICT', message: 'Device code already consumed' },
        });
      }

      const sessionId = await createAccessSession(client, row.user_id);
      const refreshToken = await createRefreshSession(client, row.user_id);
      await client.query('COMMIT');

      logger.info('device/token: exchanged', { device_code, user_id: row.user_id, session_id: sessionId });

      return reply.send({
        success: true,
        data: {
          status: 'authorized',
          access_token: sessionId,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: ACCESS_TOKEN_MAX_AGE,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  });

  // Debug: expose device code row and latest session for debugging locally
  app.get('/v1/debug/device/:device_code', { preHandler: requireAdminAuth }, async (request, reply) => {
    if (!DEBUG_DEVICE_ENDPOINT) return reply.status(404).send({ success: false, error: { code: 'NOT_AVAILABLE', message: 'Debug endpoint disabled' } });
    if (!isDebugDeviceIpAllowed(request)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Debug endpoint IP not allowed' },
      });
    }
    const { device_code: dc } = request.params as { device_code: string };
    const res = await pool.query(`SELECT id, device_code, user_code, status, user_id, expires_at, approved_at, created_at FROM device_codes WHERE device_code = $1 LIMIT 1`, [dc]);
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Device code not found' } });
    const row = res.rows[0];
    let sessionSummary = null;
    if (row.user_id) {
      const sres = await pool.query(
        `SELECT status, created_at, expires_at
         FROM sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [row.user_id],
      );
      sessionSummary = {
        count: sres.rows.length,
        statuses: sres.rows.map((entry: any) => ({
          status: entry.status,
        })),
      };
    }
    reply.send({
      success: true,
      data: {
        device: {
          id: row.id,
          device_code_masked: maskDebugToken(row.device_code),
          user_code_masked: maskDebugToken(row.user_code),
          status: row.status,
          expires_at: row.expires_at,
          approved_at: row.approved_at,
          created_at: row.created_at,
        },
        recent_sessions: sessionSummary,
      },
    });
  });

  // ─── Multi-Account Management ─────────────────────────────────────

  // GET /v1/auth/accounts — list linked accounts for a device
  app.get('/v1/auth/accounts', { preHandler: requireAuth }, async (request: any, reply) => {
    const deviceId = String(request.headers['x-device-id'] || '').trim();
    if (!deviceId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'X-Device-Id header required' } });
    }
    const principal = await resolveActiveSessionPrincipal(pool, request.cookies?.[SESSION_COOKIE], request.headers?.authorization);
    if (!principal) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
    }
    const result = await pool.query(
      `SELECT la.id, la.user_id, u.username, u.display_name, la.label, la.avatar_url,
              la.is_active, la.last_used_at, la.created_at,
              la.pin_hash IS NOT NULL AS has_pin,
              la.remember_until
       FROM linked_accounts la
       JOIN users u ON u.id = la.user_id
       WHERE la.device_id = $1
       ORDER BY la.last_used_at DESC`,
      [deviceId],
    );
    reply.send({ success: true, data: { accounts: result.rows } });
  });

  // POST /v1/auth/accounts/link — add current session as a linked account on this device
  app.post('/v1/auth/accounts/link', { preHandler: requireAuth }, async (request: any, reply) => {
    const deviceId = String(request.headers['x-device-id'] || '').trim();
    if (!deviceId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'X-Device-Id header required' } });
    }
    const principal = await resolveActiveSessionPrincipal(pool, request.cookies?.[SESSION_COOKIE], request.headers?.authorization);
    if (!principal) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
    }
    const { label, pin } = (request.body || {}) as { label?: string; pin?: string };
    const effectiveLabel = String(label || '').trim().slice(0, 100);

    let pinHash: string | null = null;
    if (pin && pin.length >= 4 && pin.length <= 8) {
      const { createHash } = await import('crypto');
      pinHash = createHash('sha256').update(pin + principal.userId).digest('hex');
    }

    const result = await pool.query(
      `INSERT INTO linked_accounts (device_id, user_id, label, pin_hash, is_active, remember_until)
       VALUES ($1, $2, $3, $4, true, NOW() + INTERVAL '90 days')
       ON CONFLICT (device_id, user_id) DO UPDATE SET
         label = COALESCE(NULLIF($3, ''), linked_accounts.label),
         pin_hash = COALESCE($4, linked_accounts.pin_hash),
         is_active = true,
         last_used_at = NOW(),
         remember_until = NOW() + INTERVAL '90 days'
       RETURNING id, user_id, is_active, last_used_at, created_at, pin_hash IS NOT NULL AS has_pin`,
      [deviceId, principal.userId, effectiveLabel, pinHash],
    );

    // Mark current session as persistent + device-bound
    await pool.query(
      `UPDATE sessions SET device_id = $1, is_persistent = true WHERE id = $2`,
      [deviceId, principal.sessionId],
    );

    reply.send({ success: true, data: result.rows[0] });
  });

  // POST /v1/auth/accounts/switch — switch to a different linked account
  app.post('/v1/auth/accounts/switch', { preHandler: requireAuth }, async (request: any, reply) => {
    const deviceId = String(request.headers['x-device-id'] || '').trim();
    if (!deviceId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'X-Device-Id header required' } });
    }
    const { target_user_id, pin } = (request.body || {}) as { target_user_id?: string; pin?: string };
    if (!target_user_id) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_TARGET', message: 'target_user_id required' } });
    }

    // Verify linked account exists on this device
    const linked = await pool.query(
      `SELECT id, user_id, pin_hash, remember_until
       FROM linked_accounts
       WHERE device_id = $1 AND user_id = $2`,
      [deviceId, target_user_id],
    );
    if (linked.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'ACCOUNT_NOT_LINKED', message: 'Account not linked on this device' } });
    }

    const account = linked.rows[0];

    // Verify PIN if set
    if (account.pin_hash) {
      if (!pin) {
        return reply.status(403).send({ success: false, error: { code: 'PIN_REQUIRED', message: 'PIN required to switch to this account' } });
      }
      const { createHash } = await import('crypto');
      const submittedHash = createHash('sha256').update(pin + target_user_id).digest('hex');
      if (submittedHash !== account.pin_hash) {
        return reply.status(403).send({ success: false, error: { code: 'INVALID_PIN', message: 'Incorrect PIN' } });
      }
    }

    // Deactivate all accounts for this device, activate the target
    await pool.query(
      `UPDATE linked_accounts SET is_active = (user_id = $2), last_used_at = CASE WHEN user_id = $2 THEN NOW() ELSE last_used_at END WHERE device_id = $1`,
      [deviceId, target_user_id],
    );

    // Create a new session for the target user
    const { randomUUID } = await import('crypto');
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_MAX_AGE * 1000);
    await pool.query(
      `INSERT INTO sessions (id, user_id, status, expires_at, device_id, is_persistent) VALUES ($1, $2, 'active', $3, $4, true)`,
      [sessionId, target_user_id, expiresAt.toISOString(), deviceId],
    );

    // Fetch user info
    const userRes = await pool.query(
      `SELECT id, username, display_name, role, active_organization_id FROM users WHERE id = $1`,
      [target_user_id],
    );
    const user = userRes.rows[0] || {};

    reply.setCookie(SESSION_COOKIE, sessionId, authCookieOptions(ACCESS_TOKEN_MAX_AGE, request));
    reply.send({
      success: true,
      data: {
        access_token: sessionId,
        user_id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });
  });

  // DELETE /v1/auth/accounts/:userId — unlink an account from this device
  app.delete('/v1/auth/accounts/:userId', { preHandler: requireAuth }, async (request: any, reply) => {
    const deviceId = String(request.headers['x-device-id'] || '').trim();
    if (!deviceId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'X-Device-Id header required' } });
    }
    const targetUserId = (request.params as { userId: string }).userId;
    await pool.query(
      `DELETE FROM linked_accounts WHERE device_id = $1 AND user_id = $2`,
      [deviceId, targetUserId],
    );
    reply.send({ success: true });
  });

  // POST /v1/auth/accounts/pin — set or update PIN for a linked account
  app.post('/v1/auth/accounts/pin', { preHandler: requireAuth }, async (request: any, reply) => {
    const deviceId = String(request.headers['x-device-id'] || '').trim();
    if (!deviceId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_DEVICE_ID', message: 'X-Device-Id header required' } });
    }
    const principal = await resolveActiveSessionPrincipal(pool, request.cookies?.[SESSION_COOKIE], request.headers?.authorization);
    if (!principal) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
    }
    const { pin } = (request.body || {}) as { pin?: string };
    if (!pin || pin.length < 4 || pin.length > 8) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_PIN', message: 'PIN must be 4-8 digits' } });
    }
    const { createHash } = await import('crypto');
    const pinHash = createHash('sha256').update(pin + principal.userId).digest('hex');
    await pool.query(
      `UPDATE linked_accounts SET pin_hash = $1 WHERE device_id = $2 AND user_id = $3`,
      [pinHash, deviceId, principal.userId],
    );
    reply.send({ success: true });
  });
}

async function readOptionalSettingValue(pool: pg.Pool, key: string): Promise<unknown | null> {
  const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1 LIMIT 1`, [key]);
  if (res.rows.length === 0) return null;
  return res.rows[0]?.value ?? null;
}

function parseBoolLikeSettingValue(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    try {
      return Boolean(JSON.parse(raw));
    } catch {
      const normalized = raw.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
    }
  }
  return Boolean(raw);
}

function isTokenExchangeDefaultDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.AUTH_DISABLE_TOKEN_EXCHANGE || '').trim() !== '') {
    return parseBool(env.AUTH_DISABLE_TOKEN_EXCHANGE, false);
  }
  if (String(env.AUTH_TOKEN_EXCHANGE_DEFAULT_ENABLED || '').trim() !== '') {
    return !parseBool(env.AUTH_TOKEN_EXCHANGE_DEFAULT_ENABLED, true);
  }
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const profile = String(env.SVEN_ENV_PROFILE || env.SVEN_PROFILE || '').trim().toLowerCase();
  return nodeEnv === 'production' || ['strict', 'hardened', 'isolated', 'production'].includes(profile);
}

async function isTokenExchangeDisabled(pool: pg.Pool): Promise<boolean> {
  const configuredValue = await readOptionalSettingValue(pool, 'auth.disable_token_exchange');
  if (configuredValue === null) {
    return isTokenExchangeDefaultDisabled(process.env);
  }
  return parseBoolLikeSettingValue(configuredValue);
}

async function isTailscaleIdentityBootstrapAllowed(pool: pg.Pool): Promise<boolean> {
  if (String(process.env.AUTH_ALLOW_TAILSCALE || '').trim() !== '') {
    return parseBool(process.env.AUTH_ALLOW_TAILSCALE, false);
  }
  const configuredValue = await readOptionalSettingValue(pool, 'auth.allow_tailscale');
  if (configuredValue !== null) {
    return parseBoolLikeSettingValue(configuredValue);
  }
  return String(process.env.GATEWAY_TAILSCALE_MODE || '').trim().toLowerCase() === 'serve';
}

function requestCarriesTailscaleServeHeaders(request: any): boolean {
  const headerLogin = normalizeTailscaleLogin(request?.headers?.[TAILSCALE_LOGIN_HEADER]);
  const forwardedFor = String(request?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  const forwardedProto = String(request?.headers?.['x-forwarded-proto'] || '').split(',')[0]?.trim();
  const forwardedHost = String(request?.headers?.['x-forwarded-host'] || '').split(',')[0]?.trim();
  const remoteAddress = String(request?.raw?.socket?.remoteAddress || '').trim();
  return Boolean(headerLogin && forwardedFor && forwardedProto && forwardedHost && isLoopbackAddress(remoteAddress));
}

async function resolveTailscaleBootstrapUser(
  pool: pg.Pool,
  login: string,
): Promise<{ userId: string; username: string; role: string } | null> {
  const candidates = extractTailscaleUsernameCandidates(login);
  if (candidates.length === 0) return null;

  const res = await pool.query(
    `SELECT DISTINCT
       u.id,
       u.username,
       u.role
     FROM users u
     LEFT JOIN sso_identities si ON si.user_id = u.id
     JOIN organization_memberships om
       ON om.user_id = u.id
      AND om.organization_id = u.active_organization_id
      AND om.status = 'active'
     WHERE lower(u.username) = ANY($1::text[])
        OR lower(COALESCE(si.email, '')) = ANY($1::text[])
     ORDER BY u.username ASC`,
    [candidates],
  ).catch((err) => {
    if (isSchemaCompatError(err)) return { rows: [] } as any;
    throw err;
  });

  if (res.rows.length !== 1) return null;
  return {
    userId: String(res.rows[0].id || '').trim(),
    username: String(res.rows[0].username || '').trim(),
    role: String(res.rows[0].role || '').trim(),
  };
}

async function isAdminTotpEnrollmentRequired(pool: pg.Pool): Promise<boolean> {
  const envOverride = process.env.AUTH_ADMIN_TOTP_REQUIRED;
  if (envOverride !== undefined && envOverride !== null && String(envOverride).trim() !== '') {
    return parseBool(envOverride, true);
  }

  try {
    const res = await pool.query(
      `SELECT value FROM settings_global WHERE key = 'auth.adminTotpRequired' LIMIT 1`,
    );
    if (res.rows.length > 0) {
      const raw = res.rows[0]?.value;
      if (typeof raw === 'string') {
        try {
          return parseBool(JSON.parse(raw), true);
        } catch {
          return parseBool(raw, true);
        }
      }
      return parseBool(raw, true);
    }
  } catch (err) {
    logger.warn('Failed to read auth.adminTotpRequired setting; using environment default', {
      error: String((err as any)?.message || err),
    });
  }

  return process.env.NODE_ENV === 'production';
}

/**
 * RBAC middleware factory. Decorate routes with requireRole('admin').
 */
export function requireRole(pool: pg.Pool, ...roles: string[]) {
  return async (request: any, reply: any) => {
    const bearer = getBearerToken(request.headers?.authorization);
    const sessionId = request.cookies?.[SESSION_COOKIE] || bearer;
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Session required' },
      });
    }

    const result = await pool.query(
      `SELECT
         s.user_id,
         u.role,
         u.active_organization_id
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.status = 'active' AND s.expires_at > NOW()`,
      [sessionId],
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' },
      });
    }

    const user = result.rows[0];
    // Backward-compatible role normalization:
    // the users.role DB constraint historically allows admin/operator/user only,
    // while newer route guards check for "platform_admin".
    // Treat admin as platform admin at request-auth layer.
    const normalizedRole = user.role === 'admin' ? 'platform_admin' : user.role;
    const requestedAdmin = roles.includes('admin');
    const isPlatformAdmin = normalizedRole === 'platform_admin';
    const operatorAdminFallback =
      user.role === 'operator' &&
      requestedAdmin &&
      isOperatorAllowedAdminPath(String(request.raw?.url || ''));
    const platformAdminFallback =
      isPlatformAdmin &&
      roles.some((role) => role === 'admin' || role === 'operator' || role === 'user');

    if (!roles.includes(user.role) && !roles.includes(normalizedRole) && !operatorAdminFallback && !platformAdminFallback) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }

    request.user = { id: user.user_id, role: normalizedRole };
    request.userId = user.user_id;
    request.userRole = normalizedRole;
    request.orgId = user.active_organization_id || null;

    const userRateLimit = await enforceUserRateLimit(pool, String(user.user_id));
    if (userRateLimit.allowed) {
      reply.header('X-RateLimit-Limit', String(USER_RATE_LIMIT_MAX));
      reply.header('X-RateLimit-Remaining', String(userRateLimit.remaining));
      reply.header('X-RateLimit-Reset', String(userRateLimit.resetEpochSec));
      return;
    }
    if (userRateLimit.unavailable) {
      return reply.status(503).send({
        success: false,
        error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Per-user rate limiter unavailable. Please retry later.' },
      });
    }
    reply.header('X-RateLimit-Limit', String(USER_RATE_LIMIT_MAX));
    reply.header('X-RateLimit-Remaining', String(userRateLimit.remaining));
    reply.header('X-RateLimit-Reset', String(userRateLimit.resetEpochSec));
    reply.header('Retry-After', String(userRateLimit.retryAfterSec));
    if (!userRateLimit.allowed) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Per-user rate limit exceeded. Please retry later.' },
      });
    }
  };
}

function isOperatorAllowedAdminPath(rawUrl: string): boolean {
  const path = String(rawUrl || '').split('?')[0];
  if (!path.startsWith('/v1/admin')) return false;
  const blockedPrefixes = [
    '/v1/admin/users',
    '/v1/admin/accounts',
    '/v1/admin/settings',
    '/v1/admin/permissions',
    '/v1/admin/deployment',
  ];
  return !blockedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function generateUserCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const alphabetLength = alphabet.length;
  const maxUnbiasedByte = Math.floor(256 / alphabetLength) * alphabetLength;

  while (out.length < 8) {
    const bytes = randomBytes(8);
    for (const byte of bytes) {
      if (byte >= maxUnbiasedByte) continue;
      out += alphabet[byte % alphabetLength];
      if (out.length === 8) break;
    }
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function getBearerToken(authorizationHeader: unknown): string {
  const header = String(authorizationHeader || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function resolveActiveSessionPrincipal(
  pool: pg.Pool,
  cookieSessionRaw: unknown,
  authorizationHeader: unknown,
): Promise<null | { sessionId: string; userId: string; usedCookie: boolean }> {
  const cookieSessionId = String(cookieSessionRaw || '').trim();
  const bearer = getBearerToken(authorizationHeader);
  const sessionId = cookieSessionId || bearer;
  if (!sessionId) return null;

  const sessionRes = await pool.query(
    `SELECT user_id
     FROM sessions
     WHERE id = $1 AND status = 'active' AND expires_at > NOW()`,
    [sessionId],
  );
  if (sessionRes.rows.length === 0) return null;

  return {
    sessionId,
    userId: String(sessionRes.rows[0].user_id),
    usedCookie: Boolean(cookieSessionId),
  };
}
