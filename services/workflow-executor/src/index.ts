import { AckPolicy, DeliverPolicy, connect, JSONCodec, StringCodec, type NatsConnection } from 'nats';
import { Pool } from 'pg';
import { NATS_SUBJECTS, generateTaskId, ClientAttestor, CoordinatorSession, FeatureFlagRegistry, TokenBudgetTracker, type EventEnvelope, type RuntimeDispatchEvent } from '@sven/shared';
import { applyDataShapingPipeline, type DataShapeOperator } from './data-shaping.js';

const DEFAULT_WORKFLOW_LLM_TIMEOUT_MS = 45_000;
const MIN_WORKFLOW_LLM_TIMEOUT_MS = 100;
const MAX_WORKFLOW_LLM_TIMEOUT_MS = 300_000;

interface WorkflowRunContext {
  run_id: string;
  chat_id: string;
  triggered_by?: string | null;
  workflow_id: string;
  workflow_version: number;
  steps: any[];
  edges: any[];
  variables: Record<string, any>;
  step_results: Record<string, any>;
}

interface WorkflowExecuteMessage {
  run_id: string;
}

interface WorkflowRetryStepMessage {
  run_id: string;
  step_id: string;
}

type StepRetryPolicy = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
};

function normalizeWorkflowExecutorConcurrency(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return 4;
  if (parsed < 1) return 1;
  if (parsed > 32) return 32;
  return parsed;
}

class WorkflowRunControlError extends Error {
  readonly code: 'RUN_CANCELLED' | 'RUN_MISSING';

  constructor(code: 'RUN_CANCELLED' | 'RUN_MISSING', message: string) {
    super(message);
    this.code = code;
  }
}

class WorkflowExecutor {
  private pool: Pool;
  private nats_url: string;
  private nc: NatsConnection | null = null;
  private clientAttestor: ClientAttestor | null = null;
  private featureFlags: FeatureFlagRegistry;
  private workflowBudgets = new Map<string, TokenBudgetTracker>();

  constructor(pool: Pool, nats_url: string) {
    this.pool = pool;
    this.nats_url = nats_url;

    // Initialize feature flag registry for workflow runtime gating
    this.featureFlags = new FeatureFlagRegistry({ source: 'workflow-executor', warnOnStaleFlags: true });
    this.featureFlags.register({
      name: 'token-budget.workflow',
      type: 'boolean',
      value: false,
      description: 'Enable per-workflow token budget tracking',
      createdAt: '2026-04-07T00:00:00Z',
      cleanupBy: '2027-04-07T00:00:00Z',
      enabled: (process.env.FEATURE_TOKEN_BUDGET_WORKFLOW || '').toLowerCase() === 'true',
    });
    this.featureFlags.register({
      name: 'client-attestation.enabled',
      type: 'boolean',
      value: false,
      description: 'Enable HMAC attestation on inter-service messages',
      createdAt: '2026-04-07T00:00:00Z',
      cleanupBy: '2027-04-07T00:00:00Z',
      enabled: (process.env.FEATURE_CLIENT_ATTESTATION_ENABLED || '').toLowerCase() === 'true',
    });
    console.log(`Feature flag registry initialized: ${this.featureFlags.getAllFlags().map(f => f.name).join(', ')}`);

    // Initialize client attestation for inter-service message verification
    const attestationSecret = process.env.SVEN_ATTESTATION_SECRET || '';
    if (this.featureFlags.isEnabled('client-attestation.enabled') && attestationSecret.length >= 32) {
      this.clientAttestor = new ClientAttestor({ secret: attestationSecret, serviceId: 'workflow-executor' });
      console.log('Client attestation initialized for workflow-executor');
    } else if (attestationSecret.length >= 32) {
      this.clientAttestor = new ClientAttestor({ secret: attestationSecret, serviceId: 'workflow-executor' });
      console.log('Client attestation initialized for workflow-executor');
    }
  }

  /**
   * Get or create a per-workflow token budget tracker for cost monitoring.
   */
  private getOrCreateWorkflowBudget(runId: string): TokenBudgetTracker {
    let tracker = this.workflowBudgets.get(runId);
    if (!tracker) {
      tracker = new TokenBudgetTracker({
        maxTotalTokens: Number(process.env.WORKFLOW_TOKEN_BUDGET_MAX_TOKENS || 0),
        maxCostUsd: Number(process.env.WORKFLOW_TOKEN_BUDGET_MAX_COST_USD || 0),
        maxTurns: Number(process.env.WORKFLOW_TOKEN_BUDGET_MAX_STEPS || 100),
        compactThreshold: 0.9,
        inputCostPer1M: Number(process.env.TOKEN_BUDGET_INPUT_COST_PER_1M || 3.0),
        outputCostPer1M: Number(process.env.TOKEN_BUDGET_OUTPUT_COST_PER_1M || 15.0),
      });
      this.workflowBudgets.set(runId, tracker);
    }
    return tracker;
  }

  /**
   * Create a CoordinatorSession for a workflow run.
   * Enables task fan-out tracking, shared scratchpad, and deadline management.
   */
  private createCoordinatorSession(context: WorkflowRunContext): CoordinatorSession {
    return new CoordinatorSession({
      maxConcurrentWorkers: normalizeWorkflowExecutorConcurrency(process.env.WORKFLOW_EXECUTOR_MAX_CONCURRENCY),
      defaultDeadlineMs: 120_000,
      failFast: false,
      dispatchFn: async (task) => {
        console.log(`[coordinator] Dispatching step ${task.taskId}: ${task.instruction}`);
        return `dispatched:${task.taskId}`;
      },
    });
  }

  async start() {
    console.log('Starting Workflow Executor...');

    const nc = await connect({ servers: this.nats_url.split(',') });
    this.nc = nc;
    const jc = JSONCodec();

    const maxExecuteConcurrency = normalizeWorkflowExecutorConcurrency(process.env.WORKFLOW_EXECUTOR_MAX_CONCURRENCY);
    const executeInFlight = new Set<Promise<void>>();
    const js = nc.jetstream();
    const consumersApi = js.consumers as any;
    const jsm = await nc.jetstreamManager();
    let consumer: any;
    try {
      consumer = await consumersApi.get('RUNTIME', 'workflow-executor');
    } catch (err) {
      const message = String(err || '').toLowerCase();
      const isMissing = message.includes('consumer not found') || message.includes('404');
      if (!isMissing) throw err;
      await jsm.consumers.add('RUNTIME', {
        durable_name: 'workflow-executor',
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        filter_subject: NATS_SUBJECTS.RUNTIME_DISPATCH,
        ack_wait: 30_000_000_000,
        max_deliver: 10,
      });
      consumer = await consumersApi.get('RUNTIME', 'workflow-executor');
    }
    const messages = await consumer.consume();

    (async () => {
      for await (const msg of messages) {
        while (executeInFlight.size >= maxExecuteConcurrency) {
          await Promise.race(executeInFlight);
        }
        const task = this.processRuntimeDispatchMessage(msg, jc)
          .catch((err) => {
            console.error('Workflow execution task error:', err);
          })
          .finally(() => {
            executeInFlight.delete(task);
          });
        executeInFlight.add(task);
      }
    })();

    console.log('Workflow Executor ready');
  }

