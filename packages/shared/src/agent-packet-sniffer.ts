export type SnifferCaptureStatus = 'running' | 'paused' | 'stopped' | 'error';
export type SnifferProtocol = 'tcp' | 'udp' | 'icmp' | 'arp' | 'dns' | 'http' | 'tls' | 'other';

export interface AgentSnifferConfig { id: string; agent_id: string; sniffer_name: string; interface_name: string; promiscuous_mode: boolean; capture_filter: string | null; max_packet_size: number; ring_buffer_mb: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentSnifferCapture { id: string; config_id: string; capture_name: string; status: SnifferCaptureStatus; packets_count: number; bytes_count: number; pcap_path: string | null; started_at: string; stopped_at: string | null; }
export interface AgentSnifferDissection { id: string; capture_id: string; packet_number: number; protocol: SnifferProtocol | null; source_addr: string | null; dest_addr: string | null; payload_size: number | null; flags: Record<string, unknown>; timestamp: string; }
