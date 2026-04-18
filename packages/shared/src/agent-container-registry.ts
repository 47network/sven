// Batch 103 — Agent Container Registry

export type ContainerImageArch = 'amd64' | 'arm64' | 'arm' | 'ppc64le' | 's390x';
export type ContainerScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ContainerSeverity = 'critical' | 'high' | 'medium' | 'low' | 'negligible';

export interface ContainerImage {
  id: string;
  agentId: string;
  repository: string;
  tag: string;
  digest: string;
  sizeBytes: number;
  architecture: ContainerImageArch;
  os: string;
  pushedAt: string;
  lastPulledAt: string | null;
  pullCount: number;
  labels: Record<string, string>;
}

export interface ContainerScan {
  id: string;
  imageId: string;
  scanner: string;
  status: ContainerScanStatus;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: Array<{ cve: string; severity: ContainerSeverity; package: string; fixedIn: string | null }>;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ContainerRetentionPolicy {
  id: string;
  agentId: string;
  repository: string;
  policyName: string;
  keepLast: number;
  keepDays: number | null;
  tagPattern: string;
  enabled: boolean;
  imagesCleaned: number;
  bytesFreed: number;
}

export interface ContainerRegistryStats {
  totalImages: number;
  totalRepositories: number;
  totalSizeBytes: number;
  criticalVulnerabilities: number;
  imagesScanned: number;
  retentionPoliciesActive: number;
}
