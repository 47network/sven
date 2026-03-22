import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { ToolRunResultEvent } from '@sven/shared';
import { classifyToolResult, type ClassifiedError, type ErrorClassification } from './error-classifier.js';
import { LLMRouter } from './llm-router.js';
import { CanvasEmitter } from './canvas-emitter.js';
import { parseBooleanSetting, parseSettingValue } from './settings-utils.js';

const logger = createLogger('self-correction');
const jc = JSONCodec();
const STRATEGY_RETRY_MAX_DISPATCH_PER_ATTEMPT = 1;
const MIN_RETRY_DELAY_MS = 50;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_SELF_CORRECTION_RETRIES = 12;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_REQUIRE_APPROVAL_AFTER = 2;
const DEFAULT_BACKOFF_BASE_MS = 100;

// ── Types ──

interface ToolCallRecord {
  run_id: string;
  correlation_id?: string;
  tool_name: string;
  chat_id: string;
  user_id: string;
  inputs: Record<string, unknown>;
  approval_id?: string;
}

interface RetryAttempt {
  attempt: number;
  classification: ErrorClassification;
  errorDetail: string;
  originalToolCall: ToolCallRecord;
  correctedToolCall?: ToolCallRecord;
  outcome: 'pending' | 'success' | 'failed' | 'aborted';
}

interface SelfCorrectionConfig {
  enabled: boolean;
  maxRetries: number;
  requireApprovalAfter: number;
  backoffBaseMs: number;
}

// ── In-memory tracking for the current process ──

/** Track retry attempts per original run_id to detect infinite loops */
const retryTracker = new Map<string, RetryAttempt[]>();
/** Track tool_call signature → run_ids to detect duplicate calls */
const callSignatures = new Map<string, Set<string>>();

function parseToolRunInputsSafe(rawValue: unknown, runId: string): Record<string, unknown> {
  if (rawValue === null || rawValue === undefined) return {};
  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      logger.warn('Malformed tool_runs.inputs JSON; defaulting to empty object', {
        run_id: runId,
        err: String(error),
      });
      return {};
    }
  }
  if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue as Record<string, unknown>;
  }
  return {};
}

function isStrictBooleanSettingValue(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value === 0 || value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'false', '1', '0', 'on', 'off'].includes(normalized);
  }
  return false;
}

/**
 * Self-Correction Engine
 *
 * Listens for tool run results. When a tool fails, it:
 * 1. Classifies the error (transient / strategy / fatal)
 * 2. For transient: retries same call with exponential backoff
 * 3. For strategy: re-prompts LLM with error context for a different approach
 * 4. For fatal: reports to user and aborts
 * 5. Enforces max retry limit, budget guard, and infinite loop detection
 */
export class SelfCorrectionEngine {
  private config: SelfCorrectionConfig = {
    enabled: true,
    maxRetries: DEFAULT_MAX_RETRIES,
    requireApprovalAfter: DEFAULT_REQUIRE_APPROVAL_AFTER,
    backoffBaseMs: DEFAULT_BACKOFF_BASE_MS,
  };

  constructor(
    private pool: pg.Pool,
    private nc: NatsConnection,
    private llmRouter: LLMRouter,
    private canvasEmitter: CanvasEmitter,
  ) {}

