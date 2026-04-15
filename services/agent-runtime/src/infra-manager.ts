// ---------------------------------------------------------------------------
// Infrastructure Self-Management Engine (I.4)
// ---------------------------------------------------------------------------
// Sven manages its own infrastructure on sven.systems and the47network.com.
// Cost monitoring, auto-scaling decisions, upgrade proposals, health checks,
// and deployment management.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';

const logger = createLogger('infra-manager');

/* ------------------------------------------------------------------ types */

export type NodeStatus = 'healthy' | 'degraded' | 'down' | 'maintenance' | 'provisioning';
export type ResourceType = 'cpu' | 'memory' | 'disk' | 'gpu' | 'bandwidth' | 'container';
export type ProposalStatus = 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected';
export type ScalingDirection = 'up' | 'down' | 'none';
export type DeploymentStatus = 'queued' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed' | 'rolled_back';

export interface InfraNode {
  id: string;
  orgId: string;
  hostname: string;
  domain: string;
  provider: string;
  region: string;
  status: NodeStatus;
  resources: NodeResources;
  costs: NodeCosts;
  services: string[];
  tags: string[];
  createdAt: string;
  lastHealthCheck: string | null;
}

export interface NodeResources {
  cpuCores: number;
  cpuUsagePct: number;
  memoryGb: number;
  memoryUsagePct: number;
  diskGb: number;
  diskUsagePct: number;
  gpuVramGb: number;
  gpuUsagePct: number;
  bandwidthMbps: number;
  bandwidthUsagePct: number;
  containerCount: number;
  containerLimit: number;
}

export interface NodeCosts {
  monthlyCost: number;
  currency: string;
  costPerCpuHour: number;
  costPerGbMonth: number;
  bandwidthCostPerGb: number;
  lastBillingDate: string | null;
}

export interface HealthCheck {
  nodeId: string;
  timestamp: string;
  status: NodeStatus;
  latencyMs: number;
  services: Array<{
    name: string;
    status: 'ok' | 'degraded' | 'down';
    responseTimeMs: number;
    details?: string;
  }>;
  resources: NodeResources;
}

export interface ScalingDecision {
  id: string;
  nodeId: string;
  resource: ResourceType;
  direction: ScalingDirection;
  currentValue: number;
  targetValue: number;
  reason: string;
  estimatedCostDelta: number;
  confidence: number;
  createdAt: string;
}

