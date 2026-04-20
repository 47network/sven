export interface SessionTrackerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  trackIp: boolean;
  trackUserAgent: boolean;
  anomalyDetection: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ActiveSession {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  startedAt: string;
  lastActivity: string;
  isAnomaly: boolean;
}
export interface SessionAnalytics {
  totalActive: number;
  peakConcurrent: number;
  avgDurationMinutes: number;
  anomaliesDetected: number;
  expiredToday: number;
}
