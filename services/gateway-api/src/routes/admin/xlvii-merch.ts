// ---------------------------------------------------------------------------
// Batch 26 — XLVII Brand / Merch Platform — Admin API Routes
// ---------------------------------------------------------------------------
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { NatsConnection } from 'nats';

function publishNats(nc: NatsConnection | undefined, subject: string, data: unknown) {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(data))); }
  catch (err: any) { console.warn('[xlvii-merch] NATS publish error', err?.message); }
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ================================================================== */
/*  registerXlviiRoutes                                                */
/* ================================================================== */

export function registerXlviiRoutes(
  app: FastifyInstance,
  pool: Pool,
  nc?: NatsConnection,
) {
  // ── Collections ────────────────────────────────────────────────────

  app.get('/v1/admin/xlvii/collections', async (req, reply) => {
    const { status, season } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM xlvii_collections WHERE 1=1';
    const vals: string[] = [];
    if (status) { vals.push(status); sql += ` AND status = $${vals.length}`; }
    if (season) { vals.push(season); sql += ` AND season = $${vals.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, vals);
    return reply.send(rows);
  });

  app.get('/v1/admin/xlvii/collections/:collectionId', async (req, reply) => {
    const { collectionId } = req.params as Record<string, string>;
    const { rows } = await pool.query(
      `SELECT * FROM xlvii_collections WHERE id = $1`, [collectionId],
    );
    if (!rows.length) return reply.code(404).send({ error: 'collection_not_found' });
    const products = await pool.query(
      `SELECT * FROM xlvii_products WHERE collection_id = $1 ORDER BY created_at`, [collectionId],
    );
    return reply.send({ ...rows[0], products: products.rows });
  });

  app.post('/v1/admin/xlvii/collections', async (req, reply) => {
    const b = req.body as Record<string, any>;
    const id = genId('xc');
    const slug = (b.name ?? 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
    await pool.query(
      `INSERT INTO xlvii_collections (id, name, slug, description, season, status, launch_date, cover_image_url, theme, designer_agent_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, b.name, slug, b.description ?? '', b.season ?? 'evergreen', b.status ?? 'draft',
       b.launchDate ?? null, b.coverImageUrl ?? null, b.theme ?? '', b.designerAgentId ?? null,
       JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.xlvii.collection_created', { id, name: b.name });
    return reply.code(201).send({ id, slug });
  });

  app.patch('/v1/admin/xlvii/collections/:collectionId', async (req, reply) => {
    const { collectionId } = req.params as Record<string, string>;
    const b = req.body as Record<string, any>;
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(b)) {
      const col = k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return reply.code(400).send({ error: 'no_fields' });
    sets.push(`updated_at = now()`);
    vals.push(collectionId);
    await pool.query(
      `UPDATE xlvii_collections SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals,
    );
    return reply.send({ updated: true });
  });

  app.delete('/v1/admin/xlvii/collections/:collectionId', async (req, reply) => {
    const { collectionId } = req.params as Record<string, string>;
    await pool.query(
      `UPDATE xlvii_collections SET status = 'archived', updated_at = now() WHERE id = $1`,
      [collectionId],
    );
    return reply.send({ archived: true });
  });

  // ── Products ───────────────────────────────────────────────────────

  app.get('/v1/admin/xlvii/products', async (req, reply) => {
    const { status, category, collectionId, qualityTier } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM xlvii_products WHERE 1=1';
    const vals: string[] = [];
    if (status) { vals.push(status); sql += ` AND status = $${vals.length}`; }
    if (category) { vals.push(category); sql += ` AND category = $${vals.length}`; }
    if (collectionId) { vals.push(collectionId); sql += ` AND collection_id = $${vals.length}`; }
    if (qualityTier) { vals.push(qualityTier); sql += ` AND quality_tier = $${vals.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, vals);
    return reply.send(rows);
  });

  app.get('/v1/admin/xlvii/products/:productId', async (req, reply) => {
    const { productId } = req.params as Record<string, string>;
    const { rows } = await pool.query(`SELECT * FROM xlvii_products WHERE id = $1`, [productId]);
    if (!rows.length) return reply.code(404).send({ error: 'product_not_found' });
    const variants = await pool.query(
      `SELECT * FROM xlvii_variants WHERE product_id = $1 ORDER BY size, color`, [productId],
    );
    const designs = await pool.query(
      `SELECT * FROM xlvii_designs WHERE product_id = $1 ORDER BY version DESC`, [productId],
    );
    return reply.send({ ...rows[0], variants: variants.rows, designs: designs.rows });
  });

  app.post('/v1/admin/xlvii/products', async (req, reply) => {
    const b = req.body as Record<string, any>;
    const id = genId('xp');
    const slug = (b.name ?? 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
    await pool.query(
      `INSERT INTO xlvii_products (id, collection_id, name, slug, description, category,
        base_price, currency, cost_price, quality_tier, pod_provider, pod_product_id,
        design_url, mockup_urls, tags, materials, care_instructions, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [id, b.collectionId ?? null, b.name, slug, b.description ?? '',
       b.category ?? 'tshirt', b.basePrice ?? 29.99, b.currency ?? 'EUR',
       b.costPrice ?? 0, b.qualityTier ?? 'standard',
       b.podProvider ?? null, b.podProductId ?? null,
       b.designUrl ?? null, JSON.stringify(b.mockupUrls ?? []),
       JSON.stringify(b.tags ?? []), b.materials ?? '', b.careInstructions ?? '',
       b.status ?? 'draft', JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.xlvii.product_created', { id, name: b.name, category: b.category });
    return reply.code(201).send({ id, slug });
  });

  app.patch('/v1/admin/xlvii/products/:productId', async (req, reply) => {
    const { productId } = req.params as Record<string, string>;
    const b = req.body as Record<string, any>;
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(b)) {
      const col = k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return reply.code(400).send({ error: 'no_fields' });
    sets.push(`updated_at = now()`);
    vals.push(productId);
    await pool.query(
      `UPDATE xlvii_products SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals,
    );
    return reply.send({ updated: true });
  });

  app.delete('/v1/admin/xlvii/products/:productId', async (req, reply) => {
    const { productId } = req.params as Record<string, string>;
    await pool.query(
      `UPDATE xlvii_products SET status = 'discontinued', updated_at = now() WHERE id = $1`,
      [productId],
    );
    return reply.send({ discontinued: true });
  });

  // ── Variants ───────────────────────────────────────────────────────

  app.get('/v1/admin/xlvii/products/:productId/variants', async (req, reply) => {
    const { productId } = req.params as Record<string, string>;
    const { rows } = await pool.query(
      `SELECT * FROM xlvii_variants WHERE product_id = $1 ORDER BY size, color`, [productId],
    );
    return reply.send(rows);
  });

  app.post('/v1/admin/xlvii/products/:productId/variants', async (req, reply) => {
    const { productId } = req.params as Record<string, string>;
    const b = req.body as Record<string, any>;
    const id = genId('xv');
    const sku = b.sku ?? `XLVII-${id}`;
    await pool.query(
      `INSERT INTO xlvii_variants (id, product_id, sku, size, color, color_hex,
        price_override, inventory_count, pod_variant_id, weight_grams, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, productId, sku, b.size ?? 'M', b.color ?? 'Silver', b.colorHex ?? '#C0C0C0',
       b.priceOverride ?? null, b.inventoryCount ?? 0, b.podVariantId ?? null,
       b.weightGrams ?? 0, b.status ?? 'active', JSON.stringify(b.metadata ?? {})],
    );
    return reply.code(201).send({ id, sku });
  });

  app.patch('/v1/admin/xlvii/variants/:variantId', async (req, reply) => {
    const { variantId } = req.params as Record<string, string>;
    const b = req.body as Record<string, any>;
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(b)) {
      const col = k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return reply.code(400).send({ error: 'no_fields' });
    sets.push(`updated_at = now()`);
    vals.push(variantId);
    await pool.query(
      `UPDATE xlvii_variants SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals,
    );
    return reply.send({ updated: true });
  });

  // ── Inventory ──────────────────────────────────────────────────────

  app.post('/v1/admin/xlvii/variants/:variantId/restock', async (req, reply) => {
    const { variantId } = req.params as Record<string, string>;
    const { quantity } = req.body as { quantity: number };
    await pool.query(
      `UPDATE xlvii_variants SET inventory_count = inventory_count + $1,
        status = CASE WHEN status = 'out_of_stock' THEN 'active' ELSE status END,
        updated_at = now()
       WHERE id = $2`,
      [quantity ?? 0, variantId],
    );
    return reply.send({ restocked: true });
  });

  app.get('/v1/admin/xlvii/inventory/low-stock', async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT v.*, p.name AS product_name, p.category
       FROM xlvii_variants v JOIN xlvii_products p ON v.product_id = p.id
       WHERE v.status = 'active' AND v.inventory_count <= 5
       ORDER BY v.inventory_count ASC`,
    );
    return reply.send(rows);
  });

  // ── Designs ────────────────────────────────────────────────────────

  app.get('/v1/admin/xlvii/designs', async (req, reply) => {
    const { approvalStatus, designType, productId } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM xlvii_designs WHERE 1=1';
    const vals: string[] = [];
    if (approvalStatus) { vals.push(approvalStatus); sql += ` AND approval_status = $${vals.length}`; }
    if (designType) { vals.push(designType); sql += ` AND design_type = $${vals.length}`; }
    if (productId) { vals.push(productId); sql += ` AND product_id = $${vals.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, vals);
    return reply.send(rows);
  });

  app.post('/v1/admin/xlvii/designs', async (req, reply) => {
    const b = req.body as Record<string, any>;
    const id = genId('xd');
    await pool.query(
      `INSERT INTO xlvii_designs (id, product_id, designer_agent_id, name, design_type,
        design_url, source_prompt, color_palette, placement, approval_status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, b.productId ?? null, b.designerAgentId ?? null, b.name ?? 'Untitled Design',
       b.designType ?? 'logo_placement', b.designUrl ?? '', b.sourcePrompt ?? '',
       JSON.stringify(b.colorPalette ?? []), b.placement ?? 'front',
       b.approvalStatus ?? 'pending', JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.xlvii.design_created', { id, name: b.name, type: b.designType });
    return reply.code(201).send({ id });
  });

  app.patch('/v1/admin/xlvii/designs/:designId/approve', async (req, reply) => {
    const { designId } = req.params as Record<string, string>;
    await pool.query(
      `UPDATE xlvii_designs SET approval_status = 'approved', updated_at = now() WHERE id = $1`,
      [designId],
    );
    publishNats(nc, 'sven.xlvii.design_approved', { designId });
    return reply.send({ approved: true });
  });

  app.patch('/v1/admin/xlvii/designs/:designId/reject', async (req, reply) => {
    const { designId } = req.params as Record<string, string>;
    const { notes } = req.body as { notes?: string };
    await pool.query(
      `UPDATE xlvii_designs SET approval_status = 'rejected', revision_notes = $1, updated_at = now() WHERE id = $2`,
      [notes ?? '', designId],
    );
    return reply.send({ rejected: true });
  });

  // ── Fulfillments ───────────────────────────────────────────────────

  app.get('/v1/admin/xlvii/fulfillments', async (req, reply) => {
    const { status, orderId } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM xlvii_fulfillments WHERE 1=1';
    const vals: string[] = [];
    if (status) { vals.push(status); sql += ` AND status = $${vals.length}`; }
    if (orderId) { vals.push(orderId); sql += ` AND order_id = $${vals.length}`; }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, vals);
    return reply.send(rows);
  });

  app.post('/v1/admin/xlvii/fulfillments', async (req, reply) => {
    const b = req.body as Record<string, any>;
    const id = genId('xf');
    await pool.query(
      `INSERT INTO xlvii_fulfillments (id, order_id, variant_id, quantity, fulfillment_type,
        status, ship_to_name, ship_to_address, ship_to_country, cost_amount, cost_currency, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, b.orderId, b.variantId, b.quantity ?? 1, b.fulfillmentType ?? 'pod_printful',
       'pending', b.shipToName ?? '', JSON.stringify(b.shipToAddress ?? {}),
       b.shipToCountry ?? 'RO', b.costAmount ?? 0, b.costCurrency ?? 'EUR',
       JSON.stringify(b.metadata ?? {})],
    );
    publishNats(nc, 'sven.xlvii.fulfillment_created', { id, orderId: b.orderId });
    return reply.code(201).send({ id });
  });

  app.patch('/v1/admin/xlvii/fulfillments/:fulfillmentId/ship', async (req, reply) => {
    const { fulfillmentId } = req.params as Record<string, string>;
    const b = req.body as Record<string, any>;
    await pool.query(
      `UPDATE xlvii_fulfillments SET status = 'shipped', tracking_number = $1,
        tracking_url = $2, carrier = $3, shipped_at = now(), updated_at = now()
       WHERE id = $4`,
      [b.trackingNumber ?? null, b.trackingUrl ?? null, b.carrier ?? null, fulfillmentId],
    );
    publishNats(nc, 'sven.xlvii.fulfillment_shipped', { fulfillmentId });
    return reply.send({ shipped: true });
  });

  app.patch('/v1/admin/xlvii/fulfillments/:fulfillmentId/deliver', async (req, reply) => {
    const { fulfillmentId } = req.params as Record<string, string>;
    await pool.query(
      `UPDATE xlvii_fulfillments SET status = 'delivered', delivered_at = now(), updated_at = now()
       WHERE id = $1`,
      [fulfillmentId],
    );
    return reply.send({ delivered: true });
  });

  // ── Analytics / Overview ───────────────────────────────────────────

  app.get('/v1/admin/xlvii/analytics/overview', async (_req, reply) => {
    const [products, collections, variants, fulfillments, designs] = await Promise.all([
      pool.query(`SELECT count(*) AS total, status, sum(total_revenue) AS revenue FROM xlvii_products GROUP BY status`),
      pool.query(`SELECT count(*) AS total, status FROM xlvii_collections GROUP BY status`),
      pool.query(`SELECT count(*) AS total, sum(inventory_count) AS stock FROM xlvii_variants WHERE status = 'active'`),
      pool.query(`SELECT count(*) AS total, status FROM xlvii_fulfillments GROUP BY status`),
      pool.query(`SELECT count(*) AS total, approval_status FROM xlvii_designs GROUP BY approval_status`),
    ]);
    return reply.send({
      products: products.rows,
      collections: collections.rows,
      inventory: variants.rows[0] ?? { total: 0, stock: 0 },
      fulfillments: fulfillments.rows,
      designs: designs.rows,
    });
  });
}
