export type ResolutionStrategy = 'federated' | 'local' | 'hybrid' | 'delegated';
export type IdentityType = 'user' | 'service' | 'device' | 'application' | 'group';
export type IdentityStatus = 'active' | 'suspended' | 'deactivated' | 'pending_verification';
export type IdentityProvider = 'internal' | 'oauth2' | 'saml' | 'ldap' | 'oidc';

export interface IdentityResolverConfig {
  id: string;
  agentId: string;
  resolutionStrategy: ResolutionStrategy;
  identityProviders: IdentityProvider[];
  cacheTtlSeconds: number;
  fallbackEnabled: boolean;
  auditLogEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityRecord {
  id: string;
  configId: string;
  agentId: string;
  externalId: string;
  provider: IdentityProvider;
  identityType: IdentityType;
  displayName: string | null;
  email: string | null;
  attributes: Record<string, unknown>;
  verified: boolean;
  lastVerifiedAt: Date | null;
  status: IdentityStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IdentityResolutionLog {
  id: string;
  recordId: string | null;
  resolutionType: string;
  provider: IdentityProvider;
  queryInput: Record<string, unknown>;
  resolved: boolean;
  latencyMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
}
