export interface TrafficRoute {
  id: string;
  agentId: string;
  name: string;
  sourcePattern: string;
  destination: string;
  method: string;
  priority: number;
  weight: number;
  status: TrafficRouteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TrafficRule {
  id: string;
  routeId: string;
  ruleType: TrafficRuleType;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface TrafficAnalytics {
  id: string;
  routeId: string;
  periodStart: string;
  periodEnd: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  createdAt: string;
}

export type TrafficRouteStatus = 'active' | 'inactive' | 'canary' | 'shadow' | 'draining' | 'error';
export type TrafficRuleType = 'rate_limit' | 'geo_block' | 'header_match' | 'cookie_match' | 'ab_test' | 'circuit_break' | 'retry' | 'timeout';
