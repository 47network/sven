export type RegistryAuthType = 'token' | 'basic' | 'iam' | 'oidc';
export type RegistryStorageBackend = 'local' | 's3' | 'gcs' | 'azure_blob';
export type ImageArchitecture = 'amd64' | 'arm64' | 'multi';
export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'negligible';

export interface ContainerRegistry {
  id: string;
  agentId: string;
  name: string;
  endpointUrl: string;
  authType: RegistryAuthType;
  storageBackend: RegistryStorageBackend;
  maxImages: number;
  maxStorageBytes: number;
  tlsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerImage {
  id: string;
  registryId: string;
  repository: string;
  tag: string;
  digest: string;
  sizeBytes: number;
  architecture: ImageArchitecture;
  os: string;
  pushedBy: string | null;
  pushedAt: string;
  lastPulledAt: string | null;
  pullCount: number;
  labels: Record<string, string>;
}

export interface ImageVulnerability {
  id: string;
  imageId: string;
  cveId: string;
  severity: VulnerabilitySeverity;
  packageName: string;
  installedVersion: string;
  fixedVersion: string | null;
  description: string | null;
  scannedAt: string;
}

export interface ContainerRegistryStats {
  totalRegistries: number;
  totalImages: number;
  totalVulnerabilities: number;
  criticalVulns: number;
  totalStorageBytes: number;
}
