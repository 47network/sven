import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const WEBHOOK_SECRET_PREFIX = 'enc:v1:';
const WEBHOOK_SECRET_ALGO = 'aes-256-gcm';
const WEBHOOK_SECRET_IV_BYTES = 12;

function base64UrlEncode(input: Buffer): string {
  return input.toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function getWebhookSecretEncryptionKey(): Buffer {
  const keyMaterial =
    String(process.env.SVEN_WEBHOOK_SECRET_ENCRYPTION_KEY || '').trim()
    || String(process.env.SVEN_MASTER_KEY_V1 || '').trim();
  if (!keyMaterial) {
    throw new Error(
      'Webhook secret encryption key is not configured. Set SVEN_WEBHOOK_SECRET_ENCRYPTION_KEY or SVEN_MASTER_KEY_V1.',
    );
  }
  return createHash('sha256').update(keyMaterial).digest();
}

export function isEncryptedWebhookSecret(value: string): boolean {
  return String(value || '').startsWith(WEBHOOK_SECRET_PREFIX);
}

export function encryptWebhookSecret(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) {
    throw new Error('Webhook secret is required');
  }
  const key = getWebhookSecretEncryptionKey();
  const iv = randomBytes(WEBHOOK_SECRET_IV_BYTES);
  const cipher = createCipheriv(WEBHOOK_SECRET_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${WEBHOOK_SECRET_PREFIX}${base64UrlEncode(iv)}.${base64UrlEncode(tag)}.${base64UrlEncode(encrypted)}`;
}

export function decryptWebhookSecret(stored: string): string {
  const value = String(stored || '').trim();
  if (!value) {
    return '';
  }
  if (!value.startsWith(WEBHOOK_SECRET_PREFIX)) {
    // Backward compatibility for legacy plaintext rows.
    return value;
  }
  const payload = value.slice(WEBHOOK_SECRET_PREFIX.length);
  const [ivPart, tagPart, encryptedPart] = payload.split('.');
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid encrypted webhook secret format');
  }
  const key = getWebhookSecretEncryptionKey();
  const iv = base64UrlDecode(ivPart);
  const tag = base64UrlDecode(tagPart);
  const encrypted = base64UrlDecode(encryptedPart);
  const decipher = createDecipheriv(WEBHOOK_SECRET_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
