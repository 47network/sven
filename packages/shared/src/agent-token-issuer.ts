export type TokenAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'HS256' | 'EdDSA';
export type TokenType = 'access' | 'refresh' | 'api_key' | 'service';
export type RevocationReason = 'expired' | 'compromised' | 'user_request' | 'policy_violation' | 'rotation';

export interface TokenIssuerConfig {
  id: string;
  agentId: string;
  algorithm: TokenAlgorithm;
  issuer: string;
  defaultTtlSeconds: number;
  maxTtlSeconds: number;
  refreshEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IssuedToken {
  id: string;
  configId: string;
  tokenType: TokenType;
  subject: string;
  audience?: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  metadata: Record<string, unknown>;
}

export interface TokenRevocation {
  id: string;
  tokenId: string;
  reason: RevocationReason;
  revokedBy: string;
  revokedAt: string;
}
