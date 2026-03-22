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
import type { Logger } from '@sven/shared';
export type EncryptionAlgorithm = 'aes-256-gcm';
export type KdfAlgorithm = 'pbkdf2-sha256';
export interface EncryptedData {
    version: number;
    algorithm: EncryptionAlgorithm;
    iv: string;
    ciphertext: string;
    tag: string;
    aad?: string;
}
export interface WrappedKey {
    version: number;
    algorithm: EncryptionAlgorithm;
    wrapped_key: string;
    kdf_salt: string;
    kdf_iterations: number;
}
/**
 * Derives a Data Encryption Key (DEK) from the master key using PBKDF2
 * Used when generating a new wrapped key for a user
 */
export declare function deriveDekFromMasterKey(masterKey: Buffer, salt: Buffer, algorithm?: EncryptionAlgorithm, iterations?: number): Buffer;
/**
 * Encrypts a Data Encryption Key (DEK) with the Master Key (KEK)
 * Returns a wrapped key that can be safely stored in the database
 */
export declare function wrapDataKey(dek: Buffer, masterKey: Buffer, salt: Buffer, algorithm?: EncryptionAlgorithm, iterations?: number): WrappedKey;
/**
 * Unwraps a Data Encryption Key (DEK) using the Master Key (KEK)
 */
export declare function unwrapDataKey(wrappedKey: WrappedKey, masterKey: Buffer, algorithm?: EncryptionAlgorithm): Buffer;
/**
 * Encrypts plaintext data with a DEK
 */
export declare function encryptData(plaintext: string | Buffer, dek: Buffer, algorithm?: EncryptionAlgorithm, aad?: string): EncryptedData;
/**
 * Decrypts encrypted data with a DEK
 */
export declare function decryptData(encrypted: EncryptedData, dek: Buffer): string;
/**
 * Generates a new Data Encryption Key (DEK)
 * Used when creating a new user or rotating keys
 */
export declare function generateDek(keyLength?: number): Buffer;
/**
 * Generates a random salt for key derivation
 */
export declare function generateSalt(saltLength?: number): Buffer;
/**
 * Helper to encrypt user_private or artifact data in envelope encryption mode
 * Used by services to protect sensitive data
 */
export declare function encryptUserData(plaintext: string, dek: Buffer, userId: string, contentType?: string, logger?: Logger): Promise<EncryptedData>;
/**
 * Helper to decrypt user_private or artifact data
 */
export declare function decryptUserData(encrypted: EncryptedData, dek: Buffer, userId: string, contentType?: string, logger?: Logger): Promise<string>;
//# sourceMappingURL=envelope.d.ts.map