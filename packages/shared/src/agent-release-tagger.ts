export interface ReleaseTaggerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  taggingStrategy: string;
  autoChangelog: boolean;
  signTags: boolean;
  protectedBranches: string[];
  releaseNotesTemplate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseTag {
  id: string;
  configId: string;
  version: string;
  tagName: string;
  changelog: string;
  commitSha: string;
  signed: boolean;
  createdAt: string;
}

export interface ReleaseNotes {
  id: string;
  tagId: string;
  content: string;
  format: string;
  generatedAt: string;
}
