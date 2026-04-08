/**
 * Client attestation — HMAC-based inter-service request signing.
 *
 * Proves that requests between Sven services are authentic and
 * haven't been tampered with. Each request is signed with a shared
 * secret, timestamped, and nonce-guarded against replay attacks.
 *
 * Features:
 * - HMAC-SHA256/384/512 request signing
 * - Timestamp freshness verification (clock skew tolerance)
 * - Nonce tracking to prevent replay attacks
 * - Automatic nonce window pruning
 * - Service identity assertion
 *
 * Prior art: AWS Signature V4, Stripe webhook signatures,
 * Twilio request validation, HMAC-based API authentication (RFC 2104),
 * OAuth 1.0 signed requests, HTTP Message Signatures (RFC 9421).
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createLogger } from './logger.js';

const log = createLogger('client-attestation');

// ── Types ─────────────────────────────────────────────────────────

export type HmacAlgorithm = 'sha256' | 'sha384' | 'sha512';

export interface AttestationConfig {
  /** Shared secret for HMAC signing. Must come from env. */
  secret: string;
  /** HMAC algorithm. Default 'sha256'. */
  algorithm: HmacAlgorithm;
  /** Max allowed clock skew in seconds. Default 300 (5 min). */
  maxClockSkew: number;
  /** Nonce window size (how many nonces to track). Default 10000. */
  nonceWindowSize: number;
  /** Service ID for this instance. */
  serviceId: string;
}

export interface AttestationHeader {
  /** Unix timestamp (seconds). */
  timestamp: number;
  /** Random nonce (hex). */
  nonce: string;
  /** HMAC signature (hex). */
  signature: string;
  /** Service identifier. */
  serviceId: string;
  /** Algorithm used. */
  algorithm: HmacAlgorithm;
}

export interface VerificationResult {
  /** Whether the signature is valid. */
  valid: boolean;
  /** Reason for rejection. */
  reason?: string;
  /** Service ID from the header. */
  serviceId?: string;
}

// ── Header name constants ─────────────────────────────────────────

export const ATTESTATION_HEADER_PREFIX = 'x-sven-attest';
export const HEADER_TIMESTAMP = `${ATTESTATION_HEADER_PREFIX}-ts`;
export const HEADER_NONCE = `${ATTESTATION_HEADER_PREFIX}-nonce`;
export const HEADER_SIGNATURE = `${ATTESTATION_HEADER_PREFIX}-sig`;
export const HEADER_SERVICE = `${ATTESTATION_HEADER_PREFIX}-svc`;
export const HEADER_ALGORITHM = `${ATTESTATION_HEADER_PREFIX}-alg`;

// ── Default config ────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<AttestationConfig, 'secret' | 'serviceId'> = {
  algorithm: 'sha256',
  maxClockSkew: 300,
  nonceWindowSize: 10_000,
};

// ── ClientAttestor ────────────────────────────────────────────────

export class ClientAttestor {
  private readonly config: AttestationConfig;
  private readonly seenNonces: Map<string, number> = new Map();

