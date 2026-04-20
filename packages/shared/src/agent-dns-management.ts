// Batch 99 — Agent DNS Management shared types

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS' | 'CAA' | 'PTR';

export type DnsZoneStatus = 'active' | 'pending' | 'suspended' | 'transferring';

export type DnsPropagationStatus = 'pending' | 'propagating' | 'propagated' | 'failed';

export type DnsChangeType = 'create' | 'update' | 'delete' | 'transfer';

export interface DnsZone {
  id: string;
  agentId: string;
  zoneName: string;
  provider: string;
  nameservers: string[];
  dnssecEnabled: boolean;
  ttlDefault: number;
  status: DnsZoneStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  id: string;
  zoneId: string;
  recordName: string;
  recordType: DnsRecordType;
  recordValue: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DnsChange {
  id: string;
  zoneId: string;
  recordId: string | null;
  changeType: DnsChangeType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  propagationStatus: DnsPropagationStatus;
  performedBy: string;
  createdAt: string;
}

export interface DnsHealthCheck {
  zoneId: string;
  zoneName: string;
  resolvable: boolean;
  latencyMs: number;
  nameserversReachable: boolean;
  dnssecValid: boolean;
}
