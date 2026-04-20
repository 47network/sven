export type LogIndexStatus = 'active' | 'frozen' | 'archived' | 'deleted';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogIndexerConfig {
  id: string;
  agentId: string;
  indexName: string;
  logSources: string[];
  retentionDays: number;
  parsingRules: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface LogIndex {
  id: string;
  configId: string;
  indexName: string;
  documentCount: number;
  sizeBytes: number;
  fieldMappings: Record<string, unknown>;
  status: LogIndexStatus;
  createdAt: string;
}

export interface LogQuery {
  id: string;
  configId: string;
  queryText: string;
  filters: Record<string, unknown>;
  resultCount: number;
  executionTimeMs: number;
  saved: boolean;
  createdAt: string;
}
