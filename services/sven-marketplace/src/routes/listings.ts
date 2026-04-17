// ---------------------------------------------------------------------------
// Seller listing routes (org-scoped; used by Sven + admin UI)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MarketplaceRepository } from '../repo.js';
import type { ListingKind, PricingModel } from '../types.js';

const KINDS: ListingKind[] = ['skill_api', 'digital_good', 'service', 'dataset', 'model'];
const PRICING: PricingModel[] = ['one_time', 'per_call', 'subscription', 'usage_based'];

const CreateBody = z.object({
  orgId: z.string().min(1),
  sellerAgentId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  kind: z.enum(KINDS as [ListingKind, ...ListingKind[]]),
  pricingModel: z.enum(PRICING as [PricingModel, ...PricingModel[]]),
  unitPrice: z.number().nonnegative().max(1_000_000),
  currency: z.string().length(3).optional(),
  payoutAccountId: z.string().optional().nullable(),
  skillName: z.string().optional().nullable(),
  endpointUrl: z.string().url().optional().nullable(),
  pipelineId: z.string().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
  slug: z.string().optional(),
});

export function registerListingRoutes(app: FastifyInstance, repo: MarketplaceRepository) {
  app.post('/v1/market/listings', async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_BODY', message: parsed.error.message } });
    }
    const listing = await repo.createListing(parsed.data);
    return reply.status(201).send({ success: true, data: { listing } });
  });

  app.get('/v1/market/org/:orgId/listings', async (req, reply) => {
    const orgId = (req.params as { orgId: string }).orgId;
    const listings = await repo.listOrgListings(orgId);
    return reply.send({ success: true, data: { listings } });
  });

  app.post('/v1/market/listings/:id/publish', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    try {
      const listing = await repo.publishListing(id);
      if (!listing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return reply.send({ success: true, data: { listing } });
    } catch (err) {
      return reply.status(400).send({ success: false, error: { code: 'PUBLISH_FAILED', message: (err as Error).message } });
    }
  });

  app.post('/v1/market/listings/:id/pause', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const listing = await repo.pauseListing(id);
    if (!listing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    return reply.send({ success: true, data: { listing } });
  });

  app.post('/v1/market/listings/:id/retire', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const listing = await repo.retireListing(id);
    if (!listing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    return reply.send({ success: true, data: { listing } });
  });
}
