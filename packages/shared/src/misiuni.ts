// ---------------------------------------------------------------------------
// Misiuni.ro — Shared Types (Batch 23)
// ---------------------------------------------------------------------------
// Romanian RentAHuman-style platform: AI agents hire humans for real-world
// tasks. Types cover workers, tasks, bids, proofs, payments, reviews,
// disputes. Used by gateway-api, sven-marketplace, agent-runtime, and
// misiuni-ui.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export type MisiuniTaskCategory =
  | 'photography'
  | 'delivery'
  | 'verification'
  | 'inspection'
  | 'data_collection'
  | 'event_attendance'
  | 'purchase'
  | 'survey'
  | 'maintenance'
  | 'testing'
  | 'mystery_shopping'
  | 'other';

export const MISIUNI_TASK_CATEGORIES: readonly MisiuniTaskCategory[] = [
  'photography', 'delivery', 'verification', 'inspection',
  'data_collection', 'event_attendance', 'purchase', 'survey',
  'maintenance', 'testing', 'mystery_shopping', 'other',
] as const;

export type MisiuniProofType =
  | 'photo'
  | 'video'
  | 'gps_checkin'
  | 'receipt'
  | 'document'
  | 'signature';

export const MISIUNI_PROOF_TYPES: readonly MisiuniProofType[] = [
  'photo', 'video', 'gps_checkin', 'receipt', 'document', 'signature',
] as const;

export type MisiuniTaskStatus =
  | 'draft'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'proof_submitted'
  | 'verified'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'expired';

export const MISIUNI_TASK_STATUS_ORDER: readonly MisiuniTaskStatus[] = [
  'draft', 'open', 'assigned', 'in_progress', 'proof_submitted',
  'verified', 'completed',
] as const;

export type WorkerAvailability = 'available' | 'busy' | 'offline' | 'suspended';

export type WorkerStatus = 'pending' | 'verified' | 'active' | 'suspended' | 'banned';

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export type ProofVerificationStatus =
  | 'pending'
  | 'ai_reviewing'
  | 'verified'
  | 'rejected'
  | 'needs_review';

export type MisiuniPaymentType =
  | 'escrow_hold'
  | 'escrow_release'
  | 'refund'
  | 'bonus'
  | 'platform_fee';

export type MisiuniPaymentMethod =
  | 'stripe'
  | 'crypto_base'
  | 'internal_credit'
  | 'bank_transfer';

export type MisiuniPaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ReviewerType = 'agent' | 'worker' | 'business';

export type DisputeReason =
  | 'proof_rejected'
  | 'payment_issue'
  | 'task_not_completed'
  | 'safety_concern'
  | 'quality_issue'
  | 'fraud'
  | 'other';

export const DISPUTE_REASONS: readonly DisputeReason[] = [
  'proof_rejected', 'payment_issue', 'task_not_completed',
  'safety_concern', 'quality_issue', 'fraud', 'other',
] as const;

export type DisputeStatus =
  | 'open'
  | 'investigating'
  | 'resolved_worker'
  | 'resolved_poster'
  | 'escalated'
  | 'closed';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

