import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const OAUTH_SECRET_PREFIX = 'enc:v1:';
const OAUTH_SECRET_ALGO = 'aes-256-gcm';
const OAUTH_IV_BYTES = 12;

function base64UrlEncode(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getOauthEncryptionKey(): Buffer {
  const configured =
    String(process.env.SVEN_CALENDAR_OAUTH_ENCRYPTION_KEY || '').trim() ||
    String(process.env.SVEN_MASTER_KEY_V1 || '').trim();

  if (!configured) {
    throw new Error(
      'Calendar OAuth encryption key is not configured. Set SVEN_CALENDAR_OAUTH_ENCRYPTION_KEY or SVEN_MASTER_KEY_V1.',
    );
  }
  return createHash('sha256').update(configured, 'utf8').digest();
}

export function encryptCalendarOAuthSecret(raw: string): string {
  const value = String(raw || '');
  if (!value) return '';

  const key = getOauthEncryptionKey();
  const iv = randomBytes(OAUTH_IV_BYTES);
  const cipher = createCipheriv(OAUTH_SECRET_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${OAUTH_SECRET_PREFIX}${base64UrlEncode(iv)}.${base64UrlEncode(tag)}.${base64UrlEncode(encrypted)}`;
}

export function decryptCalendarOAuthSecret(stored: string): string {
  const value = String(stored || '').trim();
  if (!value) return '';

  if (!value.startsWith(OAUTH_SECRET_PREFIX)) {
    // Backward compatibility for legacy plaintext rows pending migration.
    return value;
  }

  const payload = value.slice(OAUTH_SECRET_PREFIX.length);
  const [ivPart, tagPart, encryptedPart] = payload.split('.');
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid encrypted OAuth token format');
  }

  const key = getOauthEncryptionKey();
  const iv = base64UrlDecode(ivPart);
  const tag = base64UrlDecode(tagPart);
  const encrypted = base64UrlDecode(encryptedPart);
  const decipher = createDecipheriv(OAUTH_SECRET_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

