// ---------------------------------------------------------------------------
// Publishing Pipeline v2 Admin API — Printing, Legal, POD, Genres, Personas
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { NatsConnection } from 'nats';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(
  nc: NatsConnection | null,
  subject: string,
  payload: Record<string, unknown>,
): void {
  if (!nc) return;
  try {
    nc.publish(subject, Buffer.from(JSON.stringify(payload)));
  } catch {
    // silent — NATS publish best-effort
  }
}

const VALID_ORDER_STATUSES = [
  'draft', 'submitted', 'accepted', 'printing',
  'quality_check', 'shipped', 'delivered', 'cancelled', 'failed',
];
const VALID_ORDER_TYPES = ['pod', 'bulk', 'sample'];
const VALID_PRINT_FORMATS = ['paperback', 'hardcover', 'special_edition'];
const VALID_EDGE_TYPES = ['plain', 'stained', 'sprayed', 'foil', 'painted', 'gilded'];
const VALID_POD_PROVIDERS = [
  'amazon_kdp', 'ingram_spark', 'lulu', 'blurb',
  'bookbaby', 'tipografia_universul', 'custom',
];
const VALID_LEGAL_TYPES = [
  'isbn_registration', 'copyright_filing', 'distribution_license',
  'tax_obligation', 'content_rating', 'deposit_copy', 'import_export',
  'data_protection', 'censorship_review', 'author_contract',
];
const VALID_LEGAL_STATUSES = [
  'researched', 'pending', 'submitted', 'approved', 'rejected', 'expired',
];
const VALID_TREND_SOURCES = [
  'amazon_bestseller', 'goodreads', 'booktok', 'bookstagram',
  'google_trends', 'publisher_weekly', 'manual', 'agent_research',
];
const VALID_COMPETITION_LEVELS = ['low', 'medium', 'high', 'saturated'];
const VALID_PRINTER_TYPES = ['digital_press', 'offset', 'inkjet', 'laser', 'specialty'];
const VALID_PROPOSAL_STATUSES = ['proposed', 'under_review', 'approved', 'rejected', 'purchased'];

