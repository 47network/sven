/* Batch 145 — Agent Signal Dispatch */

export enum SignalKind {
  Command = 'command',
  Query = 'query',
  Event = 'event',
  Alert = 'alert',
  Heartbeat = 'heartbeat',
  Shutdown = 'shutdown',
  Restart = 'restart',
}

export enum SignalPriority {
  Critical = 'critical',
  High = 'high',
  Normal = 'normal',
  Low = 'low',
  Background = 'background',
}

export enum DispatchMode {
  Broadcast = 'broadcast',
  Unicast = 'unicast',
  Multicast = 'multicast',
  Anycast = 'anycast',
}

export enum DeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Acknowledged = 'acknowledged',
  Failed = 'failed',
  Expired = 'expired',
}

export interface AgentSignal {
  id: string;
  senderId: string;
  signalKind: SignalKind;
  priority: SignalPriority;
  payload: Record<string, unknown>;
  ttlSeconds: number;
  dispatchMode: DispatchMode;
  deliveredCount: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface SignalSubscription {
  id: string;
  agentId: string;
  signalKind: string;
  filterPattern?: string;
  callbackUrl?: string;
  isActive: boolean;
  receivedCount: number;
  lastReceived?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignalDelivery {
  id: string;
  signalId: string;
  recipientId: string;
  subscriptionId?: string;
  status: DeliveryStatus;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export interface SignalDispatchStats {
  totalSignals: number;
  totalSubscriptions: number;
  deliveryRate: number;
  avgLatencyMs: number;
  failedDeliveries: number;
}
