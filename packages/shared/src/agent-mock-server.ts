export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type RecordMode = 'passthrough' | 'record' | 'replay' | 'mixed';
export type MatchStrategy = 'exact' | 'regex' | 'wildcard' | 'fuzzy';

export interface AgentMockServerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  defaultPort: number;
  recordMode: boolean;
  latencySimulation: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMockEndpoint {
  id: string;
  configId: string;
  method: MockMethod;
  pathPattern: string;
  responseStatus: number;
  responseBody?: unknown;
  responseHeaders: Record<string, string>;
  delayMs: number;
  enabled: boolean;
  createdAt: Date;
}

export interface AgentMockRequest {
  id: string;
  endpointId: string;
  requestMethod?: string;
  requestPath?: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  matched: boolean;
  receivedAt: Date;
}