  /**
   * Load config from settings_global DB table.
   * Called once at startup and can be refreshed.
   */
  async loadConfig(): Promise<void> {
    const keys = [
      'agent.selfCorrection.enabled',
      'agent.selfCorrection.maxRetries',
      'agent.selfCorrection.requireApprovalAfter',
    ];

    const res = await this.pool.query(
      `SELECT key, value FROM settings_global WHERE key = ANY($1::text[])`,
      [keys],
    );

    const map = new Map<string, unknown>();
    for (const row of res.rows) {
      map.set(row.key, parseSettingValue(row.value));
    }

    const parsedMaxRetries = map.has('agent.selfCorrection.maxRetries')
      ? Number(map.get('agent.selfCorrection.maxRetries'))
      : DEFAULT_MAX_RETRIES;
    const maxRetries = Number.isFinite(parsedMaxRetries)
      ? Math.min(MAX_SELF_CORRECTION_RETRIES, Math.max(1, Math.floor(parsedMaxRetries)))
      : DEFAULT_MAX_RETRIES;
    const parsedRequireApprovalAfter = map.has('agent.selfCorrection.requireApprovalAfter')
      ? Number(map.get('agent.selfCorrection.requireApprovalAfter'))
      : DEFAULT_REQUIRE_APPROVAL_AFTER;
    const requireApprovalAfterRaw = Number.isFinite(parsedRequireApprovalAfter)
      ? Math.max(1, Math.floor(parsedRequireApprovalAfter))
      : DEFAULT_REQUIRE_APPROVAL_AFTER;
    const requireApprovalAfter = Math.min(requireApprovalAfterRaw, maxRetries);

    const enabledRaw = map.get('agent.selfCorrection.enabled');
    if (map.has('agent.selfCorrection.enabled') && !isStrictBooleanSettingValue(enabledRaw)) {
      logger.warn('Invalid self-correction enabled setting value; using safe disabled fallback', {
        key: 'agent.selfCorrection.enabled',
        value: enabledRaw,
      });
    }

    this.config = {
      enabled: map.has('agent.selfCorrection.enabled')
        ? parseBooleanSetting(enabledRaw, false)
        : true,
      maxRetries,
      requireApprovalAfter,
      backoffBaseMs: DEFAULT_BACKOFF_BASE_MS,
    };

    logger.info('Self-correction config loaded', { config: this.config });
  }

  /**
   * Handle a tool run result. Returns true if self-correction handled it
   * (retry dispatched or error reported), false if no action needed.
   */
  async handleToolResult(
    result: ToolRunResultEvent,
  ): Promise<boolean> {
    const existingChainId = this.findExistingChainId(result.run_id);
    if ((result.status === 'success' || result.status === 'completed') && existingChainId) {
      await this.incrementMetric('agent.self_correction.success_after_retry');
      return false;
    }

    // Classify the error
    const classified = classifyToolResult(
      result.tool_name,
      result.status,
      result.outputs,
      result.error,
    );

    // No error — nothing to correct
    if (!classified) return false;

    // Self-correction disabled — just report
    if (!this.config.enabled) {
      logger.info('Self-correction disabled, skipping retry', {
        run_id: result.run_id,
        tool: result.tool_name,
        classification: classified.classification,
      });
      return false;
    }

    // Get the original tool call from DB
    const originalCall = await this.getOriginalToolCall(result.run_id);
    if (!originalCall) {
      logger.warn('Could not find original tool call for retry', { run_id: result.run_id });
      return false;
    }
    if (!originalCall.correlation_id && result.correlation_id) {
      originalCall.correlation_id = result.correlation_id;
    }

    // Get or create retry history for this chain
    const chainId = this.getRetryChainId(result.run_id);
    const attempts = retryTracker.get(chainId) || [];
    const attemptNumber = attempts.length + 1;

    logger.info('Self-correction evaluating tool failure', {
      run_id: result.run_id,
      chain_id: chainId,
      tool: result.tool_name,
      classification: classified.classification,
      attempt: attemptNumber,
      maxRetries: this.config.maxRetries,
    });

    // Fatal — abort immediately
    if (classified.classification === 'fatal') {
      await this.incrementMetric('agent.self_correction.retries_total.fatal');
      await this.recordRetryAttempt(chainId, {
        attempt: attemptNumber,
        classification: 'fatal',
        errorDetail: classified.errorDetail,
        originalToolCall: originalCall,
        outcome: 'aborted',
      });

      await this.reportErrorToUser(
        originalCall.chat_id,
        result.tool_name,
        classified,
        'fatal',
      );

      return true;
    }

    // Max retries exceeded — abort
    if (attemptNumber > this.config.maxRetries) {
      await this.recordRetryAttempt(chainId, {
        attempt: attemptNumber,
        classification: classified.classification,
        errorDetail: classified.errorDetail,
        originalToolCall: originalCall,
        outcome: 'aborted',
      });

      await this.reportErrorToUser(
        originalCall.chat_id,
        result.tool_name,
        classified,
        'max_retries_exceeded',
      );

      logger.warn('Max retries exceeded', {
        chain_id: chainId,
        tool: result.tool_name,
        attempts: attemptNumber,
      });

      return true;
    }

    // Approval threshold gate — stop autonomous retries past threshold
    if (attemptNumber > this.config.requireApprovalAfter) {
      await this.recordRetryAttempt(chainId, {
        attempt: attemptNumber,
        classification: classified.classification,
        errorDetail: classified.errorDetail,
        originalToolCall: originalCall,
        outcome: 'aborted',
      });

      await this.recordToolRetryInDb({
        toolCallId: originalCall.run_id,
        attempt: attemptNumber,
        classification: classified.classification,
        errorDetail: classified.errorDetail,
        originalParams: originalCall.inputs,
        correctedParams: originalCall.inputs,
        outcome: 'aborted',
        errorAnalysis: `approval gate triggered after attempt ${this.config.requireApprovalAfter}`,
      });

      await this.reportErrorToUser(
        originalCall.chat_id,
        result.tool_name,
        classified,
        'approval_required',
      );

      logger.warn('Self-correction approval gate triggered', {
        chain_id: chainId,
        tool: result.tool_name,
        attempt: attemptNumber,
        requireApprovalAfter: this.config.requireApprovalAfter,
      });

      return true;
    }

    // Budget guard — check if retry would exceed token budget
    const budgetOk = await this.checkBudget(originalCall.user_id);
    if (!budgetOk) {
      await this.recordRetryAttempt(chainId, {
        attempt: attemptNumber,
        classification: classified.classification,
        errorDetail: classified.errorDetail,
        originalToolCall: originalCall,
        outcome: 'aborted',
      });

      await this.reportErrorToUser(
        originalCall.chat_id,
        result.tool_name,
        classified,
        'budget_exceeded',
      );

      return true;
    }

    // Dispatch based on classification
    if (classified.classification === 'transient') {
      await this.incrementMetric('agent.self_correction.retries_total.transient');
      return this.handleTransientRetry(chainId, attemptNumber, originalCall, classified);
    }

    if (classified.classification === 'strategy') {
      await this.incrementMetric('agent.self_correction.retries_total.strategy');
      return this.handleStrategyRetry(chainId, attemptNumber, originalCall, classified, result);
    }

    return false;
  }

