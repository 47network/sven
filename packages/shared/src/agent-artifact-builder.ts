export type BuildSystem = 'generic' | 'npm' | 'docker' | 'gradle' | 'make' | 'custom';
export type ArtifactFormat = 'archive' | 'container' | 'binary' | 'package' | 'document';
export type VersioningStrategy = 'semver' | 'calver' | 'incremental' | 'git_hash';
export type BuildStatus = 'queued' | 'building' | 'testing' | 'publishing' | 'completed' | 'failed';

export interface ArtifactBuilderConfig {
  id: string;
  agentId: string;
  buildSystem: BuildSystem;
  outputFormat: ArtifactFormat;
  versioningStrategy: VersioningStrategy;
  storagePath: string;
  maxArtifactSizeMb: number;
  retentionCount: number;
  signingEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  configId: string;
  agentId: string;
  artifactName: string;
  version: string;
  format: ArtifactFormat;
  sizeBytes: number;
  checksum?: string;
  storageUrl?: string;
  buildDurationMs?: number;
  status: BuildStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BuildLog {
  id: string;
  artifactId: string;
  logLevel: string;
  message: string;
  stepName?: string;
  durationMs?: number;
  createdAt: string;
}
