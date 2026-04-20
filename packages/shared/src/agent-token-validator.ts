/** Batch 235 — Token Validator types */

export type TokenType = 'jwt' | 'api_key' | 'oauth2' | 'session' | 'refresh' | 'service';
export type TokenStatus = 'active' | 'expired' | 'revoked' | 'refreshed';
export type ValidationResult = 'valid' | 'expired' | 'revoked' | 'invalid_signature' | 'malformed';

export interface AgentTokenConfig {
  id: string;
  agentId: string;
  tokenType: TokenType;
  issuer: string;
  audience?: string;
  algorithm: string;
  ttlSeconds: number;
  rotationPolicy: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface AgentIssuedToken {
  id: string;
  configId: string;
  agentId: string;
  tokenHash: string;
  claims: Record<string, unknown>;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  status: TokenStatus;
}

export interface AgentTokenValidation {
  id: string;
  tokenId?: string;
  agentId: string;
  validationResult: ValidationResult;
  validatedAt: string;
}
