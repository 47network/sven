// Batch 180: Agent Network Scanner Types

export type NetworkScanType = 'discovery' | 'port_scan' | 'vulnerability' | 'service_detection' | 'os_fingerprint' | 'full';
export type NetworkProtocol = 'tcp' | 'udp' | 'icmp' | 'sctp';
export type NetworkScanStatus = 'pending' | 'scanning' | 'analyzing' | 'completed' | 'failed' | 'cancelled';
export type NetworkHostStatus = 'up' | 'down' | 'filtered' | 'unknown';
export type NetworkVulnSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface NetworkScan {
  id: string;
  scanType: NetworkScanType;
  targetRange: string;
  protocol: NetworkProtocol;
  portRange: string | null;
  status: NetworkScanStatus;
  discoveredHosts: number;
  discoveredServices: number;
  vulnerabilitiesFound: number;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  results: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkHost {
  id: string;
  scanId: string;
  ipAddress: string;
  hostname: string | null;
  macAddress: string | null;
  osFingerprint: string | null;
  status: NetworkHostStatus;
  openPorts: number[];
  services: Record<string, unknown>[];
  lastSeenAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkVulnerability {
  id: string;
  hostId: string;
  cveId: string | null;
  severity: NetworkVulnSeverity;
  title: string;
  description: string | null;
  affectedService: string | null;
  remediation: string | null;
  verified: boolean;
  falsePositive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