export async function registerPublishingV2Routes(
  app: FastifyInstance,
  pool: Pool,
  nc: NatsConnection | null,
): Promise<void> {
  // ═══════════════════════════════════════════════════════════════════════
  //  POD INTEGRATIONS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/pod-integrations', async (request: any) => {
    const orgId = String(request.orgId || '');
    const { provider, active } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM pod_integrations WHERE org_id = $1';
    const params: unknown[] = [orgId];
    if (provider) { params.push(provider); sql += ` AND provider = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND active = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.get('/publishing/v2/pod-integrations/:integrationId', async (request: any, reply) => {
    const { integrationId } = request.params as { integrationId: string };
    const { rows } = await pool.query('SELECT * FROM pod_integrations WHERE id = $1', [integrationId]);
    if (!rows.length) return reply.status(404).send({ error: 'POD integration not found' });
    return rows[0];
  });

  app.post('/publishing/v2/pod-integrations', async (request: any) => {
    const orgId = String(request.orgId || '');
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('pod');
    await pool.query(
      `INSERT INTO pod_integrations (id, org_id, provider, display_name, api_endpoint,
        capabilities, supported_formats, min_order_qty, base_cost_eur, per_page_cost,
        edge_printing, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, orgId, b.provider, b.displayName, b.apiEndpoint ?? null,
        JSON.stringify(b.capabilities ?? {}), b.supportedFormats ?? [],
        b.minOrderQty ?? 1, b.baseCostEur ?? 0, b.perPageCost ?? 0,
        b.edgePrinting ?? false, JSON.stringify(b.metadata ?? {})],
    );
    return { id, status: 'created' };
  });

  app.patch('/publishing/v2/pod-integrations/:integrationId', async (request: any, reply) => {
    const { integrationId } = request.params as { integrationId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('display_name', b.displayName);
    addSet('api_endpoint', b.apiEndpoint);
    addSet('base_cost_eur', b.baseCostEur);
    addSet('per_page_cost', b.perPageCost);
    addSet('edge_printing', b.edgePrinting);
    addSet('active', b.active);
    if (b.capabilities) { params.push(JSON.stringify(b.capabilities)); sets.push(`capabilities = $${params.length}`); }
    if (b.metadata) { params.push(JSON.stringify(b.metadata)); sets.push(`metadata = $${params.length}`); }
    params.push(integrationId);
    const { rowCount } = await pool.query(
      `UPDATE pod_integrations SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'POD integration not found' });
    return { id: integrationId, status: 'updated' };
  });

  app.delete('/publishing/v2/pod-integrations/:integrationId', async (request: any, reply) => {
    const { integrationId } = request.params as { integrationId: string };
    const { rowCount } = await pool.query(
      `UPDATE pod_integrations SET active = false, updated_at = NOW() WHERE id = $1`,
      [integrationId],
    );
    if (!rowCount) return reply.status(404).send({ error: 'POD integration not found' });
    return { id: integrationId, status: 'deactivated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  PRINTING ORDERS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/printing-orders', async (request: any) => {
    const orgId = String(request.orgId || '');
    const { status, projectId } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM printing_orders WHERE org_id = $1';
    const params: unknown[] = [orgId];
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    if (projectId) { params.push(projectId); sql += ` AND project_id = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.get('/publishing/v2/printing-orders/:orderId', async (request: any, reply) => {
    const { orderId } = request.params as { orderId: string };
    const { rows } = await pool.query('SELECT * FROM printing_orders WHERE id = $1', [orderId]);
    if (!rows.length) return reply.status(404).send({ error: 'Printing order not found' });
    return rows[0];
  });

  app.post('/publishing/v2/printing-orders', async (request: any) => {
    const orgId = String(request.orgId || '');
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('prt');
    await pool.query(
      `INSERT INTO printing_orders (id, org_id, project_id, pod_integration_id, order_type,
        quantity, format, page_count, edge_type, edge_spec, print_file_url, cover_file_url,
        unit_cost_eur, total_cost_eur, shipping_address, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, orgId, b.projectId, b.podIntegrationId ?? null, b.orderType,
        b.quantity ?? 1, b.format, b.pageCount ?? null,
        b.edgeType ?? 'plain', JSON.stringify(b.edgeSpec ?? {}),
        b.printFileUrl ?? null, b.coverFileUrl ?? null,
        b.unitCostEur ?? null, b.totalCostEur ?? null,
        JSON.stringify(b.shippingAddress ?? {}), b.notes ?? null,
        JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.publishing.print_order_created', {
      orderId: id, projectId: String(b.projectId), format: String(b.format),
      orderType: String(b.orderType), quantity: Number(b.quantity ?? 1),
    });
    return { id, status: 'created' };
  });

  app.patch('/publishing/v2/printing-orders/:orderId', async (request: any, reply) => {
    const { orderId } = request.params as { orderId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('status', b.status);
    addSet('tracking_number', b.trackingNumber);
    addSet('supplier_ref', b.supplierRef);
    addSet('notes', b.notes);
    if (b.status === 'submitted') { sets.push('submitted_at = NOW()'); }
    if (b.status === 'delivered') { sets.push('completed_at = NOW()'); }
    if (b.status === 'shipped') {
      publishNats(nc, 'sven.publishing.print_order_shipped', {
        orderId, trackingNumber: String(b.trackingNumber ?? ''),
      });
    }
    params.push(orderId);
    const { rowCount } = await pool.query(
      `UPDATE printing_orders SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'Printing order not found' });
    return { id: orderId, status: 'updated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  LEGAL REQUIREMENTS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/legal-requirements', async (request: any) => {
    const orgId = String(request.orgId || '');
    const { countryCode, requirementType } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM legal_requirements WHERE org_id = $1';
    const params: unknown[] = [orgId];
    if (countryCode) { params.push(countryCode); sql += ` AND country_code = $${params.length}`; }
    if (requirementType) { params.push(requirementType); sql += ` AND requirement_type = $${params.length}`; }
    sql += ' ORDER BY country_code, requirement_type';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.get('/publishing/v2/legal-requirements/:reqId', async (request: any, reply) => {
    const { reqId } = request.params as { reqId: string };
    const { rows } = await pool.query('SELECT * FROM legal_requirements WHERE id = $1', [reqId]);
    if (!rows.length) return reply.status(404).send({ error: 'Legal requirement not found' });
    return rows[0];
  });

  app.post('/publishing/v2/legal-requirements', async (request: any) => {
    const orgId = String(request.orgId || '');
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('leg');
    await pool.query(
      `INSERT INTO legal_requirements (id, org_id, country_code, country_name, requirement_type,
        title, description, authority_name, authority_url, cost_eur, processing_days,
        mandatory, documents, status, valid_until, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, orgId, b.countryCode, b.countryName, b.requirementType,
        b.title, b.description ?? null, b.authorityName ?? null,
        b.authorityUrl ?? null, b.costEur ?? null, b.processingDays ?? null,
        b.mandatory ?? true, JSON.stringify(b.documents ?? []),
        b.status ?? 'researched', b.validUntil ?? null, b.notes ?? null,
        JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.publishing.legal_requirement_added', {
      reqId: id, countryCode: String(b.countryCode),
      requirementType: String(b.requirementType), title: String(b.title),
    });
    return { id, status: 'created' };
  });

  app.patch('/publishing/v2/legal-requirements/:reqId', async (request: any, reply) => {
    const { reqId } = request.params as { reqId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('status', b.status);
    addSet('title', b.title);
    addSet('description', b.description);
    addSet('cost_eur', b.costEur);
    addSet('processing_days', b.processingDays);
    addSet('valid_until', b.validUntil);
    addSet('notes', b.notes);
    if (b.documents) { params.push(JSON.stringify(b.documents)); sets.push(`documents = $${params.length}`); }
    params.push(reqId);
    const { rowCount } = await pool.query(
      `UPDATE legal_requirements SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'Legal requirement not found' });
    return { id: reqId, status: 'updated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  GENRE TRENDS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/genre-trends', async (request: any) => {
    const { genre, market, source, minPopularity } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM genre_trends WHERE 1=1';
    const params: unknown[] = [];
    if (genre) { params.push(genre); sql += ` AND genre = $${params.length}`; }
    if (market) { params.push(market); sql += ` AND market = $${params.length}`; }
    if (source) { params.push(source); sql += ` AND source = $${params.length}`; }
    if (minPopularity) { params.push(Number(minPopularity)); sql += ` AND popularity_score >= $${params.length}`; }
    sql += ' ORDER BY popularity_score DESC, created_at DESC';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.get('/publishing/v2/genre-trends/:trendId', async (request: any, reply) => {
    const { trendId } = request.params as { trendId: string };
    const { rows } = await pool.query('SELECT * FROM genre_trends WHERE id = $1', [trendId]);
    if (!rows.length) return reply.status(404).send({ error: 'Genre trend not found' });
    return rows[0];
  });

  app.post('/publishing/v2/genre-trends', async (request: any) => {
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('gtr');
    await pool.query(
      `INSERT INTO genre_trends (id, genre, sub_genre, trope, market, source,
        popularity_score, competition_level, avg_price_eur, monthly_sales,
        trending_up, keywords, sample_titles, demographic, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id, b.genre, b.subGenre ?? null, b.trope ?? null,
        b.market ?? 'global', b.source ?? 'agent_research',
        b.popularityScore ?? 50, b.competitionLevel ?? 'medium',
        b.avgPriceEur ?? null, b.monthlySales ?? null,
        b.trendingUp ?? true, b.keywords ?? [],
        JSON.stringify(b.sampleTitles ?? []), JSON.stringify(b.demographic ?? {}),
        b.notes ?? null, JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.publishing.genre_trend_discovered', {
      trendId: id, genre: String(b.genre),
      popularityScore: Number(b.popularityScore ?? 50),
    });
    return { id, status: 'created' };
  });

  app.patch('/publishing/v2/genre-trends/:trendId', async (request: any, reply) => {
    const { trendId } = request.params as { trendId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('popularity_score', b.popularityScore);
    addSet('competition_level', b.competitionLevel);
    addSet('avg_price_eur', b.avgPriceEur);
    addSet('monthly_sales', b.monthlySales);
    addSet('trending_up', b.trendingUp);
    addSet('notes', b.notes);
    if (b.keywords) { params.push(b.keywords); sets.push(`keywords = $${params.length}`); }
    params.push(trendId);
    const { rowCount } = await pool.query(
      `UPDATE genre_trends SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'Genre trend not found' });
    return { id: trendId, status: 'updated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  AUTHOR PERSONAS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/author-personas', async (request: any) => {
    const orgId = String(request.orgId || '');
    const { agentId, active } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM author_personas WHERE org_id = $1';
    const params: unknown[] = [orgId];
    if (agentId) { params.push(agentId); sql += ` AND agent_id = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND active = $${params.length}`; }
    sql += ' ORDER BY total_sales DESC, created_at DESC';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.get('/publishing/v2/author-personas/:personaId', async (request: any, reply) => {
    const { personaId } = request.params as { personaId: string };
    const { rows } = await pool.query('SELECT * FROM author_personas WHERE id = $1', [personaId]);
    if (!rows.length) return reply.status(404).send({ error: 'Author persona not found' });
    return rows[0];
  });

  app.post('/publishing/v2/author-personas', async (request: any) => {
    const orgId = String(request.orgId || '');
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('aup');
    await pool.query(
      `INSERT INTO author_personas (id, org_id, agent_id, pen_name, bio, genres,
        voice_style, writing_traits, avatar_url, social_links, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, orgId, b.agentId, b.penName, b.bio ?? null,
        b.genres ?? [], b.voiceStyle ?? null,
        JSON.stringify(b.writingTraits ?? {}),
        b.avatarUrl ?? null, JSON.stringify(b.socialLinks ?? {}),
        JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.publishing.author_persona_created', {
      personaId: id, penName: String(b.penName),
      agentId: String(b.agentId),
    });
    return { id, status: 'created' };
  });

  app.patch('/publishing/v2/author-personas/:personaId', async (request: any, reply) => {
    const { personaId } = request.params as { personaId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('pen_name', b.penName);
    addSet('bio', b.bio);
    addSet('voice_style', b.voiceStyle);
    addSet('avatar_url', b.avatarUrl);
    addSet('active', b.active);
    addSet('backlist_count', b.backlistCount);
    addSet('total_sales', b.totalSales);
    addSet('total_revenue', b.totalRevenue);
    addSet('rating_avg', b.ratingAvg);
    addSet('rating_count', b.ratingCount);
    if (b.genres) { params.push(b.genres); sets.push(`genres = $${params.length}`); }
    if (b.writingTraits) { params.push(JSON.stringify(b.writingTraits)); sets.push(`writing_traits = $${params.length}`); }
    if (b.socialLinks) { params.push(JSON.stringify(b.socialLinks)); sets.push(`social_links = $${params.length}`); }
    if (b.evolutionLog) { params.push(JSON.stringify(b.evolutionLog)); sets.push(`evolution_log = $${params.length}`); }
    params.push(personaId);
    const { rowCount } = await pool.query(
      `UPDATE author_personas SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'Author persona not found' });
    return { id: personaId, status: 'updated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  EDGE PRINTING SPECS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/edge-printing-specs', async (request: any) => {
    const { country, active } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM edge_printing_specs WHERE 1=1';
    const params: unknown[] = [];
    if (country) { params.push(country); sql += ` AND supplier_country = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); sql += ` AND active = $${params.length}`; }
    sql += ' ORDER BY quality_rating DESC NULLS LAST, cost_per_unit_eur ASC';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.post('/publishing/v2/edge-printing-specs', async (request: any) => {
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('edg');
    await pool.query(
      `INSERT INTO edge_printing_specs (id, supplier_name, supplier_country, edge_types,
        min_order_qty, cost_per_unit_eur, turnaround_days, quality_rating,
        contact_email, contact_url, supports_custom, sample_images, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, b.supplierName, b.supplierCountry, b.edgeTypes ?? [],
        b.minOrderQty ?? 50, b.costPerUnitEur, b.turnaroundDays ?? 14,
        b.qualityRating ?? null, b.contactEmail ?? null, b.contactUrl ?? null,
        b.supportsCustom ?? false, JSON.stringify(b.sampleImages ?? []),
        b.notes ?? null, JSON.stringify(b.metadata ?? {})],
    );
    return { id, status: 'created' };
  });

  app.patch('/publishing/v2/edge-printing-specs/:specId', async (request: any, reply) => {
    const { specId } = request.params as { specId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('supplier_name', b.supplierName);
    addSet('cost_per_unit_eur', b.costPerUnitEur);
    addSet('turnaround_days', b.turnaroundDays);
    addSet('quality_rating', b.qualityRating);
    addSet('active', b.active);
    addSet('supports_custom', b.supportsCustom);
    if (b.edgeTypes) { params.push(b.edgeTypes); sets.push(`edge_types = $${params.length}`); }
    params.push(specId);
    const { rowCount } = await pool.query(
      `UPDATE edge_printing_specs SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'Edge spec not found' });
    return { id: specId, status: 'updated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  PRINTER PURCHASE PROPOSALS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/printer-proposals', async (request: any) => {
    const orgId = String(request.orgId || '');
    const { status } = (request.query || {}) as Record<string, string>;
    let sql = 'SELECT * FROM printer_purchase_proposals WHERE org_id = $1';
    const params: unknown[] = [orgId];
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    return { items: rows, total: rows.length };
  });

  app.get('/publishing/v2/printer-proposals/:proposalId', async (request: any, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const { rows } = await pool.query('SELECT * FROM printer_purchase_proposals WHERE id = $1', [proposalId]);
    if (!rows.length) return reply.status(404).send({ error: 'Proposal not found' });
    return rows[0];
  });

  app.post('/publishing/v2/printer-proposals', async (request: any) => {
    const orgId = String(request.orgId || '');
    const b = (request.body || {}) as Record<string, unknown>;
    const id = newId('prp');

    const purchaseCost = Number(b.purchaseCostEur ?? 0);
    const monthlyMaintenance = Number(b.monthlyMaintenanceEur ?? 0);
    const costPerPage = Number(b.costPerPageEur ?? 0);
    const monthlyCapacity = Number(b.monthlyCapacity ?? 0);
    const currentVolume = Number(b.currentMonthlyVolume ?? 0);
    const currentCost = Number(b.currentMonthlyCostEur ?? 0);

    // Calculate break-even and projected savings
    const externalPerUnit = currentVolume > 0 ? currentCost / currentVolume : 0;
    const ownPerUnit = costPerPage * 250; // avg 250 pages per book
    const savingsPerUnit = externalPerUnit - ownPerUnit;
    const monthlySavings = savingsPerUnit > 0 ? savingsPerUnit * currentVolume - monthlyMaintenance : 0;
    const breakEvenMonths = monthlySavings > 0 ? Math.ceil(purchaseCost / monthlySavings) : null;
    const roiPct = purchaseCost > 0 && monthlySavings > 0
      ? Math.round(((monthlySavings * 12 - purchaseCost) / purchaseCost) * 10000) / 100
      : null;

    await pool.query(
      `INSERT INTO printer_purchase_proposals (id, org_id, proposed_by, printer_model,
        printer_type, purchase_cost_eur, monthly_maintenance_eur, cost_per_page_eur,
        monthly_capacity, break_even_months, current_monthly_volume, current_monthly_cost_eur,
        projected_savings_eur, roi_percentage, shipping_address, vendor_url, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, orgId, b.proposedBy, b.printerModel, b.printerType,
        purchaseCost, monthlyMaintenance, costPerPage, monthlyCapacity,
        breakEvenMonths, currentVolume, currentCost,
        Math.max(0, Math.round(monthlySavings * 100) / 100), roiPct,
        JSON.stringify(b.shippingAddress ?? {}), b.vendorUrl ?? null,
        JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.publishing.printer_proposal_submitted', {
      proposalId: id, printerModel: String(b.printerModel),
      purchaseCostEur: purchaseCost, breakEvenMonths: breakEvenMonths ?? 0,
    });
    return { id, status: 'created', breakEvenMonths, roiPercentage: roiPct };
  });

  app.patch('/publishing/v2/printer-proposals/:proposalId', async (request: any, reply) => {
    const { proposalId } = request.params as { proposalId: string };
    const b = (request.body || {}) as Record<string, unknown>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const addSet = (col: string, val: unknown) => {
      if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
    };
    addSet('status', b.status);
    addSet('approval_notes', b.approvalNotes);
    if (b.shippingAddress) { params.push(JSON.stringify(b.shippingAddress)); sets.push(`shipping_address = $${params.length}`); }
    params.push(proposalId);
    const { rowCount } = await pool.query(
      `UPDATE printer_purchase_proposals SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.status(404).send({ error: 'Proposal not found' });
    return { id: proposalId, status: 'updated' };
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/publishing/v2/analytics', async (request: any) => {
    const orgId = String(request.orgId || '');
    const [orders, personas, trends, legal] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_cost_eur),0)::numeric AS total_cost
         FROM printing_orders WHERE org_id = $1 GROUP BY status`, [orgId]),
      pool.query(
        `SELECT COUNT(*)::int AS total, COALESCE(SUM(total_sales),0)::int AS total_sales,
                COALESCE(SUM(total_revenue),0)::numeric AS total_revenue
         FROM author_personas WHERE org_id = $1 AND active = true`, [orgId]),
      pool.query(
        `SELECT COUNT(*)::int AS total, AVG(popularity_score)::int AS avg_popularity
         FROM genre_trends`),
      pool.query(
        `SELECT status, COUNT(*)::int AS count FROM legal_requirements
         WHERE org_id = $1 GROUP BY status`, [orgId]),
    ]);
    return {
      printingOrders: orders.rows,
      authorPersonas: personas.rows[0] ?? { total: 0, total_sales: 0, total_revenue: 0 },
      genreTrends: trends.rows[0] ?? { total: 0, avg_popularity: 0 },
      legalRequirements: legal.rows,
    };
  });
}
