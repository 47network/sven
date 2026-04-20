export type InventorySlot = 'skill' | 'tool' | 'resource' | 'credential' | 'dataset' | 'model' | 'template' | 'artifact';
export type InventoryTxType = 'acquire' | 'consume' | 'transfer' | 'expire' | 'upgrade' | 'downgrade';
export type ReservationStatus = 'held' | 'consumed' | 'released' | 'expired';

export interface AgentInventoryItem {
  id: string;
  agentId: string;
  slot: InventorySlot;
  itemName: string;
  itemVersion: string | null;
  quantity: number;
  maxQuantity: number | null;
  metadata: Record<string, unknown>;
  acquiredAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryId: string;
  transactionType: InventoryTxType;
  quantityChange: number;
  fromAgentId: string | null;
  toAgentId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InventoryReservation {
  id: string;
  inventoryId: string;
  taskId: string | null;
  quantityReserved: number;
  status: ReservationStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTrackingStats {
  totalItems: number;
  totalQuantity: number;
  reservedQuantity: number;
  expiredItems: number;
  transactionCount: number;
  activeReservations: number;
}
