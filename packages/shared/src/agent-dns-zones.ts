export type DnsProvider = 'cloudflare' | 'route53' | 'gcloud' | 'azure' | 'custom';
export type ManagedDnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS' | 'CAA' | 'PTR';
export type ManagedDnsZoneStatus = 'active' | 'pending' | 'suspended' | 'deleted';
export type ManagedDnsChangeType = 'create' | 'update' | 'delete' | 'import' | 'export';

export interface ManagedDnsZone {
  id: string;
  agentId: string;
  zoneName: string;
  provider: DnsProvider;
  status: ManagedDnsZoneStatus;
  dnssecEnabled: boolean;
  ttlDefault: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedDnsRecord {
  id: string;
  zoneId: string;
  name: string;
  recordType: ManagedDnsRecordType;
  value: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DnsChangeLog {
  id: string;
  zoneId: string;
  recordId: string | null;
  changeType: ManagedDnsChangeType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  performedBy: string | null;
  createdAt: string;
}

export interface DnsZoneStats {
  totalZones: number;
  totalRecords: number;
  activeZones: number;
  dnssecEnabled: number;
  recentChanges: number;
}
