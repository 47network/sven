export interface BlobArchiverConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveEntry {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ArchiveManifest {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