export interface UpgradeProposal {
  id: string;
  orgId: string;
  title: string;
  description: string;
  nodeId: string | null;
  proposalType: 'scale_up' | 'scale_down' | 'migrate' | 'new_node' | 'decommission' | 'optimize';
  currentCost: number;
  proposedCost: number;
  costDelta: number;
  expectedBenefit: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: ProposalStatus;
  approvedBy: string | null;
  executionLog: string[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface ServiceDeployment {
  id: string;
  nodeId: string;
  serviceName: string;
  version: string;
  image: string;
  status: DeploymentStatus;
  port: number;
  healthEndpoint: string;
  envVars: string[]; // key names only, never values
  cpuLimit: string;
  memoryLimit: string;
  replicas: number;
  createdAt: string;
  updatedAt: string;
}

export interface CostReport {
  period: string;
  totalCost: number;
  byNode: Array<{ nodeId: string; hostname: string; cost: number }>;
  byResource: Array<{ resource: ResourceType; cost: number }>;
  trend: 'increasing' | 'stable' | 'decreasing';
  projectedMonthlyCost: number;
  savingsOpportunities: Array<{ description: string; estimatedSavings: number }>;
}

export interface InfraStats {
  totalNodes: number;
  healthyNodes: number;
  degradedNodes: number;
  downNodes: number;
  totalCpuCores: number;
  totalMemoryGb: number;
  totalDiskGb: number;
  totalGpuVramGb: number;
  avgCpuUsagePct: number;
  avgMemoryUsagePct: number;
  totalMonthlyCost: number;
  totalDeployments: number;
  pendingProposals: number;
  activeAlerts: number;
}

/* ------------------------------------------ goal tracking (I.5.5) */

export type GoalType = 'revenue' | 'infrastructure' | 'cost_reduction' | 'performance' | 'uptime' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'cancelled';

export interface Goal {
  id: string;
  orgId: string;
  type: GoalType;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  status: GoalStatus;
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  label: string;
  targetValue: number;
  achieved: boolean;
  achievedAt: string | null;
}

/* ------------------------------------------ scaling thresholds */

export interface ScalingPolicy {
  resource: ResourceType;
  scaleUpThreshold: number;   // percentage
  scaleDownThreshold: number;  // percentage
  cooldownMs: number;          // min time between scaling events
  minValue: number;
  maxValue: number;
}

const DEFAULT_SCALING_POLICIES: ScalingPolicy[] = [
  { resource: 'cpu', scaleUpThreshold: 80, scaleDownThreshold: 20, cooldownMs: 300_000, minValue: 1, maxValue: 64 },
  { resource: 'memory', scaleUpThreshold: 85, scaleDownThreshold: 25, cooldownMs: 300_000, minValue: 1, maxValue: 256 },
  { resource: 'disk', scaleUpThreshold: 90, scaleDownThreshold: 30, cooldownMs: 3600_000, minValue: 10, maxValue: 2000 },
  { resource: 'gpu', scaleUpThreshold: 90, scaleDownThreshold: 15, cooldownMs: 600_000, minValue: 0, maxValue: 80 },
  { resource: 'bandwidth', scaleUpThreshold: 75, scaleDownThreshold: 10, cooldownMs: 600_000, minValue: 100, maxValue: 10000 },
];

/* ------------------------------------------ stores (in-memory) */

const nodeStore = new Map<string, InfraNode>();
const healthLog: HealthCheck[] = [];
const proposalStore = new Map<string, UpgradeProposal>();
const deploymentStore = new Map<string, ServiceDeployment>();
const scalingDecisions: ScalingDecision[] = [];
const goalStore = new Map<string, Goal>();

const MAX_NODES = 50;
const MAX_HEALTH_LOG = 5000;
const MAX_PROPOSALS = 200;
const MAX_DEPLOYMENTS = 500;
const MAX_SCALING = 1000;
const MAX_GOALS = 100;

let nodeCounter = 0;
let proposalCounter = 0;
let deploymentCounter = 0;
let scalingCounter = 0;
let goalCounter = 0;

/* ------------------------------------------ node management */

export function registerNode(params: {
  orgId: string;
  hostname: string;
  domain: string;
  provider: string;
  region: string;
  resources: Partial<NodeResources>;
  costs?: Partial<NodeCosts>;
  services?: string[];
  tags?: string[];
}): InfraNode {
  if (nodeStore.size >= MAX_NODES) {
    throw new Error(`Maximum node limit (${MAX_NODES}) reached`);
  }

  nodeCounter++;
  const id = `node-${Date.now()}-${nodeCounter}`;

  const node: InfraNode = {
    id,
    orgId: params.orgId,
    hostname: params.hostname,
    domain: params.domain,
    provider: params.provider,
    region: params.region,
    status: 'provisioning',
    resources: {
      cpuCores: 0, cpuUsagePct: 0,
      memoryGb: 0, memoryUsagePct: 0,
      diskGb: 0, diskUsagePct: 0,
      gpuVramGb: 0, gpuUsagePct: 0,
      bandwidthMbps: 0, bandwidthUsagePct: 0,
      containerCount: 0, containerLimit: 10,
      ...params.resources,
    },
    costs: {
      monthlyCost: 0, currency: 'USD',
      costPerCpuHour: 0, costPerGbMonth: 0,
      bandwidthCostPerGb: 0, lastBillingDate: null,
      ...params.costs,
    },
    services: params.services || [],
    tags: params.tags || [],
    createdAt: new Date().toISOString(),
    lastHealthCheck: null,
  };

  nodeStore.set(id, node);
  logger.info('Infrastructure node registered', { id, hostname: params.hostname, domain: params.domain });
  return node;
}

export function getNode(id: string): InfraNode | undefined {
  return nodeStore.get(id);
}

export function listNodes(orgId?: string, status?: NodeStatus): InfraNode[] {
  let nodes = [...nodeStore.values()];
  if (orgId) nodes = nodes.filter((n) => n.orgId === orgId);
  if (status) nodes = nodes.filter((n) => n.status === status);
  return nodes.sort((a, b) => a.hostname.localeCompare(b.hostname));
}

export function updateNodeStatus(id: string, status: NodeStatus): InfraNode | undefined {
  const node = nodeStore.get(id);
  if (!node) return undefined;
  node.status = status;
  logger.info('Node status updated', { id, hostname: node.hostname, status });
  return node;
}

export function decommissionNode(id: string): InfraNode | undefined {
  const node = nodeStore.get(id);
  if (!node) return undefined;
  node.status = 'down';
  node.services = [];
  logger.info('Node decommissioned', { id, hostname: node.hostname });
  return node;
}

/* ------------------------------------------ health checks */

export function recordHealthCheck(check: HealthCheck): void {
  if (healthLog.length >= MAX_HEALTH_LOG) {
    healthLog.splice(0, healthLog.length - MAX_HEALTH_LOG + 500);
  }
  healthLog.push(check);

  const node = nodeStore.get(check.nodeId);
  if (node) {
    node.status = check.status;
    node.resources = check.resources;
    node.lastHealthCheck = check.timestamp;
  }
}

export function getHealthHistory(nodeId: string, limit = 50): HealthCheck[] {
  return healthLog
    .filter((h) => h.nodeId === nodeId)
    .slice(-limit);
}

export function getLatestHealth(nodeId: string): HealthCheck | undefined {
  for (let i = healthLog.length - 1; i >= 0; i--) {
    if (healthLog[i].nodeId === nodeId) return healthLog[i];
  }
  return undefined;
}

/* ------------------------------------------ scaling decisions */

export function evaluateScaling(nodeId: string, policies?: ScalingPolicy[]): ScalingDecision[] {
  const node = nodeStore.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);

  const activePolicies = policies || DEFAULT_SCALING_POLICIES;
  const decisions: ScalingDecision[] = [];

  const resourceUsage: Record<ResourceType, { current: number; capacity: number }> = {
    cpu: { current: node.resources.cpuUsagePct, capacity: node.resources.cpuCores },
    memory: { current: node.resources.memoryUsagePct, capacity: node.resources.memoryGb },
    disk: { current: node.resources.diskUsagePct, capacity: node.resources.diskGb },
    gpu: { current: node.resources.gpuUsagePct, capacity: node.resources.gpuVramGb },
    bandwidth: { current: node.resources.bandwidthUsagePct, capacity: node.resources.bandwidthMbps },
    container: { current: (node.resources.containerCount / Math.max(node.resources.containerLimit, 1)) * 100, capacity: node.resources.containerLimit },
  };

  for (const policy of activePolicies) {
    const usage = resourceUsage[policy.resource];
    if (!usage) continue;

    let direction: ScalingDirection = 'none';
    let reason = '';

    if (usage.current >= policy.scaleUpThreshold && usage.capacity < policy.maxValue) {
      direction = 'up';
      reason = `${policy.resource} usage at ${usage.current.toFixed(1)}% exceeds ${policy.scaleUpThreshold}% threshold`;
    } else if (usage.current <= policy.scaleDownThreshold && usage.capacity > policy.minValue) {
      direction = 'down';
      reason = `${policy.resource} usage at ${usage.current.toFixed(1)}% below ${policy.scaleDownThreshold}% threshold`;
    }

    if (direction !== 'none') {
      scalingCounter++;
      const targetValue = direction === 'up'
        ? Math.min(usage.capacity * 1.5, policy.maxValue)
        : Math.max(usage.capacity * 0.7, policy.minValue);

      const costDelta = direction === 'up'
        ? (targetValue - usage.capacity) * (node.costs.costPerCpuHour || 0.05) * 720
        : (usage.capacity - targetValue) * (node.costs.costPerCpuHour || 0.05) * 720 * -1;

      const decision: ScalingDecision = {
        id: `scale-${Date.now()}-${scalingCounter}`,
        nodeId,
        resource: policy.resource,
        direction,
        currentValue: usage.capacity,
        targetValue: Math.round(targetValue * 10) / 10,
        reason,
        estimatedCostDelta: Math.round(costDelta * 100) / 100,
        confidence: Math.min(1, Math.abs(usage.current - (direction === 'up' ? policy.scaleUpThreshold : policy.scaleDownThreshold)) / 20),
        createdAt: new Date().toISOString(),
      };

      decisions.push(decision);
      if (scalingDecisions.length >= MAX_SCALING) {
        scalingDecisions.splice(0, scalingDecisions.length - MAX_SCALING + 100);
      }
      scalingDecisions.push(decision);
    }
  }

  return decisions;
}

export function listScalingDecisions(nodeId?: string, limit = 50): ScalingDecision[] {
  let decisions = [...scalingDecisions];
  if (nodeId) decisions = decisions.filter((d) => d.nodeId === nodeId);
  return decisions.slice(-limit);
}

/* ------------------------------------------ upgrade proposals */

export function createProposal(params: {
  orgId: string;
  title: string;
  description: string;
  nodeId?: string;
  proposalType: UpgradeProposal['proposalType'];
  currentCost: number;
  proposedCost: number;
  expectedBenefit: string;
  riskLevel: 'low' | 'medium' | 'high';
}): UpgradeProposal {
  if (proposalStore.size >= MAX_PROPOSALS) {
    const old = [...proposalStore.entries()]
      .find(([, p]) => p.status === 'completed' || p.status === 'rejected');
    if (old) proposalStore.delete(old[0]);
  }

  proposalCounter++;
  const id = `prop-${Date.now()}-${proposalCounter}`;

  const proposal: UpgradeProposal = {
    id,
    orgId: params.orgId,
    title: params.title,
    description: params.description,
    nodeId: params.nodeId || null,
    proposalType: params.proposalType,
    currentCost: params.currentCost,
    proposedCost: params.proposedCost,
    costDelta: params.proposedCost - params.currentCost,
    expectedBenefit: params.expectedBenefit,
    riskLevel: params.riskLevel,
    status: 'draft',
    approvedBy: null,
    executionLog: [],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  proposalStore.set(id, proposal);
  logger.info('Upgrade proposal created', { id, title: params.title, type: params.proposalType });
  return proposal;
}

export function approveProposal(id: string, approver: string): UpgradeProposal | undefined {
  const proposal = proposalStore.get(id);
  if (!proposal) return undefined;
  if (proposal.status !== 'pending_approval') return proposal;
  proposal.status = 'approved';
  proposal.approvedBy = approver;
  proposal.executionLog.push(`Approved by ${approver} at ${new Date().toISOString()}`);
  return proposal;
}

export function rejectProposal(id: string, reason: string): UpgradeProposal | undefined {
  const proposal = proposalStore.get(id);
  if (!proposal) return undefined;
  proposal.status = 'rejected';
  proposal.resolvedAt = new Date().toISOString();
  proposal.executionLog.push(`Rejected: ${reason} at ${new Date().toISOString()}`);
  return proposal;
}

export function submitProposal(id: string): UpgradeProposal | undefined {
  const proposal = proposalStore.get(id);
  if (!proposal) return undefined;
  if (proposal.status !== 'draft') return proposal;
  proposal.status = 'pending_approval';
  proposal.executionLog.push(`Submitted for approval at ${new Date().toISOString()}`);
  return proposal;
}

export function completeProposal(id: string, log?: string): UpgradeProposal | undefined {
  const proposal = proposalStore.get(id);
  if (!proposal) return undefined;
  proposal.status = 'completed';
  proposal.resolvedAt = new Date().toISOString();
  if (log) proposal.executionLog.push(log);
  return proposal;
}

export function getProposal(id: string): UpgradeProposal | undefined {
  return proposalStore.get(id);
}

export function listProposals(orgId?: string, status?: ProposalStatus): UpgradeProposal[] {
  let proposals = [...proposalStore.values()];
  if (orgId) proposals = proposals.filter((p) => p.orgId === orgId);
  if (status) proposals = proposals.filter((p) => p.status === status);
  return proposals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------------------ service deployments (I.4.5) */

export function createDeployment(params: {
  nodeId: string;
  serviceName: string;
  version: string;
  image: string;
  port: number;
  healthEndpoint?: string;
  envVars?: string[];
  cpuLimit?: string;
  memoryLimit?: string;
  replicas?: number;
}): ServiceDeployment {
  const node = nodeStore.get(params.nodeId);
  if (!node) throw new Error(`Node ${params.nodeId} not found`);

  if (deploymentStore.size >= MAX_DEPLOYMENTS) {
    const stopped = [...deploymentStore.entries()]
      .find(([, d]) => d.status === 'stopped' || d.status === 'failed');
    if (stopped) deploymentStore.delete(stopped[0]);
  }

  deploymentCounter++;
  const id = `deploy-${Date.now()}-${deploymentCounter}`;
  const now = new Date().toISOString();

  const deployment: ServiceDeployment = {
    id,
    nodeId: params.nodeId,
    serviceName: params.serviceName,
    version: params.version,
    image: params.image,
    status: 'queued',
    port: params.port,
    healthEndpoint: params.healthEndpoint || '/healthz',
    envVars: params.envVars || [],
    cpuLimit: params.cpuLimit || '1000m',
    memoryLimit: params.memoryLimit || '512Mi',
    replicas: params.replicas || 1,
    createdAt: now,
    updatedAt: now,
  };

  deploymentStore.set(id, deployment);

  // Add service to node
  if (!node.services.includes(params.serviceName)) {
    node.services.push(params.serviceName);
  }

  logger.info('Service deployment created', {
    id, nodeId: params.nodeId, service: params.serviceName, version: params.version,
  });
  return deployment;
}

export function updateDeploymentStatus(id: string, status: DeploymentStatus): ServiceDeployment | undefined {
  const deployment = deploymentStore.get(id);
  if (!deployment) return undefined;
  deployment.status = status;
  deployment.updatedAt = new Date().toISOString();
  return deployment;
}

export function getDeployment(id: string): ServiceDeployment | undefined {
  return deploymentStore.get(id);
}

export function listDeployments(nodeId?: string, status?: DeploymentStatus): ServiceDeployment[] {
  let deployments = [...deploymentStore.values()];
  if (nodeId) deployments = deployments.filter((d) => d.nodeId === nodeId);
  if (status) deployments = deployments.filter((d) => d.status === status);
  return deployments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------------------ cost reporting (I.4.2) */

export function generateCostReport(orgId: string, periodDays = 30): CostReport {
  const nodes = listNodes(orgId);
  const totalCost = nodes.reduce((sum, n) => sum + n.costs.monthlyCost, 0);

  const byNode = nodes.map((n) => ({
    nodeId: n.id,
    hostname: n.hostname,
    cost: n.costs.monthlyCost,
  })).sort((a, b) => b.cost - a.cost);

  const byResource: CostReport['byResource'] = [
    { resource: 'cpu', cost: nodes.reduce((s, n) => s + n.costs.costPerCpuHour * n.resources.cpuCores * 720, 0) },
    { resource: 'memory', cost: nodes.reduce((s, n) => s + n.costs.costPerGbMonth * n.resources.memoryGb, 0) },
    { resource: 'bandwidth', cost: nodes.reduce((s, n) => s + n.costs.bandwidthCostPerGb * n.resources.bandwidthMbps * 0.001 * 30, 0) },
    { resource: 'disk', cost: totalCost * 0.1 }, // rough estimate
    { resource: 'gpu', cost: totalCost * 0.3 },
    { resource: 'container', cost: 0 },
  ];

  // Savings opportunities
  const savings: CostReport['savingsOpportunities'] = [];
  for (const n of nodes) {
    if (n.resources.cpuUsagePct < 20 && n.resources.cpuCores > 2) {
      savings.push({ description: `Downsize CPU on ${n.hostname} (${n.resources.cpuUsagePct.toFixed(0)}% utilization)`, estimatedSavings: n.costs.monthlyCost * 0.3 });
    }
    if (n.resources.memoryUsagePct < 25 && n.resources.memoryGb > 4) {
      savings.push({ description: `Reduce memory on ${n.hostname} (${n.resources.memoryUsagePct.toFixed(0)}% utilization)`, estimatedSavings: n.costs.monthlyCost * 0.15 });
    }
    if (n.status === 'down' && n.costs.monthlyCost > 0) {
      savings.push({ description: `Decommission offline node ${n.hostname}`, estimatedSavings: n.costs.monthlyCost });
    }
  }

  return {
    period: `${periodDays} days`,
    totalCost: Math.round(totalCost * 100) / 100,
    byNode,
    byResource,
    trend: 'stable',
    projectedMonthlyCost: Math.round(totalCost * 100) / 100,
    savingsOpportunities: savings,
  };
}

/* ------------------------------------------ goal tracking (I.5.5) */

export function createGoal(params: {
  orgId: string;
  type: GoalType;
  title: string;
  description: string;
  targetValue: number;
  unit: string;
  deadline: string;
  milestones?: Array<{ label: string; targetValue: number }>;
}): Goal {
  if (goalStore.size >= MAX_GOALS) {
    const achieved = [...goalStore.entries()]
      .find(([, g]) => g.status === 'achieved' || g.status === 'cancelled');
    if (achieved) goalStore.delete(achieved[0]);
  }

  goalCounter++;
  const id = `goal-${Date.now()}-${goalCounter}`;
  const now = new Date().toISOString();

  const goal: Goal = {
    id,
    orgId: params.orgId,
    type: params.type,
    title: params.title,
    description: params.description,
    targetValue: params.targetValue,
    currentValue: 0,
    unit: params.unit,
    deadline: params.deadline,
    status: 'active',
    milestones: (params.milestones || []).map((m) => ({
      label: m.label,
      targetValue: m.targetValue,
      achieved: false,
      achievedAt: null,
    })),
    createdAt: now,
    updatedAt: now,
  };

  goalStore.set(id, goal);
  logger.info('Goal created', { id, type: params.type, title: params.title, target: params.targetValue });
  return goal;
}

export function updateGoalProgress(id: string, currentValue: number): Goal | undefined {
  const goal = goalStore.get(id);
  if (!goal) return undefined;
  if (goal.status !== 'active') return goal;

  goal.currentValue = currentValue;
  goal.updatedAt = new Date().toISOString();

  // Check milestones
  for (const milestone of goal.milestones) {
    if (!milestone.achieved && currentValue >= milestone.targetValue) {
      milestone.achieved = true;
      milestone.achievedAt = new Date().toISOString();
      logger.info('Goal milestone achieved', { goalId: id, milestone: milestone.label });
    }
  }

  // Check goal completion
  if (currentValue >= goal.targetValue) {
    goal.status = 'achieved';
    logger.info('Goal achieved', { id, title: goal.title });
  }

  // Check deadline
  if (new Date(goal.deadline) < new Date() && goal.status === 'active') {
    goal.status = currentValue >= goal.targetValue ? 'achieved' : 'missed';
  }

  return goal;
}

export function getGoal(id: string): Goal | undefined {
  return goalStore.get(id);
}

export function listGoals(orgId?: string, type?: GoalType, status?: GoalStatus): Goal[] {
  let goals = [...goalStore.values()];
  if (orgId) goals = goals.filter((g) => g.orgId === orgId);
  if (type) goals = goals.filter((g) => g.type === type);
  if (status) goals = goals.filter((g) => g.status === status);
  return goals.sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export function cancelGoal(id: string): Goal | undefined {
  const goal = goalStore.get(id);
  if (!goal) return undefined;
  goal.status = 'cancelled';
  goal.updatedAt = new Date().toISOString();
  return goal;
}

/* ------------------------------------------ infra stats */

export function getInfraStats(orgId?: string): InfraStats {
  let nodes = [...nodeStore.values()];
  if (orgId) nodes = nodes.filter((n) => n.orgId === orgId);

  const totalCpuCores = nodes.reduce((s, n) => s + n.resources.cpuCores, 0);
  const totalMemoryGb = nodes.reduce((s, n) => s + n.resources.memoryGb, 0);
  const totalDiskGb = nodes.reduce((s, n) => s + n.resources.diskGb, 0);
  const totalGpuVramGb = nodes.reduce((s, n) => s + n.resources.gpuVramGb, 0);

  const activeNodes = nodes.filter((n) => n.status === 'healthy' || n.status === 'degraded');
  const avgCpu = activeNodes.length > 0 ? activeNodes.reduce((s, n) => s + n.resources.cpuUsagePct, 0) / activeNodes.length : 0;
  const avgMem = activeNodes.length > 0 ? activeNodes.reduce((s, n) => s + n.resources.memoryUsagePct, 0) / activeNodes.length : 0;

  return {
    totalNodes: nodes.length,
    healthyNodes: nodes.filter((n) => n.status === 'healthy').length,
    degradedNodes: nodes.filter((n) => n.status === 'degraded').length,
    downNodes: nodes.filter((n) => n.status === 'down').length,
    totalCpuCores,
    totalMemoryGb,
    totalDiskGb,
    totalGpuVramGb,
    avgCpuUsagePct: Math.round(avgCpu * 10) / 10,
    avgMemoryUsagePct: Math.round(avgMem * 10) / 10,
    totalMonthlyCost: Math.round(nodes.reduce((s, n) => s + n.costs.monthlyCost, 0) * 100) / 100,
    totalDeployments: deploymentStore.size,
    pendingProposals: [...proposalStore.values()].filter((p) => p.status === 'pending_approval').length,
    activeAlerts: 0,
  };
}

/* ------------------------------------------ reset for testing */

export function _resetForTesting(): void {
  nodeStore.clear();
  healthLog.length = 0;
  proposalStore.clear();
  deploymentStore.clear();
  scalingDecisions.length = 0;
  goalStore.clear();
  nodeCounter = 0;
  proposalCounter = 0;
  deploymentCounter = 0;
  scalingCounter = 0;
  goalCounter = 0;
}
