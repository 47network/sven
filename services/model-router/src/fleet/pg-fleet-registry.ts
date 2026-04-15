// ---------------------------------------------------------------------------
// Postgres-Backed Fleet Node Registry
// ---------------------------------------------------------------------------
// Persists fleet nodes and probe history in Postgres. Wraps the pure
// probing functions from @sven/model-router/fleet with DB persistence.
// ---------------------------------------------------------------------------

import pg from 'pg';
import type {
  FleetNode, FleetNodeStatus, FleetStatus, LoadedModel,
  RuntimeType, HotSwapResult,
} from '@sven/model-router/fleet';
import {
  probeOllamaVram, probeLlamaServerVram,
} from '@sven/model-router/fleet';

export class PgFleetRegistry {
  constructor(private pool: pg.Pool) {}

  // ── Node CRUD ─────────────────────────────────────────────────────────

  async registerNode(node: FleetNode, orgId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO fleet_nodes (id, name, endpoint, runtime, gpus, total_vram_mb, healthy, org_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         endpoint = EXCLUDED.endpoint,
         runtime = EXCLUDED.runtime,
         gpus = EXCLUDED.gpus,
         total_vram_mb = EXCLUDED.total_vram_mb,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        node.id, node.name, node.endpoint, node.runtime,
        JSON.stringify(node.gpus), node.totalVramMb, node.healthy,
        orgId, JSON.stringify({}),
      ],
    );
  }

  async unregisterNode(id: string, orgId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM fleet_nodes WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getNode(id: string, orgId: string): Promise<FleetNode | null> {
    const res = await this.pool.query(
      `SELECT * FROM fleet_nodes WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    return res.rows[0] ? this.rowToNode(res.rows[0]) : null;
  }

  async listNodes(orgId: string): Promise<FleetNode[]> {
    const res = await this.pool.query(
      `SELECT * FROM fleet_nodes WHERE org_id = $1 ORDER BY name`,
      [orgId],
    );
    return res.rows.map((r) => this.rowToNode(r));
  }

  async listHealthyNodes(orgId: string): Promise<FleetNode[]> {
    const res = await this.pool.query(
      `SELECT * FROM fleet_nodes WHERE org_id = $1 AND healthy = true ORDER BY name`,
      [orgId],
    );
    return res.rows.map((r) => this.rowToNode(r));
  }

  // ── Probing ───────────────────────────────────────────────────────────

  async probeNode(id: string, orgId: string): Promise<FleetNodeStatus | null> {
    const node = await this.getNode(id, orgId);
    if (!node) return null;

    let status: FleetNodeStatus | null = null;

    if (node.runtime === 'ollama') {
      status = await probeOllamaVram(node.endpoint);
    } else if (node.runtime === 'llama-server') {
      status = await probeLlamaServerVram(node.endpoint);
    }

    if (status) {
      status.node = { ...node, healthy: status.node.healthy, lastProbe: new Date().toISOString() };
      status.vramFreeMb = Math.max(0, node.totalVramMb - status.vramUsedMb);

      // Persist health update
      await this.pool.query(
        `UPDATE fleet_nodes SET healthy = $2, last_probe = now(), updated_at = now() WHERE id = $1`,
        [id, status.node.healthy],
      );

      // Record probe snapshot
      await this.pool.query(
        `INSERT INTO fleet_probes (node_id, healthy, vram_used_mb, vram_free_mb, loaded_models)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, status.node.healthy, status.vramUsedMb, status.vramFreeMb, JSON.stringify(status.loadedModels)],
      );
    } else {
      await this.pool.query(
        `UPDATE fleet_nodes SET healthy = false, last_probe = now(), updated_at = now() WHERE id = $1`,
        [id],
      );
      await this.pool.query(
        `INSERT INTO fleet_probes (node_id, healthy, vram_used_mb, vram_free_mb, loaded_models)
         VALUES ($1, false, 0, 0, '[]')`,
        [id],
      );
    }

    return status;
  }

  async probeAll(orgId: string): Promise<FleetStatus> {
    const nodes = await this.listNodes(orgId);
    const results: FleetNodeStatus[] = [];

    for (const node of nodes) {
      const status = await this.probeNode(node.id, orgId);
      if (status) results.push(status);
    }

    return this.buildFleetStatus(results);
  }

  async getFleetStatus(orgId: string): Promise<FleetStatus> {
    // Build from latest probes
    const nodes = await this.listNodes(orgId);
    const results: FleetNodeStatus[] = [];

    for (const node of nodes) {
      const probeRes = await this.pool.query(
        `SELECT * FROM fleet_probes WHERE node_id = $1 ORDER BY probed_at DESC LIMIT 1`,
        [node.id],
      );
      const probe = probeRes.rows[0];
      if (probe) {
        results.push({
          node,
          loadedModels: (probe.loaded_models as LoadedModel[]) || [],
          vramUsedMb: probe.vram_used_mb as number,
          vramFreeMb: probe.vram_free_mb as number,
        });
      }
    }

    return this.buildFleetStatus(results);
  }

  // ── Probe History ─────────────────────────────────────────────────────

  async getProbeHistory(
    nodeId: string,
    limit = 100,
  ): Promise<Array<{ healthy: boolean; vramUsedMb: number; vramFreeMb: number; probedAt: string }>> {
    const res = await this.pool.query(
      `SELECT healthy, vram_used_mb, vram_free_mb, probed_at
       FROM fleet_probes WHERE node_id = $1 ORDER BY probed_at DESC LIMIT $2`,
      [nodeId, limit],
    );
    return res.rows.map((r) => ({
      healthy: r.healthy as boolean,
      vramUsedMb: r.vram_used_mb as number,
      vramFreeMb: r.vram_free_mb as number,
      probedAt: (r.probed_at as Date).toISOString(),
    }));
  }

  async cleanupOldProbes(retentionDays = 30): Promise<number> {
    const res = await this.pool.query(
      `DELETE FROM fleet_probes WHERE probed_at < now() - make_interval(days => $1)`,
      [retentionDays],
    );
    return res.rowCount ?? 0;
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private buildFleetStatus(nodeStatuses: FleetNodeStatus[]): FleetStatus {
    const totalVramMb = nodeStatuses.reduce((s, n) => s + n.node.totalVramMb, 0);
    const usedVramMb = nodeStatuses.reduce((s, n) => s + n.vramUsedMb, 0);
    const loadedModels = nodeStatuses.reduce((s, n) => s + n.loadedModels.length, 0);
    const healthyNodes = nodeStatuses.filter((n) => n.node.healthy).length;

    return {
      nodes: nodeStatuses,
      totalVramMb,
      usedVramMb,
      freeVramMb: Math.max(0, totalVramMb - usedVramMb),
      loadedModels,
      healthyNodes,
      degradedNodes: nodeStatuses.length - healthyNodes,
    };
  }

  private rowToNode(row: Record<string, unknown>): FleetNode {
    return {
      id: row.id as string,
      name: row.name as string,
      endpoint: row.endpoint as string,
      runtime: row.runtime as RuntimeType,
      gpus: (row.gpus as FleetNode['gpus']) || [],
      totalVramMb: row.total_vram_mb as number,
      healthy: row.healthy as boolean,
      lastProbe: row.last_probe ? (row.last_probe as Date).toISOString() : null,
    };
  }
}
