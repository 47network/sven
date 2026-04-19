export type HealthCheckType = 'http' | 'https' | 'tcp' | 'dns' | 'icmp' | 'grpc';
export type HealthTargetStatus = 'active' | 'paused' | 'disabled';
export type IncidentType = 'downtime' | 'degradation' | 'timeout' | 'ssl_expiry' | 'dns_failure';

export interface AgentHealthTarget {
  id: string;
  agent_id: string;
  target_name: string;
  target_url: string;
  check_type: HealthCheckType;
  interval_seconds: number;
  timeout_ms: number;
  expected_status: number;
  status: HealthTargetStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentHealthResult {
  id: string;
  target_id: string;
  status_code: number | null;
  response_time_ms: number | null;
  healthy: boolean;
  error_message: string | null;
  checked_at: string;
}

export interface AgentHealthIncident {
  id: string;
  target_id: string;
  incident_type: IncidentType;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
  notification_sent: boolean;
  notes: string | null;
}
