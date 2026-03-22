import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@sven/shared', () => ({
  createLogger: () => ({
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));
jest.mock(
  '../services/IntegrationRuntimeOrchestrator.js',
  () => ({
    IntegrationRuntimeOrchestrator: class {
      async execute() {
        return { executed: false, configured: false, ok: false };
      }
    },
  }),
  { virtual: true },
);

import { IntegrationRuntimeReconciler } from '../services/IntegrationRuntimeReconciler';

type QueryCall = {
  sql: string;
  params: unknown[];
};

describe('IntegrationRuntimeReconciler', () => {
  it('marks running runtime error then auto-heals to running on successful deploy hook', async () => {
    const calls: QueryCall[] = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        if (sql.includes('FROM integration_runtime_instances')) {
          return {
            rows: [
              {
                organization_id: 'org-a',
                integration_type: 'obsidian',
                runtime_mode: 'container',
                status: 'running',
                image_ref: 'sven/integration-obsidian:latest',
                storage_path: '/tmp/obsidian',
                network_scope: 'sven-org-a',
              },
            ],
          };
        }
        return { rows: [] };
      },
    } as any;

    const fakeOrchestrator = {
      execute: async (params: { action: string }) => {
        if (params.action === 'status') {
          return {
            executed: true,
            configured: true,
            ok: false,
            error: 'probe failed',
          };
        }
        return {
          executed: true,
          configured: true,
          ok: true,
        };
      },
    } as any;

    const prevAutoHeal = process.env.SVEN_INTEGRATION_RUNTIME_AUTOHEAL;
    process.env.SVEN_INTEGRATION_RUNTIME_AUTOHEAL = 'true';
    let report:
      | {
          scanned: number;
          drift_detected: number;
          autoheal_attempted: number;
          autoheal_succeeded: number;
        }
      | undefined;
    try {
      const reconciler = new IntegrationRuntimeReconciler(pool, fakeOrchestrator);
      report = await reconciler.reconcileOnce();
    } finally {
      if (prevAutoHeal === undefined) delete process.env.SVEN_INTEGRATION_RUNTIME_AUTOHEAL;
      else process.env.SVEN_INTEGRATION_RUNTIME_AUTOHEAL = prevAutoHeal;
    }

    const markError = calls.find((c) => c.sql.includes(`SET status = 'error'`));
    const markRunning = calls.find((c) => c.sql.includes(`SET status = 'running'`));
    expect(markError).toBeTruthy();
    expect(markRunning).toBeTruthy();
    expect(report?.scanned).toBe(1);
    expect(report?.drift_detected).toBe(1);
    expect(report?.autoheal_attempted).toBe(1);
    expect(report?.autoheal_succeeded).toBe(1);
  });

  it('returns explicit lock-skip metadata when reconcile is already running', async () => {
    let release: (() => void) | null = null;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    let selectCount = 0;
    const pool = {
      query: async (sql: string) => {
        if (sql.includes('FROM integration_runtime_instances')) {
          selectCount += 1;
          if (selectCount === 1) {
            await blocker;
          }
          return { rows: [] };
        }
        return { rows: [] };
      },
    } as any;

    const reconciler = new IntegrationRuntimeReconciler(pool, {
      execute: async () => ({ executed: false, configured: false, ok: false }),
    } as any);

    const first = reconciler.reconcileOnce();
    const second = await reconciler.reconcileOnce();
    expect(second.skipped_due_to_lock).toBe(true);
    expect(second.scanned).toBe(0);
    expect(second.started_at).toBeTruthy();
    expect(second.completed_at).toBeTruthy();

    if (release) release();
    const firstReport = await first;
    expect(firstReport.skipped_due_to_lock).toBe(false);
  });

  it('reconciles deploying/error statuses using probe outcome matrix', async () => {
    const cases: Array<{
      dbStatus: 'deploying' | 'error';
      probeOk: boolean;
      expectRunningSync: number;
      expectMarkedError: number;
    }> = [
      { dbStatus: 'deploying', probeOk: true, expectRunningSync: 1, expectMarkedError: 0 },
      { dbStatus: 'deploying', probeOk: false, expectRunningSync: 0, expectMarkedError: 1 },
      { dbStatus: 'error', probeOk: true, expectRunningSync: 1, expectMarkedError: 0 },
      { dbStatus: 'error', probeOk: false, expectRunningSync: 0, expectMarkedError: 0 },
    ];

    for (const c of cases) {
      const calls: QueryCall[] = [];
      const pool = {
        query: async (sql: string, params: unknown[] = []) => {
          calls.push({ sql, params });
          if (sql.includes('FROM integration_runtime_instances')) {
            return {
              rows: [
                {
                  organization_id: 'org-a',
                  integration_type: 'obsidian',
                  runtime_mode: 'container',
                  status: c.dbStatus,
                  image_ref: 'sven/integration-obsidian:latest',
                  storage_path: '/tmp/obsidian',
                  network_scope: 'sven-org-a',
                },
              ],
            };
          }
          return { rows: [] };
        },
      } as any;

      const reconciler = new IntegrationRuntimeReconciler(pool, {
        execute: async () => ({
          executed: true,
          configured: true,
          ok: c.probeOk,
          error: c.probeOk ? undefined : 'probe failed',
        }),
      } as any);

      const report = await reconciler.reconcileOnce();
      expect(report.status_synced_to_running).toBe(c.expectRunningSync);
      expect(report.marked_error).toBe(c.expectMarkedError);

      const runningUpdates = calls.filter((q) => q.sql.includes(`SET status = 'running'`));
      const errorUpdates = calls.filter((q) => q.sql.includes(`SET status = 'error'`));
      expect(runningUpdates.length).toBe(c.expectRunningSync);
      expect(errorUpdates.length).toBe(c.expectMarkedError);
    }
  });

  it('continues reconciling remaining rows when one row probe throws and reports row_errors', async () => {
    const calls: QueryCall[] = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        if (sql.includes('FROM integration_runtime_instances')) {
          return {
            rows: [
              {
                organization_id: 'org-fail',
                integration_type: 'obsidian',
                runtime_mode: 'container',
                status: 'running',
                image_ref: 'sven/integration-obsidian:latest',
                storage_path: '/tmp/obsidian',
                network_scope: 'sven-org-fail',
              },
              {
                organization_id: 'org-ok',
                integration_type: 'notion',
                runtime_mode: 'container',
                status: 'running',
                image_ref: 'sven/integration-notion:latest',
                storage_path: '/tmp/notion',
                network_scope: 'sven-org-ok',
              },
            ],
          };
        }
        return { rows: [] };
      },
    } as any;

    const reconciler = new IntegrationRuntimeReconciler(pool, {
      execute: async (params: { organizationId?: string; action: string }) => {
        if (params.action === 'status' && params.organizationId === 'org-fail') {
          throw new Error('probe transport failure');
        }
        if (params.action === 'status' && params.organizationId === 'org-ok') {
          return { executed: true, configured: true, ok: false, error: 'probe failed' };
        }
        return { executed: true, configured: true, ok: true };
      },
    } as any);

    const report = await reconciler.reconcileOnce();
    expect(report.scanned).toBe(2);
    expect(report.row_errors.length).toBe(1);
    expect(report.row_errors[0]).toMatchObject({
      organization_id: 'org-fail',
      integration_type: 'obsidian',
    });
    expect(report.marked_error).toBe(1);

    const errorUpdates = calls.filter((q) => q.sql.includes(`SET status = 'error'`));
    expect(errorUpdates.length).toBe(1);
    expect(String(errorUpdates[0].params[0])).toBe('org-ok');
    expect(String(errorUpdates[0].params[1])).toBe('notion');
  });
});
