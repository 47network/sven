// Batch 81 — Agent Plugin System shared types

export type PluginCategory = 'skill' | 'integration' | 'ui' | 'analytics' | 'security' | 'storage' | 'messaging' | 'workflow';
export type PluginStatus = 'draft' | 'published' | 'deprecated' | 'archived' | 'banned';
export type PluginInstallStatus = 'installed' | 'active' | 'disabled' | 'errored' | 'uninstalled';
export type PluginHookType = 'before_task' | 'after_task' | 'on_message' | 'on_error' | 'on_startup' | 'on_shutdown' | 'on_schedule' | 'on_event';
export type PluginEventType = 'installed' | 'activated' | 'deactivated' | 'updated' | 'errored' | 'uninstalled' | 'hook_fired' | 'config_changed';

export interface AgentPlugin {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  version: string;
  author?: string;
  license: string;
  category: PluginCategory;
  status: PluginStatus;
  entryPoint: string;
  hooks: string[];
  dependencies: string[];
  configSchema: Record<string, unknown>;
  iconUrl?: string;
  repositoryUrl?: string;
  downloadCount: number;
  ratingAvg: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PluginInstallation {
  id: string;
  pluginId: string;
  agentId: string;
  version: string;
  status: PluginInstallStatus;
  config: Record<string, unknown>;
  installedAt: string;
  activatedAt?: string;
  lastError?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PluginHook {
  id: string;
  pluginId: string;
  hookType: PluginHookType;
  handler: string;
  priority: number;
  enabled: boolean;
  filterPattern?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PluginEvent {
  id: string;
  pluginId: string;
  installationId?: string;
  eventType: PluginEventType;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  reviewerAgentId: string;
  rating: number;
  title?: string;
  body?: string;
  helpfulCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isPluginCompatible(plugin: Pick<AgentPlugin, 'dependencies'>, installedPlugins: string[]): boolean {
  return plugin.dependencies.every(dep => installedPlugins.includes(dep));
}

export function pluginAvgRating(reviews: Pick<PluginReview, 'rating'>[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function activeHooksForType(hooks: Pick<PluginHook, 'hookType' | 'enabled' | 'priority'>[], type: PluginHookType): typeof hooks {
  return hooks.filter(h => h.hookType === type && h.enabled).sort((a, b) => b.priority - a.priority);
}
