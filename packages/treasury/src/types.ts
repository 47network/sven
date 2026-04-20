// ---------------------------------------------------------------------------
// Treasury core types
// ---------------------------------------------------------------------------

export type AccountKind =
  | 'operating'
  | 'reserve'
  | 'compute'
  | 'upgrade'
  | 'escrow'
  | 'external';

export type Currency = string;

export type TxKind =
  | 'revenue'
  | 'payout'
  | 'transfer'
  | 'refund'
  | 'fee'
  | 'compute_cost'
  | 'upgrade'
  | 'donation'
  | 'seed'
  | 'reserve_move'
  | 'adjustment';

export type TxStatus = 'pending' | 'posted' | 'failed' | 'reversed';

export type Direction = 'credit' | 'debit';

export type RiskTier = 'auto' | 'notify' | 'approve';

export interface TreasuryAccount {
  id: string;
  orgId: string;
  name: string;
  kind: AccountKind;
  currency: Currency;
  balance: string;
  available: string;
  reserved: string;
  walletId: string | null;
  frozen: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryTransaction {
  id: string;
  orgId: string;
  accountId: string;
  counterAccountId: string | null;
  direction: Direction;
  amount: string;
  currency: Currency;
  kind: TxKind;
  source: string;
  sourceRef: string | null;
  status: TxStatus;
  approvalId: string | null;
  riskTier: RiskTier;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  postedAt: string | null;
}

export interface TreasuryLimit {
  id: string;
  orgId: string;
  scope: 'global' | 'account' | 'kind';
  scopeRef: string | null;
  currency: Currency;
  autoMax: string;
  notifyMax: string;
  dailyCap: string | null;
  weeklyCap: string | null;
  monthlyCap: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  setByUserId: string | null;
  setByAgent: boolean;
  notes: string;
}

export type Chain =
  | 'base'
  | 'base-sepolia'
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'optimism';

export type Network = 'mainnet' | 'testnet';

export interface CryptoWallet {
  id: string;
  orgId: string;
  chain: Chain;
  network: Network;
  address: string;
  label: string;
  derivationPath: string | null;
  secretRef: string;
  status: 'active' | 'archived' | 'revoked';
  lastKnownBalance: string;
  lastBalanceAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CryptoTransaction {
  id: string;
  orgId: string;
  walletId: string;
  chain: Chain;
  network: Network;
  direction: 'in' | 'out';
  txHash: string | null;
  counterparty: string | null;
  tokenAddress: string | null;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  feeWei: string;
  blockNumber: number | null;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed' | 'dropped';
  treasuryTxId: string | null;
  approvalId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  confirmedAt: string | null;
}
