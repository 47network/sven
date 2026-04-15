// ---------------------------------------------------------------------------
// NATS Event Publisher
// ---------------------------------------------------------------------------
// Publishes model-router domain events to NATS JetStream for consumption
// by other services (gateway-api, agent-runtime, admin-ui, etc.).
// ---------------------------------------------------------------------------

import type { NatsConnection } from 'nats';
import { JSONCodec } from 'nats';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { ModelEntry } from '@sven/model-router/registry';
import type { HotSwapResult } from '@sven/model-router/fleet';

const logger = createLogger('model-router-nats');
const jc = JSONCodec();

export class ModelRouterPublisher {
  constructor(private nc: NatsConnection) {}

  publishModelRegistered(model: ModelEntry, orgId: string): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_REGISTERED,
      jc.encode({
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        status: model.status,
        endpoint: model.endpoint,
        orgId,
        timestamp: new Date().toISOString(),
      }),
    );
    logger.debug('Published model.registered', { modelId: model.id });
  }

  publishModelUnregistered(modelId: string, orgId: string): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_UNREGISTERED,
      jc.encode({
        modelId,
        orgId,
        timestamp: new Date().toISOString(),
      }),
    );
    logger.debug('Published model.unregistered', { modelId });
  }

  publishStatusChanged(modelId: string, oldStatus: string, newStatus: string): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_STATUS_CHANGED,
      jc.encode({
        modelId,
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
      }),
    );
    logger.debug('Published model.status.changed', { modelId, oldStatus, newStatus });
  }

  publishRouteDecision(decision: {
    requestId: string;
    task: string;
    modelId: string;
    modelName: string;
    score: number;
    reason: string;
    fallbackChain: string[];
    orgId: string;
  }): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_ROUTE_DECISION,
      jc.encode({
        ...decision,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  publishHotswapResult(result: HotSwapResult): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_HOTSWAP_RESULT,
      jc.encode({
        ...result,
        timestamp: new Date().toISOString(),
      }),
    );
    logger.info('Published model.hotswap.result', {
      action: result.action,
      modelId: result.modelId,
      nodeId: result.nodeId,
      success: result.success,
    });
  }

  publishBenchmarkComplete(runId: string, modelId: string, suiteId: string, orgId: string): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_BENCHMARK_COMPLETE,
      jc.encode({
        runId,
        modelId,
        suiteId,
        orgId,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  publishDeployStatus(modelId: string, nodeId: string, status: string, message: string): void {
    this.nc.publish(
      NATS_SUBJECTS.MODEL_DEPLOY_STATUS,
      jc.encode({
        modelId,
        nodeId,
        status,
        message,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
