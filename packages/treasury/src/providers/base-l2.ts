// ---------------------------------------------------------------------------
// Base L2 ChainClient — viem implementation.
// ---------------------------------------------------------------------------
// Supports Base mainnet + Base Sepolia testnet. Uses a configurable RPC URL
// (falls back to the Coinbase-operated public endpoint). Fiat ↔ crypto happens
// outside this module (off-ramp) — this layer only signs + submits + tracks.
// ---------------------------------------------------------------------------

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseAbi,
  type Chain as ViemChain,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { createLogger } from '@sven/shared';
import type {
  ChainClient,
  CreatedWallet,
  SecretResolver,
  SendErc20Params,
  SendNativeParams,
  SignedTx,
} from '../wallet/provider.js';
import type { Chain, Network } from '../types.js';

const logger = createLogger('treasury.base-l2');

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

export interface BaseL2Options {
  network: Network;
  rpcUrl?: string;
  confirmations?: number;
}

export class BaseL2Client implements ChainClient {
  public readonly chain: Chain;
  public readonly network: Network;
  private publicClient: PublicClient;
  private viemChain: ViemChain;
  private confirmations: number;

  constructor(options: BaseL2Options) {
    this.network = options.network;
    this.chain = options.network === 'mainnet' ? 'base' : 'base-sepolia';
    this.viemChain = options.network === 'mainnet' ? base : baseSepolia;
    this.confirmations = options.confirmations ?? 2;

    const rpcUrl =
      options.rpcUrl ||
      (options.network === 'mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

    this.publicClient = createPublicClient({
      chain: this.viemChain,
      transport: http(rpcUrl),
    });
    logger.info('Base L2 client ready', { network: this.network, rpcUrl });
  }

  async create(secretResolver: SecretResolver, label: string): Promise<CreatedWallet> {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const secretRef = await secretResolver.storePrivateKey(label, key);
    return {
      address: account.address.toLowerCase(),
      secretRef,
      derivationPath: null,
    };
  }

  async getNativeBalance(address: string): Promise<bigint> {
    return this.publicClient.getBalance({ address: address as Hex });
  }

  async getErc20Balance(tokenAddress: string, address: string): Promise<bigint> {
    const balance = (await this.publicClient.readContract({
      address: tokenAddress as Hex,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as Hex],
    })) as bigint;
    return balance;
  }

  private async walletFor(secretResolver: SecretResolver, secretRef: string): Promise<{ wallet: WalletClient; account: Account }> {
    const key = await secretResolver.resolvePrivateKey(secretRef);
    const account = privateKeyToAccount(key as Hex);
    const wallet = createWalletClient({
      account,
      chain: this.viemChain,
      transport: http((this.publicClient.transport as { url?: string }).url),
    });
    return { wallet, account };
  }

  async sendNative(params: SendNativeParams): Promise<SignedTx> {
    const resolver = (this as BaseL2Client & { _secretResolver?: SecretResolver })._secretResolver;
    if (!resolver) throw new Error('BaseL2Client: secretResolver not attached');
    const { wallet, account } = await this.walletFor(resolver, params.secretRef);
    const hash = await wallet.sendTransaction({
      account,
      chain: this.viemChain,
      to: params.to as Hex,
      value: params.amountWei,
    });
    logger.info('native tx submitted', { hash, to: params.to, wei: params.amountWei.toString() });
    return { txHash: hash, raw: hash };
  }

  async sendErc20(params: SendErc20Params): Promise<SignedTx> {
    const resolver = (this as BaseL2Client & { _secretResolver?: SecretResolver })._secretResolver;
    if (!resolver) throw new Error('BaseL2Client: secretResolver not attached');
    const { wallet, account } = await this.walletFor(resolver, params.secretRef);
    const hash = await wallet.writeContract({
      account,
      chain: this.viemChain,
      address: params.tokenAddress as Hex,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [params.to as Hex, params.amountUnits],
    });
    logger.info('erc20 tx submitted', { hash, token: params.tokenAddress, to: params.to });
    return { txHash: hash, raw: hash };
  }

  async waitForConfirmation(txHash: string, confirmations?: number): Promise<number> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash as Hex,
      confirmations: confirmations ?? this.confirmations,
    });
    return Number(receipt.blockNumber);
  }

  attachResolver(resolver: SecretResolver): this {
    (this as BaseL2Client & { _secretResolver?: SecretResolver })._secretResolver = resolver;
    return this;
  }

  /** Convenience: format native balance as ETH string. */
  async getNativeBalanceEth(address: string): Promise<string> {
    const wei = await this.getNativeBalance(address);
    return formatEther(wei);
  }
}
