export type ExportFormat = 'json' | 'csv' | 'syslog' | 'cef';
export type ExportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface AuditTrailManagerConfig {
  id: string;
  agentId: string;
  retentionDays: number;
  tamperDetection: boolean;
  hashAlgorithm: string;
  exportFormat: ExportFormat;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEntry {
  id: string;
  configId: string;
  eventType: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  chainHash?: string;
  createdAt: Date;
}

export interface AuditExport {
  id: string;
  configId: string;
  format: string;
  dateFrom: Date;
  dateTo: Date;
  recordCount: number;
  fileUrl?: string;
  status: ExportStatus;
  createdAt: Date;
}
