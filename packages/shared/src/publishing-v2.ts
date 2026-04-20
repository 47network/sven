// ─── Publishing Pipeline v2: Printing, Legal, POD, Trending Genres ───
// Extends publishing-pipeline.ts with physical production capabilities

// ─── Print Order Types ──────────────────────────────────────────────────

export type PrintOrderStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'printing'
  | 'quality_check'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type PrintOrderType = 'pod' | 'bulk' | 'sample';

export type PrintFormat = 'paperback' | 'hardcover' | 'special_edition';

export type EdgeType =
  | 'plain'
  | 'stained'
  | 'sprayed'
  | 'foil'
  | 'painted'
  | 'gilded';

export const PRINT_ORDER_STATUS_FLOW: PrintOrderStatus[] = [
  'draft', 'submitted', 'accepted', 'printing',
  'quality_check', 'shipped', 'delivered',
];

export function canAdvancePrintOrder(
  current: PrintOrderStatus,
  next: PrintOrderStatus,
): boolean {
  if (current === next) return false;
  if (next === 'cancelled' || next === 'failed') return true;
  const ci = PRINT_ORDER_STATUS_FLOW.indexOf(current);
  const ni = PRINT_ORDER_STATUS_FLOW.indexOf(next);
  if (ci < 0 || ni < 0) return false;
  return ni === ci + 1;
}

// ─── POD Provider Types ─────────────────────────────────────────────────

export type PODProvider =
  | 'amazon_kdp'
  | 'ingram_spark'
  | 'lulu'
  | 'blurb'
  | 'bookbaby'
  | 'tipografia_universul'
  | 'custom';