  private async processWorkflowRetryStepMessage(data: WorkflowRetryStepMessage): Promise<void> {
    const run_id = String(data.run_id || '').trim();
    const step_id = String(data.step_id || '').trim();
    if (!run_id || !step_id) {
      console.error('[workflow-executor] Invalid workflow.retry_step message payload');
      return;
    }

    const runResult = await this.pool.query(
      `SELECT * FROM workflow_runs WHERE id = $1`,
      [run_id],
    );
    if (runResult.rows.length === 0) {
      console.error(`[workflow-executor] Retry target run not found: ${run_id}`);
      return;
    }
    const run = runResult.rows[0];
    const workflowResult = await this.pool.query(
      `SELECT * FROM workflows WHERE id = $1`,
      [run.workflow_id],
    );
    if (workflowResult.rows.length === 0) {
      console.error(`[workflow-executor] Retry target workflow not found: ${run.workflow_id}`);
      return;
    }
    const workflow = workflowResult.rows[0];
    const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
    const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
    const stepResults = (run.step_results && typeof run.step_results === 'object')
      ? { ...run.step_results as Record<string, any> }
      : {};

    const targetStep = steps.find((s: any) => String(s?.id || '') === step_id);
    if (!targetStep) {
      console.error(`[workflow-executor] Retry target step not found in workflow: ${step_id}`);
      return;
    }
    if (String(stepResults[step_id]?.status || '') !== 'failed') {
      console.error(`[workflow-executor] Retry target step is not failed: ${step_id}`);
      return;
    }
    if (!this.areStepDependenciesCompleted(step_id, edges, stepResults)) {
      console.error(`[workflow-executor] Retry dependency check failed for step: ${step_id}`);
      return;
    }

    delete stepResults[step_id];
    await this.pool.query(
      `UPDATE workflow_runs
       SET status = 'running',
           completed_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [run_id],
    );

    await this.executeWorkflow({
      run_id: String(run_id),
      chat_id: String(workflow.chat_id),
      triggered_by: run.triggered_by || null,
      workflow_id: String(workflow.id),
      workflow_version: Number(workflow.version || 1),
      steps,
      edges,
      variables: this.hydrateVariablesFromStepResults(
        { ...(run.input_variables || {}) },
        stepResults,
        steps,
      ),
      step_results: stepResults,
    });
  }

  private async executeWorkflow(context: WorkflowRunContext) {
    const { run_id, chat_id, triggered_by, steps, edges, variables, step_results } = context;
    let totalStepCount = 0;

    // Initialize coordinator session for this workflow run
    const coordinator = this.createCoordinatorSession(context);
    console.log(`[workflow-executor] Coordinator session ${coordinator.sessionId} created for run ${run_id}`);

    try {
      // Execute steps in topological order
      const executedSteps = new Set<string>();
      const stepsByDependencies = this.buildDependencyGraph(steps, edges);
      totalStepCount = stepsByDependencies.length;
      if (totalStepCount > 500) {
        throw new Error(`Workflow exceeds maximum step limit: ${totalStepCount} > 500`);
      }
      await this.syncRunTelemetry(run_id, totalStepCount, step_results, new Date().toISOString(), true);

      for (const step_id of stepsByDependencies) {
        const controlState = await this.waitForRunRunnable(run_id);
        if (controlState === 'cancelled') {
          await this.markRunCancelled(run_id);
          return;
        }
        if (controlState === 'missing') {
          throw new WorkflowRunControlError('RUN_MISSING', `Workflow run not found: ${run_id}`);
        }

        if (step_results[step_id]?.status === 'completed') {
          executedSteps.add(step_id);
          continue;
        }

        const step = steps.find((s: any) => String(s?.id || '') === step_id);
        if (!step) {
          throw new Error(`workflow step missing for dependency graph node: ${step_id}`);
        }
        const retryPolicy = this.resolveStepRetryPolicy(step);

        console.log(`[workflow-executor] Executing step: ${step_id} (${step.type})`);

        let completed = false;
        let lastError: unknown = null;
        let attempt = 1;

        while (attempt <= retryPolicy.maxRetries + 1) {
          const now = new Date().toISOString();
          const step_run_id = generateTaskId('workflow_run');

          // Create step run record
          await this.pool.query(
            `INSERT INTO workflow_step_runs
               (id, run_id, step_id, step_type, step_config, status, started_at, attempt_number, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [step_run_id, run_id, step_id, step.type, JSON.stringify(step.config), 'running', now, attempt, retryPolicy.maxRetries]
          );
          await this.emitWorkflowStepCanvasEvent({
            chat_id,
            run_id,
            step_id,
            step_type: String(step.type || ''),
            status: 'running',
            occurred_at: now,
          });
          await this.emitWorkflowStepAuditEvent({
            workflow_id: context.workflow_id,
            run_id,
            actor_id: triggered_by ? String(triggered_by) : null,
            action: 'step_started',
            step_id,
            step_type: String(step.type || ''),
            occurred_at: now,
            details: { attempt_number: attempt, max_retries: retryPolicy.maxRetries },
          });

          try {
            let output;

            switch (step.type) {
              case 'tool_call':
                output = await this.executeTool(step, variables, {
                  workflow_run_id: run_id,
                  chat_id,
                  user_id: triggered_by ? String(triggered_by) : null,
                });
                break;
              case 'approval':
                output = await this.executeApproval(step, variables, run_id, {
                  chat_id,
                  user_id: triggered_by ? String(triggered_by) : null,
                });
                break;
              case 'conditional':
                output = await this.executeConditional(step, variables);
                break;
              case 'notification':
                output = await this.executeNotification(step, variables, {
                  workflow_run_id: run_id,
                  chat_id,
                  user_id: triggered_by ? String(triggered_by) : null,
                });
                break;
              case 'data_shape':
                output = await this.executeDataShape(step, variables);
                break;
              case 'llm_task':
                output = await this.executeLlmTask(step, variables);
                break;
              default:
                throw new Error(`Unknown step type: ${step.type}`);
            }

            // Update variables
            if (step.outputs) {
              this.applyStepOutputMappings(variables, step, output);
            }

            // Mark step as completed
            const step_now = new Date().toISOString();
            await this.pool.query(
              `UPDATE workflow_step_runs SET status = $2, output_variables = $3, completed_at = $4, updated_at = $4
               WHERE id = $1`,
              [step_run_id, 'completed', JSON.stringify(output), step_now]
            );
            await this.emitWorkflowStepCanvasEvent({
              chat_id,
              run_id,
              step_id,
              step_type: String(step.type || ''),
              status: 'completed',
              occurred_at: step_now,
            });
            await this.emitWorkflowStepAuditEvent({
              workflow_id: context.workflow_id,
              run_id,
              actor_id: triggered_by ? String(triggered_by) : null,
              action: 'step_completed',
              step_id,
              step_type: String(step.type || ''),
              occurred_at: step_now,
              details: { attempt_number: attempt, max_retries: retryPolicy.maxRetries },
            });

            step_results[step_id] = { status: 'completed', output, attempts: attempt, max_retries: retryPolicy.maxRetries };
            coordinator.writeScratchpad(step_id, `step_result:${step_id}`, JSON.stringify({ status: 'completed', attempts: attempt }));
            executedSteps.add(step_id);
            await this.syncRunTelemetry(run_id, totalStepCount, step_results, step_now);
            completed = true;
            break;
          } catch (err) {
            lastError = err;
            console.error(`Step ${step_id} failed (attempt ${attempt}/${retryPolicy.maxRetries + 1}):`, err);

            const error_now = new Date().toISOString();
            const errorMessage = String((err as Error)?.message || err || 'step execution failed');
            await this.pool.query(
              `UPDATE workflow_step_runs SET status = $2, error_message = $3, completed_at = $4, updated_at = $4
               WHERE id = $1`,
              [step_run_id, 'failed', errorMessage, error_now]
            );
            await this.emitWorkflowStepCanvasEvent({
              chat_id,
              run_id,
              step_id,
              step_type: String(step.type || ''),
              status: 'failed',
              error_message: errorMessage,
              occurred_at: error_now,
            });
            await this.emitWorkflowStepAuditEvent({
              workflow_id: context.workflow_id,
              run_id,
              actor_id: triggered_by ? String(triggered_by) : null,
              action: 'step_failed',
              step_id,
              step_type: String(step.type || ''),
              occurred_at: error_now,
              details: {
                attempt_number: attempt,
                max_retries: retryPolicy.maxRetries,
                error_message: errorMessage,
              },
            });

            if (err instanceof WorkflowRunControlError && err.code === 'RUN_CANCELLED') {
              throw err;
            }

            const isLastAttempt = attempt >= retryPolicy.maxRetries + 1;
            if (isLastAttempt) {
              await this.pool.query(
                `UPDATE workflow_step_runs
                 SET retry_delay_ms = NULL,
                     next_retry_at = NULL,
                     updated_at = NOW()
                 WHERE id = $1`,
                [step_run_id],
              );
              step_results[step_id] = {
                status: 'failed',
                error: errorMessage,
                attempts: attempt,
                max_retries: retryPolicy.maxRetries,
              };
              await this.syncRunTelemetry(run_id, totalStepCount, step_results, error_now);
              break;
            }

            const delayMs = this.computeStepRetryDelayMs(attempt, retryPolicy);
            const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
            await this.pool.query(
              `UPDATE workflow_step_runs
               SET retry_delay_ms = $2,
                   next_retry_at = $3,
                   updated_at = NOW()
               WHERE id = $1`,
              [step_run_id, delayMs, nextRetryAt],
            );
            console.warn(
              `[workflow-executor] Retrying step ${step_id} in ${delayMs}ms (attempt ${attempt + 1}/${retryPolicy.maxRetries + 1})`,
            );
            await this.sleep(delayMs);
            attempt += 1;
            continue;
          }
        }

        if (!completed) {
          // Continue or fail based on config after retry budget is exhausted.
          if (step.config.on_error === 'stop') {
            throw (lastError instanceof Error ? lastError : new Error(String(lastError || 'step execution failed')));
          }
        }
      }

