export interface DnsZone {
  id: string;
  agentId: string;
  domain: string;
  zoneType: DnsZoneType;
  ttlSeconds: number;
  dnssecEnabled: boolean;
  status: DnsZoneStatus;
  nameservers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  id: string;
  zoneId: string;
  name: string;
  recordType: DnsRecordType;
  value: string;
  ttlSeconds: number;
  priority: number | null;
  weight: number | null;
  port: number | null;
  proxied: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DnsQueryLog {
  id: string;
  zoneId: string;
  queryName: string;
  queryType: string;
  responseCode: string;
  latencyMs: number;
  sourceIp: string;
  cached: boolean;
  queriedAt: string;
}

export type DnsZoneType = 'primary' | 'secondary' | 'forward' | 'stub' | 'delegation';
export type DnsZoneStatus = 'pending' | 'active' | 'propagating' | 'error' | 'suspended' | 'archived';
export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS' | 'PTR' | 'SOA' | 'CAA';
