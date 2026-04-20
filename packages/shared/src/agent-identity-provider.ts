export type IdentityProviderType = 'oauth2' | 'saml' | 'oidc' | 'ldap' | 'custom';
export type IdentityProviderStatus = 'active' | 'inactive' | 'suspended' | 'configuring';
export type IdentityRole = 'admin' | 'user' | 'service' | 'readonly';

export interface AgentIdentityProvider {
  id: string;
  agentId: string;
  providerName: string;
  providerType: IdentityProviderType;
  configuration: Record<string, unknown>;
  status: IdentityProviderStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIdentitySession {
  id: string;
  providerId: string;
  subjectId: string;
  tokenHash?: string;
  claims: Record<string, unknown>;
  expiresAt: string;
  createdAt: string;
}

export interface AgentIdentityMapping {
  id: string;
  providerId: string;
  externalId: string;
  internalAgentId: string;
  role: IdentityRole;
  metadata: Record<string, unknown>;
  createdAt: string;
}