  constructor(config: Pick<AttestationConfig, 'secret' | 'serviceId'> & Partial<AttestationConfig>) {
    if (!config.secret || config.secret.length < 32) {
      throw new Error('Attestation secret must be at least 32 characters');
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Sign a request. Returns attestation headers to attach to the request.
   */
  sign(request: {
    method: string;
    path: string;
    body?: string;
  }): AttestationHeader {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString('hex');
    const payload = this.buildPayload(request.method, request.path, request.body, timestamp, nonce);

    const signature = createHmac(this.config.algorithm, this.config.secret)
      .update(payload)
      .digest('hex');

    log.debug('Request signed', {
      serviceId: this.config.serviceId,
      method: request.method,
      path: request.path,
    });

    return {
      timestamp,
      nonce,
      signature,
      serviceId: this.config.serviceId,
      algorithm: this.config.algorithm,
    };
  }

  /**
   * Verify an incoming request's attestation headers.
   * Checks signature, timestamp freshness, and nonce uniqueness.
   */
  verify(
    header: AttestationHeader,
    request: {
      method: string;
      path: string;
      body?: string;
    },
  ): VerificationResult {
    // 1. Check timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    const skew = Math.abs(now - header.timestamp);
    if (skew > this.config.maxClockSkew) {
      log.warn('Attestation rejected: timestamp skew', {
        skew,
        max: this.config.maxClockSkew,
        serviceId: header.serviceId,
      });
      return { valid: false, reason: `Timestamp skew too large: ${skew}s > ${this.config.maxClockSkew}s` };
    }

    // 2. Check nonce replay
    if (this.seenNonces.has(header.nonce)) {
      log.warn('Attestation rejected: nonce replay', {
        serviceId: header.serviceId,
      });
      return { valid: false, reason: 'Nonce already used (replay attack)' };
    }

    // 3. Verify algorithm is allowed
    const algo = header.algorithm ?? this.config.algorithm;
    if (!['sha256', 'sha384', 'sha512'].includes(algo)) {
      return { valid: false, reason: `Unsupported algorithm: ${algo}` };
    }

    // 4. Compute expected signature
    const payload = this.buildPayload(
      request.method,
      request.path,
      request.body,
      header.timestamp,
      header.nonce,
    );
    const expected = createHmac(algo, this.config.secret)
      .update(payload)
      .digest('hex');

    // 5. Constant-time comparison
    const sigBuf = Buffer.from(header.signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      log.warn('Attestation rejected: signature mismatch', {
        serviceId: header.serviceId,
        method: request.method,
        path: request.path,
      });
      return { valid: false, reason: 'Signature mismatch' };
    }

    // 6. Record nonce
    this.seenNonces.set(header.nonce, header.timestamp);
    this.pruneExpiredNonces();

    log.debug('Attestation verified', {
      serviceId: header.serviceId,
      method: request.method,
      path: request.path,
    });

    return { valid: true, serviceId: header.serviceId };
  }

  /**
   * Build attestation headers as a plain object for HTTP requests.
   */
  toHeaders(attestation: AttestationHeader): Record<string, string> {
    return {
      [HEADER_TIMESTAMP]: String(attestation.timestamp),
      [HEADER_NONCE]: attestation.nonce,
      [HEADER_SIGNATURE]: attestation.signature,
      [HEADER_SERVICE]: attestation.serviceId,
      [HEADER_ALGORITHM]: attestation.algorithm,
    };
  }

  /**
   * Parse attestation from incoming HTTP headers.
   */
  static fromHeaders(headers: Record<string, string | string[] | undefined>): AttestationHeader | null {
    const get = (key: string): string | undefined => {
      const v = headers[key];
      return Array.isArray(v) ? v[0] : v;
    };

    const ts = get(HEADER_TIMESTAMP);
    const nonce = get(HEADER_NONCE);
    const sig = get(HEADER_SIGNATURE);
    const svc = get(HEADER_SERVICE);
    const alg = get(HEADER_ALGORITHM);

    if (!ts || !nonce || !sig || !svc) return null;

    return {
      timestamp: parseInt(ts, 10),
      nonce,
      signature: sig,
      serviceId: svc,
      algorithm: (alg as HmacAlgorithm) ?? 'sha256',
    };
  }

  /**
   * Create from environment variables.
   */
  static fromEnv(serviceId: string): ClientAttestor {
    const secret = process.env['SVEN_ATTESTATION_SECRET'];
    if (!secret) {
      throw new Error('SVEN_ATTESTATION_SECRET environment variable is required');
    }
    return new ClientAttestor({
      secret,
      serviceId,
      algorithm: (process.env['SVEN_ATTESTATION_ALGORITHM'] as HmacAlgorithm) ?? 'sha256',
      maxClockSkew: parseInt(process.env['SVEN_ATTESTATION_MAX_SKEW'] ?? '300', 10) || 300,
    });
  }

  // ── Private helpers ───────────────────────────────────────────

  private buildPayload(
    method: string,
    path: string,
    body: string | undefined,
    timestamp: number,
    nonce: string,
  ): string {
    // Canonical request string: method + path + timestamp + nonce + body_hash
    const bodyHash = body
      ? createHmac(this.config.algorithm, this.config.secret).update(body).digest('hex')
      : '';
    return `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  }

  private pruneExpiredNonces(): void {
    if (this.seenNonces.size <= this.config.nonceWindowSize) return;

    // Remove oldest nonces
    const cutoff = Math.floor(Date.now() / 1000) - this.config.maxClockSkew * 2;
    const toDelete: string[] = [];
    for (const [nonce, ts] of this.seenNonces) {
      if (ts < cutoff) toDelete.push(nonce);
    }
    for (const nonce of toDelete) {
      this.seenNonces.delete(nonce);
    }

    // If still over capacity, drop oldest by timestamp
    if (this.seenNonces.size > this.config.nonceWindowSize) {
      const sorted = [...this.seenNonces.entries()].sort((a, b) => a[1] - b[1]);
      const excess = sorted.length - this.config.nonceWindowSize;
      for (let i = 0; i < excess; i++) {
        this.seenNonces.delete(sorted[i]![0]);
      }
    }
  }
}
