/* Batch 165 — Agent Traffic Mirror */

export type AgentTrafficMirrorStatus = 'active' | 'paused' | 'draining' | 'stopped';

export type AgentTrafficReplayStatus = 'pending' | 'running' | 'completed' | 'aborted';

export interface AgentTrafficMirror {
  id: string;
  tenantId: string;
  mirrorName: string;
  sourceService: string;
  targetService: string;
  mirrorPct: number;
  filterRules: Record<string, unknown>;
  status: AgentTrafficMirrorStatus;
  captureHeaders: boolean;
  captureBody: boolean;
  maxBodyBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTrafficCapture {
  id: string;
  mirrorId: string;
  requestMethod: string;
  requestPath: string;
  requestHeaders: Record<string, string> | null;
  responseStatus: number | null;
  responseTimeMs: number | null;
  sourceResponse: unknown | null;
  targetResponse: unknown | null;
  diffDetected: boolean;
  metadata: Record<string, unknown>;
  capturedAt: string;
}

export interface AgentTrafficReplay {
  id: string;
  mirrorId: string;
  replayName: string;
  captureCount: number;
  replayedCount: number;
  diffCount: number;
  speedFactor: number;
  status: AgentTrafficReplayStatus;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentTrafficMirrorStats {
  totalMirrors: number;
  activeMirrors: number;
  totalCaptures: number;
  diffsDetected: number;
  avgResponseTimeMs: number;
}
