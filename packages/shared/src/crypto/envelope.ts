/**
 * Envelope Encryption Utilities
 *
 * Implements envelope encryption pattern:
 * 1. Master Key (KEK - Key Encryption Key): Stored externally in SOPS/age or Vault
 * 2. Data Encryption Key (DEK): Per-user DEK, encrypted with KEK, stored in user_keys table
 * 3. Data Encryption: User data encrypted with DEK, stored in database/objects
 *
 * This provides security benefits:
 * - Master key never leaves secure storage
 * - Data keys can be rotated independently
 * - Compromised database doesn't expose plaintext keys (only wrapped DEKs)
 */

import crypto from 'node:crypto';
import type { Logger } from '@sven/shared';

export type EncryptionAlgorithm = 'aes-256-gcm';
export type KdfAlgorithm = 'pbkdf2-sha256';

export interface EncryptedData {
  version: number;
  algorithm: EncryptionAlgorithm;
  iv: string; // base64-encoded
  ciphertext: string; // base64-encoded
  tag: string; // base64-encoded GCM auth tag
  aad?: string; // base64-encoded additional authenticated data
}

export interface WrappedKey {
  version: number;
  algorithm: EncryptionAlgorithm;
  wrapped_key: string; // base64-encoded
  kdf_salt: string; // base64-encoded
  kdf_iterations: number;
}

/**
 * Derives a Data Encryption Key (DEK) from the master key using PBKDF2
 * Used when generating a new wrapped key for a user
 */
export function deriveDekFromMasterKey(
  masterKey: Buffer,
  salt: Buffer,
  algorithm: EncryptionAlgorithm = 'aes-256-gcm',
  iterations: number = 100000,
): Buffer {
  if (algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  // AES-256-GCM requires 32-byte key
  const keyLength = 32;
  return crypto.pbkdf2Sync(masterKey, salt, iterations, keyLength, 'sha256');
}

/**
 * Encrypts a Data Encryption Key (DEK) with the Master Key (KEK)
 * Returns a wrapped key that can be safely stored in the database
 */
export function wrapDataKey(
  dek: Buffer,
  masterKey: Buffer,
  salt: Buffer,
  algorithm: EncryptionAlgorithm = 'aes-256-gcm',
  iterations: number = 100000,
): WrappedKey {
  if (algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const kek = deriveDekFromMasterKey(masterKey, salt, algorithm, iterations);
  const iv = crypto.randomBytes(12); // 96 bits for GCM
  const cipher = crypto.createCipheriv(algorithm, kek, iv);
  let encrypted = cipher.update(dek);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm,
    wrapped_key: Buffer.concat([iv, tag, encrypted]).toString('base64'),
    kdf_salt: salt.toString('base64'),
    kdf_iterations: iterations,
  };
}

/**
 * Unwraps a Data Encryption Key (DEK) using the Master Key (KEK)
 */
export function unwrapDataKey(
  wrappedKey: WrappedKey,
  masterKey: Buffer,
  algorithm: EncryptionAlgorithm = 'aes-256-gcm',
): Buffer {
  if (wrappedKey.version !== 1 || wrappedKey.algorithm !== algorithm) {
    throw new Error(`Unsupported wrapped key version or algorithm`);
  }

  const salt = Buffer.from(wrappedKey.kdf_salt, 'base64');
  const kek = deriveDekFromMasterKey(masterKey, salt, algorithm, wrappedKey.kdf_iterations);

  const combined = Buffer.from(wrappedKey.wrapped_key, 'base64');
  const iv = combined.slice(0, 12);
  const tag = combined.slice(12, 28);
  const ciphertext = combined.slice(28);

  const decipher = crypto.createDecipheriv(algorithm, kek, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted;
}

/**
 * Encrypts plaintext data with a DEK
 */
export function encryptData(
  plaintext: string | Buffer,
  dek: Buffer,
  algorithm: EncryptionAlgorithm = 'aes-256-gcm',
  aad?: string,
): EncryptedData {
  if (algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, dek, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  let ciphertext = cipher.update(data);
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
    aad: aad ? Buffer.from(aad, 'utf8').toString('base64') : undefined,
  };
}

/**
 * Decrypts encrypted data with a DEK
 */
export function decryptData(
  encrypted: EncryptedData,
  dek: Buffer,
): string {
  if (encrypted.version !== 1 || encrypted.algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported encrypted data version or algorithm`);
  }

  const iv = Buffer.from(encrypted.iv, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  const decipher = crypto.createDecipheriv(encrypted.algorithm, dek, iv);
  decipher.setAuthTag(tag);

  if (encrypted.aad) {
    decipher.setAAD(Buffer.from(encrypted.aad, 'base64'));
  }

  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);

  return plaintext.toString('utf8');
}

/**
 * Generates a new Data Encryption Key (DEK)
 * Used when creating a new user or rotating keys
 */
export function generateDek(keyLength: number = 32): Buffer {
  return crypto.randomBytes(keyLength);
}

/**
 * Generates a random salt for key derivation
 */
export function generateSalt(saltLength: number = 16): Buffer {
  return crypto.randomBytes(saltLength);
}

/**
 * Helper to encrypt user_private or artifact data in envelope encryption mode
 * Used by services to protect sensitive data
 */
export async function encryptUserData(
  plaintext: string,
  dek: Buffer,
  userId: string,
  contentType: string = 'user_private_memory',
  logger?: Logger,
): Promise<EncryptedData> {
  try {
    // Use user_id + content_type as additional authenticated data to prevent misuse
    const aad = `${userId}:${contentType}`;
    const encrypted = encryptData(plaintext, dek, 'aes-256-gcm', aad);
    if (logger) {
      logger.debug('User data encrypted', {
        user_id: userId,
        content_type: contentType,
        ciphertext_length: encrypted.ciphertext.length,
      });
    }
    return encrypted;
  } catch (err) {
    if (logger) {
      logger.error('Failed to encrypt user data', { user_id: userId, error: String(err) });
    }
    throw err;
  }
}

/**
 * Helper to decrypt user_private or artifact data
 */
export async function decryptUserData(
  encrypted: EncryptedData,
  dek: Buffer,
  userId: string,
  contentType: string = 'user_private_memory',
  logger?: Logger,
): Promise<string> {
  try {
    const aad = `${userId}:${contentType}`;
    const encrypted2 = { ...encrypted, aad: Buffer.from(aad, 'utf8').toString('base64') };
    const plaintext = decryptData(encrypted2, dek);
    if (logger) {
      logger.debug('User data decrypted', {
        user_id: userId,
        content_type: contentType,
      });
    }
    return plaintext;
  } catch (err) {
    if (logger) {
      logger.error('Failed to decrypt user data', { user_id: userId, error: String(err) });
    }
    throw err;
  }
}
