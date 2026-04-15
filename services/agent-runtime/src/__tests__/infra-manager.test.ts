import * as InfraManager from '../infra-manager';

beforeEach(() => {
  InfraManager._resetForTesting();
});

describe('infra-manager', () => {
  describe('node management', () => {
    it('registers a node', () => {
      const node = InfraManager.registerNode({
        orgId: 'org1',
        hostname: 'sven-prod-01',
        domain: 'sven.systems',
        provider: 'hetzner',
        region: 'eu-central-1',
        resources: { cpuCores: 8, memoryGb: 32, diskGb: 500, gpuVramGb: 24 },
        costs: { monthlyCost: 120, currency: 'USD', costPerCpuHour: 0.04 },
        services: ['gateway-api', 'agent-runtime'],
        tags: ['production', 'gpu'],
      });

      expect(node.id).toBeDefined();
      expect(node.hostname).toBe('sven-prod-01');
      expect(node.status).toBe('provisioning');
      expect(node.resources.cpuCores).toBe(8);
      expect(node.costs.monthlyCost).toBe(120);
    });

    it('lists nodes by org and status', () => {
      InfraManager.registerNode({ orgId: 'org1', hostname: 'n1', domain: 'a.com', provider: 'aws', region: 'us-east-1', resources: {} });
      const n2 = InfraManager.registerNode({ orgId: 'org1', hostname: 'n2', domain: 'a.com', provider: 'aws', region: 'us-west-2', resources: {} });
      InfraManager.registerNode({ orgId: 'org2', hostname: 'n3', domain: 'b.com', provider: 'gcp', region: 'eu-west-1', resources: {} });

      expect(InfraManager.listNodes('org1')).toHaveLength(2);
      expect(InfraManager.listNodes('org2')).toHaveLength(1);

      InfraManager.updateNodeStatus(n2.id, 'healthy');
      expect(InfraManager.listNodes('org1', 'healthy')).toHaveLength(1);
    });

    it('decommissions a node', () => {
      const node = InfraManager.registerNode({ orgId: 'org1', hostname: 'decom', domain: 'x.com', provider: 'do', region: 'nyc1', resources: {} });

      const decom = InfraManager.decommissionNode(node.id);
      expect(decom?.status).toBe('down');
      expect(decom?.services).toHaveLength(0);
    });
  });

  describe('health checks', () => {
    it('records and retrieves health checks', () => {
      const node = InfraManager.registerNode({ orgId: 'org1', hostname: 'health', domain: 'h.com', provider: 'aws', region: 'us-east-1', resources: {} });

      InfraManager.recordHealthCheck({
        nodeId: node.id,
        timestamp: new Date().toISOString(),
        status: 'healthy',
        latencyMs: 45,
        services: [{ name: 'gateway-api', status: 'ok', responseTimeMs: 12 }],
        resources: {
          cpuCores: 4, cpuUsagePct: 55, memoryGb: 16, memoryUsagePct: 70,
          diskGb: 200, diskUsagePct: 45, gpuVramGb: 0, gpuUsagePct: 0,
          bandwidthMbps: 1000, bandwidthUsagePct: 15, containerCount: 5, containerLimit: 20,
        },
      });

      const history = InfraManager.getHealthHistory(node.id);
      expect(history).toHaveLength(1);
      expect(history[0].latencyMs).toBe(45);

      const latest = InfraManager.getLatestHealth(node.id);
      expect(latest?.status).toBe('healthy');

      // Verify node status was updated
      const updated = InfraManager.getNode(node.id);
      expect(updated?.status).toBe('healthy');
      expect(updated?.resources.cpuUsagePct).toBe(55);
    });
  });

  describe('scaling decisions', () => {
    it('recommends scale-up when usage exceeds threshold', () => {
      const node = InfraManager.registerNode({
        orgId: 'org1',
        hostname: 'hot',
        domain: 'hot.com',
        provider: 'aws',
        region: 'us-east-1',
        resources: {
          cpuCores: 4, cpuUsagePct: 92,
          memoryGb: 16, memoryUsagePct: 88,
          diskGb: 100, diskUsagePct: 50,
          gpuVramGb: 0, gpuUsagePct: 0,
          bandwidthMbps: 1000, bandwidthUsagePct: 30,
          containerCount: 8, containerLimit: 10,
        },
        costs: { monthlyCost: 100, costPerCpuHour: 0.05 },
      });

      const decisions = InfraManager.evaluateScaling(node.id);
      expect(decisions.length).toBeGreaterThan(0);

      const cpuDecision = decisions.find((d) => d.resource === 'cpu');
      expect(cpuDecision?.direction).toBe('up');
      expect(cpuDecision?.estimatedCostDelta).toBeGreaterThan(0);
    });

    it('recommends scale-down when usage is low', () => {
      const node = InfraManager.registerNode({
        orgId: 'org1',
        hostname: 'cold',
        domain: 'cold.com',
        provider: 'aws',
        region: 'us-east-1',
        resources: {
          cpuCores: 16, cpuUsagePct: 5,
          memoryGb: 64, memoryUsagePct: 10,
          diskGb: 1000, diskUsagePct: 15,
          gpuVramGb: 0, gpuUsagePct: 0,
          bandwidthMbps: 5000, bandwidthUsagePct: 2,
          containerCount: 1, containerLimit: 50,
        },
        costs: { monthlyCost: 500, costPerCpuHour: 0.05 },
      });

      const decisions = InfraManager.evaluateScaling(node.id);
      const cpuDown = decisions.find((d) => d.resource === 'cpu');
      expect(cpuDown?.direction).toBe('down');
    });

    it('returns no decisions when usage is normal', () => {
      const node = InfraManager.registerNode({
        orgId: 'org1',
        hostname: 'normal',
        domain: 'n.com',
        provider: 'aws',
        region: 'us-east-1',
        resources: {
          cpuCores: 8, cpuUsagePct: 50,
          memoryGb: 32, memoryUsagePct: 60,
          diskGb: 200, diskUsagePct: 55,
          gpuVramGb: 0, gpuUsagePct: 0,
          bandwidthMbps: 1000, bandwidthUsagePct: 40,
          containerCount: 5, containerLimit: 20,
        },
      });

      const decisions = InfraManager.evaluateScaling(node.id);
      expect(decisions).toHaveLength(0);
    });
  });

  describe('upgrade proposals', () => {
    it('creates, submits, and approves a proposal', () => {
      const proposal = InfraManager.createProposal({
        orgId: 'org1',
        title: 'Add GPU node for inference',
        description: 'Current GPU at 90% utilization',
        proposalType: 'new_node',
        currentCost: 100,
        proposedCost: 300,
        expectedBenefit: '3x inference throughput',
        riskLevel: 'medium',
      });

      expect(proposal.status).toBe('draft');
      expect(proposal.costDelta).toBe(200);

      const submitted = InfraManager.submitProposal(proposal.id);
      expect(submitted?.status).toBe('pending_approval');

      const approved = InfraManager.approveProposal(proposal.id, 'admin-user');
      expect(approved?.status).toBe('approved');
      expect(approved?.approvedBy).toBe('admin-user');
    });

    it('rejects a proposal with reason', () => {
      const proposal = InfraManager.createProposal({
        orgId: 'org1',
        title: 'Upgrade all servers',
        description: 'Too expensive',
        proposalType: 'scale_up',
        currentCost: 500,
        proposedCost: 2000,
        expectedBenefit: 'More capacity',
        riskLevel: 'high',
      });

      InfraManager.submitProposal(proposal.id);
      const rejected = InfraManager.rejectProposal(proposal.id, 'Budget exceeded');
      expect(rejected?.status).toBe('rejected');
      expect(rejected?.executionLog).toContainEqual(expect.stringContaining('Rejected: Budget exceeded'));
    });
  });

  describe('deployments', () => {
    it('creates a deployment on a node', () => {
      const node = InfraManager.registerNode({ orgId: 'org1', hostname: 'deploy', domain: 'd.com', provider: 'aws', region: 'us-east-1', resources: {} });

      const deploy = InfraManager.createDeployment({
        nodeId: node.id,
        serviceName: 'gateway-api',
        version: '2.1.0',
        image: 'sven/gateway-api:2.1.0',
        port: 3000,
        healthEndpoint: '/healthz',
        cpuLimit: '2000m',
        memoryLimit: '1Gi',
        replicas: 2,
      });

      expect(deploy.status).toBe('queued');
      expect(deploy.serviceName).toBe('gateway-api');
      expect(deploy.replicas).toBe(2);

      // Check service was added to node
      const updatedNode = InfraManager.getNode(node.id);
      expect(updatedNode?.services).toContain('gateway-api');
    });

    it('updates deployment status', () => {
      const node = InfraManager.registerNode({ orgId: 'org1', hostname: 'dstat', domain: 'd.com', provider: 'aws', region: 'us-east-1', resources: {} });
      const deploy = InfraManager.createDeployment({
        nodeId: node.id, serviceName: 'agent-runtime', version: '1.0.0',
        image: 'sven/agent-runtime:1.0.0', port: 4000,
      });

      InfraManager.updateDeploymentStatus(deploy.id, 'building');
      expect(InfraManager.getDeployment(deploy.id)?.status).toBe('building');

      InfraManager.updateDeploymentStatus(deploy.id, 'running');
      expect(InfraManager.getDeployment(deploy.id)?.status).toBe('running');
    });
  });

  describe('cost reporting', () => {
    it('generates a cost report with savings opportunities', () => {
      InfraManager.registerNode({
        orgId: 'org1', hostname: 'cheap', domain: 'c.com', provider: 'do', region: 'nyc1',
        resources: { cpuCores: 4, cpuUsagePct: 10, memoryGb: 8, memoryUsagePct: 15 },
        costs: { monthlyCost: 80, costPerCpuHour: 0.03, costPerGbMonth: 2 },
      });

      InfraManager.registerNode({
        orgId: 'org1', hostname: 'expensive', domain: 'e.com', provider: 'aws', region: 'us-east-1',
        resources: { cpuCores: 16, cpuUsagePct: 75, memoryGb: 64, memoryUsagePct: 80 },
        costs: { monthlyCost: 400, costPerCpuHour: 0.08, costPerGbMonth: 5 },
      });

      const report = InfraManager.generateCostReport('org1');
      expect(report.totalCost).toBe(480);
      expect(report.byNode).toHaveLength(2);

      // The cheap node with low CPU should trigger a savings opportunity
      expect(report.savingsOpportunities.length).toBeGreaterThan(0);
      expect(report.savingsOpportunities[0].estimatedSavings).toBeGreaterThan(0);
    });
  });

  describe('goal tracking (I.5.5)', () => {
    it('creates a goal with milestones', () => {
      const goal = InfraManager.createGoal({
        orgId: 'org1',
        type: 'revenue',
        title: '$10K monthly revenue',
        description: 'Reach $10,000 MRR across all pipelines',
        targetValue: 10000,
        unit: 'USD',
        deadline: '2026-12-31',
        milestones: [
          { label: '$1K MRR', targetValue: 1000 },
          { label: '$5K MRR', targetValue: 5000 },
        ],
      });

      expect(goal.status).toBe('active');
      expect(goal.targetValue).toBe(10000);
      expect(goal.milestones).toHaveLength(2);
      expect(goal.milestones[0].achieved).toBe(false);
    });

    it('updates progress and achieves milestones', () => {
      const goal = InfraManager.createGoal({
        orgId: 'org1', type: 'revenue', title: 'Rev target',
        description: '', targetValue: 100, unit: 'USD', deadline: '2030-12-31',
        milestones: [
          { label: '25%', targetValue: 25 },
          { label: '50%', targetValue: 50 },
          { label: '75%', targetValue: 75 },
        ],
      });

      InfraManager.updateGoalProgress(goal.id, 30);
      let updated = InfraManager.getGoal(goal.id);
      expect(updated?.milestones[0].achieved).toBe(true);
      expect(updated?.milestones[1].achieved).toBe(false);
      expect(updated?.status).toBe('active');

      InfraManager.updateGoalProgress(goal.id, 100);
      updated = InfraManager.getGoal(goal.id);
      expect(updated?.status).toBe('achieved');
      expect(updated?.milestones.every((m) => m.achieved)).toBe(true);
    });

    it('lists goals by type and status', () => {
      InfraManager.createGoal({ orgId: 'org1', type: 'revenue', title: 'G1', description: '', targetValue: 100, unit: 'USD', deadline: '2030-01-01' });
      InfraManager.createGoal({ orgId: 'org1', type: 'infrastructure', title: 'G2', description: '', targetValue: 5, unit: 'nodes', deadline: '2030-01-01' });
      InfraManager.createGoal({ orgId: 'org1', type: 'uptime', title: 'G3', description: '', targetValue: 99.9, unit: '%', deadline: '2030-01-01' });

      expect(InfraManager.listGoals('org1')).toHaveLength(3);
      expect(InfraManager.listGoals('org1', 'revenue')).toHaveLength(1);
    });

    it('cancels a goal', () => {
      const goal = InfraManager.createGoal({ orgId: 'org1', type: 'custom', title: 'Cancel me', description: '', targetValue: 1, unit: 'x', deadline: '2030-01-01' });
      const cancelled = InfraManager.cancelGoal(goal.id);
      expect(cancelled?.status).toBe('cancelled');
    });
  });

  describe('stats', () => {
    it('returns infrastructure stats', () => {
      InfraManager.registerNode({
        orgId: 'org1', hostname: 'h1', domain: 'd1.com', provider: 'aws', region: 'us-east-1',
        resources: { cpuCores: 8, cpuUsagePct: 50, memoryGb: 32, memoryUsagePct: 60 },
        costs: { monthlyCost: 200 },
      });
      InfraManager.updateNodeStatus(InfraManager.listNodes('org1')[0].id, 'healthy');

      InfraManager.registerNode({
        orgId: 'org1', hostname: 'h2', domain: 'd2.com', provider: 'do', region: 'nyc1',
        resources: { cpuCores: 4, cpuUsagePct: 30, memoryGb: 16, memoryUsagePct: 40 },
        costs: { monthlyCost: 80 },
      });
      InfraManager.updateNodeStatus(InfraManager.listNodes('org1')[1].id, 'degraded');

      const stats = InfraManager.getInfraStats('org1');
      expect(stats.totalNodes).toBe(2);
      expect(stats.healthyNodes).toBe(1);
      expect(stats.degradedNodes).toBe(1);
      expect(stats.totalCpuCores).toBe(12);
      expect(stats.totalMonthlyCost).toBe(280);
      expect(stats.avgCpuUsagePct).toBeGreaterThan(0);
    });
  });
});
