/**
 * Batch 23 — Misiuni.ro Platform (AI Hires Humans)
 *
 * Tests: migration, shared types, admin API routes, NATS/Eidolon wiring,
 * skills, task-executor handlers.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string): string =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

// ────────────────────────────────────────────────────────────
// 1. Migration SQL
// ────────────────────────────────────────────────────────────
describe('Batch 23 — Migration', () => {
  const sql = read('services/gateway-api/migrations/20260427060000_misiuni_platform.sql');

  const tables = [
    'misiuni_workers',
    'misiuni_tasks',
    'misiuni_bids',
    'misiuni_proofs',
    'misiuni_payments',
    'misiuni_reviews',
    'misiuni_disputes',
  ];

  test.each(tables)('creates table %s', (t) => {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
  });

  test('misiuni_workers has core columns', () => {
    expect(sql).toContain('display_name');
    expect(sql).toContain('phone');
    expect(sql).toContain('location_city');
    expect(sql).toContain('location_county');
    expect(sql).toContain('rating_avg');
    expect(sql).toContain('rating_count');
  });

  test('misiuni_tasks has budget + category + location', () => {
    expect(sql).toContain('budget_eur');
    expect(sql).toContain('category');
    expect(sql).toContain('location_city');
    expect(sql).toContain('poster_agent_id');
    expect(sql).toContain('required_proof');
  });

  test('misiuni_bids references tasks and workers', () => {
    expect(sql).toContain('REFERENCES misiuni_tasks');
    expect(sql).toContain('REFERENCES misiuni_workers');
  });

  test('misiuni_proofs has verification columns', () => {
    expect(sql).toContain('proof_type');
    expect(sql).toContain('file_url');
    expect(sql).toContain('gps_lat');
    expect(sql).toContain('gps_lng');
    expect(sql).toContain('status');
  });

  test('misiuni_payments has escrow and fee columns', () => {
    expect(sql).toContain('amount_eur');
    expect(sql).toContain('platform_fee');
    expect(sql).toContain('payment_type');
    expect(sql).toContain('payment_method');
  });

  test('misiuni_reviews has rating columns', () => {
    expect(sql).toContain('rating');
    expect(sql).toContain('comment');
    expect(sql).toContain('reviewer_type');
  });

  test('misiuni_disputes has resolution columns', () => {
    expect(sql).toContain('reason');
    expect(sql).toContain('resolution');
    expect(sql).toContain('resolved_at');
  });

  // Index checks
  const expectedIndexes = [
    'idx_mis_workers_status',
    'idx_mis_workers_city',
    'idx_mis_workers_county',
    'idx_mis_tasks_status',
    'idx_mis_tasks_category',
    'idx_mis_tasks_city',
    'idx_mis_tasks_deadline',
    'idx_mis_bids_task',
    'idx_mis_bids_worker',
    'idx_mis_proofs_task',
    'idx_mis_proofs_worker',
    'idx_mis_payments_task',
    'idx_mis_payments_status',
    'idx_mis_reviews_task',
    'idx_mis_reviews_reviewer',
    'idx_mis_disputes_task',
    'idx_mis_disputes_status',
  ];

  test.each(expectedIndexes)('creates index %s', (idx) => {
    expect(sql).toContain(idx);
  });

  test('has CHECK constraints for status enums', () => {
    expect(sql).toMatch(/CHECK\s*\(/);
  });

  test('uses JSONB metadata columns', () => {
    expect(sql).toContain('JSONB');
  });
});

// ────────────────────────────────────────────────────────────
// 2. Shared Types — packages/shared/src/misiuni.ts
// ────────────────────────────────────────────────────────────
describe('Batch 23 — Shared Types', () => {
  const src = read('packages/shared/src/misiuni.ts');

  // Type unions
  const typeUnions = [
    'MisiuniTaskCategory',
    'MisiuniProofType',
    'MisiuniTaskStatus',
    'WorkerAvailability',
    'WorkerStatus',
    'BidStatus',
    'ProofVerificationStatus',
    'MisiuniPaymentType',
    'MisiuniPaymentMethod',
    'MisiuniPaymentStatus',
    'ReviewerType',
    'DisputeReason',
    'DisputeStatus',
    'TaskPriority',
  ];

  test.each(typeUnions)('exports type %s', (t) => {
    expect(src).toContain(`export type ${t}`);
  });

  // Interfaces
  const interfaces = [
    'MisiuniWorker',
    'MisiuniTask',
    'MisiuniBid',
    'MisiuniProof',
    'MisiuniPayment',
    'MisiuniReview',
    'MisiuniDispute',
  ];

  test.each(interfaces)('exports interface %s', (iface) => {
    expect(src).toContain(`export interface ${iface}`);
  });

  // Task categories
  const categories = [
    'verification', 'delivery', 'photography', 'data_collection',
    'event_attendance', 'inspection', 'mystery_shopping',
    'purchase', 'survey', 'maintenance', 'testing', 'other',
  ];

  test.each(categories)('MisiuniTaskCategory includes "%s"', (c) => {
    expect(src).toContain(`'${c}'`);
  });

  // Utility functions
  test('exports calculatePlatformFee', () => {
    expect(src).toContain('export function calculatePlatformFee');
  });

  test('exports calculateWorkerPayout', () => {
    expect(src).toContain('export function calculateWorkerPayout');
  });

  test('exports canTransitionTask', () => {
    expect(src).toContain('export function canTransitionTask');
  });

  test('exports haversineKm', () => {
    expect(src).toContain('export function haversineKm');
  });

  // Constants
  test('MISIUNI_PLATFORM_FEE_PCT = 0.10', () => {
    expect(src).toMatch(/MISIUNI_PLATFORM_FEE_PCT\s*=\s*0\.10/);
  });

  test('MISIUNI_MIN_BUDGET_EUR = 5', () => {
    expect(src).toMatch(/MISIUNI_MIN_BUDGET_EUR\s*=\s*5/);
  });

  test('MISIUNI_MAX_BUDGET_EUR = 500', () => {
    expect(src).toMatch(/MISIUNI_MAX_BUDGET_EUR\s*=\s*500/);
  });

  test('ROMANIAN_COUNTIES has 42 entries', () => {
    const match = src.match(/ROMANIAN_COUNTIES[^=]*=\s*\[([^\]]+)\]/s);
    expect(match).toBeTruthy();
    const items = match![1].split(',').map(s => s.trim()).filter(Boolean);
    expect(items.length).toBe(42);
  });

  // Barrel export
  test('index.ts re-exports misiuni', () => {
    const idx = read('packages/shared/src/index.ts');
    expect(idx).toContain("from './misiuni");
  });
});

// ────────────────────────────────────────────────────────────
// 3. Admin API — routes/admin/misiuni.ts
// ────────────────────────────────────────────────────────────
describe('Batch 23 — Admin API', () => {
  const src = read('services/gateway-api/src/routes/admin/misiuni.ts');

  test('exports registerMisiuniRoutes', () => {
    expect(src).toContain('registerMisiuniRoutes');
  });

  // Worker endpoints
  const workerRoutes = [
    ["app.get('/misiuni/workers'", 'list workers'],
    ["app.get('/misiuni/workers/:workerId'", 'get worker'],
    ["app.post('/misiuni/workers'", 'register worker'],
    ["app.patch('/misiuni/workers/:workerId'", 'update worker'],
    ["app.post('/misiuni/workers/:workerId/verify'", 'verify worker'],
    ["app.post('/misiuni/workers/:workerId/suspend'", 'suspend worker'],
  ];

  test.each(workerRoutes)('has route %s (%s)', (route) => {
    expect(src).toContain(route);
  });

  // Task endpoints
  const taskRoutes = [
    ["app.get('/misiuni/tasks'", 'list tasks'],
    ["app.get('/misiuni/tasks/:taskId'", 'get task'],
    ["app.post('/misiuni/tasks'", 'create task'],
    ["app.patch('/misiuni/tasks/:taskId'", 'update task'],
    ["app.post('/misiuni/tasks/:taskId/publish'", 'publish task'],
    ["app.post('/misiuni/tasks/:taskId/cancel'", 'cancel task'],
  ];

  test.each(taskRoutes)('has route %s (%s)', (route) => {
    expect(src).toContain(route);
  });

  // Bid endpoints
  const bidRoutes = [
    ["app.get('/misiuni/tasks/:taskId/bids'", 'list bids'],
    ["app.post('/misiuni/tasks/:taskId/bids'", 'submit bid'],
    ["app.post('/misiuni/bids/:bidId/accept'", 'accept bid'],
    ["app.post('/misiuni/bids/:bidId/reject'", 'reject bid'],
  ];

  test.each(bidRoutes)('has route %s (%s)', (route) => {
    expect(src).toContain(route);
  });

  // Proof endpoints
  test('has proof submission route', () => {
    expect(src).toContain("app.post('/misiuni/tasks/:taskId/proofs'");
  });

  test('has proof verification route', () => {
    expect(src).toContain("app.post('/misiuni/proofs/:proofId/verify'");
  });

  // Payment endpoints
  const paymentRoutes = [
    ["app.post('/misiuni/tasks/:taskId/escrow'", 'escrow'],
    ["app.post('/misiuni/tasks/:taskId/release-payment'", 'release payment'],
    ["app.get('/misiuni/tasks/:taskId/payments'", 'list payments'],
  ];

  test.each(paymentRoutes)('has route %s (%s)', (route) => {
    expect(src).toContain(route);
  });

  // Review endpoints
  test('has review submission route', () => {
    expect(src).toContain("app.post('/misiuni/tasks/:taskId/reviews'");
  });

  test('has review listing route', () => {
    expect(src).toContain("app.get('/misiuni/tasks/:taskId/reviews'");
  });

  // Dispute endpoints
  test('has dispute filing route', () => {
    expect(src).toContain("app.post('/misiuni/tasks/:taskId/disputes'");
  });

  test('has dispute resolution route', () => {
    expect(src).toContain("app.post('/misiuni/disputes/:disputeId/resolve'");
  });

  test('has dispute listing route', () => {
    expect(src).toContain("app.get('/misiuni/disputes'");
  });

  // Analytics endpoints
  test('has stats endpoint', () => {
    expect(src).toContain("app.get('/misiuni/stats'");
  });

  test('has leaderboard endpoint', () => {
    expect(src).toContain("app.get('/misiuni/leaderboard'");
  });

  test('has matching endpoint', () => {
    expect(src).toContain("app.get('/misiuni/tasks/:taskId/matches'");
  });

  // NATS integration
  test('publishes NATS events', () => {
    expect(src).toContain('publishNats');
  });

  test('publishes task_created event', () => {
    expect(src).toContain('misiuni.task_created');
  });

  test('publishes bid_accepted event', () => {
    expect(src).toContain('misiuni.bid_accepted');
  });

  test('publishes payment_released event', () => {
    expect(src).toContain('misiuni.payment_released');
  });

  // Platform fee
  test('applies 10% platform fee', () => {
    expect(src).toContain('0.10');
  });

  // Wired into admin/index.ts
  test('admin index imports registerMisiuniRoutes', () => {
    const idx = read('services/gateway-api/src/routes/admin/index.ts');
    expect(idx).toContain('registerMisiuniRoutes');
  });

  test('admin index mounts misiuni routes', () => {
    const idx = read('services/gateway-api/src/routes/admin/index.ts');
    expect(idx).toContain('registerMisiuniRoutes(scopedApp, pool, nc)');
  });
});

// ────────────────────────────────────────────────────────────
// 4. NATS / Eidolon Wiring
// ────────────────────────────────────────────────────────────
describe('Batch 23 — NATS + Eidolon', () => {
  const eventBus = read('services/sven-eidolon/src/event-bus.ts');
  const types = read('services/sven-eidolon/src/types.ts');

  // SUBJECT_MAP entries
  const subjects = [
    ['sven.misiuni.task_created', 'misiuni.task_created'],
    ['sven.misiuni.bid_accepted', 'misiuni.bid_accepted'],
    ['sven.misiuni.proof_submitted', 'misiuni.proof_submitted'],
    ['sven.misiuni.task_verified', 'misiuni.task_verified'],
    ['sven.misiuni.payment_released', 'misiuni.payment_released'],
  ];

  test.each(subjects)('SUBJECT_MAP maps %s → %s', (nats, internal) => {
    expect(eventBus).toContain(`'${nats}'`);
    expect(eventBus).toContain(`'${internal}'`);
  });

  // EidolonEventKind
  const eventKinds = [
    'misiuni.task_created',
    'misiuni.bid_accepted',
    'misiuni.proof_submitted',
    'misiuni.task_verified',
    'misiuni.payment_released',
  ];

  test.each(eventKinds)('EidolonEventKind includes "%s"', (kind) => {
    expect(types).toContain(`'${kind}'`);
  });

  // EidolonBuildingKind
  test('EidolonBuildingKind includes recruitment_center', () => {
    expect(types).toContain("'recruitment_center'");
  });

  // districtFor
  test('districtFor maps recruitment_center', () => {
    expect(types).toContain("case 'recruitment_center'");
  });
});

// ────────────────────────────────────────────────────────────
// 5. Skills — misiuni-post + misiuni-verify
// ────────────────────────────────────────────────────────────
describe('Batch 23 — Misiuni Post Skill', () => {
  const skill = read('skills/autonomous-economy/misiuni-post/SKILL.md');

  test('has YAML frontmatter', () => {
    expect(skill).toMatch(/^---/);
    expect(skill).toContain('name: misiuni-post');
  });

  test('archetype is recruiter', () => {
    expect(skill).toContain('archetype: recruiter');
  });

  test('defines actions', () => {
    expect(skill).toContain('post-task');
    expect(skill).toContain('post-draft');
    expect(skill).toContain('estimate-workers');
  });

  test('defines inputs', () => {
    expect(skill).toContain('title');
    expect(skill).toContain('description');
    expect(skill).toContain('category');
    expect(skill).toContain('budgetEur');
    expect(skill).toContain('locationCity');
    expect(skill).toContain('requiredProof');
  });

  test('defines outputs', () => {
    expect(skill).toContain('taskId');
    expect(skill).toContain('estimatedMatchCount');
  });

  test('mentions safety protocols', () => {
    expect(skill).toContain('Safety');
    expect(skill).toContain('KYC');
  });

  test('references the correct API endpoint', () => {
    expect(skill).toContain('/v1/admin/misiuni/tasks');
  });

  test('references the correct NATS event', () => {
    expect(skill).toContain('sven.misiuni.task_created');
  });

  test('mentions budget limits (€5 min, €500 max)', () => {
    expect(skill).toContain('€5');
    expect(skill).toContain('€500');
  });
});

describe('Batch 23 — Misiuni Verify Skill', () => {
  const skill = read('skills/autonomous-economy/misiuni-verify/SKILL.md');

  test('has YAML frontmatter', () => {
    expect(skill).toMatch(/^---/);
    expect(skill).toContain('name: misiuni-verify');
  });

  test('archetype is analyst', () => {
    expect(skill).toContain('archetype: analyst');
  });

  test('defines verification actions', () => {
    expect(skill).toContain('verify-photo');
    expect(skill).toContain('verify-gps');
    expect(skill).toContain('verify-receipt');
    expect(skill).toContain('verify-combined');
  });

  test('defines GPS inputs', () => {
    expect(skill).toContain('gpsLat');
    expect(skill).toContain('gpsLng');
    expect(skill).toContain('expectedLat');
    expect(skill).toContain('expectedLng');
    expect(skill).toContain('maxDistanceKm');
  });

  test('defines outputs', () => {
    expect(skill).toContain('verified');
    expect(skill).toContain('confidence');
    expect(skill).toContain('gpsDistanceKm');
    expect(skill).toContain('flags');
  });

  test('documents confidence thresholds', () => {
    expect(skill).toContain('0.95');
    expect(skill).toContain('0.70');
    expect(skill).toContain('0.50');
  });

  test('references haversineKm from shared', () => {
    expect(skill).toContain('haversineKm()');
  });

  test('references the correct NATS event', () => {
    expect(skill).toContain('sven.misiuni.task_verified');
  });
});

// ────────────────────────────────────────────────────────────
// 6. Task Executor — misiuni_post + misiuni_verify handlers
// ────────────────────────────────────────────────────────────
describe('Batch 23 — Task Executor', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  test('routeToHandler has misiuni_post case', () => {
    expect(src).toContain("case 'misiuni_post'");
  });

  test('routeToHandler has misiuni_verify case', () => {
    expect(src).toContain("case 'misiuni_verify'");
  });

  test('has handleMisiuniPost method', () => {
    expect(src).toContain('handleMisiuniPost');
  });

  test('has handleMisiuniVerify method', () => {
    expect(src).toContain('handleMisiuniVerify');
  });

  // misiuni_post handler details
  test('handleMisiuniPost enforces budget limits', () => {
    expect(src).toContain('Math.min');
    expect(src).toContain('Math.max');
    expect(src).toMatch(/5.*500|500.*5/);
  });

  test('handleMisiuniPost generates task ID with mis_ prefix', () => {
    expect(src).toContain('mis_');
  });

  test('handleMisiuniPost calculates platform fee', () => {
    expect(src).toContain('platformFee');
    expect(src).toContain('0.10');
  });

  // misiuni_verify handler details
  test('handleMisiuniVerify performs haversine distance calculation', () => {
    expect(src).toContain('Math.atan2');
    expect(src).toContain('Math.sin');
    expect(src).toContain('6371');
  });

  test('handleMisiuniVerify returns confidence score', () => {
    expect(src).toContain('confidence');
  });

  test('handleMisiuniVerify flags GPS too far', () => {
    expect(src).toContain('gps_too_far');
  });

  test('handleMisiuniVerify flags missing proof ID', () => {
    expect(src).toContain('missing_proof_id');
  });

  test('handleMisiuniVerify returns verified boolean', () => {
    expect(src).toContain('verified');
    expect(src).toContain('confidence >= 0.5');
  });
});

// ────────────────────────────────────────────────────────────
// 7. Cross-cutting completeness checks
// ────────────────────────────────────────────────────────────
describe('Batch 23 — Completeness', () => {
  test('skills directory has 14 skills now', () => {
    const skillDir = path.join(ROOT, 'skills', 'autonomous-economy');
    const skills = fs.readdirSync(skillDir).filter((d) =>
      fs.statSync(path.join(skillDir, d)).isDirectory(),
    );
    expect(skills.length).toBeGreaterThanOrEqual(14);
    expect(skills).toContain('misiuni-post');
    expect(skills).toContain('misiuni-verify');
  });

  test('migration file exists', () => {
    const migPath = path.join(ROOT, 'services/gateway-api/migrations/20260427060000_misiuni_platform.sql');
    expect(fs.existsSync(migPath)).toBe(true);
  });

  test('misiuni shared types file exists', () => {
    const typesPath = path.join(ROOT, 'packages/shared/src/misiuni.ts');
    expect(fs.existsSync(typesPath)).toBe(true);
  });

  test('admin misiuni API file exists', () => {
    const apiPath = path.join(ROOT, 'services/gateway-api/src/routes/admin/misiuni.ts');
    expect(fs.existsSync(apiPath)).toBe(true);
  });

  test('total SUBJECT_MAP entries >= 39', () => {
    const eb = read('services/sven-eidolon/src/event-bus.ts');
    const matches = eb.match(/': '/g);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(39);
  });

  test('EidolonEventKind has >= 40 values', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    const block = types.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
    expect(block).toBeTruthy();
    const pipes = (block![1].match(/\|/g) || []).length;
    expect(pipes).toBeGreaterThanOrEqual(39);
  });

  test('EidolonBuildingKind has 8 values', () => {
    const types = read('services/sven-eidolon/src/types.ts');
    const block = types.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
    expect(block).toBeTruthy();
    const pipes = (block![1].match(/\|/g) || []).length;
    expect(pipes).toBeGreaterThanOrEqual(7); // 8+ values
  });
});
