export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'PTR';
export type DnsResponseCode = 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | 'REFUSED' | 'TIMEOUT';

export interface AgentDnsGatewayConfig {
  id: string;
  agentId: string;
  gatewayName: string;
  upstreamServers: string[];
  cacheTtl: number;
  maxCacheEntries: number;
  dnssecEnabled: boolean;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDnsRecord {
  id: string;
  configId: string;
  recordName: string;
  recordType: DnsRecordType;
  recordValue: string;
  ttl: number;
  priority: number | null;
  status: string;
  createdAt: string;
}

export interface AgentDnsQuery {
  id: string;
  configId: string;
  queryName: string;
  queryType: string;
  responseCode: DnsResponseCode | null;
  responseTimeMs: number | null;
  cached: boolean;
  queriedAt: string;
}
