export interface PodSchedulerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  schedulingStrategy: string;
  priorityClass: string;
  nodeAffinity: Record<string, unknown>;
  resourceRequests: Record<string, unknown>;
  preemptionAllowed: boolean;
  maxReplicas: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ScheduledPod {
  id: string;
  configId: string;
  podName: string;
  nodeName: string;
  status: string;
  resources: Record<string, unknown>;
  scheduledAt: string;
}
export interface SchedulingDecision {
  id: string;
  podId: string;
  reason: string;
  score: number;
  candidateNodes: string[];
  selectedNode: string;
  decidedAt: string;
}
