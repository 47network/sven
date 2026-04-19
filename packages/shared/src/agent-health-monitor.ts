// Batch 187: Agent Health Monitor — service health checks, uptime, incident detection

export type HealthCheckType = 'http' | 'tcp' | 'dns' | 'icmp' | 'grpc' | 'websocket' | 'custom';

export type HealthEndpointStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'maintenance';

export type HealthEndpointState = 'active' | 'paused' | 'disabled' | 'archived';

export type HealthCheckResult = 'success' | 'failure' | 'timeout' | 'error' | 'degraded';

export type HealthIncidentType = 'outage' | 'degradation' | 'latency_spike' | 'error_rate' | 'certificate' | 'dns_failure';

export type HealthIncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface HealthEndpoint {
  id: string;
  agent_id: string;
  endpoint_name: string;
  endpoint_url: string;
  check_type: HealthCheckType;
  interval_seconds: number;
  timeout_seconds: number;
  expected_status: number | null;
  expected_body: string | null;
  headers: Record<string, string>;
  current_status: HealthEndpointStatus;
  uptime_percent: number;
  consecutive_failures: number;
  last_check_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  status: HealthEndpointState;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HealthCheck {
  id: string;
  endpoint_id: string;
  response_time_ms: number;
  status_code: number | null;
  result: HealthCheckResult;
  error_message: string | null;
  response_body: string | null;
  metadata: Record<string, unknown>;
  checked_at: string;
}

export interface HealthIncident {
  id: string;
  endpoint_id: string;
  incident_type: HealthIncidentType;
  severity: string;
  title: string;
  description: string | null;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
  root_cause: string | null;
  resolution: string | null;
  affected_services: string[];
  status: HealthIncidentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}
