import * as InfraManager from '@sven/agent-runtime/infra-manager';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const orgId = (input.org_id as string) || 'default';

  switch (action) {
    case 'register_node': {
      const hostname = input.hostname as string;
      const domain = input.domain as string;
      const provider = input.provider as string;
      const region = (input.region as string) || 'us-east-1';

      if (!hostname || !domain || !provider) {
        return { error: 'hostname, domain, and provider are required' };
      }

      const node = InfraManager.registerNode({
        orgId, hostname, domain, provider, region,
        resources: (input.resources as Partial<InfraManager.NodeResources>) || {},
        costs: (input.costs as Partial<InfraManager.NodeCosts>) || {},
        services: input.services as string[] | undefined,
        tags: input.tags as string[] | undefined,
      });
      return { result: node };
    }

    case 'list_nodes': {
      const status = input.status as InfraManager.NodeStatus | undefined;
      const nodes = InfraManager.listNodes(orgId, status);
      return { result: { nodes, count: nodes.length } };
    }

    case 'evaluate_scaling': {
      const nodeId = input.node_id as string;
      if (!nodeId) return { error: 'node_id is required' };

      const decisions = InfraManager.evaluateScaling(nodeId);
      return { result: { decisions, count: decisions.length } };
    }

    case 'create_proposal': {
      const title = input.title as string;
      const proposalType = input.proposal_type as InfraManager.UpgradeProposal['proposalType'];
      if (!title || !proposalType) return { error: 'title and proposal_type are required' };

      const proposal = InfraManager.createProposal({
        orgId, title,
        description: (input.description as string) || '',
        nodeId: input.node_id as string | undefined,
        proposalType,
        currentCost: (input.current_cost as number) || 0,
        proposedCost: (input.proposed_cost as number) || 0,
        expectedBenefit: (input.expected_benefit as string) || '',
        riskLevel: (input.risk_level as 'low' | 'medium' | 'high') || 'low',
      });
      return { result: proposal };
    }

    case 'approve_proposal': {
      const proposalId = input.proposal_id as string;
      const approver = (input.approver as string) || 'system';
      if (!proposalId) return { error: 'proposal_id is required' };

      const proposal = InfraManager.approveProposal(proposalId, approver);
      return { result: proposal };
    }

    case 'submit_proposal': {
      const proposalId = input.proposal_id as string;
      if (!proposalId) return { error: 'proposal_id is required' };

      const proposal = InfraManager.submitProposal(proposalId);
      return { result: proposal };
    }

    case 'create_deployment': {
      const nodeId = input.node_id as string;
      const serviceName = input.service_name as string;
      const version = input.version as string;
      const image = input.image as string;
      const port = input.port as number;

      if (!nodeId || !serviceName || !version || !image || !port) {
        return { error: 'node_id, service_name, version, image, and port are required' };
      }

      const deployment = InfraManager.createDeployment({
        nodeId, serviceName, version, image, port,
        healthEndpoint: input.health_endpoint as string | undefined,
        envVars: input.env_vars as string[] | undefined,
        cpuLimit: input.cpu_limit as string | undefined,
        memoryLimit: input.memory_limit as string | undefined,
        replicas: input.replicas as number | undefined,
      });
      return { result: deployment };
    }

    case 'create_goal': {
      const title = input.title as string;
      const type = (input.type as InfraManager.GoalType) || 'custom';
      const targetValue = input.target_value as number;
      const unit = (input.unit as string) || '';
      const deadline = input.deadline as string;

      if (!title || !deadline) return { error: 'title and deadline are required' };

      const goal = InfraManager.createGoal({
        orgId, type, title,
        description: (input.description as string) || '',
        targetValue: targetValue || 0,
        unit,
        deadline,
        milestones: input.milestones as Array<{ label: string; targetValue: number }> | undefined,
      });
      return { result: goal };
    }

    case 'update_goal': {
      const goalId = input.goal_id as string;
      const currentValue = input.current_value as number;
      if (!goalId || currentValue === undefined) return { error: 'goal_id and current_value are required' };

      const goal = InfraManager.updateGoalProgress(goalId, currentValue);
      return { result: goal };
    }

    case 'cost_report': {
      const periodDays = (input.period_days as number) || 30;
      const report = InfraManager.generateCostReport(orgId, periodDays);
      return { result: report };
    }

    case 'stats': {
      const stats = InfraManager.getInfraStats(orgId);
      return { result: stats };
    }

    default:
      return { error: `Unknown action: ${action}. Valid: register_node, list_nodes, evaluate_scaling, create_proposal, approve_proposal, submit_proposal, create_deployment, create_goal, update_goal, cost_report, stats` };
  }
}
