import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { requireRole } from './auth.js';

export async function registerCallRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Initiate a call ──────────────────────────────────────────
  app.post('/v1/calls', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['chat_id', 'call_type'],
        additionalProperties: false,
        properties: {
          chat_id: { type: 'string', minLength: 1 },
          call_type: { type: 'string', enum: ['voice', 'video', 'screen_share'] },
          metadata: { type: 'object' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { chat_id, call_type, metadata } = request.body as any;

    // Verify membership
    const memberCheck = await pool.query(
      `SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chat_id, userId],
    );
    if (memberCheck.rows.length === 0) {
      return reply.status(403).send({ success: false, error: 'not a member of this chat' });
    }

    // Check no active call already in this chat
    const activeCall = await pool.query(
      `SELECT id FROM calls WHERE chat_id = $1 AND status IN ('ringing', 'active') LIMIT 1`,
      [chat_id],
    );
    if (activeCall.rows.length > 0) {
      return reply.status(409).send({
        success: false,
        error: 'call already in progress',
        data: { call_id: activeCall.rows[0].id },
      });
    }

    const callId = uuidv7();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO calls (id, chat_id, initiator_user_id, call_type, status, metadata, created_at)
         VALUES ($1, $2, $3, $4, 'ringing', $5, NOW())`,
        [callId, chat_id, userId, call_type, JSON.stringify(metadata || {})],
      );

      // Add initiator as participant
      await client.query(
        `INSERT INTO call_participants (id, call_id, user_id, status, joined_at)
         VALUES ($1, $2, $3, 'joined', NOW())`,
        [uuidv7(), callId, userId],
      );

      // Invite all other chat members
      const members = await client.query(
        `SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id != $2`,
        [chat_id, userId],
      );
      for (const member of members.rows) {
        await client.query(
          `INSERT INTO call_participants (id, call_id, user_id, status)
           VALUES ($1, $2, $3, 'invited')`,
          [uuidv7(), callId, member.user_id],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Get WebRTC ICE config
    const iceConfig = await pool.query(
      `SELECT stun_urls, turn_urls, turn_username, turn_credential, turn_ttl_seconds
       FROM webrtc_config ORDER BY org_id NULLS LAST LIMIT 1`,
    );
    const ice = iceConfig.rows[0] || { stun_urls: ['stun:stun.l.google.com:19302'], turn_urls: [] };

    return reply.status(201).send({
      success: true,
      data: {
        call_id: callId,
        call_type,
        status: 'ringing',
        ice_servers: [
          { urls: ice.stun_urls },
          ...(ice.turn_urls?.length ? [{
            urls: ice.turn_urls,
            username: ice.turn_username,
            credential: ice.turn_credential,
          }] : []),
        ],
      },
    });
  });

  // ── Join a call ──────────────────────────────────────────────
  app.post('/v1/calls/:callId/join', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { callId } = request.params as { callId: string };

    // Update participant status
    const { rowCount } = await pool.query(
      `UPDATE call_participants SET status = 'joined', joined_at = NOW()
       WHERE call_id = $1 AND user_id = $2 AND status IN ('invited', 'ringing')`,
      [callId, userId],
    );
    if (!rowCount) {
      return reply.status(404).send({ success: false, error: 'not invited to this call' });
    }

    // Activate call if still ringing
    await pool.query(
      `UPDATE calls SET status = 'active', started_at = COALESCE(started_at, NOW())
       WHERE id = $1 AND status = 'ringing'`,
      [callId],
    );

    // ICE config
    const iceConfig = await pool.query(
      `SELECT stun_urls, turn_urls, turn_username, turn_credential
       FROM webrtc_config ORDER BY org_id NULLS LAST LIMIT 1`,
    );
    const ice = iceConfig.rows[0] || { stun_urls: ['stun:stun.l.google.com:19302'], turn_urls: [] };

    // Current participants
    const participants = await pool.query(
      `SELECT cp.user_id, cp.status, cp.media_state, u.display_name
       FROM call_participants cp JOIN users u ON u.id = cp.user_id
       WHERE cp.call_id = $1 AND cp.status = 'joined'`,
      [callId],
    );

    return reply.status(200).send({
      success: true,
      data: {
        call_id: callId,
        participants: participants.rows,
        ice_servers: [
          { urls: ice.stun_urls },
          ...(ice.turn_urls?.length ? [{
            urls: ice.turn_urls,
            username: ice.turn_username,
            credential: ice.turn_credential,
          }] : []),
        ],
      },
    });
  });

  // ── Send WebRTC signal (offer/answer/candidate) ──────────────
  app.post('/v1/calls/:callId/signal', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['type', 'target_user_id'],
        properties: {
          type: { type: 'string', enum: ['offer', 'answer', 'candidate', 'renegotiate'] },
          target_user_id: { type: 'string' },
          sdp: { type: 'string' },
          candidate: { type: 'object' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { callId } = request.params as { callId: string };
    const { type, target_user_id, sdp, candidate } = request.body as any;

    // Verify both users are in the call
    const participantCheck = await pool.query(
      `SELECT user_id FROM call_participants
       WHERE call_id = $1 AND user_id IN ($2, $3) AND status = 'joined'`,
      [callId, userId, target_user_id],
    );
    if (participantCheck.rows.length < 2) {
      return reply.status(403).send({ success: false, error: 'both participants must be in the call' });
    }

    // The signal is delivered via SSE to the target user
    // Store in a transient signals table or emit via NATS
    // For now, we push to the A2UI event bus which SSE consumes
    const signalEvent = {
      type: 'call_signal',
      call_id: callId,
      from_user_id: userId,
      signal_type: type,
      sdp: sdp || undefined,
      candidate: candidate || undefined,
    };

    // Emit via app-level event bus (picked up by SSE handler)
    if ((app as any).a2uiBus) {
      (app as any).a2uiBus.emit(`user:${target_user_id}`, signalEvent);
    }

    return reply.status(200).send({ success: true });
  });

  // ── Update media state (mute/unmute) ─────────────────────────
  app.patch('/v1/calls/:callId/media', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        properties: {
          audio: { type: 'boolean' },
          video: { type: 'boolean' },
          screen: { type: 'boolean' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { callId } = request.params as { callId: string };
    const updates = request.body as { audio?: boolean; video?: boolean; screen?: boolean };

    // Build a safe jsonb object from validated boolean fields only
    const mediaUpdate: Record<string, boolean> = {};
    if (updates.audio !== undefined) mediaUpdate.audio = Boolean(updates.audio);
    if (updates.video !== undefined) mediaUpdate.video = Boolean(updates.video);
    if (updates.screen !== undefined) mediaUpdate.screen = Boolean(updates.screen);

    if (Object.keys(mediaUpdate).length === 0) {
      return reply.status(400).send({ success: false, error: 'no media fields to update' });
    }

    await pool.query(
      `UPDATE call_participants SET media_state = media_state || $3::jsonb
       WHERE call_id = $1 AND user_id = $2 AND status = 'joined'`,
      [callId, userId, JSON.stringify(mediaUpdate)],
    );

    // Broadcast media state change to other participants via SSE
    const participants = await pool.query(
      `SELECT user_id FROM call_participants WHERE call_id = $1 AND user_id != $2 AND status = 'joined'`,
      [callId, userId],
    );
    if ((app as any).a2uiBus) {
      for (const p of participants.rows) {
        (app as any).a2uiBus.emit(`user:${p.user_id}`, {
          type: 'call_media_state',
          call_id: callId,
          user_id: userId,
          media_state: updates,
        });
      }
    }

    return reply.status(200).send({ success: true });
  });

  // ── Leave / end a call ───────────────────────────────────────
  app.post('/v1/calls/:callId/leave', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { callId } = request.params as { callId: string };

    await pool.query(
      `UPDATE call_participants SET status = 'left', left_at = NOW()
       WHERE call_id = $1 AND user_id = $2 AND status IN ('joined', 'ringing', 'invited')`,
      [callId, userId],
    );

    // Check if anyone is still in the call
    const remaining = await pool.query(
      `SELECT COUNT(*)::int AS count FROM call_participants
       WHERE call_id = $1 AND status = 'joined'`,
      [callId],
    );

    if ((remaining.rows[0]?.count ?? 0) === 0) {
      // End the call
      await pool.query(
        `UPDATE calls SET status = 'ended', ended_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at)))::int
         WHERE id = $1 AND status IN ('ringing', 'active')`,
        [callId],
      );
    }

    // Notify remaining participants
    if ((app as any).a2uiBus) {
      const stillIn = await pool.query(
        `SELECT user_id FROM call_participants WHERE call_id = $1 AND status = 'joined'`,
        [callId],
      );
      for (const p of stillIn.rows) {
        (app as any).a2uiBus.emit(`user:${p.user_id}`, {
          type: 'call_participant_left',
          call_id: callId,
          user_id: userId,
        });
      }
    }

    return reply.status(200).send({ success: true });
  });

  // ── Decline a call ───────────────────────────────────────────
  app.post('/v1/calls/:callId/decline', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { callId } = request.params as { callId: string };

    await pool.query(
      `UPDATE call_participants SET status = 'declined', left_at = NOW()
       WHERE call_id = $1 AND user_id = $2 AND status IN ('invited', 'ringing')`,
      [callId, userId],
    );

    // If all participants declined, mark call as missed
    const pending = await pool.query(
      `SELECT COUNT(*)::int AS count FROM call_participants
       WHERE call_id = $1 AND status IN ('invited', 'ringing', 'joined')`,
      [callId],
    );
    if ((pending.rows[0]?.count ?? 0) <= 1) {
      await pool.query(
        `UPDATE calls SET status = 'missed', ended_at = NOW()
         WHERE id = $1 AND status = 'ringing'`,
        [callId],
      );
    }

    return reply.status(200).send({ success: true });
  });

  // ── Get call state ───────────────────────────────────────────
  app.get('/v1/calls/:callId', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const { callId } = request.params as { callId: string };

    const call = await pool.query(
      `SELECT c.*, json_agg(json_build_object(
         'user_id', cp.user_id, 'status', cp.status,
         'media_state', cp.media_state, 'joined_at', cp.joined_at
       )) AS participants
       FROM calls c
       LEFT JOIN call_participants cp ON cp.call_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [callId],
    );

    if (call.rows.length === 0) {
      return reply.status(404).send({ success: false, error: 'call not found' });
    }

    return reply.status(200).send({ success: true, data: call.rows[0] });
  });

  // ── Get active calls for a chat ──────────────────────────────
  app.get('/v1/chats/:chatId/calls', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const { chatId } = request.params as { chatId: string };

    const { rows } = await pool.query(
      `SELECT c.id, c.call_type, c.status, c.initiator_user_id, c.created_at, c.started_at,
              (SELECT COUNT(*)::int FROM call_participants WHERE call_id = c.id AND status = 'joined') AS participant_count
       FROM calls c WHERE c.chat_id = $1 AND c.status IN ('ringing', 'active')
       ORDER BY c.created_at DESC LIMIT 5`,
      [chatId],
    );

    return reply.status(200).send({ success: true, data: { calls: rows } });
  });

  // ── Get WebRTC ICE configuration ─────────────────────────────
  app.get('/v1/calls/ice-config', {
    preHandler: requireAuth,
  }, async (_request: any, reply) => {
    const { rows } = await pool.query(
      `SELECT stun_urls, turn_urls, turn_username, turn_credential, turn_ttl_seconds
       FROM webrtc_config ORDER BY org_id NULLS LAST LIMIT 1`,
    );

    const ice = rows[0] || { stun_urls: ['stun:stun.l.google.com:19302'], turn_urls: [] };

    return reply.status(200).send({
      success: true,
      data: {
        ice_servers: [
          { urls: ice.stun_urls },
          ...(ice.turn_urls?.length ? [{
            urls: ice.turn_urls,
            username: ice.turn_username,
            credential: ice.turn_credential,
            credentialType: 'password',
          }] : []),
        ],
        ttl: ice.turn_ttl_seconds,
      },
    });
  });
}
