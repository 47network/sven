// Batch 109 — Agent API Versioning types

export type ApiVersionStatus = 'draft' | 'active' | 'deprecated' | 'sunset' | 'retired';
export type ApiCompatCheckResult = 'compatible' | 'breaking' | 'unknown';
export type ApiDeprecationSeverity = 'info' | 'warning' | 'critical';

export interface ApiVersion {
  id: string;
  agentId: string;
  serviceName: string;
  versionLabel: string;
  semver: string;
  status: ApiVersionStatus;
  publishedAt: string | null;
  sunsetAt: string | null;
  changelogUrl: string | null;
  consumersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiDeprecation {
  id: string;
  agentId: string;
  versionId: string;
  endpointPath: string;
  deprecatedAt: string;
  sunsetDate: string;
  replacementPath: string | null;
  migrationGuideUrl: string | null;
  notified: boolean;
  createdAt: string;
}

export interface ApiCompatCheck {
  id: string;
  agentId: string;
  sourceVersionId: string;
  targetVersionId: string;
  isCompatible: boolean;
  breakingChangesCount: number;
  additionsCount: number;
  removalsCount: number;
  checkedAt: string;
  createdAt: string;
}

export interface ApiVersioningStats {
  totalVersions: number;
  activeVersions: number;
  deprecatedVersions: number;
  pendingDeprecations: number;
}
