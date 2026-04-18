// Batch 80 — Agent Session Management shared types

export type SessionChannel = 'api' | 'web' | 'discord' | 'telegram' | 'slack' | 'email' | 'sms' | 'voice';
export type SessionStatus = 'active' | 'idle' | 'suspended' | 'expired' | 'terminated';
export type SessionMessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'function';
export type SessionContextType = 'memory' | 'file' | 'tool_result' | 'summary' | 'injection' | 'rag_result';
export type SessionHandoffStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed';

export interface AgentSession {
  id: string;
  agentId: string;
  userId?: string;
  channel: SessionChannel;
  status: SessionStatus;
  startedAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  idleTimeoutMs: number;
  maxDurationMs: number;
  messageCount: number;
  tokenCount: number;
  contextWindowUsed: number;
  parentSessionId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: SessionMessageRole;
  content: string;
  tokenCount: number;
  modelUsed?: string;
  latencyMs?: number;
  toolCalls?: Record<string, unknown>;
  attachments: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SessionContext {
  id: string;
  sessionId: string;
  contextType: SessionContextType;
  content: string;
  tokenCount: number;
  priority: number;
  expiresAt?: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SessionHandoff {
  id: string;
  fromSessionId: string;
  toSessionId?: string;
  fromAgentId: string;
  toAgentId: string;
  reason?: string;
  contextSnapshot: Record<string, unknown>;
  status: SessionHandoffStatus;
  acceptedAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SessionAnalytics {
  id: string;
  sessionId: string;
  durationMs?: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  toolCallsCount: number;
  handoffCount: number;
  userSatisfaction?: number;
  resolutionStatus?: 'resolved' | 'unresolved' | 'escalated' | 'abandoned';
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isSessionExpired(session: Pick<AgentSession, 'expiresAt' | 'lastActivityAt' | 'idleTimeoutMs'>): boolean {
  const now = Date.now();
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) return true;
  return (now - new Date(session.lastActivityAt).getTime()) >= session.idleTimeoutMs;
}

export function sessionTokenUtilization(session: Pick<AgentSession, 'contextWindowUsed'>, maxTokens: number): number {
  return maxTokens > 0 ? session.contextWindowUsed / maxTokens : 0;
}

export function avgResponseLatency(messages: Pick<SessionMessage, 'role' | 'latencyMs'>[]): number {
  const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.latencyMs != null);
  if (assistantMsgs.length === 0) return 0;
  return assistantMsgs.reduce((sum, m) => sum + m.latencyMs!, 0) / assistantMsgs.length;
}
