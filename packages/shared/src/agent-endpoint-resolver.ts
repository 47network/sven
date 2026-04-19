export type EndpointProtocol = 'http' | 'https' | 'grpc' | 'ws' | 'wss' | 'tcp' | 'udp';
export type EndpointStatus = 'active' | 'draining' | 'unhealthy' | 'deregistered';
export type HealthCheckStatus = 'healthy' | 'unhealthy' | 'degraded' | 'timeout';
export type RoutingRuleType = 'weighted' | 'priority' | 'latency' | 'geographic' | 'header_based' | 'canary';

export interface AgentEndpointRegistration {
  id: string;
  agentId: string;
  serviceName: string;
  endpointUrl: string;
  protocol: EndpointProtocol;
  status: EndpointStatus;
  weight: number;
  priority: number;
  healthCheckUrl?: string;
  region?: string;
  metadata: Record<string, unknown>;
}

export interface AgentEndpointHealthCheck {
  id: string;
  registrationId: string;
  status: HealthCheckStatus;
  responseTimeMs?: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface AgentEndpointRoutingRule {
  id: string;
  agentId: string;
  serviceName: string;
  ruleType: RoutingRuleType;
  conditions: Record<string, unknown>;
  targetEndpoints: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
}
