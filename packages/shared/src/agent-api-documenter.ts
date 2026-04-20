export type DocFormat = 'openapi3' | 'openapi2' | 'asyncapi' | 'graphql' | 'grpc';
export type DocPageType = 'endpoint' | 'model' | 'guide' | 'changelog' | 'overview';
export type PublishStatus = 'draft' | 'published' | 'archived' | 'deprecated';

export interface AgentApiDocumenterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  outputFormat: DocFormat;
  autoGenerate: boolean;
  includeExamples: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentApiSpec {
  id: string;
  configId: string;
  specName: string;
  version: string;
  specFormat: DocFormat;
  specContent: Record<string, unknown>;
  endpointCount: number;
  generatedAt: Date;
  publishedAt?: Date;
}

export interface AgentDocPage {
  id: string;
  specId: string;
  pagePath: string;
  title?: string;
  content?: string;
  pageType: DocPageType;
  createdAt: Date;
  updatedAt: Date;
}
