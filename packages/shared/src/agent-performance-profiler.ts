export type ProfilingMode = 'sampling' | 'instrumentation' | 'tracing' | 'continuous';
export type ProfilingType = 'cpu' | 'memory' | 'io' | 'network' | 'wall_clock';
export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type HotspotCategory = 'cpu' | 'memory' | 'io' | 'lock_contention' | 'gc';

export interface PerformanceProfilerConfig {
  id: string;
  agentId: string;
  profilingMode: ProfilingMode;
  sampleRate: number;
  traceEnabled: boolean;
  flameGraphEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfilingSession {
  id: string;
  configId: string;
  agentId: string;
  targetService: string;
  profilingType: ProfilingType;
  durationSeconds: number;
  samplesCollected: number;
  hotspotsFound: number;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface PerformanceHotspot {
  id: string;
  sessionId: string;
  functionName: string;
  filePath: string | null;
  lineNumber: number | null;
  selfTimeMs: number;
  totalTimeMs: number;
  callCount: number;
  memoryBytes: number | null;
  category: HotspotCategory;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