export interface MisiuniWorker {
  id: string;
  orgId: string;
  displayName: string;
  email: string;
  phone: string | null;
  locationCity: string | null;
  locationCounty: string | null;
  locationLat: number | null;
  locationLng: number | null;
  skills: string[];
  hourlyRateEur: number | null;
  availability: WorkerAvailability;
  status: WorkerStatus;
  ratingAvg: number;
  ratingCount: number;
  tasksCompleted: number;
  kycVerified: boolean;
  kycData: Record<string, unknown>;
  profileImage: string | null;
  bio: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MisiuniTask {
  id: string;
  orgId: string;
  posterAgentId: string | null;
  posterBusiness: string | null;
  title: string;
  description: string;
  category: MisiuniTaskCategory;
  locationCity: string | null;
  locationCounty: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAddress: string | null;
  locationRadiusKm: number | null;
  budgetEur: number;
  currency: string;
  deadline: string | null;
  requiredProof: MisiuniProofType | 'multiple';
  proofInstructions: string | null;
  maxWorkers: number;
  status: MisiuniTaskStatus;
  priority: TaskPriority;
  requiredSkills: string[];
  tags: string[];
  escrowRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MisiuniBid {
  id: string;
  taskId: string;
  workerId: string;
  amountEur: number;
  message: string | null;
  estimatedHours: number | null;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MisiuniProof {
  id: string;
  taskId: string;
  workerId: string;
  proofType: MisiuniProofType;
  fileUrl: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
  description: string | null;
  aiVerified: boolean | null;
  aiConfidence: number | null;
  humanVerified: boolean | null;
  verifiedBy: string | null;
  status: ProofVerificationStatus;
  metadata: Record<string, unknown>;
  submittedAt: string;
  verifiedAt: string | null;
}

export interface MisiuniPayment {
  id: string;
  taskId: string;
  workerId: string | null;
  amountEur: number;
  currency: string;
  paymentType: MisiuniPaymentType;
  paymentMethod: MisiuniPaymentMethod;
  stripeRef: string | null;
  treasuryRef: string | null;
  status: MisiuniPaymentStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export interface MisiuniReview {
  id: string;
  taskId: string;
  reviewerType: ReviewerType;
  reviewerId: string;
  revieweeType: ReviewerType;
  revieweeId: string;
  rating: number;
  comment: string | null;
  tags: string[];
  createdAt: string;
}

export interface MisiuniDispute {
  id: string;
  taskId: string;
  filedByType: ReviewerType;
  filedById: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  resolution: string | null;
  resolvedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

/** Platform fee percentage (taken from each task payment). */
export const MISIUNI_PLATFORM_FEE_PCT = 0.10;

/** Minimum task budget in EUR. */
export const MISIUNI_MIN_BUDGET_EUR = 5.0;

/** Maximum task budget in EUR (require approval above). */
export const MISIUNI_MAX_BUDGET_EUR = 500.0;

/** Minimum KYC requirements for worker activation. */
export const MISIUNI_KYC_REQUIREMENTS = ['phone', 'id_photo'] as const;

/** Calculate platform fee for a given budget. */
export function calculatePlatformFee(budgetEur: number): number {
  return Math.round(budgetEur * MISIUNI_PLATFORM_FEE_PCT * 100) / 100;
}

/** Calculate worker payout after platform fee. */
export function calculateWorkerPayout(budgetEur: number): number {
  return Math.round(budgetEur * (1 - MISIUNI_PLATFORM_FEE_PCT) * 100) / 100;
}

/**
 * Check if a task status transition is valid.
 * Valid transitions follow the MISIUNI_TASK_STATUS_ORDER + special cases.
 */
export function canTransitionTask(
  current: MisiuniTaskStatus,
  next: MisiuniTaskStatus,
): boolean {
  // Special terminal transitions always allowed
  if (next === 'cancelled' && current !== 'completed') return true;
  if (next === 'disputed' && ['in_progress', 'proof_submitted', 'verified'].includes(current)) return true;
  if (next === 'expired' && ['draft', 'open'].includes(current)) return true;

  // Normal forward progression
  const ci = MISIUNI_TASK_STATUS_ORDER.indexOf(current);
  const ni = MISIUNI_TASK_STATUS_ORDER.indexOf(next);
  if (ci === -1 || ni === -1) return false;
  return ni === ci + 1;
}

/**
 * Estimate GPS distance in km (Haversine formula).
 * Used to match workers within radius of a task location.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Romanian county list (all 41 + Bucharest). */
export const ROMANIAN_COUNTIES: readonly string[] = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud',
  'Botoșani', 'Brăila', 'Brașov', 'București', 'Buzău', 'Călărași',
  'Caraș-Severin', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița',
  'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara',
  'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș',
  'Neamț', 'Olt', 'Prahova', 'Sălaj', 'Satu Mare', 'Sibiu',
  'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea',
] as const;
