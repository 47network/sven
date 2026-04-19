// Batch 199: Ingress Controller — traffic routing, TLS, access control

export interface IngressRule {
  id: string;
  agentId: string;
  ruleName: string;
  hostPattern: string;
  pathPrefix: string;
  targetService: string;
  targetPort: number;
  priority: number;
  tlsEnabled: boolean;
  tlsCertId?: string;
  rateLimitRps?: number;
  corsEnabled: boolean;
  corsOrigins: string[];
  authMode: IngressAuthMode;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface IngressCertificate {
  id: string;
  agentId: string;
  domain: string;
  certType: IngressCertType;
  status: IngressCertStatus;
  issuedAt?: string;
  expiresAt?: string;
  autoRenew: boolean;
  metadata: Record<string, unknown>;
}

export interface IngressAccessLog {
  id: string;
  ruleId: string;
  clientIp: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  bytesSent: number;
  userAgent?: string;
  loggedAt: string;
}

export type IngressAuthMode = 'none' | 'basic' | 'bearer' | 'oauth2' | 'mtls' | 'api_key';
export type IngressCertType = 'lets_encrypt' | 'self_signed' | 'custom' | 'managed';
export type IngressCertStatus = 'pending' | 'active' | 'expired' | 'revoked' | 'failed';
export type IngressControllerEvent = 'ingress.rule_created' | 'ingress.cert_issued' | 'ingress.traffic_spike' | 'ingress.rate_limited';
