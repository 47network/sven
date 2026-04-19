export type PatchTarget = 'prompt' | 'config' | 'skill' | 'workflow' | 'handler' | 'filter';
export type PatchOp = 'replace' | 'append' | 'prepend' | 'delete' | 'merge' | 'wrap';
export type PatchChainStatus = 'draft' | 'testing' | 'applied' | 'rolled_back' | 'failed';
export type PatchAuditAction = 'created' | 'applied' | 'rolled_back' | 'failed' | 'tested';

export interface AgentPatch {
  id: string;
  agentId: string;
  name: string;
  target: PatchTarget;
  operation: PatchOp;
  patchData: Record<string, unknown>;
  rollbackData: Record<string, unknown> | null;
  applied: boolean;
  appliedAt: string | null;
  rolledBack: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PatchChain {
  id: string;
  name: string;
  agentId: string;
  patches: string[];
  status: PatchChainStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PatchAuditEntry {
  id: string;
  patchId: string;
  chainId: string | null;
  action: PatchAuditAction;
  actorAgentId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface HotPatchingStats {
  totalPatches: number;
  appliedPatches: number;
  rolledBackPatches: number;
  totalChains: number;
  activeChains: number;
  failedChains: number;
}