  // ── Transient retry: same tool, same params, with backoff ──

  private async handleTransientRetry(
    chainId: string,
    attemptNumber: number,
    originalCall: ToolCallRecord,
    classified: ClassifiedError,
  ): Promise<boolean> {
    // Infinite loop detection: check if identical call was already attempted
    const sig = this.computeCallSignature(originalCall.tool_name, originalCall.inputs);
    const existingSigs = callSignatures.get(chainId) || new Set();

    if (existingSigs.has(sig) && attemptNumber > 1) {
      // Same exact call already tried — this is fine for transient, but track it
      logger.info('Transient retry with identical call signature', {
        chain_id: chainId,
        attempt: attemptNumber,
      });
    }

    existingSigs.add(sig);
    callSignatures.set(chainId, existingSigs);

    // Calculate backoff: 100ms, 400ms, 1600ms (base * 4^(attempt-1))
    const exponentialBackoff = this.config.backoffBaseMs * Math.pow(4, attemptNumber - 1);
    const boundedBackoffMs = Number.isFinite(exponentialBackoff)
      ? Math.min(MAX_RETRY_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, exponentialBackoff))
      : MAX_RETRY_DELAY_MS;
    // Add jitter: ±25%
    const jitter = boundedBackoffMs * 0.25 * (Math.random() * 2 - 1);
    const candidateDelay = boundedBackoffMs + jitter;
    const delay = Number.isFinite(candidateDelay)
      ? Math.max(MIN_RETRY_DELAY_MS, Math.min(MAX_RETRY_DELAY_MS, Math.round(candidateDelay)))
      : MAX_RETRY_DELAY_MS;

    logger.info('Scheduling transient retry', {
      chain_id: chainId,
      attempt: attemptNumber,
      backoff_ms: delay,
      tool: originalCall.tool_name,
    });

    // Record the attempt
    const attempt: RetryAttempt = {
      attempt: attemptNumber,
      classification: 'transient',
      errorDetail: classified.errorDetail,
      originalToolCall: originalCall,
      outcome: 'pending',
    };
    await this.recordRetryAttempt(chainId, attempt);

