import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseEther, parseUnits } from 'viem';
import type { WalletRegistry, SecretResolver } from '@sven/treasury';
import type { BaseL2Client } from '@sven/treasury/providers/base-l2';

interface Deps {
  walletRegistry: WalletRegistry;
  baseClient: BaseL2Client;
  secrets: SecretResolver;
}

const CreateSchema = z.object({
  orgId: z.string().min(1),
  label: z.string().min(1),
  network: z.enum(['mainnet', 'testnet']).default('mainnet'),
  metadata: z.record(z.unknown()).optional(),
});

const SendNativeSchema = z.object({
  to: z.string().min(1),
  amountEth: z.union([z.string(), z.number()]).transform(String),
  approvalId: z.string().optional(),
});

const SendErc20Schema = z.object({
  to: z.string().min(1),
  tokenAddress: z.string().min(1),
  tokenDecimals: z.number().int().min(0).max(36).default(18),
  tokenSymbol: z.string().default('ERC20'),
  amount: z.union([z.string(), z.number()]).transform(String),
  approvalId: z.string().optional(),
});

export async function registerWalletRoutes(app: FastifyInstance, deps: Deps) {
  const { walletRegistry, baseClient, secrets } = deps;

  app.post('/wallets', async (req, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const created = await baseClient.create(secrets, parsed.data.label);
    const wallet = await walletRegistry.register({
      orgId: parsed.data.orgId,
      chain: baseClient.chain,
      network: baseClient.network,
      address: created.address,
      secretRef: created.secretRef,
      label: parsed.data.label,
      derivationPath: created.derivationPath,
      metadata: parsed.data.metadata,
    });
    return reply.code(201).send(wallet);
  });

  app.get<{ Querystring: { orgId: string } }>('/wallets', async (req, reply) => {
    if (!req.query.orgId) return reply.code(400).send({ error: 'orgId required' });
    return walletRegistry.list(req.query.orgId);
  });

  app.get<{ Params: { id: string } }>('/wallets/:id', async (req, reply) => {
    const w = await walletRegistry.get(req.params.id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return w;
  });

  app.get<{ Params: { id: string } }>('/wallets/:id/balance', async (req, reply) => {
    const w = await walletRegistry.get(req.params.id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    const wei = await baseClient.getNativeBalance(w.address);
    await walletRegistry.updateBalance(w.id, wei.toString());
    return { walletId: w.id, address: w.address, wei: wei.toString(), chain: w.chain, network: w.network };
  });

  app.post<{ Params: { id: string } }>('/wallets/:id/send-native', async (req, reply) => {
    const w = await walletRegistry.get(req.params.id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    const parsed = SendNativeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const amountWei = parseEther(parsed.data.amountEth);
    const signed = await baseClient.sendNative({ secretRef: w.secretRef, to: parsed.data.to, amountWei });
    const tx = await walletRegistry.recordTx({
      orgId: w.orgId,
      walletId: w.id,
      chain: w.chain,
      network: w.network,
      direction: 'out',
      txHash: signed.txHash,
      counterparty: parsed.data.to,
      tokenSymbol: 'ETH',
      tokenDecimals: 18,
      amount: amountWei.toString(),
      approvalId: parsed.data.approvalId ?? null,
    });
    return reply.code(201).send({ tx, signed });
  });

  app.post<{ Params: { id: string } }>('/wallets/:id/send-erc20', async (req, reply) => {
    const w = await walletRegistry.get(req.params.id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    const parsed = SendErc20Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const amountUnits = parseUnits(parsed.data.amount, parsed.data.tokenDecimals);
    const signed = await baseClient.sendErc20({
      secretRef: w.secretRef,
      tokenAddress: parsed.data.tokenAddress,
      to: parsed.data.to,
      amountUnits,
    });
    const tx = await walletRegistry.recordTx({
      orgId: w.orgId,
      walletId: w.id,
      chain: w.chain,
      network: w.network,
      direction: 'out',
      txHash: signed.txHash,
      counterparty: parsed.data.to,
      tokenAddress: parsed.data.tokenAddress,
      tokenSymbol: parsed.data.tokenSymbol,
      tokenDecimals: parsed.data.tokenDecimals,
      amount: amountUnits.toString(),
      approvalId: parsed.data.approvalId ?? null,
    });
    return reply.code(201).send({ tx, signed });
  });

  app.get<{ Params: { id: string } }>('/wallets/:id/transactions', async (req, reply) => {
    const w = await walletRegistry.get(req.params.id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return walletRegistry.listTx(w.id);
  });
}
