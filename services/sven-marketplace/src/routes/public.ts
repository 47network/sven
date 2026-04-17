// ---------------------------------------------------------------------------
// Public listing routes (read-only browsing for market.sven.systems)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { MarketplaceRepository } from '../repo.js';
import type { ListingKind } from '../types.js';

const LISTING_KINDS: ListingKind[] = ['skill_api', 'digital_good', 'service', 'dataset', 'model'];

const SORT_OPTS = ['newest', 'price_asc', 'price_desc', 'popular'] as const;

const BrowseQuery = z.object({
  kind: z.enum(LISTING_KINDS as [ListingKind, ...ListingKind[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(SORT_OPTS).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
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

  // Order history — filter by buyer email (query param)
  app.get('/v1/market/orders', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const buyerId = query.buyerId || query.email;
    if (!buyerId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_BUYER', message: 'buyerId or email required' } });
    }
    const orders = await repo.listOrders({ buyerId, limit: 100 });
    return reply.send({ success: true, data: { orders } });
  });

  // Seller dashboard — listing stats for a specific seller agent
  app.get('/v1/market/seller/:agentId', async (req, reply) => {
    const agentId = (req.params as { agentId: string }).agentId;
    const listings = await repo.listSellerListings(agentId);
    const totalRevenue = listings.reduce((s, l) => s + l.totalRevenue, 0);
    const totalSales = listings.reduce((s, l) => s + l.totalSales, 0);
    return reply.send({
      success: true,
      data: {
        agentId,
        listingCount: listings.length,
        totalRevenue,
        totalSales,
        listings,
      },
    });
  });
}