      const completionControlState = await this.waitForRunRunnable(run_id);
      if (completionControlState === 'cancelled') {
        await this.markRunCancelled(run_id);
        return;
      }
      if (completionControlState === 'missing') {
        throw new WorkflowRunControlError('RUN_MISSING', `Workflow run not found: ${run_id}`);
      }

      // Mark run as completed
      const completion_time = new Date().toISOString();
      const finalTelemetry = this.calculateRunProgress(totalStepCount, step_results);
      await this.pool.query(
        `UPDATE workflow_runs
         SET status = $2,
             output_variables = $3,
             step_results = $4,
             total_steps = $5,
             completed_steps = $6,
             failed_steps = $7,
             completed_at = $8,
             updated_at = $8
         WHERE id = $1`,
        [
          run_id,
          'completed',
          JSON.stringify(variables),
          JSON.stringify(step_results),
          totalStepCount,
          finalTelemetry.completedSteps,
          finalTelemetry.failedSteps,
          completion_time,
        ]
      );

      const coordStatus = coordinator.getStatus();
      console.log(`[workflow-executor] Run ${run_id} completed successfully`, {
        coordinator_session: coordStatus.sessionId,
        coordinator_running_tasks: coordStatus.running,
        coordinator_scratchpad_size: coordStatus.scratchpadSize,
      });
      coordinator.destroy();
    } catch (err) {
      if (err instanceof WorkflowRunControlError && err.code === 'RUN_CANCELLED') {
        await this.markRunCancelled(run_id);
        return;
      }
      console.error(`Run ${run_id} failed:`, err);
      coordinator.destroy();
      await this.markRunFailed(
        run_id,
        err instanceof WorkflowRunControlError ? err.code : 'RUN_EXECUTION_FAILED',
        String((err as Error)?.message || err || 'run execution failed'),
        {
          totalSteps: totalStepCount,
          stepResults: step_results,
        },
      );
    }
  }

  private async processRuntimeDispatchMessage(msg: any, jc: ReturnType<typeof JSONCodec>): Promise<void> {
    let run_id = '';
    try {
      const envelope = jc.decode(msg.data) as EventEnvelope<RuntimeDispatchEvent>;
      const data = envelope?.data || ({} as RuntimeDispatchEvent);
      if (data.kind === 'workflow.retry_step') {
        await this.processWorkflowRetryStepMessage({
          run_id: String(data.run_id || ''),
          step_id: String(data.step_id || ''),
        });
        msg.ack();
        return;
      }

      run_id = String(data?.run_id || '').trim();
      if (data.kind !== 'workflow.execute' || !run_id) {
        await this.publishWorkflowDeadLetter('invalid_runtime_dispatch_payload', { payload: envelope });
        console.error('[workflow-executor] Invalid runtime.dispatch message payload');
        msg.ack();
        return;
      }
      console.log(`[workflow-executor] Executing run: ${run_id}`);

      // Claim run atomically to prevent duplicate concurrent execution.
      const run = await this.claimPendingRun(run_id);
      if (!run) {
        console.warn(`[workflow-executor] Skipping run ${run_id}; already claimed or not pending`);
        return;
      }

      // Fetch workflow
      const wf_result = await this.pool.query(
        `SELECT * FROM workflows WHERE id = $1`,
        [run.workflow_id]
      );

      if (wf_result.rows.length === 0) {
        console.error(`Workflow ${run.workflow_id} not found`);
        await this.markRunFailed(run_id, 'WORKFLOW_NOT_FOUND', `Workflow ${run.workflow_id} not found`);
        await this.publishWorkflowDeadLetter('workflow_not_found', {
          run_id,
          workflow_id: String(run.workflow_id || ''),
        });
        msg.ack();
        return;
      }

      const workflow = wf_result.rows[0];

      // Execute workflow
      await this.executeWorkflow({
        run_id,
        chat_id: workflow.chat_id,
        triggered_by: run.triggered_by || null,
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        steps: workflow.steps,
        edges: workflow.edges,
        variables: run.input_variables || {},
        step_results: run.step_results || {}
      });
      msg.ack();
    } catch (err) {
      console.error('Workflow execution error:', err);
      if (run_id) {
        await this.markRunFailed(
          run_id,
          'EXECUTION_PRECHECK_FAILED',
          String((err as Error)?.message || err || 'workflow execution error'),
        );
      } else {
        await this.publishWorkflowDeadLetter('execute_exception_without_run_id', {
          error: String((err as Error)?.message || err || 'workflow execution error'),
        });
      }
      msg.ack();
    }
  }

  private async claimPendingRun(run_id: string): Promise<Record<string, any> | null> {
    const now = new Date().toISOString();
    const claimResult = await this.pool.query(
      `UPDATE workflow_runs
       SET status = 'running',
           started_at = COALESCE(started_at, $2),
           updated_at = $2
       WHERE id = $1
         AND status = 'pending'
       RETURNING *`,
      [run_id, now],
    );
    if (claimResult.rows.length > 0) {
      return claimResult.rows[0] as Record<string, any>;
    }

    const existing = await this.pool.query(
      `SELECT status FROM workflow_runs WHERE id = $1 LIMIT 1`,
      [run_id],
    );
    if (existing.rows.length === 0) {
      await this.publishWorkflowDeadLetter('run_not_found', { run_id });
      console.error(`Run ${run_id} not found`);
      return null;
    }
    return null;
  }

  private calculateRunProgress(
    totalSteps: number,
    stepResults: Record<string, any>,
  ): { completedSteps: number; failedSteps: number } {
    let completedSteps = 0;
    let failedSteps = 0;
    for (const result of Object.values(stepResults || {})) {
      const status = String((result as any)?.status || '').toLowerCase();
      if (status === 'completed') completedSteps += 1;
      if (status === 'failed') failedSteps += 1;
    }
    return {
      completedSteps: Math.min(totalSteps, completedSteps),
      failedSteps: Math.min(totalSteps, failedSteps),
    };
  }

  private async syncRunTelemetry(
    run_id: string,
    totalSteps: number,
    stepResults: Record<string, any>,
    occurredAt: string,
    setStartedAt = false,
  ): Promise<void> {
    const progress = this.calculateRunProgress(totalSteps, stepResults);
    await this.pool.query(
      `UPDATE workflow_runs
       SET step_results = $2,
           total_steps = $3,
           completed_steps = $4,
           failed_steps = $5,
           started_at = CASE WHEN $6 THEN COALESCE(started_at, $7) ELSE started_at END,
           updated_at = $7
       WHERE id = $1`,
      [
        run_id,
        JSON.stringify(stepResults),
        totalSteps,
        progress.completedSteps,
        progress.failedSteps,
        setStartedAt,
        occurredAt,
      ],
    );
  }

  private resolveStepRetryPolicy(step: any): StepRetryPolicy {
    const config = (step && typeof step === 'object' && step.config && typeof step.config === 'object')
      ? step.config as Record<string, unknown>
      : {};
    const maxRetries = Math.min(10, Math.max(0, Number(config.max_retries ?? 0) || 0));
    const baseDelayMs = Math.min(60_000, Math.max(0, Number(config.retry_backoff_ms ?? 1000) || 1000));
    const maxDelayMs = Math.min(5 * 60_000, Math.max(baseDelayMs, Number(config.retry_backoff_max_ms ?? 30_000) || 30_000));
    const multiplier = Math.min(10, Math.max(1, Number(config.retry_backoff_multiplier ?? 2) || 2));
    return { maxRetries, baseDelayMs, maxDelayMs, multiplier };
  }

  private computeStepRetryDelayMs(attempt: number, policy: StepRetryPolicy): number {
    if (policy.baseDelayMs <= 0) return 0;
    const exponential = policy.baseDelayMs * Math.pow(policy.multiplier, Math.max(0, attempt - 1));
    return Math.min(policy.maxDelayMs, Math.floor(exponential));
  }

  private buildDependencyGraph(steps: any[], edges: any[]): string[] {
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const stepIds = new Set<string>();

    // Initialize
    for (const step of steps) {
      const stepId = String(step?.id || '').trim();
      if (!stepId) {
        throw new Error('workflow step id must be non-empty');
      }
      if (stepIds.has(stepId)) {
        throw new Error(`duplicate workflow step id: ${stepId}`);
      }
      stepIds.add(stepId);
      graph.set(stepId, new Set());
      inDegree.set(stepId, 0);
    }

    // Build graph
    for (const edge of edges) {
      const from = String(edge?.from || '').trim();
      const to = String(edge?.to || '').trim();
      if (!from || !to) {
        throw new Error('workflow edge must include non-empty from/to');
      }
      if (!stepIds.has(from) || !stepIds.has(to)) {
        throw new Error(`workflow edge references unknown step id: ${from}->${to}`);
      }
      if (from === to) {
        throw new Error(`workflow edge self-reference is not allowed: ${from}`);
      }
      if (!graph.get(from)!.has(to)) {
        graph.get(from)!.add(to);
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);

      for (const neighbor of graph.get(id) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 1) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== stepIds.size) {
      throw new Error('workflow edges must form an acyclic graph over declared steps');
    }

    return result;
  }

  private async executeTool(
    step: any,
    variables: Record<string, any>,
    context: { workflow_run_id: string; chat_id: string; user_id: string | null },
  ): Promise<any> {
    if (!this.nc) {
      throw new Error('NATS connection is not ready');
    }
    const { tool_name, params } = step.config;
    if (!tool_name || typeof tool_name !== 'string') {
      throw new Error('workflow tool_call step requires tool_name');
    }

    // Resolve variables in params
    const resolvedParams = this.resolveVariables(params, variables);
    const userId = String(context.user_id || variables.user_id || '').trim();
    if (!userId) {
      throw new Error('workflow tool_call step requires user identity');
    }

    // Dispatch real tool run into the skill-runner pipeline.
    const toolRunId = generateTaskId('tool_run');
    const correlationId = generateTaskId('coordinator_task');
    const now = new Date().toISOString();
    const envelope = {
      schema_version: '1.0',
      event_id: generateTaskId('event_envelope'),
      occurred_at: now,
      data: {
        run_id: toolRunId,
        correlation_id: correlationId,
        tool_name: String(tool_name),
        chat_id: String(context.chat_id),
        user_id: userId,
        inputs: resolvedParams || {},
        justification: {
          user_message_ids: [],
          rag_citations: [],
        },
      },
    };
    this.nc.publish('tool.run.request', JSONCodec().encode(envelope));

    // Wait for the corresponding tool run to complete/fail.
    const timeoutMs = 5 * 60 * 1000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const controlState = await this.waitForRunRunnable(context.workflow_run_id);
      if (controlState === 'cancelled') {
        throw new WorkflowRunControlError('RUN_CANCELLED', `Workflow run cancelled: ${context.workflow_run_id}`);
      }
      if (controlState === 'missing') {
        throw new WorkflowRunControlError('RUN_MISSING', `Workflow run not found: ${context.workflow_run_id}`);
      }

      const result = await this.pool.query(
        `SELECT status, outputs, error
         FROM tool_runs
         WHERE id = $1
         LIMIT 1`,
        [toolRunId],
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const status = String(row.status || '').toLowerCase();
        if (status === 'completed') {
          if (row.outputs && typeof row.outputs === 'object') return row.outputs;
          return {};
        }
        if (status === 'error' || status === 'failed' || status === 'cancelled') {
          throw new Error(String(row.error || `Tool call failed (${status})`));
        }
      }
      await this.sleep(1000);
    }

    throw new Error(`Tool call timed out after ${Math.floor(timeoutMs / 1000)}s`);
  }

  private async executeApproval(
    step: any,
    variables: Record<string, any>,
    run_id: string,
    context: { chat_id: string; user_id: string | null },
  ): Promise<any> {
    const { title, approvers } = step.config;
    const requesterUserId = String(context.user_id || variables.user_id || '').trim();
    if (!requesterUserId) {
      throw new Error('Approval step requires authenticated requester user id');
    }
    const normalizedApprovers = Array.isArray(approvers)
      ? approvers.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [];
    const uniqueApprovers = [...new Set(normalizedApprovers)];
    const requestedQuorum = Number(step?.config?.quorum_required ?? step?.config?.quorum);
    const quorumRequired = Number.isFinite(requestedQuorum)
      ? Math.max(1, Math.floor(requestedQuorum))
      : Math.max(1, uniqueApprovers.length > 0 ? uniqueApprovers.length : 1);
    const expiresAt = new Date(
      Date.now() + (Math.max(1, Math.floor(Number(step?.config?.timeout_seconds || 1200))) * 1000),
    ).toISOString();
    const scope = String(step?.config?.scope || 'workflow.approval').trim() || 'workflow.approval';
    const toolName = String(step?.config?.tool_name || 'workflow.approval').trim() || 'workflow.approval';

    // Create approval
    const approval_id = generateTaskId('approval');
    const now = new Date().toISOString();

    await this.pool.query(
      `INSERT INTO approvals
         (id, chat_id, tool_name, scope, requester_user_id, status, quorum_required, votes_approve, votes_deny, expires_at, details, created_at)
       VALUES
         ($1, $2, $3, $4, $5, 'pending', $6, 0, 0, $7, $8, $9)`,
      [
        approval_id,
        context.chat_id,
        toolName,
        scope,
        requesterUserId,
        quorumRequired,
        expiresAt,
        JSON.stringify({
          title: String(title || '').trim() || 'Workflow approval',
          run_id,
          step_id: String(step?.id || ''),
          approvers: uniqueApprovers,
        }),
        now,
      ],
    );

    // Wait for approval (default 20m, configurable per-step, max 1 hour).
    const timeoutSec = Number(step?.config?.timeout_seconds || 1200);
    const clampedTimeout = Math.min(3600, timeoutSec);
    const maxAttempts = Math.max(1, Math.floor(Number.isFinite(clampedTimeout) ? clampedTimeout : 1200));
    let attempts = 0;
    while (attempts < maxAttempts) {
      const controlState = await this.waitForRunRunnable(run_id);
      if (controlState === 'cancelled') {
        throw new WorkflowRunControlError('RUN_CANCELLED', `Workflow run cancelled: ${run_id}`);
      }
      if (controlState === 'missing') {
        throw new WorkflowRunControlError('RUN_MISSING', `Workflow run not found: ${run_id}`);
      }

      // Poll current approval with tally reconciliation.
      const approvalResult = await this.pool.query(
        `SELECT status, quorum_required, votes_approve, votes_deny
         FROM approvals
         WHERE id = $1`,
        [approval_id]
      );
      if (approvalResult.rows.length === 0) {
        throw new Error('Approval record missing');
      }

      const tallyRes = await this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE vote = 'approve')::int AS approve_count,
           COUNT(*) FILTER (WHERE vote = 'deny')::int AS deny_count
         FROM approval_votes
         WHERE approval_id = $1`,
        [approval_id],
      );
      const approveCount = Number(tallyRes.rows[0]?.approve_count || 0);
      const denyCount = Number(tallyRes.rows[0]?.deny_count || 0);
      const effectiveQuorum = Number(approvalResult.rows[0]?.quorum_required || 1);
      const derivedStatus: 'pending' | 'approved' | 'denied' = approveCount >= effectiveQuorum
        ? 'approved'
        : denyCount > 0
          ? 'denied'
          : 'pending';
      const persistedStatus = String(approvalResult.rows[0]?.status || 'pending').toLowerCase();
      if (
        persistedStatus !== derivedStatus
        || Number(approvalResult.rows[0]?.votes_approve || 0) !== approveCount
        || Number(approvalResult.rows[0]?.votes_deny || 0) !== denyCount
      ) {
        await this.pool.query(
          `UPDATE approvals
           SET votes_approve = $2,
               votes_deny = $3,
               status = $4,
               resolved_at = CASE WHEN $4 = 'pending' THEN NULL ELSE NOW() END
           WHERE id = $1`,
          [approval_id, approveCount, denyCount, derivedStatus],
        );
      }

      const status = derivedStatus;
      if (status === 'approved') {
        return { approval_id, approved: true, votes_approve: approveCount, votes_deny: denyCount, quorum_required: effectiveQuorum };
      }
      if (status === 'denied') {
        throw new Error('Approval denied');
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
    }

    throw new Error(`Approval timed out after ${maxAttempts}s`);
  }

  private async getRunStatus(run_id: string): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT status FROM workflow_runs WHERE id = $1 LIMIT 1`,
      [run_id],
    );
    if (result.rows.length === 0) return null;
    return String(result.rows[0]?.status || '').toLowerCase();
  }

  private async waitForRunRunnable(run_id: string): Promise<'running' | 'cancelled' | 'missing'> {
    for (;;) {
      const status = await this.getRunStatus(run_id);
      if (!status) return 'missing';
      if (status === 'paused') {
        await this.sleep(1000);
        continue;
      }
      if (status === 'cancelled' || status === 'completed' || status === 'failed') return 'cancelled';
      return 'running';
    }
  }

  private async markRunCancelled(run_id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.pool.query(
      `UPDATE workflow_runs
       SET status = 'cancelled',
           completed_at = COALESCE(completed_at, $2),
           updated_at = $2
       WHERE id = $1 AND status NOT IN ('completed', 'failed', 'cancelled')`,
      [run_id, now],
    );
  }

  private async markRunFailed(
    run_id: string,
    reasonCode: string,
    reasonMessage: string,
    telemetry?: { totalSteps?: number; stepResults?: Record<string, any> },
  ): Promise<void> {
    const now = new Date().toISOString();
    const totalSteps = Math.max(0, Number(telemetry?.totalSteps || 0));
    const stepResults = (telemetry?.stepResults && typeof telemetry.stepResults === 'object')
      ? telemetry.stepResults
      : {};
    const progress = this.calculateRunProgress(totalSteps, stepResults);
    await this.pool.query(
      `UPDATE workflow_runs
       SET status = 'failed',
           completed_at = COALESCE(completed_at, $2),
           updated_at = $2,
           started_at = COALESCE(started_at, $2),
           total_steps = CASE WHEN $5 > 0 THEN $5 ELSE total_steps END,
           completed_steps = CASE WHEN $5 > 0 THEN $6 ELSE completed_steps END,
           failed_steps = CASE WHEN $5 > 0 THEN $7 ELSE failed_steps END,
           step_results = COALESCE(step_results::jsonb, '{}'::jsonb) || jsonb_build_object(
             '__executor_failure',
             jsonb_build_object(
               'code', $3,
               'message', $4,
               'at', $2
             )
           )
       WHERE id = $1
         AND status NOT IN ('completed', 'failed', 'cancelled')`,
      [run_id, now, reasonCode, reasonMessage, totalSteps, progress.completedSteps, progress.failedSteps],
    );
  }

  private async publishWorkflowDeadLetter(
    reason: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.nc) return;
    const now = new Date().toISOString();
    this.nc.publish(
      'runtime.dispatch.dead_letter',
      JSONCodec().encode({
        schema_version: '1.0',
        event_id: generateTaskId('event_envelope'),
        occurred_at: now,
        data: {
          reason,
          ...payload,
        },
      }),
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeConditional(step: any, variables: Record<string, any>): Promise<any> {
    const { condition } = step.config;
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      throw new Error('workflow conditional step requires condition object');
    }

    // Simple condition evaluation
    // Example: { variable: 'status', operator: 'equals', value: 'ready' }
    const { variable, operator, value } = condition;
    if (!variable || typeof variable !== 'string') {
      throw new Error('workflow conditional step requires condition.variable');
    }
    const varValue = variables[variable];

    let result = false;
    switch (operator) {
      case 'equals':
        result = varValue === value;
        break;
      case 'not_equals':
        result = varValue !== value;
        break;
      case 'greater_than':
        result = varValue > value;
        break;
      case 'less_than':
        result = varValue < value;
        break;
      case 'contains':
        result = String(varValue).includes(String(value));
        break;
      default:
        throw new Error(`Unsupported conditional operator: ${String(operator || '')}`);
    }

    return { condition_result: result };
  }

  private async executeNotification(
    step: any,
    variables: Record<string, any>,
    context: { workflow_run_id: string; chat_id: string; user_id: string | null },
  ): Promise<any> {
    if (!this.nc) {
      throw new Error('NOTIFICATION_BACKEND_UNAVAILABLE: NATS connection is not ready');
    }

    const resolvedConfig = this.resolveVariables(step?.config ?? {}, variables) as Record<string, any>;
    const requestId = generateTaskId('notification');
    const timeoutSecondsRaw = Number(resolvedConfig?.delivery_timeout_seconds ?? 60);
    const timeoutSeconds = Number.isFinite(timeoutSecondsRaw) ? Math.max(5, Math.floor(timeoutSecondsRaw)) : 60;
    const deadlineAt = Date.now() + timeoutSeconds * 1000;

    const title = String(
      resolvedConfig?.title
        ?? resolvedConfig?.subject
        ?? `Workflow notification (${String(step?.id || 'step')})`,
    ).trim();
    const bodySource = resolvedConfig?.message ?? resolvedConfig?.body ?? '';
    const body = typeof bodySource === 'string'
      ? bodySource
      : JSON.stringify(bodySource);
    if (!title && !body) {
      throw new Error('workflow notification step requires title or message/body');
    }

    const recipientsRaw = resolvedConfig?.recipients;
    const recipientCandidates = Array.isArray(recipientsRaw)
      ? recipientsRaw
      : (recipientsRaw === undefined || recipientsRaw === null ? [] : [recipientsRaw]);
    const targetUserIds = recipientCandidates
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const uniqueTargetUserIds = [...new Set(targetUserIds)];
    const explicitRecipient = String(
      resolvedConfig?.recipient_user_id
      ?? resolvedConfig?.recipientUserId
      ?? '',
    ).trim();
    const recipientUserId = explicitRecipient || uniqueTargetUserIds[0] || String(context.user_id || '').trim();

    const channelsRaw = resolvedConfig?.channels;
    const channels = (Array.isArray(channelsRaw) ? channelsRaw : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const uniqueChannels = [...new Set(channels)];
    const channel = String(resolvedConfig?.channel || uniqueChannels[0] || 'outbox').trim() || 'outbox';

    const payloadData = {
      ...((resolvedConfig?.data && typeof resolvedConfig.data === 'object' && !Array.isArray(resolvedConfig.data))
        ? resolvedConfig.data
        : {}),
      workflow_run_id: context.workflow_run_id,
      workflow_step_id: String(step?.id || ''),
      workflow_notification_request_id: requestId,
      chat_id: context.chat_id,
    };

    const envelope = {
      schema_version: '1.0',
      event_id: generateTaskId('event_envelope'),
      occurred_at: new Date().toISOString(),
      data: {
        type: String(resolvedConfig?.type || 'workflow.notification'),
        recipient_user_id: recipientUserId || undefined,
        target_user_ids: uniqueTargetUserIds.length > 0 ? uniqueTargetUserIds : undefined,
        channel,
        channels: uniqueChannels.length > 0 ? uniqueChannels : undefined,
        title: title || 'Workflow notification',
        body: body || '',
        data: payloadData,
        action_url: resolvedConfig?.action_url ? String(resolvedConfig.action_url) : undefined,
        priority: resolvedConfig?.priority ? String(resolvedConfig.priority) : undefined,
      },
    };

    this.nc.publish('notify.push', JSONCodec().encode(envelope));

    while (Date.now() < deadlineAt) {
      const controlState = await this.waitForRunRunnable(context.workflow_run_id);
      if (controlState === 'cancelled') {
        throw new WorkflowRunControlError('RUN_CANCELLED', `Workflow run cancelled: ${context.workflow_run_id}`);
      }
      if (controlState === 'missing') {
        throw new WorkflowRunControlError('RUN_MISSING', `Workflow run not found: ${context.workflow_run_id}`);
      }

      const deliveryResult = await this.pool.query(
        `SELECT id, status, delivered_at
         FROM notifications
         WHERE data->>'workflow_notification_request_id' = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [requestId],
      );

      if (deliveryResult.rows.length > 0) {
        const row = deliveryResult.rows[0];
        const status = String(row.status || '').toLowerCase();
        if (status === 'delivered' || status === 'partial') {
          return {
            notified: true,
            notification_id: String(row.id || ''),
            delivery_status: status,
            request_id: requestId,
            delivered_at: row.delivered_at || null,
          };
        }
        if (status === 'failed') {
          throw new Error(`Notification delivery failed for request ${requestId}`);
        }
      }

      await this.sleep(1000);
    }

    throw new Error(`Notification delivery timed out after ${timeoutSeconds}s (request ${requestId})`);
  }

  private areStepDependenciesCompleted(
    targetStepId: string,
    edges: any[],
    stepResults: Record<string, any>,
  ): boolean {
    const dependencies = edges
      .filter((edge: any) => String(edge?.to || '') === targetStepId)
      .map((edge: any) => String(edge?.from || ''))
      .filter(Boolean);
    for (const dep of dependencies) {
      if (String(stepResults[dep]?.status || '') !== 'completed') return false;
    }
    return true;
  }

  private hydrateVariablesFromStepResults(
    variables: Record<string, any>,
    stepResults: Record<string, any>,
    steps: any[],
  ): Record<string, any> {
    const hydrated = { ...variables };
    for (const step of steps) {
      const stepId = String(step?.id || '');
      if (!stepId) continue;
      const result = stepResults[stepId];
      if (!result || String(result.status || '') !== 'completed') continue;
      const output = result.output;
      if (!step.outputs || typeof step.outputs !== 'object') continue;
      this.applyStepOutputMappings(hydrated, step, output);
    }
    return hydrated;
  }

  private applyStepOutputMappings(
    targetVariables: Record<string, any>,
    step: any,
    output: any,
  ): void {
    if (!step?.outputs || typeof step.outputs !== 'object' || Array.isArray(step.outputs)) {
      return;
    }
    for (const [rawTarget, mapping] of Object.entries(step.outputs as Record<string, unknown>)) {
      const target = String(rawTarget || '').trim();
      if (!target) {
        throw new Error(`workflow step ${String(step?.id || '(unknown)')} has empty output mapping key`);
      }
      const sourcePath = this.resolveOutputMappingPath(target, mapping);
      const resolved = this.resolveOutputValueByPath(output, sourcePath);
      if (!resolved.found) {
        throw new Error(
          `workflow step ${String(step?.id || '(unknown)')} output mapping path not found: ${sourcePath}`,
        );
      }
      targetVariables[target] = resolved.value;
    }
  }

  private resolveOutputMappingPath(target: string, mapping: unknown): string {
    if (typeof mapping === 'string') {
      const normalized = mapping.trim();
      if (!normalized) {
        throw new Error(`workflow output mapping for ${target} must not be empty`);
      }
      return normalized;
    }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      return target;
    }
    const config = mapping as Record<string, unknown>;
    const candidate = config.source ?? config.path ?? target;
    const normalized = String(candidate || '').trim();
    if (!normalized) {
      throw new Error(`workflow output mapping for ${target} has invalid source/path`);
    }
    return normalized;
  }

  private resolveOutputValueByPath(
    output: unknown,
    path: string,
  ): { found: boolean; value: unknown } {
    const normalizedPath = String(path || '').trim();
    if (normalizedPath === '$' || normalizedPath === '.') {
      return { found: true, value: output };
    }
    const segments = normalizedPath
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      return { found: true, value: output };
    }

    let cursor: unknown = output;
    for (const segment of segments) {
      if (Array.isArray(cursor)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
          return { found: false, value: undefined };
        }
        cursor = cursor[index];
        continue;
      }
      if (!cursor || typeof cursor !== 'object') {
        return { found: false, value: undefined };
      }
      if (!Object.prototype.hasOwnProperty.call(cursor, segment)) {
        return { found: false, value: undefined };
      }
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    return { found: true, value: cursor };
  }

  private async emitWorkflowStepCanvasEvent(params: {
    chat_id: string;
    run_id: string;
    step_id: string;
    step_type: string;
    status: 'running' | 'completed' | 'failed';
    occurred_at: string;
    error_message?: string;
  }): Promise<void> {
    const messageId = generateTaskId('message');
    const canvasEventId = generateTaskId('event_envelope');
    const text = params.status === 'failed'
      ? `Workflow step failed: ${params.step_id} (${params.step_type}) — ${params.error_message || 'unknown error'}`
      : `Workflow step ${params.status}: ${params.step_id} (${params.step_type})`;

    const blocks = [
      {
        type: 'workflow_step_status',
        run_id: params.run_id,
        step_id: params.step_id,
        step_type: params.step_type,
        status: params.status,
        error: params.error_message || null,
        occurred_at: params.occurred_at,
      },
    ];

    await this.pool.query(
      `INSERT INTO messages (id, chat_id, role, content_type, text, blocks, created_at)
       VALUES ($1, $2, 'system', 'blocks', $3, $4, $5)`,
      [messageId, params.chat_id, text, JSON.stringify(blocks), params.occurred_at],
    );

    await this.pool.query(
      `INSERT INTO canvas_events (id, chat_id, message_id, blocks, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [canvasEventId, params.chat_id, messageId, JSON.stringify(blocks), params.occurred_at],
    );
  }

  private async emitWorkflowStepAuditEvent(params: {
    workflow_id: string;
    run_id: string;
    actor_id: string | null;
    action: 'step_started' | 'step_completed' | 'step_failed';
    step_id: string;
    step_type: string;
    occurred_at: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    if (!params.actor_id) {
      return;
    }

    const details = {
      step_id: params.step_id,
      step_type: params.step_type,
      ...((params.details && typeof params.details === 'object') ? params.details : {}),
    };

    await this.pool.query(
      `INSERT INTO workflow_audit_log (id, workflow_id, run_id, action, actor_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        generateTaskId('audit_entry'),
        params.workflow_id,
        params.run_id,
        params.action,
        params.actor_id,
        JSON.stringify(details),
        params.occurred_at,
      ],
    );
  }

  private async executeDataShape(step: any, variables: Record<string, any>): Promise<any> {
    const source = this.resolveVariables(step.config?.input ?? step.config?.source ?? [], variables);
    const pipeline = Array.isArray(step.config?.pipeline)
      ? (step.config.pipeline as DataShapeOperator[])
      : [];
    if (!pipeline.length) {
      return source;
    }
    return applyDataShapingPipeline(source, pipeline);
  }

  private async executeLlmTask(step: any, variables: Record<string, any>): Promise<any> {
    const config = this.resolveVariables(step?.config ?? {}, variables) as Record<string, any>;
    const prompt = String(config.prompt || '').trim();
    if (!prompt) {
      throw new Error('workflow llm_task step requires prompt');
    }

    const endpoint = String(process.env.LITELLM_URL || 'http://litellm:4000').replace(/\/+$/, '');
    const apiKey = String(process.env.LLM_API_KEY || '').trim();
    const model = String(config.model || process.env.WORKFLOW_LLM_TASK_MODEL || 'gpt-4o-mini').trim();
    const systemPrompt = String(config.system_prompt || '').trim();
    const outputKey = String(config.output_key || 'text').trim() || 'text';
    const temperatureRaw = config.temperature === undefined ? 0.2 : Number(config.temperature);
    const temperature = Number.isFinite(temperatureRaw) ? temperatureRaw : 0.2;
    const timeoutMs = this.normalizeWorkflowLlmTimeoutMs(config.timeout_ms);

    const response = await this.fetchWithTimeout(
      `${endpoint}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: config.json_schema
            ? {
                type: 'json_schema',
                json_schema: {
                  name: `${String(step?.id || 'workflow_llm_task')}_schema`,
                  schema: config.json_schema,
                },
              }
            : undefined,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
        }),
      },
      timeoutMs,
      'llm_task',
    );

    if (!response.ok) {
      throw new Error(`workflow llm_task provider error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      throw new Error('workflow llm_task provider returned empty content');
    }

    let parsed: unknown = text;
    if (config.json_schema) {
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error(`workflow llm_task expected JSON output: ${String((err as Error)?.message || err)}`);
      }
    }

    return {
      text,
      [outputKey]: parsed,
      model_used: model,
      provider_used: 'openai_compatible',
      tokens_used: {
        prompt: Number(data?.usage?.prompt_tokens || 0),
        completion: Number(data?.usage?.completion_tokens || 0),
      },
    };
  }

  private normalizeWorkflowLlmTimeoutMs(raw: unknown): number {
    const parsed = Number(raw ?? process.env.WORKFLOW_LLM_TASK_TIMEOUT_MS ?? DEFAULT_WORKFLOW_LLM_TIMEOUT_MS);
    if (!Number.isFinite(parsed)) return DEFAULT_WORKFLOW_LLM_TIMEOUT_MS;
    const normalized = Math.floor(parsed);
    if (normalized <= 0) return DEFAULT_WORKFLOW_LLM_TIMEOUT_MS;
    return Math.max(MIN_WORKFLOW_LLM_TIMEOUT_MS, Math.min(MAX_WORKFLOW_LLM_TIMEOUT_MS, normalized));
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    provider: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        throw new Error(`${provider} request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveVariables(params: any, variables: Record<string, any>): any {
    if (typeof params === 'string' && params.startsWith('${') && params.endsWith('}')) {
      const varName = params.slice(2, -1);
      return variables[varName];
    }

    if (typeof params === 'object' && params !== null) {
      if (Array.isArray(params)) {
        return params.map(p => this.resolveVariables(p, variables));
      }

      const resolved: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        resolved[key] = this.resolveVariables(value, variables);
      }
      return resolved;
    }

    return params;
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const nats_url = process.env.NATS_URL || 'nats://localhost:4222';

  const executor = new WorkflowExecutor(pool, nats_url);
  await executor.start();

  // Keep process alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
