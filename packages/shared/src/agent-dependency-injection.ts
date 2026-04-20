export type DIScope = 'singleton' | 'transient' | 'scoped' | 'request' | 'session';

export type BindingType = 'class' | 'factory' | 'value' | 'alias' | 'provider' | 'async_factory';

export type ContainerStatus = 'active' | 'frozen' | 'disposed';

export type InterceptorType = 'before_resolve' | 'after_resolve' | 'on_dispose' | 'on_error' | 'middleware';

export type LifecycleEventType = 'created' | 'resolved' | 'cached' | 'disposed' | 'error' | 'intercepted' | 'migrated';

export interface DIContainer {
  id: string;
  name: string;
  parentId?: string;
  scope: DIScope;
  status: ContainerStatus;
  bindingCount: number;
  resolutionCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DIBinding {
  id: string;
  containerId: string;
  token: string;
  bindingType: BindingType;
  implementation?: string;
  scope: DIScope;
  isOptional: boolean;
  tags: string[];
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DIResolution {
  id: string;
  containerId: string;
  bindingId: string;
  token: string;
  resolutionTimeMs: number;
  depth: number;
  cacheHit: boolean;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DIInterceptor {
  id: string;
  containerId: string;
  tokenPattern: string;
  interceptorType: InterceptorType;
  handler: string;
  priority: number;
  isActive: boolean;
  invocationCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DILifecycleEvent {
  id: string;
  containerId: string;
  bindingId?: string;
  eventType: LifecycleEventType;
  token?: string;
  durationMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isContainerActive(c: DIContainer): boolean {
  return c.status === 'active';
}

export function bindingCacheRate(resolutions: DIResolution[]): number {
  if (resolutions.length === 0) return 0;
  return (resolutions.filter(r => r.cacheHit).length / resolutions.length) * 100;
}

export function avgResolutionTime(resolutions: DIResolution[]): number {
  if (resolutions.length === 0) return 0;
  return resolutions.reduce((sum, r) => sum + r.resolutionTimeMs, 0) / resolutions.length;
}
