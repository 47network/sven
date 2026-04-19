export type OAuthFlow = 'authorization_code' | 'client_credentials' | 'implicit' | 'device_code' | 'refresh_token';
export type GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token' | 'device_code';

export interface OAuthManagerConfig {
  id: string;
  agentId: string;
  supportedFlows: OAuthFlow[];
  tokenEndpoint?: string;
  authEndpoint?: string;
  pkceRequired: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthClient {
  id: string;
  configId: string;
  clientId: string;
  clientName: string;
  redirectUris: string[];
  scopes: string[];
  grantTypes: GrantType[];
  isConfidential: boolean;
  createdAt: string;
}

export interface OAuthGrant {
  id: string;
  clientId: string;
  subject: string;
  scopes: string[];
  code?: string;
  codeExpiresAt?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  grantedAt: string;
}
