export interface NodeDrainerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  gracePeriodSeconds: number;
  forceDrain: boolean;
  cordonBeforeDrain: boolean;
  skipDaemonsets: boolean;
  podEvictionTimeout: number;
  notificationWebhook: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface DrainOperation {
  id: string;
  configId: string;
  nodeName: string;
  status: string;
  podsEvicted: number;
  podsFailed: number;
  startedAt: string;
  completedAt: string | null;
}
export interface EvictedPod {
  id: string;
  operationId: string;
  podName: string;
  namespace: string;
  rescheduledTo: string | null;
  evictedAt: string;
}
