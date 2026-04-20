// Batch 181: Agent DNS Manager Types

export type DnsZoneType = 'primary' | 'secondary' | 'stub' | 'forward';
export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA' | 'PTR' | 'SOA';
export type DnsZoneStatus = 'active' | 'pending' | 'suspended' | 'transferring' | 'error';
export type DnsRecordStatus = 'active' | 'pending' | 'propagating' | 'error' | 'disabled';
export type DnsHealthCheckType = 'http' | 'https' | 'tcp' | 'udp' | 'icmp';
export type DnsHealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

export interface DnsZone {
  id: string;
  domain: string;
  zoneType: DnsZoneType;
  provider: string | null;
  nameservers: string[];
  dnssecEnabled: boolean;
  ttlDefault: number;
  recordCount: number;
  status: DnsZoneStatus;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  id: string;
  zoneId: string;
  name: string;
  recordType: DnsRecordType;
  value: string;
  ttl: number;
  priority: number | null;
  weight: number | null;
  port: number | null;
  proxied: boolean;
  healthCheckId: string | null;
  status: DnsRecordStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DnsHealthCheck {
  id: string;
  recordId: string;
  checkType: DnsHealthCheckType;
  endpoint: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  lastStatus: DnsHealthStatus;
  lastCheckedAt: string | null;
  consecutiveFailures: number;
  failoverRecordId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
