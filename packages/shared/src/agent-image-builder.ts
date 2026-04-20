export type BuilderType = 'docker' | 'buildah' | 'kaniko' | 'buildkit' | 'nix';
export type BuildState = 'queued' | 'building' | 'pushing' | 'completed' | 'failed' | 'cancelled';

export interface AgentImgBuilderConfig {
  id: string; agent_id: string; builder_type: BuilderType; base_images: string[];
  build_cache_enabled: boolean; max_concurrent: number; registry_push_url: string;
  status: string; created_at: string; updated_at: string;
}
export interface AgentImgBuild {
  id: string; config_id: string; image_name: string; tag: string;
  dockerfile_ref: string; build_args: Record<string, string>;
  state: BuildState; duration_seconds: number; image_size_mb: number;
  started_at: string; completed_at: string; created_at: string;
}
export interface AgentImgLayer {
  id: string; build_id: string; layer_index: number; command: string;
  size_mb: number; cached: boolean; digest: string;
}
