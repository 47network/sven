export enum SwarmStrategy {
  Consensus = 'consensus',
  RoundRobin = 'round_robin',
  Auction = 'auction',
  Hierarchical = 'hierarchical',
  Emergent = 'emergent',
}

export enum SwarmStatus {
  Forming = 'forming',
  Active = 'active',
  Degraded = 'degraded',
  Dissolving = 'dissolving',
  Dissolved = 'dissolved',
}

export enum SwarmRole {
  Leader = 'leader',
  Worker = 'worker',
  Specialist = 'specialist',
  Observer = 'observer',
  Backup = 'backup',
}

export interface SwarmCluster {
  id: string;
  name: string;
  leaderAgentId: string | null;
  strategy: SwarmStrategy;
  maxMembers: number;
  currentMembers: number;
  status: SwarmStatus;
  objective: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmMember {
  id: string;
  clusterId: string;
  agentId: string;
  role: SwarmRole;
  joinedAt: string;
  lastHeartbeat: string;
  status: string;
  capabilities: string[];
}

export interface SwarmTask {
  id: string;
  clusterId: string;
  assignedTo: string | null;
  taskType: string;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface SwarmCoordinationStats {
  totalClusters: number;
  activeClusters: number;
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
}
