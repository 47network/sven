export enum ProposalType {
  Standard = 'standard',
  Emergency = 'emergency',
  Constitutional = 'constitutional',
  Budget = 'budget',
  Technical = 'technical',
}

export enum ProposalStatus {
  Draft = 'draft',
  Voting = 'voting',
  Passed = 'passed',
  Rejected = 'rejected',
  Expired = 'expired',
  Executed = 'executed',
}

export enum VoteChoice {
  Approve = 'approve',
  Reject = 'reject',
  Abstain = 'abstain',
}

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  title: string;
  description: string | null;
  proposalType: ProposalType;
  quorumRequired: number;
  status: ProposalStatus;
  votingStarts: string | null;
  votingEnds: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConsensusVote {
  id: string;
  proposalId: string;
  voterId: string;
  vote: VoteChoice;
  weight: number;
  reason: string | null;
  votedAt: string;
}

export interface ConsensusExecution {
  id: string;
  proposalId: string;
  executorId: string;
  actionTaken: string;
  success: boolean;
  result: Record<string, unknown>;
  executedAt: string;
}

export interface ConsensusProtocolStats {
  totalProposals: number;
  activeVoting: number;
  passedProposals: number;
  rejectedProposals: number;
  avgQuorumReached: number;
}
