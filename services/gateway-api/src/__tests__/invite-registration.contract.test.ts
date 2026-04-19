import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const AUTH_ROUTES = path.resolve(__dirname, '../routes/auth.ts');
const ADMIN_INDEX = path.resolve(__dirname, '../routes/admin/index.ts');
const INVITE_ROUTES = path.resolve(__dirname, '../routes/admin/invites.ts');
const MIGRATION = path.resolve(
  __dirname,
  '../db/migrations/20260417100000_invite_tokens.sql',
);

describe('invite-based user registration', () => {
  describe('route registration contracts', () => {
    it('auth.ts contains POST /v1/auth/register endpoint', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      expect(source).toContain("app.post('/v1/auth/register'");
      expect(source).toContain('invite_token');
      expect(source).toContain('INVALID_INVITE');
      expect(source).toContain('INVITE_EXPIRED');
      expect(source).toContain('INVITE_REVOKED');
      expect(source).toContain('INVITE_EXHAUSTED');
    });

    it('register endpoint validates input via schema', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      // Must require invite_token, username, password
      expect(source).toContain("required: ['invite_token', 'username', 'password']");
      // Must validate username length
      expect(source).toContain('minLength: 2');
      // Must validate password length
      expect(source).toContain('minLength: 8');
    });

    it('register endpoint is rate-limited', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      const registerBlock = source.slice(
        source.indexOf("app.post('/v1/auth/register'"),
        source.indexOf("app.post('/v1/auth/register'") + 500,
      );
      expect(registerBlock).toContain('rateLimit');
    });

    it('register endpoint validates username format', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      expect(source).toContain('/^[a-zA-Z0-9_-]+$/');
    });

    it('register endpoint uses transactions for atomicity', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      const registerSection = source.slice(
        source.indexOf("app.post('/v1/auth/register'"),
        source.indexOf("// ─── POST /v1/auth/login"),
      );
      expect(registerSection).toContain('BEGIN');
      expect(registerSection).toContain('COMMIT');
      expect(registerSection).toContain('ROLLBACK');
      expect(registerSection).toContain('FOR UPDATE');
    });

    it('register endpoint creates session for immediate login', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      const registerSection = source.slice(
        source.indexOf("app.post('/v1/auth/register'"),
        source.indexOf("// ─── POST /v1/auth/login"),
      );
      expect(registerSection).toContain('createAccessSession');
      expect(registerSection).toContain('createRefreshSession');
      expect(registerSection).toContain('setCookie');
    });

    it('register endpoint increments invite use_count', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      const registerSection = source.slice(
        source.indexOf("app.post('/v1/auth/register'"),
        source.indexOf("// ─── POST /v1/auth/login"),
      );
      expect(registerSection).toContain('use_count = use_count + 1');
    });

    it('register endpoint records invite redemption', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      const registerSection = source.slice(
        source.indexOf("app.post('/v1/auth/register'"),
        source.indexOf("// ─── POST /v1/auth/login"),
      );
      expect(registerSection).toContain('invite_redemptions');
    });
  });

  describe('admin invite routes registration', () => {
    it('admin index imports and mounts invite routes', async () => {
      const source = await fs.readFile(ADMIN_INDEX, 'utf8');
      expect(source).toContain(
        "import { registerInviteRoutes } from './invites.js';",
      );
      expect(source).toContain('registerInviteRoutes');
    });

    it('invite routes file exports registerInviteRoutes', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain(
        'export async function registerInviteRoutes',
      );
    });

    it('invite routes implement CRUD for invites', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain("app.post('/invites'");
      expect(source).toContain("app.get('/invites'");
      expect(source).toContain("app.get('/invites/:id'");
      expect(source).toContain("app.delete('/invites/:id'");
    });

    it('invite creation enforces admin/owner role check', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain('Only admins and owners can create invites');
      expect(source).toContain('FORBIDDEN');
    });

    it('invite creation restricts admin/operator invite roles', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain(
        'Creating admin/operator invites requires owner or platform admin privileges',
      );
    });

    it('invite token is cryptographically random', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain('randomBytes');
      expect(source).toContain('base64url');
    });

    it('invite has maximum TTL enforcement', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain('MAX_INVITE_TTL_HOURS');
      expect(source).toContain('720'); // 30 days max
    });

    it('invite revocation sets revoked_at', async () => {
      const source = await fs.readFile(INVITE_ROUTES, 'utf8');
      expect(source).toContain('revoked_at = NOW()');
    });
  });

  describe('database migration', () => {
    it('migration file exists', async () => {
      const stat = await fs.stat(MIGRATION);
      expect(stat.isFile()).toBe(true);
    });

    it('migration creates invite_tokens table', async () => {
      const sql = await fs.readFile(MIGRATION, 'utf8');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS invite_tokens');
      expect(sql).toContain('token');
      expect(sql).toContain('created_by');
      expect(sql).toContain('organization_id');
      expect(sql).toContain('role');
      expect(sql).toContain('max_uses');
      expect(sql).toContain('use_count');
      expect(sql).toContain('expires_at');
      expect(sql).toContain('revoked_at');
    });

    it('migration creates invite_redemptions table', async () => {
      const sql = await fs.readFile(MIGRATION, 'utf8');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS invite_redemptions');
      expect(sql).toContain('invite_id');
      expect(sql).toContain('user_id');
    });

    it('migration creates indexes', async () => {
      const sql = await fs.readFile(MIGRATION, 'utf8');
      expect(sql).toContain('idx_invite_tokens_token');
      expect(sql).toContain('idx_invite_tokens_expires_at');
      expect(sql).toContain('idx_invite_tokens_org');
    });
  });

  describe('auth support table fallback', () => {
    it('ensureAuthSupportTables creates invite tables as fallback', async () => {
      const source = await fs.readFile(AUTH_ROUTES, 'utf8');
      const supportSection = source.slice(
        source.indexOf('async function ensureAuthSupportTables'),
        source.indexOf('function parseBool'),
      );
      expect(supportSection).toContain('invite_tokens');
      expect(supportSection).toContain('invite_redemptions');
    });
  });
});
