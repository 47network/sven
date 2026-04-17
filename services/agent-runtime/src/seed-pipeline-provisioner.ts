// ---------------------------------------------------------------------------
// Seed Pipeline Provisioner (Batch 6)
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
// The provisioner is intentionally tiny — it is a pure wrapper around
// `RevenuePipelineRepository.seedServiceMarketplacePipeline`. Future batches
// may extend this with "publish marketplace listing" + "register service
// endpoint" steps so each seed actually fronts a sellable capability.
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
}

export class SeedPipelineProvisioner {
  private readonly repo: RevenuePipelineRepository;
  private readonly nameTemplate: string;

  constructor(opts: SeedPipelineProvisionerOptions) {
    this.repo = opts.repo;
    this.nameTemplate = opts.nameTemplate || 'Seed pipeline — automaton {automatonId}';
  }

  /**
   * Provision a single active service_marketplace pipeline for the given
   * newborn automaton. Idempotent-ish: if an active pipeline already targets
   * the treasury account with `typeConfig.automatonId` matching, we return
   * that one instead of creating a duplicate.
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
    return { pipelineId: pipeline.id, pipelineName: pipeline.name };
  }
}
