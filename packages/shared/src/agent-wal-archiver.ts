export interface WalArchiverConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveSegment {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ArchiverEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
