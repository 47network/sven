// Batch 214: Packet Analyzer — deep packet inspection and traffic analysis

export type PacketCaptureFormat = 'pcap' | 'pcapng' | 'json' | 'csv' | 'summary';
export type PacketCaptureStatus = 'pending' | 'capturing' | 'completed' | 'analyzing' | 'failed' | 'archived';
export type PacketAnalysisType = 'protocol_distribution' | 'top_talkers' | 'anomaly_detection' | 'bandwidth_usage' | 'connection_tracking' | 'dns_analysis' | 'tls_inspection' | 'flow_analysis';
export type PacketAnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';
export type PacketRuleType = 'alert' | 'block' | 'log' | 'redirect' | 'rate_limit' | 'tag' | 'sample';
export type PacketRuleProtocol = 'tcp' | 'udp' | 'icmp' | 'http' | 'https' | 'dns' | 'tls' | 'any';

export interface AgentPacketCapture {
  id: string;
  agentId: string;
  captureName: string;
  interfaceName: string;
  filterExpression: string | null;
  captureFormat: PacketCaptureFormat;
  status: PacketCaptureStatus;
  packetCount: number;
  bytesCaptured: number;
  durationSeconds: number | null;
  startTime: string | null;
  endTime: string | null;
  storagePath: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPacketAnalysis {
  id: string;
  captureId: string;
  agentId: string;
  analysisType: PacketAnalysisType;
  status: PacketAnalysisStatus;
  results: Record<string, unknown>;
  summary: string | null;
  findingsCount: number;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentPacketRule {
  id: string;
  agentId: string;
  ruleName: string;
  ruleType: PacketRuleType;
  protocol: PacketRuleProtocol | null;
  sourceFilter: string | null;
  destinationFilter: string | null;
  portRange: string | null;
  pattern: string | null;
  actionConfig: Record<string, unknown>;
  enabled: boolean;
  hitCount: number;
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
