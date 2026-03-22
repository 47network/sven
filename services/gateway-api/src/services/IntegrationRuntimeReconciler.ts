import { Pool } from 'pg';
import { createLogger } from '@sven/shared';
import { IntegrationRuntimeOrchestrator } from './IntegrationRuntimeOrchestrator.js';

const logger = createLogger('integration-runtime-reconciler');

type RuntimeRow = {
  organization_id: string;
  integration_type: string;
  runtime_mode: 'container' | 'local_worker';
  status: 'stopped' | 'deploying' | 'running' | 'error';
  image_ref: string | null;
  storage_path: string | null;
  network_scope: string | null;
};

export type IntegrationRuntimeReconcileReport = {
  started_at: string;
  completed_at: string | null;
  skipped_due_to_lock: boolean;
  scanned: number;
  row_errors: Array<{ organization_id: string; integration_type: string; error: string }>;
  skipped_no_probe: number;
  drift_detected: number;
  status_synced_to_running: number;
  marked_error: number;
  autoheal_attempted: number;
  autoheal_succeeded: number;
  autoheal_failed: number;
};

export class IntegrationRuntimeReconciler {
  private readonly pool: Pool;
  private readonly enabled = String(process.env.SVEN_INTEGRATION_RUNTIME_RECONCILE_ENABLED || '').toLowerCase() === 'true';
  private readonly autoHeal = String(process.env.SVEN_INTEGRATION_RUNTIME_AUTOHEAL || '').toLowerCase() === 'true';
  private readonly intervalMs = Math.max(10_000, Number(process.env.SVEN_INTEGRATION_RUNTIME_RECONCILE_INTERVAL_MS || 60_000));
  private readonly orchestrator: IntegrationRuntimeOrchestrator;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(pool: Pool, orchestrator?: IntegrationRuntimeOrchestrator) {
    this.pool = pool;
    this.orchestrator = orchestrator || new IntegrationRuntimeOrchestrator();
  }

  start() {
    if (!this.enabled || this.timer) return;
    this.timer = setInterval(() => {
      this.reconcileOnce().catch((err) => {
        logger.warn('Integration runtime reconciliation failed', { err: String(err) });
      });
    }, this.intervalMs);
    logger.info('Integration runtime reconciler started', {
      interval_ms: this.intervalMs,
      auto_heal: this.autoHeal,
    });
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async reconcileOnce(options?: { organizationId?: string }): Promise<IntegrationRuntimeReconcileReport> {
    const report: IntegrationRuntimeReconcileReport = {
      started_at: new Date().toISOString(),
      completed_at: null,
      skipped_due_to_lock: false,
      scanned: 0,
      row_errors: [],
      skipped_no_probe: 0,
      drift_detected: 0,
      status_synced_to_running: 0,
      marked_error: 0,
      autoheal_attempted: 0,
      autoheal_succeeded: 0,
      autoheal_failed: 0,
    };
    if (this.running) {
      report.skipped_due_to_lock = true;
      report.completed_at = new Date().toISOString();
      return report;
    }
    this.running = true;
    try {
      const rows = options?.organizationId
        ? await this.pool.query<RuntimeRow>(
            `SELECT organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope
             FROM integration_runtime_instances
             WHERE organization_id = $1`,
            [options.organizationId],
          )
        : await this.pool.query<RuntimeRow>(
            `SELECT organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope
             FROM integration_runtime_instances`,
          );

      for (const row of rows.rows) {
        report.scanned += 1;
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.reconcileRow(row, report);
        } catch (err) {
          const errorMessage = String(err);
          report.row_errors.push({
            organization_id: String(row.organization_id),
            integration_type: String(row.integration_type),
            error: errorMessage,
          });
          logger.warn('Integration runtime row reconciliation failed', {
            organization_id: row.organization_id,
            integration_type: row.integration_type,
            err: errorMessage,
          });
        }
      }
      report.completed_at = new Date().toISOString();
      return report;
    } finally {
      if (!report.completed_at) {
        report.completed_at = new Date().toISOString();
      }
      this.running = false;
    }
  }

  private async reconcileRow(row: RuntimeRow, report: IntegrationRuntimeReconcileReport) {
    const probe = await this.orchestrator.execute({
      action: 'status',
      integrationType: String(row.integration_type),
      organizationId: String(row.organization_id),
      runtimeMode: row.runtime_mode === 'local_worker' ? 'local_worker' : 'container',
      imageRef: row.image_ref,
      storagePath: row.storage_path,
      networkScope: row.network_scope,
    });

    // If no status probe command is configured, reconciliation for this runtime is skipped.
    if (!probe.configured) {
      report.skipped_no_probe += 1;
      return;
    }

    const dbStatus = String(row.status || 'stopped');
    const runtimeRunning = probe.ok;

    if (runtimeRunning) {
      if (dbStatus === 'running') return;
      report.drift_detected += 1;
      report.status_synced_to_running += 1;
      await this.pool.query(
        `UPDATE integration_runtime_instances
         SET status = 'running', last_error = NULL, updated_at = NOW()
         WHERE organization_id = $1
           AND integration_type = $2`,
        [row.organization_id, row.integration_type],
      );
      logger.warn('Integration runtime drift detected (db not running, runtime running)', {
        organization_id: row.organization_id,
        integration_type: row.integration_type,
        db_status: dbStatus,
      });
      return;
    }

    if (dbStatus === 'stopped' || dbStatus === 'error') {
      return;
    }

    if (dbStatus === 'running' || dbStatus === 'deploying') {
      report.drift_detected += 1;
      report.marked_error += 1;
      const probeError = String(probe.error || probe.output || 'runtime status probe failed');
      await this.pool.query(
        `UPDATE integration_runtime_instances
         SET status = 'error', last_error = $3, updated_at = NOW()
         WHERE organization_id = $1
           AND integration_type = $2`,
        [row.organization_id, row.integration_type, probeError],
      );

      logger.warn('Integration runtime drift detected (db active, runtime unavailable)', {
        organization_id: row.organization_id,
        integration_type: row.integration_type,
        db_status: dbStatus,
      });

      if (!this.autoHeal) return;
      report.autoheal_attempted += 1;
      const heal = await this.orchestrator.execute({
        action: 'deploy',
        integrationType: row.integration_type,
        organizationId: row.organization_id,
        runtimeMode: row.runtime_mode === 'local_worker' ? 'local_worker' : 'container',
        imageRef: row.image_ref,
        storagePath: row.storage_path,
        networkScope: row.network_scope,
      });
      if (heal.ok) {
        report.autoheal_succeeded += 1;
        await this.pool.query(
          `UPDATE integration_runtime_instances
           SET status = 'running', last_error = NULL, last_deployed_at = NOW(), updated_at = NOW()
           WHERE organization_id = $1
             AND integration_type = $2`,
          [row.organization_id, row.integration_type],
        );
        logger.info('Integration runtime auto-heal succeeded', {
          organization_id: row.organization_id,
          integration_type: row.integration_type,
        });
      } else {
        report.autoheal_failed += 1;
        await this.pool.query(
          `UPDATE integration_runtime_instances
           SET status = 'error', last_error = $3, updated_at = NOW()
           WHERE organization_id = $1
             AND integration_type = $2`,
          [row.organization_id, row.integration_type, String(heal.error || 'runtime auto-heal failed')],
        );
        logger.warn('Integration runtime auto-heal failed', {
          organization_id: row.organization_id,
          integration_type: row.integration_type,
        });
      }
    }
  }
}
