export type BuildStatus = 'pending' | 'building' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentContainerConfig {
  id: string;
  agent_id: string;
  base_image: string;
  build_context: string;
  dockerfile_path: string;
  cache_enabled: boolean;
  multi_stage: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentContainerBuild {
  id: string;
  config_id: string;
  image_tag: string;
  status: BuildStatus;
  build_log?: string;
  duration_ms?: number;
  image_size_bytes?: number;
  layer_count?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface AgentContainerLayer {
  id: string;
  build_id: string;
  layer_index: number;
  instruction: string;
  size_bytes: number;
  cached: boolean;
  digest?: string;
  created_at: string;
}
