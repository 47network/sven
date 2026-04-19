export type SdkLanguage = 'typescript' | 'python' | 'go' | 'rust' | 'java' | 'csharp';
export type BuildStatus = 'pending' | 'generating' | 'building' | 'testing' | 'published' | 'failed';
export type VersioningStrategy = 'semver' | 'calver' | 'incremental';

export interface AgentSdkGeneratorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  targetLanguages: SdkLanguage[];
  packagePrefix: string;
  versioningStrategy: VersioningStrategy;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSdkBuild {
  id: string;
  configId: string;
  language: SdkLanguage;
  version: string;
  sourceSpecId?: string;
  buildStatus: BuildStatus;
  packageUrl?: string;
  fileCount: number;
  builtAt?: Date;
  publishedAt?: Date;
}

export interface AgentSdkMethod {
  id: string;
  buildId: string;
  methodName: string;
  httpMethod?: string;
  endpointPath?: string;
  parameters: unknown[];
  returnType?: string;
  createdAt: Date;
}
