// ---------------------------------------------------------------------------
// Public listing routes (read-only browsing for market.sven.systems)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MarketplaceRepository } from '../repo.js';
import type { ListingKind } from '../types.js';

const LISTING_KINDS: ListingKind[] = ['skill_api', 'digital_good', 'service', 'dataset', 'model'];

const BrowseQuery = z.object({
  kind: z.enum(LISTING_KINDS as [ListingKind, ...ListingKind[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export function registerPublicRoutes(app: FastifyInstance, repo: MarketplaceRepository) {
  app.get('/v1/market/listings', async (req, reply) => {
    const parsed = BrowseQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_QUERY', message: parsed.error.message } });
    }
    const listings = await repo.listPublishedListings(parsed.data);
    return reply.send({ success: true, data: { listings } });
  });

  app.get('/v1/market/listings/:slug', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const listing = await repo.getListingBySlug(slug);
    if (!listing || listing.status !== 'published') {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    }
    return reply.send({ success: true, data: { listing } });
  });
}
