// ---------------------------------------------------------------------------
// Business Landing Routes — public JSON API for *.from.sven.systems pages.
// ---------------------------------------------------------------------------
// These routes are called by the Nginx wildcard vhost which sets the
// X-Business-Subdomain header. No auth required — fully public.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('business-landing');

export function registerBusinessLandingRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
) {
  // GET /v1/business/:subdomain — full agent business page (profile + listings)
  app.get<{ Params: { subdomain: string } }>('/v1/business/:subdomain', async (req, reply) => {
    const subdomain = req.params.subdomain.toLowerCase();

    const { rows: profileRows } = await pool.query(
      `SELECT ap.agent_id, ap.display_name, ap.bio, ap.archetype, ap.avatar_url,
              ap.specializations, ap.reputation, ap.business_subdomain,
              ap.business_url, ap.business_status, ap.business_landing_type,
              ap.business_tagline, ap.business_activated_at,
              be.status AS endpoint_status, be.uptime_pct, be.total_requests
       FROM agent_profiles ap
       LEFT JOIN agent_business_endpoints be ON be.agent_id = ap.agent_id
       WHERE ap.business_subdomain = $1 AND ap.business_status = 'active'
       LIMIT 1`,
      [subdomain],
    );

    if (!profileRows.length) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found or inactive' },
      });
    }

    const profile = profileRows[0];

    // Fetch agent's published listings
    const { rows: listingRows } = await pool.query(
      `SELECT id, slug, title, description, kind, pricing_model, unit_price, currency,
              cover_image_url, tags, total_sales, total_revenue, published_at
       FROM marketplace_listings
       WHERE seller_agent_id = $1 AND status = 'published'
       ORDER BY total_revenue DESC
       LIMIT 50`,
      [profile.agent_id],
    );

    // Aggregate stats
    let totalSales = 0;
    let totalRevenue = 0;
    for (const l of listingRows) {
      totalSales += l.total_sales || 0;
      totalRevenue += Number(l.total_revenue) || 0;
    }

    const reputation = typeof profile.reputation === 'string'
      ? JSON.parse(profile.reputation)
      : profile.reputation ?? {};

    return reply.send({
      success: true,
      data: {
        agent: {
          agentId: profile.agent_id,
          displayName: profile.display_name,
          bio: profile.bio,
          archetype: profile.archetype,
          avatarUrl: profile.avatar_url,
          specializations: profile.specializations ?? [],
          reputation: {
            rating: Number(reputation.rating) || 0,
            reviewCount: Number(reputation.reviewCount) || 0,
            totalSales: Number(reputation.totalSales) || 0,
          },
          landingType: profile.business_landing_type,
          tagline: profile.business_tagline,
          activatedAt: profile.business_activated_at,
        },
        listings: listingRows.map((l) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          description: l.description,
          kind: l.kind,
          pricingModel: l.pricing_model,
          unitPrice: Number(l.unit_price),
          currency: l.currency,
          coverImageUrl: l.cover_image_url,
          tags: l.tags ?? [],
          totalSales: l.total_sales,
          totalRevenue: Number(l.total_revenue),
          publishedAt: l.published_at,
        })),
        stats: {
          totalListings: listingRows.length,
          totalSales,
          totalRevenue,
          rating: Number(reputation.rating) || 0,
          endpointStatus: profile.endpoint_status ?? 'unknown',
          uptimePct: Number(profile.uptime_pct) || 0,
          totalRequests: Number(profile.total_requests) || 0,
        },
      },
    });
  });

  // GET /v1/business/:subdomain/listings — paginated listings for agent
  app.get<{ Params: { subdomain: string } }>('/v1/business/:subdomain/listings', async (req, reply) => {
    const subdomain = req.params.subdomain.toLowerCase();
    const q = req.query as { limit?: string; offset?: string; kind?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const offset = Math.max(0, Number(q.offset) || 0);

    // Resolve agent_id from subdomain
    const { rows: agentRows } = await pool.query(
      `SELECT agent_id FROM agent_profiles
       WHERE business_subdomain = $1 AND business_status = 'active'`,
      [subdomain],
    );
    if (!agentRows.length) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Business not found or inactive' },
      });
    }

    let where = `seller_agent_id = $1 AND status = 'published'`;
    const params: unknown[] = [agentRows[0].agent_id];
    let idx = 2;

    if (q.kind) {
      where += ` AND kind = $${idx++}`;
      params.push(q.kind);
    }
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT id, slug, title, description, kind, pricing_model, unit_price, currency,
              cover_image_url, tags, total_sales, total_revenue, published_at
       FROM marketplace_listings
       WHERE ${where}
       ORDER BY total_revenue DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM marketplace_listings WHERE ${where}`,
      params.slice(0, params.length - 2),
    );

    return reply.send({
      success: true,
      data: rows.map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        description: l.description,
        kind: l.kind,
        pricingModel: l.pricing_model,
        unitPrice: Number(l.unit_price),
        currency: l.currency,
        coverImageUrl: l.cover_image_url,
        tags: l.tags ?? [],
        totalSales: l.total_sales,
        totalRevenue: Number(l.total_revenue),
        publishedAt: l.published_at,
      })),
      pagination: { total: countRes.rows[0]?.total ?? 0, limit, offset },
    });
  });

  // GET /v1/business/directory — public directory of all active business spaces
  app.get('/v1/business/directory', async (req, reply) => {
    const q = req.query as { limit?: string; offset?: string; archetype?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    let where = `ap.business_status = 'active' AND ap.business_subdomain IS NOT NULL`;
    const params: unknown[] = [];
    let idx = 1;

    if (q.archetype) {
      where += ` AND ap.archetype = $${idx++}`;
      params.push(q.archetype);
    }
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT ap.agent_id, ap.display_name, ap.archetype, ap.business_subdomain,
              ap.business_url, ap.business_tagline, ap.business_landing_type,
              ap.avatar_url,
              COUNT(ml.id)::int AS listing_count,
              COALESCE(SUM(ml.total_sales), 0)::int AS total_sales
       FROM agent_profiles ap
       LEFT JOIN marketplace_listings ml ON ml.seller_agent_id = ap.agent_id AND ml.status = 'published'
       WHERE ${where}
       GROUP BY ap.agent_id, ap.display_name, ap.archetype, ap.business_subdomain,
                ap.business_url, ap.business_tagline, ap.business_landing_type, ap.avatar_url
       ORDER BY total_sales DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT ap.agent_id)::int AS total
       FROM agent_profiles ap WHERE ${where}`,
      params.slice(0, params.length - 2),
    );

    return reply.send({
      success: true,
      data: rows.map((r) => ({
        agentId: r.agent_id,
        displayName: r.display_name,
        archetype: r.archetype,
        subdomain: r.business_subdomain,
        businessUrl: r.business_url,
        tagline: r.business_tagline,
        landingType: r.business_landing_type,
        avatarUrl: r.avatar_url,
        listingCount: r.listing_count,
        totalSales: r.total_sales,
      })),
      pagination: { total: countRes.rows[0]?.total ?? 0, limit, offset },
    });
  });
}
