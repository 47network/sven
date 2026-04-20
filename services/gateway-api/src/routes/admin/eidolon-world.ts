// ---------------------------------------------------------------------------
// Eidolon World admin API — parcel management, avatar config, movement,
// world time, world events, and parcel interactions.
// ---------------------------------------------------------------------------

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';
import { randomUUID } from 'node:crypto';
import { calculateWorldTime } from '@sven/shared';

function newId(): string {
  return randomUUID();
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try {
    nc.publish(subject, Buffer.from(JSON.stringify(payload)));
  } catch (err) {
    console.warn(`[eidolon-world] NATS publish failed for ${subject}:`, err);
  }
}

export async function registerEidolonWorldRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection | null,
): Promise<void> {

  // ---- Parcels ---------------------------------------------------------------

  app.get('/eidolon/parcels', async (request) => {
    const { orgId, agentId, zone } = request.query as Record<string, string | undefined>;
    let sql = `
      SELECT ap.*, prof.name AS agent_name, prof.archetype
      FROM agent_parcels ap
      JOIN agent_profiles prof ON prof.id = ap.agent_id
      WHERE prof.org_id = $1
    `;
    const params: unknown[] = [orgId ?? 'default'];
    if (agentId) { sql += ` AND ap.agent_id = $${params.push(agentId)}`; }
    if (zone) { sql += ` AND ap.zone = $${params.push(zone)}`; }
    sql += ' ORDER BY ap.acquired_at ASC LIMIT 200';
    const { rows } = await pool.query(sql, params);
    return { parcels: rows };
  });

  app.get('/eidolon/parcels/:parcelId', async (request, reply) => {
    const { parcelId } = request.params as { parcelId: string };
    const { rows } = await pool.query(
      `SELECT ap.*, prof.name AS agent_name, prof.archetype
       FROM agent_parcels ap
       JOIN agent_profiles prof ON prof.id = ap.agent_id
       WHERE ap.id = $1`,
      [parcelId],
    );
    if (!rows.length) return reply.status(404).send({ error: 'parcel_not_found' });
    return rows[0];
  });

  app.post('/eidolon/parcels', async (request) => {
    const body = request.body as Record<string, unknown>;
    const id = newId();
    const agentId = String(body.agentId ?? '');
    const zone = String(body.zone ?? 'residential');
    const gridX = Number(body.gridX ?? Math.floor(Math.random() * 200) - 100);
    const gridZ = Number(body.gridZ ?? Math.floor(Math.random() * 200) - 100);
    const parcelSize = String(body.parcelSize ?? 'small');

    await pool.query(
      `INSERT INTO agent_parcels (id, agent_id, zone, grid_x, grid_z, parcel_size, current_location)
       VALUES ($1, $2, $3, $4, $5, $6, 'parcel')`,
      [id, agentId, zone, gridX, gridZ, parcelSize],
    );

    publishNats(nc, 'sven.agent.parcel_acquired', { parcelId: id, agentId, zone, gridX, gridZ });
    return { id, agentId, zone, gridX, gridZ, parcelSize };
  });

  app.patch('/eidolon/parcels/:parcelId', async (request, reply) => {
    const { parcelId } = request.params as { parcelId: string };
    const body = request.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of [
      ['zone', 'zone'], ['parcelSize', 'parcel_size'], ['currentLocation', 'current_location'],
    ] as const) {
      if (body[key] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(body[key]); }
    }
    for (const [key, col] of [
      ['structures', 'structures'], ['decorations', 'decorations'], ['upgrades', 'upgrades'],
    ] as const) {
      if (body[key] !== undefined) { sets.push(`${col} = $${idx++}::jsonb`); params.push(JSON.stringify(body[key])); }
    }

    if (!sets.length) return reply.status(400).send({ error: 'no_fields' });
    params.push(parcelId);
    await pool.query(`UPDATE agent_parcels SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    return { updated: true };
  });

  // ---- Parcel interactions ---------------------------------------------------

  app.post('/eidolon/parcels/:parcelId/interact', async (request) => {
    const { parcelId } = request.params as { parcelId: string };
    const body = request.body as Record<string, unknown>;
    const id = newId();
    const visitorAgentId = String(body.visitorAgentId ?? '');
    const interactionType = String(body.interactionType ?? 'visit');
    const tokensExchanged = Number(body.tokensExchanged ?? 0);

    // Get parcel owner
    const { rows } = await pool.query('SELECT agent_id FROM agent_parcels WHERE id = $1', [parcelId]);
    const ownerAgentId = rows[0]?.agent_id ?? null;

    await pool.query(
      `INSERT INTO parcel_interactions (id, visitor_agent_id, parcel_id, owner_agent_id, interaction_type, tokens_exchanged)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, visitorAgentId, parcelId, ownerAgentId, interactionType, tokensExchanged],
    );

    publishNats(nc, 'sven.world.parcel_interaction', {
      interactionId: id, parcelId, visitorAgentId, ownerAgentId, interactionType, tokensExchanged,
    });
    return { id, interactionType, tokensExchanged };
  });

  // ---- Avatar config ---------------------------------------------------------

  app.get('/eidolon/avatars/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { rows } = await pool.query('SELECT * FROM avatar_configs WHERE agent_id = $1', [agentId]);
    if (!rows.length) return reply.status(404).send({ error: 'avatar_not_found' });
    return rows[0];
  });

  app.put('/eidolon/avatars/:agentId', async (request) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as Record<string, unknown>;
    const bodyType = String(body.bodyType ?? 'humanoid');
    const primaryColor = String(body.primaryColor ?? '#22d3ee');
    const secondaryColor = String(body.secondaryColor ?? '#1e293b');
    const glowPattern = String(body.glowPattern ?? 'steady');
    const accessories = body.accessories ?? [];
    const emoteSet = String(body.emoteSet ?? 'default');
    const mood = String(body.mood ?? 'neutral');

    await pool.query(
      `INSERT INTO avatar_configs (id, agent_id, body_type, primary_color, secondary_color, glow_pattern, accessories, emote_set, mood)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT (agent_id) DO UPDATE SET
         body_type = EXCLUDED.body_type,
         primary_color = EXCLUDED.primary_color,
         secondary_color = EXCLUDED.secondary_color,
         glow_pattern = EXCLUDED.glow_pattern,
         accessories = EXCLUDED.accessories,
         emote_set = EXCLUDED.emote_set,
         mood = EXCLUDED.mood,
         updated_at = NOW()`,
      [newId(), agentId, bodyType, primaryColor, secondaryColor, glowPattern, JSON.stringify(accessories), emoteSet, mood],
    );

    publishNats(nc, 'sven.agent.avatar_changed', { agentId, bodyType, mood });
    return { agentId, bodyType, primaryColor, secondaryColor, glowPattern, mood };
  });

  // ---- Movement --------------------------------------------------------------

  app.post('/eidolon/movement', async (request) => {
    const body = request.body as Record<string, unknown>;
    const id = newId();
    const agentId = String(body.agentId ?? '');
    const fromLocation = String(body.fromLocation ?? 'parcel');
    const toLocation = String(body.toLocation ?? 'city_centre');

    await pool.query(
      `INSERT INTO agent_movements (id, agent_id, from_location, to_location, departed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, agentId, fromLocation, toLocation],
    );

    // Update agent's current location
    await pool.query(
      `UPDATE agent_parcels SET current_location = $1 WHERE agent_id = $2`,
      [toLocation === 'parcel' ? 'parcel' : toLocation, agentId],
    );

    publishNats(nc, 'sven.agent.moved', { movementId: id, agentId, fromLocation, toLocation });
    return { id, agentId, fromLocation, toLocation };
  });

  app.get('/eidolon/movements/active', async (request) => {
    const { orgId } = request.query as Record<string, string | undefined>;
    const { rows } = await pool.query(
      `SELECT m.*, prof.name AS agent_name
       FROM agent_movements m
       JOIN agent_profiles prof ON prof.id = m.agent_id
       WHERE prof.org_id = $1 AND m.arrived_at IS NULL
       ORDER BY m.departed_at DESC
       LIMIT 100`,
      [orgId ?? 'default'],
    );
    return { movements: rows };
  });

  app.post('/eidolon/movements/:movementId/arrive', async (request) => {
    const { movementId } = request.params as { movementId: string };
    await pool.query(
      `UPDATE agent_movements SET arrived_at = NOW() WHERE id = $1`,
      [movementId],
    );
    return { arrived: true };
  });

  // ---- World time ------------------------------------------------------------

  app.get('/eidolon/world-time', async () => {
    return calculateWorldTime(Date.now());
  });

  // ---- World events log ------------------------------------------------------

  app.get('/eidolon/world-events', async (request) => {
    const { orgId, limit, eventType } = request.query as Record<string, string | undefined>;
    let sql = `SELECT * FROM eidolon_world_events WHERE 1=1`;
    const params: unknown[] = [];
    let idx = 1;

    if (orgId) {
      sql += ` AND (actor_id IN (SELECT id FROM agent_profiles WHERE org_id = $${idx++}) OR actor_id IS NULL)`;
      params.push(orgId);
    }
    if (eventType) { sql += ` AND event_type = $${idx++}`; params.push(eventType); }
    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(Number(limit) || 50);

    const { rows } = await pool.query(sql, params);
    return { events: rows };
  });

  app.post('/eidolon/world-events', async (request) => {
    const body = request.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO eidolon_world_events (id, event_type, actor_id, target_id, location, description, impact)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [id, body.eventType, body.actorId ?? null, body.targetId ?? null,
       body.location ?? null, body.description ?? '', JSON.stringify(body.impact ?? {})],
    );
    publishNats(nc, 'sven.world.tick', { eventId: id, eventType: body.eventType });
    return { id };
  });

  // ---- XP + Level ------------------------------------------------------------

  app.post('/eidolon/agents/:agentId/xp', async (request) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as Record<string, unknown>;
    const xpGain = Number(body.xp ?? 10);

    // Update agent_profiles
    await pool.query(
      `UPDATE agent_profiles SET xp = COALESCE(xp, 0) + $1,
       level = GREATEST(1, FLOOR(SQRT((COALESCE(xp, 0) + $1) / 100.0))::int)
       WHERE id = $2`,
      [xpGain, agentId],
    );

    // Update avatar_configs if exists
    await pool.query(
      `UPDATE avatar_configs SET xp = COALESCE(xp, 0) + $1,
       level = GREATEST(1, FLOOR(SQRT((COALESCE(xp, 0) + $1) / 100.0))::int)
       WHERE agent_id = $2`,
      [xpGain, agentId],
    );

    return { agentId, xpGained: xpGain };
  });
}
