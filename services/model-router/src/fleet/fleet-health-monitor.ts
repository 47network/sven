// ---------------------------------------------------------------------------
// Fleet Health Monitor
// ---------------------------------------------------------------------------
// Periodic probing loop that checks all fleet nodes, records probe history,
// detects state changes, and publishes NATS events on health transitions.
// ---------------------------------------------------------------------------

import type { NatsConnection, JSONCodec as JSONCodecType } from 'nats';
import { JSONCodec } from 'nats';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { FleetStatus } from '@sven/model-router/fleet';
import { PgFleetRegistry } from './pg-fleet-registry.js';

const logger = createLogger('fleet-health-monitor');
const jc = JSONCodec();

export interface FleetMonitorConfig {
  probeIntervalMs: number;       // how often to probe all nodes (default: 30s)
  vramAlertThresholdPct: number; // % VRAM used threshold to emit alert (default: 90)
  probeRetentionDays: number;    // how long to keep probe history (default: 30)
  cleanupIntervalMs: number;     // how often to clean old probes (default: 1h)
}

const DEFAULT_CONFIG: FleetMonitorConfig = {
  probeIntervalMs: 30_000,
  vramAlertThresholdPct: 90,
  probeRetentionDays: 30,
  cleanupIntervalMs: 60 * 60 * 1_000,
};

export class FleetHealthMonitor {
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lastHealthMap = new Map<string, boolean>();
  private config: FleetMonitorConfig;

  constructor(
    private fleetRegistry: PgFleetRegistry,
    private nc: NatsConnection,
    private orgId: string,
    config: Partial<FleetMonitorConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    logger.info('Fleet health monitor started', {
      probeIntervalMs: this.config.probeIntervalMs,
      orgId: this.orgId,
    });

    // Initial probe
    void this.sweep();

    this.probeTimer = setInterval(() => {
      void this.sweep();
    }, this.config.probeIntervalMs);

    this.cleanupTimer = setInterval(() => {
      void this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  stop(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    logger.info('Fleet health monitor stopped');
  }

  async sweep(): Promise<FleetStatus> {
    const startMs = Date.now();

    try {
      const status = await this.fleetRegistry.probeAll(this.orgId);

      // Detect health transitions
      for (const nodeStatus of status.nodes) {
        const nodeId = nodeStatus.node.id;
        const prevHealthy = this.lastHealthMap.get(nodeId);
        const nowHealthy = nodeStatus.node.healthy;

        if (prevHealthy !== undefined && prevHealthy !== nowHealthy) {
          logger.warn('Fleet node health changed', {
            nodeId,
            nodeName: nodeStatus.node.name,
            from: prevHealthy ? 'healthy' : 'unhealthy',
            to: nowHealthy ? 'healthy' : 'unhealthy',
          });

          // Publish per-node probe event
          this.nc.publish(
            NATS_SUBJECTS.modelNodeProbe(nodeId),
            jc.encode({
              nodeId,
              nodeName: nodeStatus.node.name,
              healthy: nowHealthy,
              vramUsedMb: nodeStatus.vramUsedMb,
              vramFreeMb: nodeStatus.vramFreeMb,
              loadedModels: nodeStatus.loadedModels.length,
              timestamp: new Date().toISOString(),
            }),
          );
        }

        this.lastHealthMap.set(nodeId, nowHealthy);

        // VRAM alert check
        if (nodeStatus.node.totalVramMb > 0) {
          const usedPct = (nodeStatus.vramUsedMb / nodeStatus.node.totalVramMb) * 100;
          if (usedPct >= this.config.vramAlertThresholdPct) {
            this.nc.publish(
              NATS_SUBJECTS.MODEL_VRAM_ALERT,
              jc.encode({
                nodeId,
                nodeName: nodeStatus.node.name,
                vramUsedPct: Math.round(usedPct),
                vramUsedMb: nodeStatus.vramUsedMb,
                totalVramMb: nodeStatus.node.totalVramMb,
                timestamp: new Date().toISOString(),
              }),
            );
          }
        }
      }

      // Publish fleet-wide health summary
      this.nc.publish(
        NATS_SUBJECTS.MODEL_FLEET_HEALTH,
        jc.encode({
          totalNodes: status.nodes.length,
          healthyNodes: status.healthyNodes,
          degradedNodes: status.degradedNodes,
          totalVramMb: status.totalVramMb,
          usedVramMb: status.usedVramMb,
          freeVramMb: status.freeVramMb,
          loadedModels: status.loadedModels,
          probeLatencyMs: Date.now() - startMs,
          timestamp: new Date().toISOString(),
        }),
      );

      logger.debug('Fleet probe sweep complete', {
        nodes: status.nodes.length,
        healthy: status.healthyNodes,
        durationMs: Date.now() - startMs,
      });

      return status;
    } catch (err) {
      logger.error('Fleet probe sweep failed', { error: (err as Error).message });
      throw err;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const deleted = await this.fleetRegistry.cleanupOldProbes(this.config.probeRetentionDays);
      if (deleted > 0) {
        logger.info('Cleaned up old probe records', { deleted, retentionDays: this.config.probeRetentionDays });
      }
    } catch (err) {
      logger.error('Probe cleanup failed', { error: (err as Error).message });
    }
  }
}
