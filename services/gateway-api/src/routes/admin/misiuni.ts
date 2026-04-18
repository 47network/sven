// ---------------------------------------------------------------------------
// Batch 23 — Misiuni.ro Admin API Routes
// ---------------------------------------------------------------------------
import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection, StringCodec } from 'nats';

const sc = StringCodec();
function newId(): string {
  return `mis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>) {
  if (!nc) return;
  try { nc.publish(subject, sc.encode(JSON.stringify(payload))); } catch (e: any) {
    console.warn(`[misiuni] NATS publish ${subject} failed: ${e.message}`);
  }
}

export async function registerMisiuniRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // ── Workers ──────────────────────────────────────────────────────

  // List workers (with filters)
  app.get('/misiuni/workers', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;
    if (q.status) { conditions.push(`status = $${idx++}`); params.push(q.status); }
    if (q.city) { conditions.push(`location_city = $${idx++}`); params.push(q.city); }
    if (q.county) { conditions.push(`location_county = $${idx++}`); params.push(q.county); }
    if (q.org_id) { conditions.push(`org_id = $${idx++}`); params.push(q.org_id); }
    const limit = Math.min(Number(q.limit) || 50, 200);
    const offset = Number(q.offset) || 0;
    const { rows } = await pool.query(
      `SELECT * FROM misiuni_workers WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );
    reply.send({ workers: rows, count: rows.length });
  });

  // Get single worker
  app.get('/misiuni/workers/:workerId', async (req, reply) => {
    const { workerId } = req.params as { workerId: string };
    const { rows } = await pool.query('SELECT * FROM misiuni_workers WHERE id = $1', [workerId]);
    if (!rows.length) return reply.status(404).send({ error: 'Worker not found' });
    reply.send(rows[0]);
  });

  // Register worker
  app.post('/misiuni/workers', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_workers (id, org_id, display_name, email, phone, location_city, location_county,
        location_lat, location_lng, skills, hourly_rate_eur, bio, profile_image, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, b.orgId || 'default', b.displayName, b.email, b.phone || null,
       b.locationCity || null, b.locationCounty || null,
       b.locationLat || null, b.locationLng || null,
       b.skills || [], b.hourlyRateEur || null,
       b.bio || null, b.profileImage || null, b.metadata || {}],
    );
    await publishNats(natsConn, 'sven.misiuni.worker_registered', { workerId: id });
    reply.status(201).send({ id, status: 'pending' });
  });

  // Update worker
  app.patch('/misiuni/workers/:workerId', async (req, reply) => {
    const { workerId } = req.params as { workerId: string };
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [k, v] of Object.entries(b)) {
      const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      sets.push(`${col} = $${idx++}`);
      params.push(v);
    }
    if (!sets.length) return reply.status(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = NOW()`);
    params.push(workerId);
    await pool.query(
      `UPDATE misiuni_workers SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
    reply.send({ updated: true });
  });

  // Approve/verify worker
  app.post('/misiuni/workers/:workerId/verify', async (req, reply) => {
    const { workerId } = req.params as { workerId: string };
    await pool.query(
      `UPDATE misiuni_workers SET status = 'verified', kyc_verified = true, updated_at = NOW() WHERE id = $1`,
      [workerId],
    );
    await publishNats(natsConn, 'sven.misiuni.worker_verified', { workerId });
    reply.send({ verified: true });
  });

  // Suspend worker
  app.post('/misiuni/workers/:workerId/suspend', async (req, reply) => {
    const { workerId } = req.params as { workerId: string };
    const b = req.body as Record<string, unknown>;
    await pool.query(
      `UPDATE misiuni_workers SET status = 'suspended', availability = 'suspended', updated_at = NOW() WHERE id = $1`,
      [workerId],
    );
    await publishNats(natsConn, 'sven.misiuni.worker_suspended', { workerId, reason: b.reason });
    reply.send({ suspended: true });
  });

  // ── Tasks ────────────────────────────────────────────────────────

  // List tasks
  app.get('/misiuni/tasks', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;
    if (q.status) { conditions.push(`status = $${idx++}`); params.push(q.status); }
    if (q.category) { conditions.push(`category = $${idx++}`); params.push(q.category); }
    if (q.city) { conditions.push(`location_city = $${idx++}`); params.push(q.city); }
    if (q.poster_agent_id) { conditions.push(`poster_agent_id = $${idx++}`); params.push(q.poster_agent_id); }
    if (q.org_id) { conditions.push(`org_id = $${idx++}`); params.push(q.org_id); }
    if (q.priority) { conditions.push(`priority = $${idx++}`); params.push(q.priority); }
    const limit = Math.min(Number(q.limit) || 50, 200);
    const offset = Number(q.offset) || 0;
    const { rows } = await pool.query(
      `SELECT * FROM misiuni_tasks WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );
    reply.send({ tasks: rows, count: rows.length });
  });

  // Get single task (with bids + proofs)
  app.get('/misiuni/tasks/:taskId', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const [taskRes, bidsRes, proofsRes] = await Promise.all([
      pool.query('SELECT * FROM misiuni_tasks WHERE id = $1', [taskId]),
      pool.query('SELECT * FROM misiuni_bids WHERE task_id = $1 ORDER BY created_at DESC', [taskId]),
      pool.query('SELECT * FROM misiuni_proofs WHERE task_id = $1 ORDER BY submitted_at DESC', [taskId]),
    ]);
    if (!taskRes.rows.length) return reply.status(404).send({ error: 'Task not found' });
    reply.send({ ...taskRes.rows[0], bids: bidsRes.rows, proofs: proofsRes.rows });
  });

  // Create task
  app.post('/misiuni/tasks', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_tasks (id, org_id, poster_agent_id, poster_business, title, description,
        category, location_city, location_county, location_lat, location_lng, location_address,
        location_radius_km, budget_eur, currency, deadline, required_proof, proof_instructions,
        max_workers, priority, required_skills, tags, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [id, b.orgId || 'default', b.posterAgentId || null, b.posterBusiness || null,
       b.title, b.description, b.category,
       b.locationCity || null, b.locationCounty || null,
       b.locationLat || null, b.locationLng || null, b.locationAddress || null,
       b.locationRadiusKm || null, b.budgetEur, b.currency || 'EUR',
       b.deadline || null, b.requiredProof || 'photo', b.proofInstructions || null,
       b.maxWorkers || 1, b.priority || 'normal',
       b.requiredSkills || [], b.tags || [], b.metadata || {}],
    );
    await publishNats(natsConn, 'sven.misiuni.task_created', { taskId: id, category: b.category, budgetEur: b.budgetEur });
    reply.status(201).send({ id, status: 'draft' });
  });

  // Update task
  app.patch('/misiuni/tasks/:taskId', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [k, v] of Object.entries(b)) {
      const col = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      sets.push(`${col} = $${idx++}`);
      params.push(v);
    }
    if (!sets.length) return reply.status(400).send({ error: 'No fields to update' });
    sets.push(`updated_at = NOW()`);
    params.push(taskId);
    await pool.query(
      `UPDATE misiuni_tasks SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
    reply.send({ updated: true });
  });

  // Publish task (draft → open)
  app.post('/misiuni/tasks/:taskId/publish', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const { rows } = await pool.query('SELECT status, budget_eur FROM misiuni_tasks WHERE id = $1', [taskId]);
    if (!rows.length) return reply.status(404).send({ error: 'Task not found' });
    if (rows[0].status !== 'draft') return reply.status(400).send({ error: 'Only draft tasks can be published' });
    await pool.query(`UPDATE misiuni_tasks SET status = 'open', updated_at = NOW() WHERE id = $1`, [taskId]);
    await publishNats(natsConn, 'sven.misiuni.task_published', { taskId, budgetEur: rows[0].budget_eur });
    reply.send({ published: true });
  });

  // Cancel task
  app.post('/misiuni/tasks/:taskId/cancel', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    await pool.query(`UPDATE misiuni_tasks SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [taskId]);
    await publishNats(natsConn, 'sven.misiuni.task_cancelled', { taskId });
    reply.send({ cancelled: true });
  });

  // ── Bids ─────────────────────────────────────────────────────────

  // List bids for a task
  app.get('/misiuni/tasks/:taskId/bids', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const { rows } = await pool.query(
      'SELECT * FROM misiuni_bids WHERE task_id = $1 ORDER BY created_at DESC', [taskId],
    );
    reply.send({ bids: rows, count: rows.length });
  });

  // Submit bid
  app.post('/misiuni/tasks/:taskId/bids', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_bids (id, task_id, worker_id, amount_eur, message, estimated_hours)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, taskId, b.workerId, b.amountEur, b.message || null, b.estimatedHours || null],
    );
    await publishNats(natsConn, 'sven.misiuni.bid_submitted', { bidId: id, taskId, workerId: b.workerId });
    reply.status(201).send({ id, status: 'pending' });
  });

  // Accept bid
  app.post('/misiuni/bids/:bidId/accept', async (req, reply) => {
    const { bidId } = req.params as { bidId: string };
    const { rows } = await pool.query('SELECT task_id, worker_id FROM misiuni_bids WHERE id = $1', [bidId]);
    if (!rows.length) return reply.status(404).send({ error: 'Bid not found' });
    const { task_id, worker_id } = rows[0];
    await pool.query(`UPDATE misiuni_bids SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [bidId]);
    await pool.query(`UPDATE misiuni_bids SET status = 'rejected', updated_at = NOW() WHERE task_id = $1 AND id != $2 AND status = 'pending'`, [task_id, bidId]);
    await pool.query(`UPDATE misiuni_tasks SET status = 'assigned', updated_at = NOW() WHERE id = $1`, [task_id]);
    await publishNats(natsConn, 'sven.misiuni.bid_accepted', { bidId, taskId: task_id, workerId: worker_id });
    reply.send({ accepted: true });
  });

  // Reject bid
  app.post('/misiuni/bids/:bidId/reject', async (req, reply) => {
    const { bidId } = req.params as { bidId: string };
    await pool.query(`UPDATE misiuni_bids SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [bidId]);
    reply.send({ rejected: true });
  });

  // ── Proofs ───────────────────────────────────────────────────────

  // Submit proof of work
  app.post('/misiuni/tasks/:taskId/proofs', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_proofs (id, task_id, worker_id, proof_type, file_url, gps_lat, gps_lng,
        gps_accuracy_m, description, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, taskId, b.workerId, b.proofType, b.fileUrl || null,
       b.gpsLat || null, b.gpsLng || null, b.gpsAccuracyM || null,
       b.description || null, b.metadata || {}],
    );
    await pool.query(`UPDATE misiuni_tasks SET status = 'proof_submitted', updated_at = NOW() WHERE id = $1`, [taskId]);
    await publishNats(natsConn, 'sven.misiuni.proof_submitted', { proofId: id, taskId, proofType: b.proofType });
    reply.status(201).send({ id, status: 'pending' });
  });

  // Verify proof (AI or human)
  app.post('/misiuni/proofs/:proofId/verify', async (req, reply) => {
    const { proofId } = req.params as { proofId: string };
    const b = req.body as Record<string, unknown>;
    const verified = b.verified === true;
    const isAi = b.verifierType === 'ai';

    const updates = isAi
      ? `ai_verified = $1, ai_confidence = $2, status = $3, verified_at = NOW()`
      : `human_verified = $1, verified_by = $2, status = $3, verified_at = NOW()`;
    const params = isAi
      ? [verified, b.confidence || 0.0, verified ? 'verified' : 'rejected', proofId]
      : [verified, b.verifiedBy || 'admin', verified ? 'verified' : 'rejected', proofId];

    await pool.query(`UPDATE misiuni_proofs SET ${updates} WHERE id = $4`, params);

    if (verified) {
      const { rows } = await pool.query('SELECT task_id FROM misiuni_proofs WHERE id = $1', [proofId]);
      if (rows.length) {
        await pool.query(`UPDATE misiuni_tasks SET status = 'verified', updated_at = NOW() WHERE id = $1`, [rows[0].task_id]);
        await publishNats(natsConn, 'sven.misiuni.task_verified', { taskId: rows[0].task_id, proofId });
      }
    }
    reply.send({ verified });
  });

  // ── Payments ─────────────────────────────────────────────────────

  // Create escrow hold
  app.post('/misiuni/tasks/:taskId/escrow', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_payments (id, task_id, amount_eur, currency, payment_type, payment_method, metadata)
       VALUES ($1,$2,$3,$4,'escrow_hold',$5,$6)`,
      [id, taskId, b.amountEur, b.currency || 'EUR', b.paymentMethod || 'stripe', b.metadata || {}],
    );
    await pool.query(`UPDATE misiuni_tasks SET escrow_ref = $1, updated_at = NOW() WHERE id = $2`, [id, taskId]);
    reply.status(201).send({ id, paymentType: 'escrow_hold' });
  });

  // Release payment to worker
  app.post('/misiuni/tasks/:taskId/release-payment', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const id = newId();

    const { rows: taskRows } = await pool.query('SELECT budget_eur FROM misiuni_tasks WHERE id = $1', [taskId]);
    if (!taskRows.length) return reply.status(404).send({ error: 'Task not found' });

    const budgetEur = Number(taskRows[0].budget_eur);
    const platformFee = Math.round(budgetEur * 0.10 * 100) / 100;
    const workerPayout = Math.round((budgetEur - platformFee) * 100) / 100;

    // Release payment
    await pool.query(
      `INSERT INTO misiuni_payments (id, task_id, worker_id, amount_eur, currency, payment_type, payment_method, status, completed_at)
       VALUES ($1,$2,$3,$4,$5,'escrow_release',$6,'completed',NOW())`,
      [id, taskId, b.workerId, workerPayout, b.currency || 'EUR', b.paymentMethod || 'stripe'],
    );

    // Platform fee record
    const feeId = newId();
    await pool.query(
      `INSERT INTO misiuni_payments (id, task_id, amount_eur, currency, payment_type, payment_method, status, completed_at)
       VALUES ($1,$2,$3,$4,'platform_fee','internal_credit','completed',NOW())`,
      [feeId, taskId, platformFee, b.currency || 'EUR'],
    );

    await pool.query(`UPDATE misiuni_tasks SET status = 'completed', updated_at = NOW() WHERE id = $1`, [taskId]);

    // Update worker stats
    if (b.workerId) {
      await pool.query(
        `UPDATE misiuni_workers SET tasks_completed = tasks_completed + 1, updated_at = NOW() WHERE id = $1`,
        [b.workerId],
      );
    }

    await publishNats(natsConn, 'sven.misiuni.payment_released', {
      taskId, workerId: b.workerId, workerPayout, platformFee,
    });
    reply.send({ released: true, workerPayout, platformFee });
  });

  // List payments for a task
  app.get('/misiuni/tasks/:taskId/payments', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const { rows } = await pool.query(
      'SELECT * FROM misiuni_payments WHERE task_id = $1 ORDER BY created_at DESC', [taskId],
    );
    reply.send({ payments: rows, count: rows.length });
  });

  // ── Reviews ──────────────────────────────────────────────────────

  // Submit review
  app.post('/misiuni/tasks/:taskId/reviews', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_reviews (id, task_id, reviewer_type, reviewer_id, reviewee_type, reviewee_id, rating, comment, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, taskId, b.reviewerType, b.reviewerId, b.revieweeType, b.revieweeId,
       b.rating, b.comment || null, b.tags || []],
    );

    // Update worker rating average if reviewing a worker
    if (b.revieweeType === 'worker') {
      await pool.query(
        `UPDATE misiuni_workers SET
          rating_avg = (SELECT AVG(rating) FROM misiuni_reviews WHERE reviewee_id = $1 AND reviewee_type = 'worker'),
          rating_count = (SELECT COUNT(*) FROM misiuni_reviews WHERE reviewee_id = $1 AND reviewee_type = 'worker'),
          updated_at = NOW()
         WHERE id = $1`,
        [b.revieweeId],
      );
    }
    reply.status(201).send({ id });
  });

  // List reviews for a task
  app.get('/misiuni/tasks/:taskId/reviews', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const { rows } = await pool.query(
      'SELECT * FROM misiuni_reviews WHERE task_id = $1 ORDER BY created_at DESC', [taskId],
    );
    reply.send({ reviews: rows, count: rows.length });
  });

  // ── Disputes ─────────────────────────────────────────────────────

  // File dispute
  app.post('/misiuni/tasks/:taskId/disputes', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const b = req.body as Record<string, unknown>;
    const id = newId();
    await pool.query(
      `INSERT INTO misiuni_disputes (id, task_id, filed_by_type, filed_by_id, reason, description, evidence_urls, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, taskId, b.filedByType, b.filedById, b.reason, b.description,
       b.evidenceUrls || [], b.metadata || {}],
    );
    await pool.query(`UPDATE misiuni_tasks SET status = 'disputed', updated_at = NOW() WHERE id = $1`, [taskId]);
    await publishNats(natsConn, 'sven.misiuni.dispute_filed', { disputeId: id, taskId, reason: b.reason });
    reply.status(201).send({ id, status: 'open' });
  });

  // Resolve dispute
  app.post('/misiuni/disputes/:disputeId/resolve', async (req, reply) => {
    const { disputeId } = req.params as { disputeId: string };
    const b = req.body as Record<string, unknown>;
    await pool.query(
      `UPDATE misiuni_disputes SET status = $1, resolution = $2, resolved_by = $3, resolved_at = NOW() WHERE id = $4`,
      [b.status || 'closed', b.resolution, b.resolvedBy || 'admin', disputeId],
    );
    await publishNats(natsConn, 'sven.misiuni.dispute_resolved', { disputeId, status: b.status });
    reply.send({ resolved: true });
  });

  // List disputes
  app.get('/misiuni/disputes', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;
    if (q.status) { conditions.push(`status = $${idx++}`); params.push(q.status); }
    if (q.task_id) { conditions.push(`task_id = $${idx++}`); params.push(q.task_id); }
    const limit = Math.min(Number(q.limit) || 50, 200);
    const offset = Number(q.offset) || 0;
    const { rows } = await pool.query(
      `SELECT d.*, t.title as task_title FROM misiuni_disputes d
       LEFT JOIN misiuni_tasks t ON d.task_id = t.id
       WHERE ${conditions.join(' AND ')} ORDER BY d.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );
    reply.send({ disputes: rows, count: rows.length });
  });

  // ── Analytics ────────────────────────────────────────────────────

  // Platform stats
  app.get('/misiuni/stats', async (_req, reply) => {
    const [workers, tasks, payments, disputes] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM misiuni_workers GROUP BY status`),
      pool.query(`SELECT status, COUNT(*) as count FROM misiuni_tasks GROUP BY status`),
      pool.query(`SELECT payment_type, SUM(amount_eur) as total, COUNT(*) as count FROM misiuni_payments WHERE status = 'completed' GROUP BY payment_type`),
      pool.query(`SELECT status, COUNT(*) as count FROM misiuni_disputes GROUP BY status`),
    ]);
    reply.send({
      workers: Object.fromEntries(workers.rows.map((r: any) => [r.status, Number(r.count)])),
      tasks: Object.fromEntries(tasks.rows.map((r: any) => [r.status, Number(r.count)])),
      payments: Object.fromEntries(payments.rows.map((r: any) => [r.payment_type, { total: Number(r.total), count: Number(r.count) }])),
      disputes: Object.fromEntries(disputes.rows.map((r: any) => [r.status, Number(r.count)])),
    });
  });

  // Worker leaderboard
  app.get('/misiuni/leaderboard', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const { rows } = await pool.query(
      `SELECT id, display_name, rating_avg, rating_count, tasks_completed, location_city, skills
       FROM misiuni_workers WHERE status IN ('verified', 'active')
       ORDER BY tasks_completed DESC, rating_avg DESC LIMIT $1`,
      [limit],
    );
    reply.send({ leaderboard: rows });
  });

  // Matching — find workers for a task
  app.get('/misiuni/tasks/:taskId/matches', async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    const q = req.query as Record<string, string>;
    const { rows: taskRows } = await pool.query('SELECT * FROM misiuni_tasks WHERE id = $1', [taskId]);
    if (!taskRows.length) return reply.status(404).send({ error: 'Task not found' });
    const task = taskRows[0];
    const limit = Math.min(Number(q.limit) || 10, 50);

    let query = `SELECT * FROM misiuni_workers WHERE status IN ('verified', 'active') AND availability = 'available'`;
    const params: unknown[] = [];
    let idx = 1;

    if (task.location_city) {
      query += ` AND location_city = $${idx++}`;
      params.push(task.location_city);
    }
    if (task.required_skills && task.required_skills.length > 0) {
      query += ` AND skills && $${idx++}`;
      params.push(task.required_skills);
    }

    query += ` ORDER BY rating_avg DESC, tasks_completed DESC LIMIT $${idx}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);
    reply.send({ matches: rows, count: rows.length });
  });
}