    // Schedule retry after backoff
    setTimeout(async () => {
      try {
        // Re-validate runtime policy at execution time so queued retries
        // honor mid-flight config/budget changes.
        await this.loadConfig();

        if (!this.config.enabled) {
          await this.recordToolRetryInDb({
            toolCallId: originalCall.run_id,
            attempt: attemptNumber,
            classification: 'transient',
            errorDetail: classified.errorDetail,
            originalParams: originalCall.inputs,
            correctedParams: originalCall.inputs,
            outcome: 'aborted',
            errorAnalysis: 'self-correction disabled before delayed transient retry dispatch',
          });
          logger.info('Suppressed delayed transient retry: self-correction disabled', {
            chain_id: chainId,
            attempt: attemptNumber,
            tool: originalCall.tool_name,
          });
          return;
        }

        if (attemptNumber > this.config.maxRetries) {
          await this.recordToolRetryInDb({
            toolCallId: originalCall.run_id,
            attempt: attemptNumber,
            classification: 'transient',
            errorDetail: classified.errorDetail,
            originalParams: originalCall.inputs,
            correctedParams: originalCall.inputs,
            outcome: 'aborted',
            errorAnalysis: `max retries reduced before delayed dispatch (attempt=${attemptNumber}, max=${this.config.maxRetries})`,
          });
          logger.warn('Suppressed delayed transient retry: max retries now exceeded', {
            chain_id: chainId,
            attempt: attemptNumber,
            max_retries: this.config.maxRetries,
            tool: originalCall.tool_name,
          });
          return;
        }

        if (attemptNumber > this.config.requireApprovalAfter) {
          await this.recordToolRetryInDb({
            toolCallId: originalCall.run_id,
            attempt: attemptNumber,
            classification: 'transient',
            errorDetail: classified.errorDetail,
            originalParams: originalCall.inputs,
            correctedParams: originalCall.inputs,
            outcome: 'aborted',
            errorAnalysis: `approval gate now active before delayed dispatch (attempt=${attemptNumber}, threshold=${this.config.requireApprovalAfter})`,
          });
          logger.warn('Suppressed delayed transient retry: approval threshold now blocks attempt', {
            chain_id: chainId,
            attempt: attemptNumber,
            require_approval_after: this.config.requireApprovalAfter,
            tool: originalCall.tool_name,
          });
          return;
        }

        const budgetOk = await this.checkBudget(originalCall.user_id);
        if (!budgetOk) {
          await this.recordToolRetryInDb({
            toolCallId: originalCall.run_id,
            attempt: attemptNumber,
            classification: 'transient',
            errorDetail: classified.errorDetail,
            originalParams: originalCall.inputs,
            correctedParams: originalCall.inputs,
            outcome: 'aborted',
            errorAnalysis: 'budget denied before delayed transient retry dispatch',
          });
          logger.warn('Suppressed delayed transient retry: budget denied at dispatch time', {
            chain_id: chainId,
            attempt: attemptNumber,
            tool: originalCall.tool_name,
          });
          return;
        }

        const newRunId = uuidv7();

        // Record retry in DB
        await this.recordToolRetryInDb({
          toolCallId: originalCall.run_id,
          attempt: attemptNumber,
          classification: 'transient',
          errorDetail: classified.errorDetail,
          originalParams: originalCall.inputs,
          correctedParams: originalCall.inputs, // Same params for transient
          outcome: 'pending',
        });

        // Re-publish the tool run request with new run_id
        this.nc.publish(
          NATS_SUBJECTS.TOOL_RUN_REQUEST,
          jc.encode({
            schema_version: '1.0',
            event_id: newRunId,
            occurred_at: new Date().toISOString(),
            data: {
              run_id: newRunId,
              correlation_id: originalCall.correlation_id || originalCall.run_id,
              tool_name: originalCall.tool_name,
              chat_id: originalCall.chat_id,
              user_id: originalCall.user_id,
              approval_id: originalCall.approval_id,
              inputs: originalCall.inputs,
              justification: {
                retry_of: originalCall.run_id,
                retry_chain: chainId,
                attempt: attemptNumber,
                classification: 'transient',
              },
            },
          }),
        );

        // Track the new run as part of this chain
        this.linkRetryToChain(chainId, newRunId);

        logger.info('Transient retry dispatched', {
          chain_id: chainId,
          new_run_id: newRunId,
          tool: originalCall.tool_name,
        });
      } catch (err) {
        logger.error('Failed to dispatch transient retry', {
          chain_id: chainId,
          err: String(err),
        });
      }
    }, delay);