export interface PODIntegration {
  id: string;
  orgId: string;
  provider: PODProvider;
  displayName: string;
  apiEndpoint: string | null;
  capabilities: Record<string, unknown>;
  supportedFormats: string[];
  minOrderQty: number;
  baseCostEur: number;
  perPageCost: number;
  edgePrinting: boolean;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Legal Requirement Types ────────────────────────────────────────────

export type LegalRequirementType =
  | 'isbn_registration'
  | 'copyright_filing'
  | 'distribution_license'
  | 'tax_obligation'
  | 'content_rating'
  | 'deposit_copy'
  | 'import_export'
  | 'data_protection'
  | 'censorship_review'
  | 'author_contract';

export type LegalStatus =
  | 'researched'
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface LegalRequirement {
  id: string;
  orgId: string;
  countryCode: string;
  countryName: string;
  requirementType: LegalRequirementType;
  title: string;
  description: string | null;
  authorityName: string | null;
  authorityUrl: string | null;
  costEur: number | null;
  processingDays: number | null;
  mandatory: boolean;
  documents: unknown[];
  status: LegalStatus;
  validUntil: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Genre Trend Types ──────────────────────────────────────────────────

export type TrendSource =
  | 'amazon_bestseller'
  | 'goodreads'
  | 'booktok'
  | 'bookstagram'
  | 'google_trends'
  | 'publisher_weekly'
  | 'manual'
  | 'agent_research';

export type CompetitionLevel = 'low' | 'medium' | 'high' | 'saturated';

export interface GenreTrend {
  id: string;
  genre: string;
  subGenre: string | null;
  trope: string | null;
  market: string;
  source: TrendSource;
  popularityScore: number;
  competitionLevel: CompetitionLevel;
  avgPriceEur: number | null;
  monthlySales: number | null;
  trendingUp: boolean;
  keywords: string[];
  sampleTitles: unknown[];
  demographic: Record<string, unknown>;
  notes: string | null;
  researchedAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const TRENDING_GENRES = [
  'dark-romance', 'mafia-romance', 'why-choose', 'enemies-to-lovers',
  'bully-romance', 'college-romance', 'age-gap', 'step-sibling',
  'psychological-thriller', 'romantasy', 'reverse-harem', 'gothic-romance',
  'paranormal-romance', 'new-adult', 'forbidden-romance',
] as const;

export const TRENDING_TROPES = [
  'enemies-to-lovers', 'enemies-to-lovers-to-enemies', 'grumpy-sunshine',
  'forced-proximity', 'fake-dating', 'one-bed', 'touch-her-and-die',
  'morally-grey', 'who-did-this-to-you', 'possessive-hero',
  'good-girl-bad-boy', 'hidden-identity', 'second-chance',
  'forbidden-love', 'slow-burn', 'love-triangle',
] as const;

// ─── Author Persona Types ───────────────────────────────────────────────

export interface AuthorPersona {
  id: string;
  orgId: string;
  agentId: string;
  penName: string;
  bio: string | null;
  genres: string[];
  voiceStyle: string | null;
  writingTraits: Record<string, unknown>;
  backlistCount: number;
  totalSales: number;
  totalRevenue: number;
  ratingAvg: number;
  ratingCount: number;
  avatarUrl: string | null;
  socialLinks: Record<string, unknown>;
  active: boolean;
  evolutionLog: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Edge Printing Types ────────────────────────────────────────────────

export interface EdgePrintingSpec {
  id: string;
  supplierName: string;
  supplierCountry: string;
  edgeTypes: string[];
  minOrderQty: number;
  costPerUnitEur: number;
  turnaroundDays: number;
  qualityRating: number | null;
  contactEmail: string | null;
  contactUrl: string | null;
  supportsCustom: boolean;
  sampleImages: unknown[];
  notes: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Printer Purchase Proposal Types ────────────────────────────────────

export type PrinterType =
  | 'digital_press'
  | 'offset'
  | 'inkjet'
  | 'laser'
  | 'specialty';

export type ProposalStatus =
  | 'proposed'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'purchased';

export interface PrinterPurchaseProposal {
  id: string;
  orgId: string;
  proposedBy: string;
  printerModel: string;
  printerType: PrinterType;
  purchaseCostEur: number;
  monthlyMaintenanceEur: number;
  costPerPageEur: number;
  monthlyCapacity: number;
  breakEvenMonths: number | null;
  currentMonthlyVolume: number;
  currentMonthlyCostEur: number;
  projectedSavingsEur: number;
  roiPercentage: number | null;
  status: ProposalStatus;
  approvalNotes: string | null;
  shippingAddress: Record<string, unknown>;
  vendorUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Printing Cost Utilities ────────────────────────────────────────────

export function calculatePrintCost(
  baseCost: number,
  perPageCost: number,
  pageCount: number,
  quantity: number,
): number {
  const unitCost = baseCost + perPageCost * pageCount;
  return Math.round(unitCost * quantity * 100) / 100;
}

export function calculateBreakEven(
  purchaseCost: number,
  monthlyMaintenance: number,
  ownCostPerUnit: number,
  externalCostPerUnit: number,
  monthlyVolume: number,
): number | null {
  const savingsPerUnit = externalCostPerUnit - ownCostPerUnit;
  if (savingsPerUnit <= 0 || monthlyVolume <= 0) return null;
  const monthlySavings = savingsPerUnit * monthlyVolume - monthlyMaintenance;
  if (monthlySavings <= 0) return null;
  return Math.ceil(purchaseCost / monthlySavings);
}

export function calculateROI(
  purchaseCost: number,
  monthlyMaintenance: number,
  projectedMonthlySavings: number,
  months: number,
): number {
  const totalInvestment = purchaseCost + monthlyMaintenance * months;
  const totalSavings = projectedMonthlySavings * months;
  if (totalInvestment === 0) return 0;
  return Math.round(((totalSavings - totalInvestment) / totalInvestment) * 10000) / 100;
}

export const EDGE_TYPES: EdgeType[] = [
  'plain', 'stained', 'sprayed', 'foil', 'painted', 'gilded',
];

export const POD_PROVIDERS: PODProvider[] = [
  'amazon_kdp', 'ingram_spark', 'lulu', 'blurb',
  'bookbaby', 'tipografia_universul', 'custom',
];

export const LEGAL_REQUIREMENT_TYPES: LegalRequirementType[] = [
  'isbn_registration', 'copyright_filing', 'distribution_license',
  'tax_obligation', 'content_rating', 'deposit_copy', 'import_export',
  'data_protection', 'censorship_review', 'author_contract',
];

// Minimum volume per month to consider buying own printer
export const MIN_VOLUME_FOR_PRINTER_PROPOSAL = 200;
// Default approval threshold (> $50 requires human approval)
export const PRINTER_APPROVAL_THRESHOLD_EUR = 50;
