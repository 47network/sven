// ---------------------------------------------------------------------------
// Wallet Provider interface — abstraction over chain SDKs.
// ---------------------------------------------------------------------------
// Keeps the treasury service chain-agnostic. First concrete impl: Base L2 via
// viem (`providers/base-l2.ts`). Private keys are referenced by secret_ref
// and resolved through a pluggable SecretResolver; never stored in rows.
// ---------------------------------------------------------------------------

import type { Chain, Network } from '../types.js';

export interface SecretResolver {
  /** Load a private key by reference (e.g. "env:SVEN_TREASURY_KEY", "vault:sven/treasury/prod"). */
  resolvePrivateKey(ref: string): Promise<string>;
  /** Persist a new secret (returns the ref that should be stored in the DB). */
  storePrivateKey(label: string, key: string): Promise<string>;
}

export interface CreatedWallet {
  address: string;
  secretRef: string;
  derivationPath: string | null;
}

export interface SignedTx {
  txHash: string;
  raw: string;
}

export interface SendNativeParams {
  secretRef: string;
  to: string;
  amountWei: bigint;
}

export interface SendErc20Params {
  secretRef: string;
  tokenAddress: string;
  to: string;
  amountUnits: bigint;
}

export interface ChainClient {
  readonly chain: Chain;
  readonly network: Network;

  create(secretResolver: SecretResolver, label: string): Promise<CreatedWallet>;

  getNativeBalance(address: string): Promise<bigint>;
  getErc20Balance(tokenAddress: string, address: string): Promise<bigint>;

  sendNative(params: SendNativeParams): Promise<SignedTx>;
  sendErc20(params: SendErc20Params): Promise<SignedTx>;

  /** Watch for confirmations. Returns block number once included. */
  waitForConfirmation(txHash: string, confirmations?: number): Promise<number>;
}
