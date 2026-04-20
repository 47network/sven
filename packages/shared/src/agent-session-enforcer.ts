/** Batch 236 — Session Enforcer types */

export type SessionStatus = 'active' | 'idle' | 'expired' | 'terminated';
export type SessionViolationType = 'concurrent_limit' | 'timeout' | 'ip_violation' | 'geo_violation' | 'mfa_required' | 'suspicious_activity';
export type ViolationAction = 'warned' | 'session_terminated' | 'account_locked' | 'alert_sent';

export interface AgentSessionPolicy {
  id: string;
  agentId: string;
  policyName: string;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  ipWhitelist: string[];
  requireMfa: boolean;
  geoRestrictions: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface AgentActiveSession {
  id: string;
  policyId?: string;
  agentId: string;
  sessionTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  startedAt: string;
  lastActivity: string;
  expiresAt: string;
  status: SessionStatus;
}

export interface AgentSessionViolation {
  id: string;
  sessionId?: string;
  agentId: string;
  violationType: SessionViolationType;
  details: Record<string, unknown>;
  actionTaken: ViolationAction;
  createdAt: string;
}
