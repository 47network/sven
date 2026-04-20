export type FederationAuthMethod = 'token' | 'mtls' | 'oauth' | 'api_key';
export type FederationPeerStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type FederationLinkType = 'collaboration' | 'delegation' | 'mirroring' | 'subscription';
export type FederationMsgType = 'task' | 'result' | 'event' | 'heartbeat' | 'sync' | 'query';
export type FederationMsgStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';

export interface FederationPeer {
  id: string;
  instanceId: string;
  instanceName: string;
  endpointUrl: string;
  authMethod: FederationAuthMethod;
  status: FederationPeerStatus;
  trustLevel: number;
  lastSync: string | null;
  capabilities: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FederationLink {
  id: string;
  localAgentId: string;
  peerId: string;
  remoteAgentId: string;
  linkType: FederationLinkType;
  bidirectional: boolean;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FederationMessage {
  id: string;
  linkId: string;
  direction: 'outbound' | 'inbound';
  messageType: FederationMsgType;
  payload: Record<string, unknown>;
  status: FederationMsgStatus;
  retryCount: number;
  createdAt: string;
  deliveredAt: string | null;
}

export interface FederationProtocolStats {
  totalPeers: number;
  activePeers: number;
  totalLinks: number;
  activeLinks: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
}
