// ---------------------------------------------------------------------------
// Seed Pipeline Provisioner (Batch 6 + Batch 11 auto-listing)
// ---------------------------------------------------------------------------
// When a fresh automaton is born it has an empty pipelineIds[] and therefore
// nothing to earn against. The lifecycle scheduler would mark it unprofitable
// on the first evaluation pass and retire it before it ever did any work.
//
// This provisioner bridges that gap: on birth, it creates + activates a
// default `service_marketplace` revenue pipeline bound to the automaton's
// treasury account and returns the new pipeline id so the caller can persist
// it onto the automaton record.
//
// Batch 11: After creating the pipeline the provisioner also auto-creates
// and publishes a marketplace listing so the automaton has a sellable
// offering from the moment it is born — closing the autonomous revenue loop.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';
import type { RevenuePipelineRepository } from './revenue-pipeline-repo.js';

const logger = createLogger('seed-pipeline-provisioner');

export interface SeedPipelineProvisionerOptions {
  repo: RevenuePipelineRepository;
  /**
   * Optional pipeline name template. Substitutions:
   *   {automatonId} | {orgId}
   */
  nameTemplate?: string;
  /** Marketplace base URL for auto-listing on birth. */
  marketplaceUrl?: string;
  /** If false, skip marketplace listing creation (default: true). */
  autoListOnBirth?: boolean;
}

export interface ProvisionParams {
  orgId: string;
  automatonId: string;
  treasuryAccountId: string;
  /** Override name; takes precedence over nameTemplate. */
  name?: string;
}

export interface ProvisionResult {
  pipelineId: string;
  pipelineName: string;
  listingId?: string;
  listingSlug?: string;
}

export class SeedPipelineProvisioner {
  private readonly repo: RevenuePipelineRepository;
  private readonly nameTemplate: string;
  private readonly marketplaceUrl: string;
  private readonly autoListOnBirth: boolean;

  constructor(opts: SeedPipelineProvisionerOptions) {
    this.repo = opts.repo;
    this.nameTemplate = opts.nameTemplate || 'Seed pipeline — automaton {automatonId}';
    this.marketplaceUrl = opts.marketplaceUrl
      || process.env.MARKETPLACE_API
      || 'http://127.0.0.1:9478';
    this.autoListOnBirth = opts.autoListOnBirth !== false;
  }

  /**
   * Provision a single active service_marketplace pipeline for the given
   * newborn automaton. Idempotent-ish: if an active pipeline already targets
   * the treasury account with `typeConfig.automatonId` matching, we return
   * that one instead of creating a duplicate.
   *
   * Batch 11: also auto-creates + publishes a marketplace listing so the
   * automaton has a revenue path from birth.
   */
  async provisionForAutomaton(params: ProvisionParams): Promise<ProvisionResult> {
    if (!params.orgId) throw new Error('orgId required');
    if (!params.automatonId) throw new Error('automatonId required');
    if (!params.treasuryAccountId) throw new Error('treasuryAccountId required');

    // Idempotency check — avoid spamming pipelines on reboot / retry storms.
    const existing = await this.repo.findActiveByTreasuryAccount(params.treasuryAccountId);
    const match = existing.find((p) => {
      const cfg = (p.config.typeConfig ?? {}) as Record<string, unknown>;
      return cfg.automatonId === params.automatonId && cfg.seed === true;
    });
    if (match) {
      logger.info('Seed pipeline already provisioned — reusing', {
        pipelineId: match.id,
        automatonId: params.automatonId,
      });
      return { pipelineId: match.id, pipelineName: match.name };
    }

    const name = params.name || this.nameTemplate
      .replace('{automatonId}', params.automatonId)
      .replace('{orgId}', params.orgId);

    const pipeline = await this.repo.seedServiceMarketplacePipeline({
      orgId: params.orgId,
      treasuryAccountId: params.treasuryAccountId,
      automatonId: params.automatonId,
      name,
    });

    const result: ProvisionResult = {
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
    };

    // Auto-list on marketplace so revenue can flow autonomously
    if (this.autoListOnBirth) {
      try {
        const listing = await this.createAndPublishListing({
          orgId: params.orgId,
          automatonId: params.automatonId,
          treasuryAccountId: params.treasuryAccountId,
          pipelineId: pipeline.id,
          pipelineName: pipeline.name,
        });
        if (listing) {
          result.listingId = listing.listingId;
          result.listingSlug = listing.listingSlug;
          logger.info('Auto-listed on marketplace at birth', {
            automatonId: params.automatonId,
            listingId: listing.listingId,
            slug: listing.listingSlug,
          });
        }
      } catch (err) {
        logger.warn('Auto-listing on birth failed — pipeline still created', {
          automatonId: params.automatonId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  // ── Marketplace auto-listing ──────────────────────────────────────

  private async createAndPublishListing(params: {
    orgId: string;
    automatonId: string;
    treasuryAccountId: string;
    pipelineId: string;
    pipelineName: string;
  }): Promise<{ listingId: string; listingSlug: string } | null> {
    const title = `Automaton ${params.automatonId.slice(0, 8)} — API Service`;
    const body = {
      orgId: params.orgId,
      sellerAgentId: params.automatonId,
      title,
      description: `Autonomous API service provided by automaton ${params.automatonId}. Backed by pipeline ${params.pipelineId}.`,
      kind: 'skill_api',
      pricingModel: 'per_call',
      unitPrice: 0.01,
      currency: 'USD',
      payoutAccountId: params.treasuryAccountId,
      tags: ['automaton', 'auto-listed', 'seed'],
      metadata: {
        source: 'seed-pipeline-provisioner',
        automatonId: params.automatonId,
        pipelineId: params.pipelineId,
      },
    };

    const createRes = await fetch(`${this.marketplaceUrl}/v1/market/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      logger.warn('Marketplace listing creation failed', {
        status: createRes.status,
        body: text.slice(0, 200),
      });
      return null;
    }

    const created = (await createRes.json()) as {
      data?: { listing?: { id: string; slug: string; status: string } };
    };
    const listing = created?.data?.listing;
    if (!listing) return null;

    // Publish immediately so the listing is live
    const pubRes = await fetch(
      `${this.marketplaceUrl}/v1/market/listings/${listing.id}/publish`,
      { method: 'POST' },
    );
    if (!pubRes.ok) {
      logger.warn('Marketplace listing publish failed — listing still in draft', {
        listingId: listing.id,
        status: pubRes.status,
      });
    }

    return { listingId: listing.id, listingSlug: listing.slug };
  }
}
