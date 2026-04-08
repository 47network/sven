import pg from 'pg';
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

/**
 * 5.1 Instance Identity Service
 * Manages Ed25519 keypair generation, storage, signing, and verification
 * for Sven-to-Sven federation message authentication.
 *
 * Uses TweetNaCl (already in deps) for Ed25519 operations.
 */

interface InstanceIdentity {
  id: string;
  organization_id: string;
  public_key: string;
  fingerprint: string;
  algorithm: string;
  key_version: number;
  is_active: boolean;
  created_at: string;
  rotated_at: string | null;
}

interface SignedEnvelope {
  payload: string;
  signature: string;
  fingerprint: string;
  algorithm: string;
  timestamp: string;
}

export class InstanceIdentityService {
  constructor(private pool: pg.Pool) {}

  /**
   * Generate a new Ed25519 keypair for the instance.
   * Private key is encrypted with the instance's master key before storage.
   */
  async generateKeypair(organizationId: string): Promise<InstanceIdentity> {
    const nacl = await import('tweetnacl');
    const keypair = nacl.sign.keyPair();
    const publicKeyB64 = Buffer.from(keypair.publicKey).toString('base64');
    const privateKeyB64 = Buffer.from(keypair.secretKey).toString('base64');

    // Encrypt private key at rest with AES-256-GCM using instance-derived key
    const encryptionKey = this.deriveStorageKey(organizationId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    let encrypted = cipher.update(privateKeyB64, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const tag = cipher.getAuthTag();

    const encryptedPrivateKey = JSON.stringify({
      iv: iv.toString('base64'),
      data: encrypted,
      tag: tag.toString('base64'),
    });

    const fingerprint = crypto
      .createHash('sha256')
      .update(keypair.publicKey)
      .digest('hex')
      .slice(0, 32);

    // Deactivate any existing active keys for this org
    await this.pool.query(
      `UPDATE federation_instance_identity SET is_active = FALSE, rotated_at = NOW()
       WHERE organization_id = $1 AND is_active = TRUE`,
      [organizationId],
    );

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO federation_instance_identity (
        id, organization_id, public_key, encrypted_private_key,
        fingerprint, algorithm, key_version, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'ed25519', 1, TRUE, NOW())
      RETURNING *`,
      [id, organizationId, publicKeyB64, encryptedPrivateKey, fingerprint],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get the active identity for an organization.
   */
  async getActiveIdentity(organizationId: string): Promise<InstanceIdentity | null> {
    const result = await this.pool.query(
      `SELECT * FROM federation_instance_identity
       WHERE organization_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Sign a payload with the instance's Ed25519 private key.
   */
  async signPayload(organizationId: string, payload: string): Promise<SignedEnvelope> {
    const identity = await this.getActiveIdentity(organizationId);
    if (!identity) throw new Error('No active instance identity found. Generate a keypair first.');

    const privateKeyB64 = await this.decryptPrivateKey(organizationId, identity.id);
    const nacl = await import('tweetnacl');
    const secretKey = Buffer.from(privateKeyB64, 'base64');
    const messageBytes = Buffer.from(payload, 'utf8');
    const signature = nacl.sign.detached(messageBytes, secretKey);

    return {
      payload,
      signature: Buffer.from(signature).toString('base64'),
      fingerprint: identity.fingerprint,
      algorithm: identity.algorithm,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify a signed envelope against a known public key.
   */
  async verifySignature(envelope: SignedEnvelope, publicKeyB64: string): Promise<boolean> {
    const nacl = await import('tweetnacl');
    const publicKey = Buffer.from(publicKeyB64, 'base64');
    const signature = Buffer.from(envelope.signature, 'base64');
    const message = Buffer.from(envelope.payload, 'utf8');
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  /**
   * Rotate the keypair: generate new, deactivate old.
   */
  async rotateKeypair(organizationId: string): Promise<InstanceIdentity> {
    return this.generateKeypair(organizationId);
  }

  /**
   * List all identities (including rotated) for audit trail.
   */
  async listIdentities(organizationId: string): Promise<InstanceIdentity[]> {
    const result = await this.pool.query(
      `SELECT * FROM federation_instance_identity
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows.map((r: any) => this.mapRow(r));
  }

  private async decryptPrivateKey(organizationId: string, identityId: string): Promise<string> {
    const result = await this.pool.query(
      `SELECT encrypted_private_key FROM federation_instance_identity
       WHERE id = $1 AND organization_id = $2`,
      [identityId, organizationId],
    );
    if (!result.rows[0]) throw new Error('Identity not found');

    const { iv, data, tag } = JSON.parse(result.rows[0].encrypted_private_key);
    const encryptionKey = this.deriveStorageKey(organizationId);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private deriveStorageKey(organizationId: string): Buffer {
    const masterSecret = process.env.SVEN_FEDERATION_KEY_SECRET
      || process.env.COOKIE_SECRET
      || 'sven-federation-default-key-change-me';
    return crypto
      .createHash('sha256')
      .update(`${masterSecret}:federation:${organizationId}`)
      .digest();
  }

  private mapRow(row: any): InstanceIdentity {
    return {
      id: row.id,
      organization_id: row.organization_id,
      public_key: row.public_key,
      fingerprint: row.fingerprint,
      algorithm: row.algorithm,
      key_version: row.key_version,
      is_active: row.is_active,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      rotated_at: row.rotated_at?.toISOString?.() ?? row.rotated_at ?? null,
    };
  }
}