    return true;
  }

  // ── Strategy retry: re-prompt LLM with error context ──

  private async handleStrategyRetry(
    chainId: string,
    attemptNumber: number,
    originalCall: ToolCallRecord,
    classified: ClassifiedError,
    result: ToolRunResultEvent,
  ): Promise<boolean> {
    logger.info('Attempting strategy correction via LLM re-prompt', {
      chain_id: chainId,
      attempt: attemptNumber,
      tool: originalCall.tool_name,
    });

    // Build error context for the LLM
    const errorContext = this.buildErrorContext(originalCall, classified, result);

    try {
      // Load conversation context
      const contextRes = await this.pool.query(
        `SELECT role, text, content_type FROM messages
         WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [originalCall.chat_id],
      );
      const messages = contextRes.rows.reverse();

      // Append the error context as a system message
      messages.push({
        role: 'system',
        content_type: 'text',
        text: errorContext,
      });

      // Get system prompt
      const identityRes = await this.pool.query(
        `SELECT content FROM sven_identity_docs
         WHERE scope = 'global' OR (scope = 'chat' AND chat_id = $1)
         ORDER BY scope DESC LIMIT 1`,
        [originalCall.chat_id],
      );
      const systemPrompt = identityRes.rows[0]?.content || 'You are Sven, a helpful AI assistant.';

      // Re-prompt the LLM
      const llmResponse = await this.llmRouter.complete({
        messages,
        systemPrompt: `${systemPrompt}\n\nYou are in self-correction mode. A previous tool call failed. Analyze the error and try an alternative approach. Do NOT repeat the exact same tool call with the same parameters.`,
        user_id: originalCall.user_id,
        chat_id: originalCall.chat_id,
      });

      // Check if LLM suggested new tool calls
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        let dispatchedCount = 0;
        for (const newToolCall of llmResponse.tool_calls) {
          if (dispatchedCount >= STRATEGY_RETRY_MAX_DISPATCH_PER_ATTEMPT) {
            logger.warn('Strategy retry fan-out capped for attempt', {
              chain_id: chainId,
              attempt: attemptNumber,
              max_dispatch: STRATEGY_RETRY_MAX_DISPATCH_PER_ATTEMPT,
              dropped_calls: llmResponse.tool_calls.length - dispatchedCount,
            });
            break;
          }
          const newSig = this.computeCallSignature(newToolCall.name, newToolCall.inputs);
          const existingSigs = callSignatures.get(chainId) || new Set();

          // Infinite loop detection: reject if identical to previous attempt
          if (existingSigs.has(newSig)) {
            logger.warn('Strategy retry generated identical tool call — aborting', {
              chain_id: chainId,
              tool: newToolCall.name,
            });

            await this.recordRetryAttempt(chainId, {
              attempt: attemptNumber,
              classification: 'strategy',
              errorDetail: classified.errorDetail,
              originalToolCall: originalCall,
              correctedToolCall: {
                run_id: newToolCall.run_id || uuidv7(),
                tool_name: newToolCall.name,
                chat_id: originalCall.chat_id,
                user_id: originalCall.user_id,
                inputs: newToolCall.inputs,
              },
              outcome: 'aborted',
            });

            await this.reportErrorToUser(
              originalCall.chat_id,
              originalCall.tool_name,
              classified,
              'identical_retry_detected',
            );

            return true;
          }

          existingSigs.add(newSig);
          callSignatures.set(chainId, existingSigs);

          // Dispatch the corrected tool call
          const newRunId = newToolCall.run_id || uuidv7();
          const correctedCall: ToolCallRecord = {
            run_id: newRunId,
            correlation_id: originalCall.correlation_id || result.correlation_id || originalCall.run_id,
            tool_name: newToolCall.name,
            chat_id: originalCall.chat_id,
            user_id: originalCall.user_id,
            inputs: newToolCall.inputs,
          };

          const introducesDangerousTool = await this.introducesDangerousTool(
            originalCall.tool_name,
            correctedCall.tool_name,
          );
          if (introducesDangerousTool) {
            await this.recordRetryAttempt(chainId, {
              attempt: attemptNumber,
              classification: 'strategy',
              errorDetail: classified.errorDetail,
              originalToolCall: originalCall,
              correctedToolCall: correctedCall,
              outcome: 'aborted',
            });
            await this.recordToolRetryInDb({
              toolCallId: originalCall.run_id,
              attempt: attemptNumber,
              classification: 'strategy',
              errorDetail: classified.errorDetail,
              originalParams: originalCall.inputs,
              correctedParams: newToolCall.inputs,
              outcome: 'aborted',
              errorAnalysis: 'dangerous tool escalation blocked by self-correction gate',
            });
            await this.reportErrorToUser(
              originalCall.chat_id,
              correctedCall.tool_name,
              classified,
              'approval_required_dangerous_tool',
            );
            return true;
          }

          await this.recordRetryAttempt(chainId, {
            attempt: attemptNumber,
            classification: 'strategy',
            errorDetail: classified.errorDetail,
            originalToolCall: originalCall,
            correctedToolCall: correctedCall,
            outcome: 'pending',
          });

          await this.recordToolRetryInDb({
            toolCallId: originalCall.run_id,
            attempt: attemptNumber,
            classification: 'strategy',
            errorDetail: classified.errorDetail,
            originalParams: originalCall.inputs,
            correctedParams: newToolCall.inputs,
            outcome: 'pending',
            errorAnalysis: errorContext,
          });

          this.nc.publish(
            NATS_SUBJECTS.TOOL_RUN_REQUEST,
            jc.encode({
              schema_version: '1.0',
              event_id: newRunId,
              occurred_at: new Date().toISOString(),
              data: {
                run_id: newRunId,
                correlation_id: correctedCall.correlation_id,
                tool_name: newToolCall.name,
                chat_id: originalCall.chat_id,
                user_id: originalCall.user_id,
                inputs: newToolCall.inputs,
                justification: {
                  retry_of: originalCall.run_id,
                  retry_chain: chainId,
                  attempt: attemptNumber,
                  classification: 'strategy',
                  error_analysis: classified.reason,
                },
              },
            }),
          );

          this.linkRetryToChain(chainId, newRunId);
          dispatchedCount += 1;

          logger.info('Strategy retry dispatched', {
            chain_id: chainId,
            new_run_id: newRunId,
            original_tool: originalCall.tool_name,
            corrected_tool: newToolCall.name,
          });
        }
      } else {
        // LLM didn't suggest new tool calls — just emit the text response
        await this.canvasEmitter.emit({
          chat_id: originalCall.chat_id,
          channel: 'internal',
          text: llmResponse.text,
        });

        await this.recordRetryAttempt(chainId, {
          attempt: attemptNumber,
          classification: 'strategy',
          errorDetail: classified.errorDetail,
          originalToolCall: originalCall,
          outcome: 'success', // LLM found an alternative text-based answer
        });
      }

      return true;
    } catch (err) {
      logger.error('Strategy retry LLM re-prompt failed', {
        chain_id: chainId,
        err: String(err),
      });

      await this.reportErrorToUser(
        originalCall.chat_id,
        originalCall.tool_name,
        classified,
        'strategy_retry_failed',
      );

      return true;
    }
  }

  // ── Helper methods ──

  private buildErrorContext(
    originalCall: ToolCallRecord,
    classified: ClassifiedError,
    result: ToolRunResultEvent,
  ): string {
    return [
      'SELF-CORRECTION CONTEXT:',
      `A previous tool call failed and needs correction.`,
      '',
      `Tool: ${originalCall.tool_name}`,
      `Parameters: ${JSON.stringify(originalCall.inputs, null, 2)}`,
      '',
      `Error Classification: ${classified.classification}`,
      `Error Reason: ${classified.reason}`,
      `Error Detail: ${classified.errorDetail}`,
      '',
      `Status: ${result.status}`,
      result.error ? `Error Message: ${result.error}` : '',
      '',
      'INSTRUCTIONS:',
      '- Analyze why the tool call failed',
      '- Try a DIFFERENT approach or different parameters',
      '- Do NOT repeat the exact same tool call with identical parameters',
      '- If no tool can solve this, respond with a text explanation to the user',
    ].filter(Boolean).join('\n');
  }

  private async getOriginalToolCall(runId: string): Promise<ToolCallRecord | null> {
    const res = await this.pool.query(
      `SELECT id, tool_name, chat_id, user_id, inputs, approval_id
       FROM tool_runs WHERE id = $1`,
      [runId],
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      run_id: row.id,
      correlation_id: undefined,
      tool_name: row.tool_name,
      chat_id: row.chat_id,
      user_id: row.user_id,
      inputs: parseToolRunInputsSafe(row.inputs, String(row.id || runId)),
      approval_id: row.approval_id,
    };
  }

  private async checkBudget(userId: string): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const [globalBudgetRes, userBudgetRes] = await Promise.all([
      this.pool.query(
        `SELECT value FROM settings_global WHERE key = 'budgets.daily_tokens'`,
      ),
      this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1`,
        [`budgets.daily_tokens.user.${userId}`],
      ),
    ]);

    const globalBudget = globalBudgetRes.rows.length > 0
      ? Number(parseSettingValue(globalBudgetRes.rows[0].value))
      : null;
    const globalBudgetValue = Number.isFinite(globalBudget) ? Number(globalBudget) : null;
    if (globalBudgetValue !== null && globalBudgetValue > 0) {
      const usageRes = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1`,
        [`usage.${today}.total`],
      );
      const usage = usageRes.rows.length > 0
        ? Number(parseSettingValue(usageRes.rows[0].value))
        : 0;
      // Leave 10% headroom for retry
      if (usage >= globalBudgetValue * 0.9) return false;
    }

    const userBudget = userBudgetRes.rows.length > 0
      ? Number(parseSettingValue(userBudgetRes.rows[0].value))
      : null;
    const userBudgetValue = Number.isFinite(userBudget) ? Number(userBudget) : null;
    if (userBudgetValue !== null && userBudgetValue > 0) {
      const userUsageRes = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1`,
        [`usage.${today}.user.${userId}`],
      );
      const userUsage = userUsageRes.rows.length > 0
        ? Number(parseSettingValue(userUsageRes.rows[0].value))
        : 0;
      if (userUsage >= userBudgetValue * 0.9) return false;
    }

    return true;
  }

  private async reportErrorToUser(
    chatId: string,
    toolName: string,
    classified: ClassifiedError,
    reason: string,
  ): Promise<void> {
    logger.warn('Reporting self-correction error to user with sanitized detail', {
      chat_id: chatId,
      tool: toolName,
      reason,
      classification: classified.classification,
      error_detail: classified.errorDetail,
    });

    const messages: Record<string, string> = {
      fatal: `Tool \`${toolName}\` encountered an unrecoverable error. Diagnostic details were captured in server logs.`,
      max_retries_exceeded: `I tried multiple approaches for \`${toolName}\` but couldn't resolve the issue. Diagnostic details were captured in server logs.`,
      approval_required: `Automatic retries paused for \`${toolName}\` after reaching the approval threshold (${this.config.requireApprovalAfter}). Review and approve further action if needed.`,
      approval_required_dangerous_tool: `Automatic correction for \`${toolName}\` was blocked because it would escalate to a higher-risk tool. Manual approval is required.`,
      budget_exceeded: `Stopping retries for \`${toolName}\` — token budget is nearly exhausted.`,
      identical_retry_detected: `I attempted to correct the \`${toolName}\` failure but kept arriving at the same approach. Diagnostic details were captured in server logs.`,
      strategy_retry_failed: `I tried to find an alternative approach for \`${toolName}\` but the correction itself failed. Diagnostic details were captured in server logs.`,
    };

    const text = messages[reason] || `Tool \`${toolName}\` failed. Diagnostic details were captured in server logs.`;

    await this.canvasEmitter.emit({
      chat_id: chatId,
      channel: 'internal',
      text,
    });
  }

  /**
   * Compute a deterministic signature for a tool call to detect duplicates.
   */
  private computeCallSignature(toolName: string, inputs: Record<string, unknown>): string {
    const canonical = this.canonicalizeForSignature(inputs, new WeakSet<object>());
    return `${toolName}::${JSON.stringify(canonical)}`;
  }

  private canonicalizeForSignature(value: unknown, seen: WeakSet<object>): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalizeForSignature(item, seen));
    }

    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      if (seen.has(objectValue)) return '[Circular]';
      seen.add(objectValue);

      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(objectValue).sort()) {
        normalized[key] = this.canonicalizeForSignature(objectValue[key], seen);
      }
      return normalized;
    }

    return value;
  }

  /**
   * Get or derive the retry chain ID from a run_id.
   * If this run_id is itself a retry, resolve to the original chain.
   */
  private getRetryChainId(runId: string): string {
    // Check if this run_id is already linked to a chain
    for (const [chainId, attempts] of retryTracker.entries()) {
      for (const attempt of attempts) {
        if (attempt.originalToolCall.run_id === runId ||
            attempt.correctedToolCall?.run_id === runId) {
          return chainId;
        }
      }
    }
    // Check linked retries
    for (const [chainId, linkedRunIds] of chainLinks.entries()) {
      if (linkedRunIds.has(runId)) return chainId;
    }
    // New chain
    return runId;
  }

  private findExistingChainId(runId: string): string | null {
    for (const [chainId, attempts] of retryTracker.entries()) {
      for (const attempt of attempts) {
        if (attempt.originalToolCall.run_id === runId || attempt.correctedToolCall?.run_id === runId) {
          return chainId;
        }
      }
    }
    for (const [chainId, linkedRunIds] of chainLinks.entries()) {
      if (linkedRunIds.has(runId)) return chainId;
    }
    return null;
  }

  private linkRetryToChain(chainId: string, newRunId: string): void {
    const links = chainLinks.get(chainId) || new Set();
    links.add(newRunId);
    chainLinks.set(chainId, links);
  }

  private async recordRetryAttempt(chainId: string, attempt: RetryAttempt): Promise<void> {
    const attempts = retryTracker.get(chainId) || [];
    attempts.push(attempt);
    retryTracker.set(chainId, attempts);

    // Auto-cleanup: remove chains older than 1 hour
    if (retryTracker.size > 1000) {
      for (const [id] of retryTracker) {
        // Simple eviction — remove oldest entries
        if (retryTracker.size > 500) {
          retryTracker.delete(id);
          callSignatures.delete(id);
          chainLinks.delete(id);
        }
      }
    }
  }

  private async recordToolRetryInDb(params: {
    toolCallId: string;
    attempt: number;
    classification: ErrorClassification;
    errorDetail: string;
    originalParams: Record<string, unknown>;
    correctedParams: Record<string, unknown>;
    outcome: string;
    errorAnalysis?: string;
  }): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO tool_retries (id, tool_call_id, attempt, error_classification, error_detail,
                                   original_params, corrected_params, error_analysis, outcome, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          uuidv7(),
          params.toolCallId,
          params.attempt,
          params.classification,
          params.errorDetail,
          JSON.stringify(params.originalParams),
          JSON.stringify(params.correctedParams),
          params.errorAnalysis || null,
          params.outcome,
        ],
      );
    } catch (err) {
      // Best effort — don't fail the retry if audit logging fails
      logger.warn('Failed to record tool retry in DB', { err: String(err) });
    }
  }

  private async incrementMetric(metricKey: string): Promise<void> {
    try {
      const res = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
        [metricKey],
      );
      const current = res.rows.length > 0
        ? Number(parseSettingValue(res.rows[0].value) || 0)
        : 0;
      const next = Number.isFinite(current) ? current + 1 : 1;
      await this.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), 'system')
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'system'`,
        [metricKey, JSON.stringify(next)],
      );
    } catch (err) {
      logger.warn('Failed to increment self-correction metric', {
        metric: metricKey,
        err: String(err),
      });
    }
  }

  private async introducesDangerousTool(originalTool: string, correctedTool: string): Promise<boolean> {
    if (originalTool === correctedTool) return false;
    const [origDangerous, newDangerous] = await Promise.all([
      this.isDangerousTool(originalTool),
      this.isDangerousTool(correctedTool),
    ]);
    return !origDangerous && newDangerous;
  }

  private async isDangerousTool(toolName: string): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `SELECT permissions_required FROM tools WHERE name = $1 LIMIT 1`,
        [toolName],
      );
      if (res.rows.length === 0) return false;
      const perms = res.rows[0].permissions_required;
      const list = Array.isArray(perms) ? perms.map((p: unknown) => String(p || '')) : [];
      return list.some((p) => (
        p.includes('.write')
        || p.includes('.delete')
        || p.includes('exec')
        || p.includes('admin')
        || p.includes('secrets.read')
      ));
    } catch {
      return false;
    }
  }

  /**
   * Cleanup tracking state for completed chains (call periodically).
   */
  cleanup(): void {
    // Keep max 500 chains in memory
    if (retryTracker.size > 500) {
      const entries = Array.from(retryTracker.entries());
      const toRemove = entries.slice(0, entries.length - 500);
      for (const [id] of toRemove) {
        retryTracker.delete(id);
        callSignatures.delete(id);
        chainLinks.delete(id);
      }
    }
  }
}

/** Map chainId → set of run_ids that are retries within that chain */
const chainLinks = new Map<string, Set<string>>();
