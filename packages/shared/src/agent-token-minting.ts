export enum TokenType {
  Utility = 'utility',
  Governance = 'governance',
  Reward = 'reward',
  Access = 'access',
  Reputation = 'reputation',
}

export enum MintReason {
  Reward = 'reward',
  Allocation = 'allocation',
  Airdrop = 'airdrop',
  Staking = 'staking',
  Manual = 'manual',
}

export enum MintStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
  Reverted = 'reverted',
}

export interface TokenDefinition {
  id: string;
  agentId: string;
  symbol: string;
  name: string;
  decimals: number;
  maxSupply: number | null;
  currentSupply: number;
  tokenType: TokenType;
  mintable: boolean;
  burnable: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MintOperation {
  id: string;
  tokenId: string;
  amount: number;
  recipient: string;
  reason: MintReason;
  txHash: string | null;
  status: MintStatus;
  createdAt: string;
}

export interface TokenBalance {
  id: string;
  tokenId: string;
  holder: string;
  balance: number;
  lastUpdated: string;
}

export interface TokenMintingStats {
  totalTokens: number;
  totalMintOps: number;
  totalSupplyIssued: number;
  uniqueHolders: number;
  failedMints: number;
}
