export type StoreType = 's3' | 'gcs' | 'azure_blob' | 'minio' | 'local_fs';
export type ArtifactAction = 'upload' | 'download' | 'delete' | 'list' | 'copy';

export interface AgentArtifactStoreConfig {
  id: string; agent_id: string; store_type: StoreType; bucket_name: string;
  endpoint_url: string; auth_ref: string; retention_policy: Record<string, unknown>;
  max_size_gb: number; status: string; created_at: string; updated_at: string;
}
export interface AgentArtifact {
  id: string; config_id: string; artifact_key: string; version: string;
  content_type: string; size_bytes: number; checksum: string;
  metadata: Record<string, unknown>; uploaded_at: string; expires_at: string | null;
}
export interface AgentArtifactAccessLog {
  id: string; artifact_id: string; accessor_agent_id: string;
  action: ArtifactAction; ip_address: string; accessed_at: string;
}
