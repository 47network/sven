export type SessionType = 'user' | 'api' | 'service' | 'websocket' | 'streaming';
export type SessionStatus = 'active' | 'idle' | 'suspended' | 'expired' | 'terminated';
export type SessionEventType = 'created' | 'refreshed' | 'suspended' | 'resumed' | 'expired' | 'terminated' | 'activity';

export interface AgentSession {
  id: string;
  agentId: string;
  sessionType: SessionType;
  status: SessionStatus;
  clientId?: string;
  ipAddress?: string;
  userAgent?: string;
  tokenHash?: string;
  startedAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}

export interface AgentSessionEvent {
  id: string;
  sessionId: string;
  eventType: SessionEventType;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentSessionPolicy {
  id: string;
  agentId: string;
  policyName: string;
  maxSessions: number;
  idleTimeoutSeconds: number;
  maxLifetimeSeconds: number;
  concurrentLimit: number;
  metadata: Record<string, unknown>;
}
