import { connect, JSONCodec, consumerOpts, createInbox, NatsConnection } from 'nats';
import pg from 'pg';
import { createLogger, NATS_SUBJECTS, generateTaskId, PermissionHookManager, PromptGuard, QueryChain, CoordinatorSession, MemoryExtractor, AntiDistillation, BackgroundSessionManager, HeartbeatManager, PersonalityEngine, TokenBudgetTracker, FeatureFlagRegistry, ClientAttestor, type TranscriptMessage, type TokenUsage } from '@sven/shared';
import type { EventEnvelope, InboundMessageEvent, RuntimeDispatchEvent, ToolRunResultEvent } from '@sven/shared';
import { PolicyEngine } from './policy-engine.js';
import { LLMRouter } from './llm-router.js';
import { TriggerGate } from './trigger-gate.js';
import { PromptFirewall } from './prompt-firewall.js';
import { ApprovalManager } from './approval-manager.js';
import { CanvasEmitter } from './canvas-emitter.js';
import { SelfCorrectionEngine } from './self-correction.js';
import {
  getCompactionSummaryPrefix,
  getSessionResetMarker,
  handleChatCommand,
  consumeNextThinkLevel,
} from './chat-commands.js';
import { appendCitationsIfMissing, normalizeCitations, verifyCitations } from './citation-utils.js';
import { parseBooleanSetting, parseSettingValue } from './settings-utils.js';
import { isScopeAllowedForSubagent, resolveSubagentConfig } from './subagent-config.js';
import {
  buildDelayedRecallPrompt,
  selectDelayedRecallMemories,
  shouldEvaluateDelayedRecall,
} from './delayed-recall.js';
import { ProjectTreeContextCache } from './project-tree-context.js';
import { resolveMetricsBindHost, runtimeMetrics, startMetricsServer } from './metrics.js';
import { parseAllowedShortcutServices, parseVoiceShortcut } from './voice-shortcuts.js';
import { buildSessionStitchingPrompt } from './session-stitching.js';
import { normalizeToolRunId } from './tool-run-id.js';
import { normalizeToolCalls } from './tool-calls.js';
import { mapApprovalVoteErrorToUserMessage } from './approval-errors.js';
import { isMissingChatQueueDispatchError } from './queue-dispatch.js';
import { basename } from 'path';

const logger = createLogger('agent-runtime');
const jc = JSONCodec();
const projectTreeCache = new ProjectTreeContextCache();

async function main() {
  const runtimeAgentId = String(process.env.SVEN_AGENT_ID || '').trim() || null;
  const allowUnrouted = String(process.env.SVEN_AGENT_ALLOW_UNROUTED || '').trim().toLowerCase() === 'true';
  const metricsPort = Number(process.env.AGENT_RUNTIME_METRICS_PORT || 9100);
  const metricsHost = resolveMetricsBindHost(process.env);
  startMetricsServer(metricsPort, metricsHost);
  logger.info('Agent runtime metrics server listening', { host: metricsHost, port: metricsPort });
  // Connect to NATS
  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'agent-runtime',
    maxReconnectAttempts: -1,
  });
  logger.info('Connected to NATS');

  // Connect to Postgres
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 10,
  });
  logger.info('Connected to Postgres');

  // Initialize subsystems
  const policyEngine = new PolicyEngine(pool);
  const llmRouter = new LLMRouter(pool);
  const triggerGate = new TriggerGate(pool);
  const promptFirewall = new PromptFirewall(pool);
  const approvalManager = new ApprovalManager(pool, nc);
  const canvasEmitter = new CanvasEmitter(pool, nc);
  const selfCorrection = new SelfCorrectionEngine(pool, nc, llmRouter, canvasEmitter);

  // Initialize permission audit hook manager
  const permissionHooks = new PermissionHookManager({
    maxAuditEntries: 5_000,
    persistSync: false,
    persistFn: async (entry) => {
      try {
        await pool.query(
          `INSERT INTO config_change_audit (id, change_type, changed_by, old_value, new_value, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            entry.entryId,
            `tool.${entry.action}`,
            entry.subjectId,
            JSON.stringify({ resource: entry.resource }),
            JSON.stringify({ decision: entry.decision, decidedBy: entry.decidedBy }),
            JSON.stringify({ correlationId: entry.correlationId }),
          ],
        );
      } catch (err) {
        logger.warn('Failed to persist tool policy audit entry', { entryId: entry.entryId, err: String(err) });
      }
    },
  });
  permissionHooks.onDeny(async (entry) => {
    logger.warn('Tool execution denied by policy', {
      subjectId: entry.subjectId,
      resource: entry.resource,
      action: entry.action,
      decidedBy: entry.decidedBy,
      correlationId: entry.correlationId,
    });
  });

  // Initialize feature flag registry for centralized runtime gating
  const featureFlags = new FeatureFlagRegistry({ source: 'agent-runtime', warnOnStaleFlags: true });
  featureFlags.register({
    name: 'prompt-guard.enabled',
    type: 'boolean',
    value: false,
    description: 'Enable prompt injection detection on inbound messages',
    createdAt: '2026-04-06T00:00:00Z',
    cleanupBy: '2027-04-06T00:00:00Z',
    enabled: (process.env.FEATURE_PROMPT_GUARD_ENABLED || '').toLowerCase() === 'true',
  });
  featureFlags.register({
    name: 'memory-extractor.enabled',
    type: 'boolean',
    value: false,
    description: 'Enable background memory extraction and consolidation',
    createdAt: '2026-04-06T00:00:00Z',
    cleanupBy: '2027-04-06T00:00:00Z',
    enabled: (process.env.FEATURE_MEMORY_EXTRACTOR_ENABLED || '').toLowerCase() === 'true',
  });
  featureFlags.register({
    name: 'anti-distillation.enabled',
    type: 'boolean',
    value: false,
    description: 'Enable response watermarking for anti-distillation',
    createdAt: '2026-04-06T00:00:00Z',
    cleanupBy: '2027-04-06T00:00:00Z',
    enabled: (process.env.FEATURE_ANTI_DISTILLATION_ENABLED || '').toLowerCase() === 'true',
  });
  featureFlags.register({
    name: 'token-budget.enabled',
    type: 'boolean',
    value: false,
    description: 'Enable per-session token budget enforcement',
    createdAt: '2026-04-07T00:00:00Z',
    cleanupBy: '2027-04-07T00:00:00Z',
    enabled: (process.env.FEATURE_TOKEN_BUDGET_ENABLED || '').toLowerCase() === 'true',
  });
  featureFlags.register({
    name: 'client-attestation.enabled',
    type: 'boolean',
    value: false,
    description: 'Enable HMAC attestation on inter-service messages',
    createdAt: '2026-04-07T00:00:00Z',
    cleanupBy: '2027-04-07T00:00:00Z',
    enabled: (process.env.FEATURE_CLIENT_ATTESTATION_ENABLED || '').toLowerCase() === 'true',
  });
  logger.info('Feature flag registry initialized', { flags: featureFlags.getAllFlags().map(f => f.name) });

  // Initialize prompt guard (gated by feature flag via NATS config)
  const promptGuard = new PromptGuard({
    blockOnDetection: true,
    blockThreshold: 'medium',
  });
  const isPromptGuardEnabled = (): boolean => featureFlags.isEnabled('prompt-guard.enabled');

  // Initialize memory extractor for pattern-based long-term knowledge consolidation
  const memoryExtractor = new MemoryExtractor({
    minConfidence: 0.5,
    maxMemories: 500,
    decayRatePerDay: 0.01,
    reinforcementBoost: 0.15,
    similarityThreshold: 0.7,
  });
  const isMemoryExtractorEnabled = (): boolean => featureFlags.isEnabled('memory-extractor.enabled');
  logger.info('Memory extractor initialized', { enabled: isMemoryExtractorEnabled() });

  // Initialize anti-distillation for response watermarking (gated by feature flag)
  const antiDistillation = AntiDistillation.fromEnv('agent-runtime');
  const isAntiDistillationEnabled = (): boolean => featureFlags.isEnabled('anti-distillation.enabled');
  logger.info('Anti-distillation initialized', { enabled: isAntiDistillationEnabled() });

  // Initialize background session manager for long-running tasks (memory consolidation, etc.)
  const bgSessions = new BackgroundSessionManager({
    maxConcurrent: Number(process.env.BG_SESSION_MAX_CONCURRENT || 4),
    maxQueueSize: Number(process.env.BG_SESSION_MAX_QUEUE || 100),
    defaultTimeoutMs: Number(process.env.BG_SESSION_TIMEOUT_MS || 30 * 60 * 1000),
  });
  logger.info('Background session manager initialized', {
    maxConcurrent: Number(process.env.BG_SESSION_MAX_CONCURRENT || 4),
  });

  // Initialize heartbeat manager for NATS connection health monitoring
  const heartbeat = new HeartbeatManager(
    'nats',
    async () => !nc.isClosed(),
    async () => {
      logger.warn('Heartbeat triggered NATS reconnect — relying on NATS client auto-reconnect');
    },
    {
      intervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS || 30_000),
      maxFailures: Number(process.env.HEARTBEAT_MAX_FAILURES || 3),
    },
    (prev, next, status) => {
      logger.info('NATS connection state change', { from: prev, to: next, failures: status.consecutiveFailures });
    },
  );
  heartbeat.start();
  logger.info('Heartbeat manager started', { intervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS || 30_000) });

  // Initialize personality engine for buddy mood, greetings, XP, and achievements
  const personalityEngine = PersonalityEngine.fromEnv();
  logger.info('Personality engine initialized', { mode: personalityEngine.mode });

  // Initialize client attestation for inter-service HMAC verification
  let clientAttestor: ClientAttestor | null = null;
  const attestationSecret = process.env.SVEN_ATTESTATION_SECRET || '';
  if (featureFlags.isEnabled('client-attestation.enabled') && attestationSecret.length >= 32) {
    clientAttestor = new ClientAttestor({ secret: attestationSecret, serviceId: 'agent-runtime' });
    logger.info('Client attestation initialized', { serviceId: 'agent-runtime' });
  } else if (featureFlags.isEnabled('client-attestation.enabled')) {
    logger.warn('Client attestation enabled but SVEN_ATTESTATION_SECRET missing or too short (need ≥32 chars)');
  }

  // Per-session token budget trackers (keyed by chat_id)
  const sessionBudgets = new Map<string, TokenBudgetTracker>();
  const isTokenBudgetEnabled = (): boolean => featureFlags.isEnabled('token-budget.enabled');
  const getOrCreateBudget = (chatId: string): TokenBudgetTracker => {
    let tracker = sessionBudgets.get(chatId);
    if (!tracker) {
      tracker = new TokenBudgetTracker({
        maxTotalTokens: Number(process.env.TOKEN_BUDGET_MAX_TOKENS || 0),
        maxCostUsd: Number(process.env.TOKEN_BUDGET_MAX_COST_USD || 0),
        maxTurns: Number(process.env.TOKEN_BUDGET_MAX_TURNS || 50),
        compactThreshold: Number(process.env.TOKEN_BUDGET_COMPACT_THRESHOLD || 0.8),
        inputCostPer1M: Number(process.env.TOKEN_BUDGET_INPUT_COST_PER_1M || 3.0),
        outputCostPer1M: Number(process.env.TOKEN_BUDGET_OUTPUT_COST_PER_1M || 15.0),
      });
      sessionBudgets.set(chatId, tracker);
    }
    return tracker;
  };
  // Periodically clean up stale session budgets (sessions idle > 2h)
  const SESSION_BUDGET_TTL_MS = 2 * 60 * 60 * 1000;
  const sessionBudgetLastSeen = new Map<string, number>();
  setInterval(() => {
    const cutoff = Date.now() - SESSION_BUDGET_TTL_MS;
    for (const [chatId, lastSeen] of sessionBudgetLastSeen) {
      if (lastSeen < cutoff) {
        sessionBudgets.delete(chatId);
        sessionBudgetLastSeen.delete(chatId);
      }
    }
  }, 10 * 60 * 1000);

  const publishRuntimeDispatch = async (data: RuntimeDispatchEvent) => {
    const event: EventEnvelope<RuntimeDispatchEvent> = {
      schema_version: '1.0',
      event_id: generateTaskId('event_envelope'),
      occurred_at: new Date().toISOString(),
      data,
    };
    nc.publish(NATS_SUBJECTS.RUNTIME_DISPATCH, jc.encode(event));
  };

  // Load self-correction config from DB
  await selfCorrection.loadConfig();

  // Start approval expiration worker (checks every 30s)
  approvalManager.startExpirationWorker();

  // Start buddy digests scheduler (checks every 60s)
  startBuddyScheduler(pool, canvasEmitter, personalityEngine);
  startMemoryMaintenance(pool, memoryExtractor, isMemoryExtractorEnabled, bgSessions);

  // Periodic cleanup for self-correction tracking state
  setInterval(() => selfCorrection.cleanup(), 10 * 60 * 1000); // every 10 min

  // Periodic cleanup for inbound event dedup records (>24h old)
  setInterval(async () => {
    try {
      const result = await pool.query(
        "DELETE FROM processed_inbound_events WHERE processed_at < NOW() - INTERVAL '24 hours'",
      );
      if (result.rowCount && result.rowCount > 0) {
        logger.info('Cleaned up processed event dedup records', { deleted: result.rowCount });
      }
    } catch (err) {
      logger.warn('Failed to clean up processed event dedup records', { err: String(err) });
    }
  }, 30 * 60 * 1000); // every 30 min

  // Get JetStream
  const js = nc.jetstream();

  // Subscribe to inbound messages
  const opts = consumerOpts();
  opts.durable('agent-runtime');
  opts.deliverTo(createInbox());
  opts.manualAck();
  opts.ackExplicit();
  opts.ackWait(240_000);  // 4 min — must exceed LLM timeout (120s) + processing overhead
  opts.maxDeliver(5);     // prevent infinite redelivery on poison messages
  const sub = await js.subscribe('inbound.message.>', opts);

  // Subscribe to tool run results for self-correction
  const toolResultOpts = consumerOpts();
  toolResultOpts.durable('agent-runtime-tool-results');
  toolResultOpts.deliverTo(createInbox());
  toolResultOpts.manualAck();
  toolResultOpts.ackExplicit();
  const toolResultSub = await js.subscribe(NATS_SUBJECTS.TOOL_RUN_RESULT, toolResultOpts);

  // Process tool results for self-correction (non-blocking)
  (async () => {
    for await (const msg of toolResultSub) {
      try {
        const envelope = jc.decode(msg.data) as EventEnvelope<ToolRunResultEvent>;
        const result = envelope.data;
        runtimeMetrics.incToolResult(result.tool_name, result.status);

        // Only process errors/timeouts — skip success/running
        if (result.status === 'error' || result.status === 'timeout') {
          const handled = await selfCorrection.handleToolResult(result);
          if (handled) {
            logger.info('Self-correction handled tool failure', {
              run_id: result.run_id,
              tool: result.tool_name,
              status: result.status,
              correlation_id: result.correlation_id || envelope.event_id,
            });
          }
        }

        msg.ack();
      } catch (err) {
        logger.error('Error processing tool result for self-correction', { err: String(err) });
        msg.ack(); // Ack anyway to not block the stream
      }
    }
  })();

  logger.info('Subscribed to inbound messages, processing...');

  for await (const msg of sub) {
    try {
      const envelope = jc.decode(msg.data) as EventEnvelope<InboundMessageEvent>;
      const event = envelope.data;
      const correlationId = extractCorrelationId(event.metadata, envelope.event_id);
      if (!(await doesChatExist(pool, event.chat_id))) {
        const deadLettered = await deadLetterQueuedMessagesForChat(
          pool,
          event.chat_id,
          new Error(`inbound event dropped because chat ${event.chat_id} no longer exists`),
        );
        logger.warn('Dropping inbound event for deleted chat', {
          chat_id: event.chat_id,
          event_id: envelope.event_id,
          correlation_id: correlationId,
          dead_lettered: deadLettered,
        });
        msg.ack();
        continue;
      }
      if (await isAgentPaused(pool, event.chat_id)) {
        logger.info('Chat is paused; deferring message', {
          chat_id: event.chat_id,
          event_id: envelope.event_id,
          correlation_id: correlationId,
        });
        await markChatProcessing(pool, event.chat_id, false);
        msg.nak(5000);
        continue;
      }
      // Dedup: skip if this inbound event was already fully processed (NATS replay protection)
      const alreadyProcessed = await pool.query(
        'SELECT 1 FROM processed_inbound_events WHERE event_id = $1',
        [envelope.event_id],
      );
      if (alreadyProcessed.rows.length > 0) {
        logger.info('Skipping replayed event (already processed)', {
          event_id: envelope.event_id,
          chat_id: event.chat_id,
          correlation_id: correlationId,
        });
        msg.ack();
        continue;
      }

      await markChatProcessing(pool, event.chat_id, true);
      const turnNudgeNonce = await getNudgeNonce(pool, event.chat_id);
      const routedAgentId =
        (event.metadata?.agent_id ? String(event.metadata.agent_id) : '');
      if (runtimeAgentId) {
        if (!routedAgentId && !allowUnrouted) {
          logger.info('Skipping unrouted message for agent runtime', {
            event_id: envelope.event_id,
            channel: event.channel,
            chat_id: event.chat_id,
            correlation_id: correlationId,
          });
          msg.ack();
          continue;
        }
        if (routedAgentId && routedAgentId !== runtimeAgentId) {
          logger.info('Skipping message routed to different agent', {
            event_id: envelope.event_id,
            channel: event.channel,
            chat_id: event.chat_id,
            routed_agent_id: routedAgentId,
            correlation_id: correlationId,
          });
          msg.ack();
          continue;
        }
      }

      logger.info('Processing inbound message', {
        event_id: envelope.event_id,
        channel: event.channel,
        chat_id: event.chat_id,
        correlation_id: correlationId,
      });

      // 1. Trigger gate – should we respond?
      const triggerDecision = await triggerGate.evaluate(event);
      if (!triggerDecision.allow) {
        logger.info('Trigger gate: skipping message', {
          chat_id: event.chat_id,
          reason: triggerDecision.reason,
          channel: event.channel,
        });
        if (triggerDecision.userMessage) {
          await canvasEmitter.emit({
            chat_id: event.chat_id,
            channel: event.channel,
            text: triggerDecision.userMessage,
          });
        }
        msg.ack();
        continue;
      }

      // 2. Check incident mode
      const incidentMode = await getIncidentMode(pool);
      if (incidentMode === 'kill_switch') {
        logger.warn('Kill switch active – blocking all processing');
        msg.ack();
        continue;
      }
      if (incidentMode === 'forensics') {
        logger.warn('Forensics mode – read-only, no tool calls');
        // Continue to chat but block tool execution below
      }

      // 3. Load context (chat history, memory, identity doc)
      let context = await loadContext(pool, event.chat_id, event.sender_identity_id);
      const chatType = await getChatType(pool, event.chat_id);
      const buddySettings = await getBuddySettings(pool);
      const buddyEnabled = buddySettings.enabled && chatType === 'hq';

      const approvalHandled = await handleApprovalCommand(
        pool,
        approvalManager,
        canvasEmitter,
        event,
        context.user_id,
      );
      if (approvalHandled) {
        msg.ack();
        continue;
      }

      const chatCommandHandled = await handleChatCommand({
        pool,
        canvasEmitter,
        event,
        userId: context.user_id,
        publishInbound: async (inboundEvent) => {
          nc.publish(
            NATS_SUBJECTS.INBOUND_MESSAGE,
            jc.encode({
              schema_version: '1.0',
              event_id: generateTaskId('event_envelope'),
              occurred_at: new Date().toISOString(),
              data: inboundEvent,
            }),
          );
        },
        publishWorkflowExecute: async (runId) => {
          const dispatchEvent: RuntimeDispatchEvent = {
            kind: 'workflow.execute',
            run_id: runId,
            chat_id: event.chat_id,
            user_id: context.user_id,
          };
          if (event.channel === 'internal') {
            dispatchEvent.trigger = 'hq';
          }
          await publishRuntimeDispatch(dispatchEvent);
        },
      });
      if (chatCommandHandled) {
        msg.ack();
        continue;
      }

      const voiceShortcutHandled = await maybeHandleVoiceShortcut({
        pool,
        nc,
        policyEngine,
        approvalManager,
        canvasEmitter,
        event,
        userId: context.user_id,
        correlationId,
      });
      if (voiceShortcutHandled) {
        msg.ack();
        continue;
      }

      const selfChatEnabled = await getChatSelfChatEnabled(pool, event.chat_id);
      const selfChatTurn = getSelfChatTurn(event.metadata);
      const selfChatMaxTurns = Math.min(50, Math.max(1, await getNumberSetting(pool, 'chat.selfchat.max_turns', 2)));

      await extractLongTermMemories(pool, event.chat_id, context.user_id, event.text || '', memoryExtractor, isMemoryExtractorEnabled());

      if (buddyEnabled && isImproveYourselfRequest(event.text || '')) {
        const improvementId = await createImprovementItem(pool, {
          title: 'Improve yourself',
          description: event.text || '',
          evidence: {
            chat_id: event.chat_id,
            channel: event.channel,
            channel_message_id: event.channel_message_id,
            sender_identity_id: event.sender_identity_id,
          },
        });

        await canvasEmitter.emit({
          chat_id: event.chat_id,
          channel: event.channel,
          text: `Logged improvement item ${improvementId}. I will review and propose updates.`,
        });

        msg.ack();
        continue;
      }

      let systemPrompt = context.systemPrompt;
      const delayedRecallPrompt = await maybeBuildDelayedRecallPrompt(
        pool,
        event.chat_id,
        context.messages,
        context.memories,
      );
      if (delayedRecallPrompt) {
        systemPrompt = `${systemPrompt}\n\n${delayedRecallPrompt}`;
      }
      const projectTreePrompt = await maybeBuildProjectTreePrompt(pool, event.chat_id);
      if (projectTreePrompt) {
        systemPrompt = `${systemPrompt}\n\n${projectTreePrompt}`;
      }
      const effectiveAgentId = routedAgentId || runtimeAgentId;
      const agentConfig = effectiveAgentId
        ? await resolveSubagentConfig(pool, event.chat_id, effectiveAgentId)
        : null;
      const routedSubagentPolicyResolutionFailed = Boolean(
        routedAgentId && agentConfig?.resolution_error,
      );
      if (routedSubagentPolicyResolutionFailed) {
        logger.warn('Subagent policy resolution failed; tool execution will be blocked for this routed turn', {
          chat_id: event.chat_id,
          routed_agent_id: routedAgentId,
          err: agentConfig?.resolution_error,
        });
      }
      if (agentConfig?.system_prompt) {
        systemPrompt = `${agentConfig.system_prompt}\n\n${systemPrompt}`;
      }
      const defaultThinkLevel = await getSettingValue(pool, 'chat.think.default');
      if (buddyEnabled && isProactivityEnabled(buddySettings.proactivity)) {
        systemPrompt = `${systemPrompt}\n\nIf the request is ambiguous, ask a brief clarifying question before taking action.`;
      }
      if (context.sessionSettings.verbose) {
        systemPrompt = `${systemPrompt}\n\nRespond with additional implementation detail, tradeoffs, and explicit steps.`;
      }
      const nextThinkLevel = consumeNextThinkLevel(event.chat_id);
      const effectiveThinkLevel =
        nextThinkLevel || context.sessionSettings.think_level || defaultThinkLevel || null;
      if (effectiveThinkLevel) {
        const thinkLevel = String(effectiveThinkLevel).toLowerCase();
        if (thinkLevel === 'off') {
          systemPrompt = `${systemPrompt}\n\nKeep reasoning concise and avoid long internal deliberation output.`;
        } else if (thinkLevel === 'high') {
          systemPrompt = `${systemPrompt}\n\nUse deeper reasoning and double-check assumptions before answering.`;
        } else {
          systemPrompt = `${systemPrompt}\n\nReasoning depth preference: ${thinkLevel}.`;
        }
      }
      if (context.sessionSettings.rag_enabled === false) {
        systemPrompt = `${systemPrompt}\n\nDo not rely on retrieval context or citations for this session unless explicitly requested by the user.`;
      }
      const availableToolsPrompt = await buildAvailableToolsPrompt(pool, event.chat_id);
      if (availableToolsPrompt) {
        systemPrompt = `${systemPrompt}\n\n${availableToolsPrompt}`;
      }
      const deviceContextPrompt = await buildDeviceContextPrompt(pool, event.chat_id);
      if (deviceContextPrompt) {
        systemPrompt = `${systemPrompt}\n\n${deviceContextPrompt}`;
      }
      const emotionToneHint = await buildEmotionToneHint(pool, event.metadata);
      if (emotionToneHint) {
        systemPrompt = `${systemPrompt}\n\n${emotionToneHint}`;
      }
      const voiceLanguageHint = await buildVoiceLanguageHint(pool, event);
      if (voiceLanguageHint) {
        systemPrompt = `${systemPrompt}\n\n${voiceLanguageHint}`;
      }
      // Cap system prompt length to prevent unbounded memory growth from concatenated context
      const MAX_SYSTEM_PROMPT_LENGTH = 500_000;
      if (systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        logger.warn('System prompt truncated', { chat_id: event.chat_id, original_length: systemPrompt.length });
        systemPrompt = systemPrompt.slice(0, MAX_SYSTEM_PROMPT_LENGTH);
      }
      const promptDriftDetected = await promptFirewall.checkSystemPromptDrift(
        context.systemPrompt,
      );
      if (promptDriftDetected) {
        logger.error('System prompt drift detected; tool calls will be blocked', {
          chat_id: event.chat_id,
        });
      }

      const autoCompaction = await maybeAutoCompactSession(pool, event.chat_id, context.user_id, context.messages);
      if (autoCompaction.compacted) {
        logger.info('Auto compaction applied before LLM routing', {
          chat_id: event.chat_id,
          before_tokens: autoCompaction.beforeTokens,
          after_tokens: autoCompaction.afterTokens,
        });
        context = await loadContext(pool, event.chat_id, event.sender_identity_id);
      }

      // Prompt guard: scan user input for injection/extraction attempts
      if (isPromptGuardEnabled() && event.text) {
        const inputScan = promptGuard.scanInput(event.text);
        if (inputScan.blocked) {
          logger.error('Prompt guard blocked input', {
            chat_id: event.chat_id,
            user_id: context.user_id,
            pattern: inputScan.patternName,
            severity: inputScan.severity,
            correlation_id: correlationId,
          });
          await canvasEmitter.emit({
            chat_id: event.chat_id,
            channel: event.channel,
            text: 'I detected a prompt that appears to be attempting to manipulate my instructions. This request has been blocked for security.',
            blocks: [],
            tool_calls: [],
            citations: [],
            metadata: { correlation_id: correlationId },
          });
          await markChatProcessing(pool, event.chat_id, false);
          msg.ack();
          continue;
        }
      }
      // Register system prompt for leakage detection
      if (isPromptGuardEnabled()) {
        promptGuard.registerProtectedContent(systemPrompt, `system-prompt-${event.chat_id}`);
      }

      // Initialize query chain depth tracking for this agent turn
      const queryChain = new QueryChain(
        { maxDepth: 10, maxBreadth: 50, maxDurationMs: 300_000 },
      );
      const chainAccepted = queryChain.push('llm_call', {
        chat_id: event.chat_id,
        model: context.sessionSettings.model_name || 'default',
        correlation_id: correlationId,
      });
      if (!chainAccepted) {
        logger.error('Query chain rejected LLM call — circuit breaker tripped', {
          chat_id: event.chat_id,
          reason: queryChain.getCircuitBrokenReason(),
          correlation_id: correlationId,
        });
        await canvasEmitter.emit({
          chat_id: event.chat_id,
          channel: event.channel,
          text: 'This request exceeded the processing depth limit. Please try a simpler request.',
          blocks: [],
          tool_calls: [],
          citations: [],
          metadata: { correlation_id: correlationId },
        });
        await markChatProcessing(pool, event.chat_id, false);
        msg.ack();
        continue;
      }

      // 4. Token budget pre-check — reject if session has exceeded budget
      if (isTokenBudgetEnabled()) {
        sessionBudgetLastSeen.set(event.chat_id, Date.now());
        const budget = getOrCreateBudget(event.chat_id);
        const preStatus = budget.getStatus();
        if (preStatus.anyBudgetExceeded) {
          logger.warn('Token budget exceeded — blocking LLM call', {
            chat_id: event.chat_id,
            totalTokens: preStatus.totalTokens,
            totalCostUsd: preStatus.totalCostUsd.toFixed(4),
            turnCount: preStatus.turnCount,
            correlation_id: correlationId,
          });
          await canvasEmitter.emit({
            chat_id: event.chat_id,
            channel: event.channel,
            text: 'This session has exceeded its token budget. Please start a new conversation or contact your administrator.',
            blocks: [],
            tool_calls: [],
            citations: [],
            metadata: { correlation_id: correlationId },
          });
          await markChatProcessing(pool, event.chat_id, false);
          msg.ack();
          continue;
        }
      }

      // 5. Route to LLM
      msg.working(); // extend NATS ack deadline — LLM calls can take 30-120s+
      const llmStartedAt = Date.now();
      const llmResponse = await llmRouter.complete({
        messages: context.messages,
        systemPrompt,
        user_id: context.user_id,
        chat_id: event.chat_id,
        agent_id: routedAgentId || undefined,
        model_override: context.sessionSettings.model_name || agentConfig?.model_name || undefined,
        profile_override: context.sessionSettings.profile_name || agentConfig?.profile_name || undefined,
        think_level: effectiveThinkLevel || undefined,
      });
      runtimeMetrics.observeLlm(
        Date.now() - llmStartedAt,
        Number(llmResponse.tokens_used?.prompt || 0),
        Number(llmResponse.tokens_used?.completion || 0),
      );
      await recordLlmAudit(
        pool,
        event.chat_id,
        context.user_id,
        llmResponse.model_used || context.sessionSettings.model_name || 'unknown',
        effectiveThinkLevel,
        llmResponse.tokens_used?.prompt || 0,
        llmResponse.tokens_used?.completion || 0,
      );
      await recordSessionTokenUsage(
        pool,
        event.chat_id,
        llmResponse.model_used || context.sessionSettings.model_name || null,
        Number(llmResponse.tokens_used?.prompt || 0),
        Number(llmResponse.tokens_used?.completion || 0),
      );

      // Record token usage in session budget tracker
      if (isTokenBudgetEnabled()) {
        const budget = getOrCreateBudget(event.chat_id);
        const budgetStatus = budget.recordUsage({
          prompt_tokens: Number(llmResponse.tokens_used?.prompt || 0),
          completion_tokens: Number(llmResponse.tokens_used?.completion || 0),
          total_tokens: Number(llmResponse.tokens_used?.prompt || 0) + Number(llmResponse.tokens_used?.completion || 0),
        });
        if (budgetStatus.shouldCompact) {
          logger.info('Token budget compact threshold reached', {
            chat_id: event.chat_id,
            totalTokens: budgetStatus.totalTokens,
            remainingTokens: budgetStatus.remainingTokens,
            correlation_id: correlationId,
          });
        }
        if (budgetStatus.anyBudgetExceeded) {
          logger.warn('Token budget exceeded after this turn', {
            chat_id: event.chat_id,
            totalTokens: budgetStatus.totalTokens,
            totalCostUsd: budgetStatus.totalCostUsd.toFixed(4),
            turnCount: budgetStatus.turnCount,
            correlation_id: correlationId,
          });
        }
      }

      // 5. Prompt firewall – validate tool calls
      if (promptDriftDetected && llmResponse.tool_calls) {
        llmResponse.tool_calls = [];
      }
      const normalizedToolCalls = normalizeToolCalls(llmResponse.tool_calls);
      if (normalizedToolCalls.droppedCount > 0) {
        logger.warn('Dropped malformed tool call entries from LLM response', {
          dropped_count: normalizedToolCalls.droppedCount,
          received_kind: Array.isArray(llmResponse.tool_calls) ? 'array' : typeof llmResponse.tool_calls,
        });
      }
      llmResponse.tool_calls = normalizedToolCalls.toolCalls;

      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
        if (await hasNudgeAdvanced(pool, event.chat_id, turnNudgeNonce)) {
          logger.info('Nudge detected after LLM call; skipping stale tool execution', {
            chat_id: event.chat_id,
            event_id: envelope.event_id,
          });
          llmResponse.tool_calls = [];
        }
        if (incidentMode === 'forensics') {
          logger.warn('Forensics mode: blocking tool calls');
          llmResponse.tool_calls = [];
        } else {
          for (const toolCall of llmResponse.tool_calls) {
            const firewallResult = await promptFirewall.validate(toolCall, event, context.user_id);
            if (!firewallResult.allowed) {
              logger.warn('Prompt firewall blocked tool call', {
                tool: toolCall.name,
                reason: firewallResult.reason,
              });
              toolCall.blocked = true;
              toolCall.block_reason = firewallResult.reason;
            }
          }
        }

        // 6. Policy engine – check each tool call
        for (const toolCall of llmResponse.tool_calls) {
          if (toolCall.blocked) continue;
          if (routedSubagentPolicyResolutionFailed) {
            toolCall.blocked = true;
            toolCall.block_reason = 'Subagent policy resolution failed; blocking tool execution';
            continue;
          }
          if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {
            toolCall.blocked = true;
            toolCall.block_reason = `Subagent policy scope denied "${toolCall.scope}"`;
            continue;
          }

          const decision = await policyEngine.evaluateToolCall({
            scope: toolCall.scope,
            tool_name: toolCall.name,
            user_id: context.user_id,
            chat_id: event.chat_id,
            inputs: toolCall.inputs,
            provider_name: llmResponse.provider_used || undefined,
            model_name: llmResponse.model_used || undefined,
          });

          // Record permission audit trail via hook manager
          await permissionHooks.executeWithHooks(
            {
              subjectId: context.user_id,
              resource: `tool.${toolCall.name}`,
              action: 'execute',
              correlationId,
              metadata: { chat_id: event.chat_id, scope: toolCall.scope },
            },
            async () => ({
              decision: decision.allowed ? 'allow' : 'deny',
              decidedBy: decision.reason || 'policy-engine',
            }),
          );

          if (!decision.allowed) {
            if (decision.requires_approval) {
              // Create approval
              const approvalId = await approvalManager.createApproval({
                chat_id: event.chat_id,
                tool_name: toolCall.name,
                scope: toolCall.scope || `tool.${toolCall.name}`,
                requester_user_id: context.user_id,
                quorum_required: decision.approval_quorum || 1,
                expires_in_ms: decision.approval_expires_in_ms,
                details: { inputs: toolCall.inputs },
              });
              toolCall.pending_approval = true;
              toolCall.approval_id = approvalId;
            } else {
              toolCall.blocked = true;
              toolCall.block_reason = decision.reason;
            }
          }
        }

        // 7. Execute approved tool calls
        const approvedCalls = llmResponse.tool_calls.filter(
          (tc: any) => !tc.blocked && !tc.pending_approval,
        );
        // Track tool calls in query chain for depth/breadth limiting
        for (const toolCall of approvedCalls) {
          const toolAccepted = queryChain.push('tool_call', {
            tool_name: toolCall.name,
            chat_id: event.chat_id,
          });
          if (!toolAccepted) {
            logger.warn('Query chain rejected tool call — depth/breadth limit hit', {
              chat_id: event.chat_id,
              tool_name: toolCall.name,
              chain_status: queryChain.getStatus(),
              correlation_id: correlationId,
            });
            break;
          }
          runtimeMetrics.incToolCall(toolCall.name);
          const toolRunId = normalizeToolRunId(toolCall.run_id);
          // Publish tool run request to NATS
          nc.publish(
            NATS_SUBJECTS.TOOL_RUN_REQUEST,
            jc.encode({
              schema_version: '1.0',
              event_id: toolRunId,
              occurred_at: new Date().toISOString(),
              data: {
                run_id: toolRunId,
                correlation_id: correlationId,
                tool_name: toolCall.name,
                chat_id: event.chat_id,
                user_id: context.user_id,
                approval_id: toolCall.approval_id,
                inputs: toolCall.inputs,
                justification: toolCall.justification || {},
              },
            }),
          );
          queryChain.pop();
        }

        // Check for circular patterns in tool call chains
        const circularPattern = queryChain.detectCircularPattern(3);
        if (circularPattern) {
          logger.warn('Circular tool call pattern detected', {
            chat_id: event.chat_id,
            pattern: circularPattern,
            correlation_id: correlationId,
          });
        }
      }

      if (context.sessionSettings.rag_enabled === false) {
        llmResponse.citations = [];
      }
      const citations = normalizeCitations(llmResponse.citations);
      if (citations.length > 0) {
        llmResponse.text = appendCitationsIfMissing(llmResponse.text, citations);
      }
      const citationCheck = verifyCitations(llmResponse.text, citations);
      if (!citationCheck.ok) {
        llmResponse.text = citationCheck.rewrite;
        llmResponse.blocks = [];
      }

      if (context.sessionSettings.usage_mode === 'tokens') {
        llmResponse.text = `${llmResponse.text}\n\n_tokens: prompt=${llmResponse.tokens_used.prompt}, completion=${llmResponse.tokens_used.completion}_`;
      } else if (context.sessionSettings.usage_mode === 'full') {
        llmResponse.text = [
          llmResponse.text,
          '',
          `_model: ${llmResponse.model_used}_`,
          `_tokens: prompt=${llmResponse.tokens_used.prompt}, completion=${llmResponse.tokens_used.completion}_`,
        ].join('\n');
      }

      if (await hasNudgeAdvanced(pool, event.chat_id, turnNudgeNonce)) {
        logger.info('Nudge detected; dropping stale assistant output', {
          chat_id: event.chat_id,
          event_id: envelope.event_id,
          correlation_id: correlationId,
        });
        await markChatProcessing(pool, event.chat_id, false);
        if (!(await isAgentPaused(pool, event.chat_id))) {
          await dispatchNextQueuedCanvasMessage(pool, nc, event.chat_id);
        }
        msg.ack();
        continue;
      }

      // 8. Prompt guard: scan output for system prompt leakage
      if (isPromptGuardEnabled() && llmResponse.text) {
        const outputScan = promptGuard.scanOutput(llmResponse.text);
        if (outputScan.blocked) {
          logger.error('Prompt guard blocked output — system prompt leakage detected', {
            chat_id: event.chat_id,
            user_id: context.user_id,
            pattern: outputScan.patternName,
            severity: outputScan.severity,
            correlation_id: correlationId,
          });
          llmResponse.text = 'I\'m unable to provide that response. The output was blocked by our security system.';
        }
      }

      // 9. Anti-distillation: watermark response before emitting
      if (isAntiDistillationEnabled() && llmResponse.text) {
        llmResponse.text = antiDistillation.watermark(llmResponse.text);
      }

      // 10. Emit canvas blocks + outbox message
      await canvasEmitter.emit({
        chat_id: event.chat_id,
        channel: event.channel,
        text: llmResponse.text,
        blocks: llmResponse.blocks,
        tool_calls: llmResponse.tool_calls,
        citations,
        metadata: {
          correlation_id: correlationId,
        },
      });
      try {
        await maybeIndexSessionTranscript(pool, event.chat_id, context.user_id);
      } catch (err) {
        logger.warn('Post-response session transcript indexing skipped', {
          chat_id: event.chat_id,
          err: String(err),
        });
      }

      if (selfChatEnabled && llmResponse.text && selfChatTurn < selfChatMaxTurns) {
        nc.publish(
          NATS_SUBJECTS.INBOUND_MESSAGE,
          jc.encode({
            schema_version: '1.0',
            event_id: generateTaskId('event_envelope'),
            occurred_at: new Date().toISOString(),
            data: {
              channel: event.channel,
              channel_message_id: `selfchat-${Date.now()}`,
              chat_id: event.chat_id,
              sender_identity_id: event.sender_identity_id,
              content_type: 'text',
              text: llmResponse.text,
              metadata: {
                ...(event.metadata || {}),
                selfchat: true,
                selfchat_turn: selfChatTurn + 1,
                selfchat_origin_message_id: event.channel_message_id,
              },
            },
          }),
        );
      }

      // Finalize query chain tracking for this turn
      queryChain.pop(); // Pop the LLM call
      const chainStatus = queryChain.getStatus();
      if (chainStatus.totalOperations > 1) {
        logger.info('Query chain turn summary', {
          chain_id: chainStatus.chainId,
          chat_id: event.chat_id,
          total_operations: chainStatus.totalOperations,
          max_depth_reached: queryChain.getMaxDepthReached(),
          duration_ms: chainStatus.durationMs,
          circuit_broken: chainStatus.isCircuitBroken,
          correlation_id: correlationId,
        });
      }

      // Record event as processed for dedup (before ack — survives crash between emit and ack)
      await pool.query(
        'INSERT INTO processed_inbound_events (event_id, chat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [envelope.event_id, event.chat_id],
      );

      await markChatProcessing(pool, event.chat_id, false);
      if (!(await isAgentPaused(pool, event.chat_id))) {
        await dispatchNextQueuedCanvasMessage(pool, nc, event.chat_id);
      } else {
        logger.info('Chat paused after processing; skipping queued dispatch', {
          chat_id: event.chat_id,
          correlation_id: correlationId,
        });
      }
      msg.ack();
    } catch (err) {
      logger.error('Error processing message', { err: String(err) });
      try {
        const envelope = jc.decode(msg.data) as EventEnvelope<InboundMessageEvent>;
        const event = envelope.data;
        if (event?.chat_id) {
          await markChatProcessing(pool, event.chat_id, false);
          if (isInferenceUnavailableError(err)) {
            const deadLettered = await deadLetterQueuedMessagesForChat(pool, event.chat_id, err);
            logger.warn('Inference backend unavailable; dead-lettered queued chat work', {
              chat_id: event.chat_id,
              dead_lettered: deadLettered,
              channel: event.channel,
            });
            await canvasEmitter.emit({
              chat_id: event.chat_id,
              channel: event.channel,
              text:
                'Sven could not generate a reply because no reachable inference backend is configured for this deployment. Configure Ollama on localhost:11434 or enable a reachable LiteLLM/OpenAI-compatible endpoint, then resend the message.',
            });
            msg.ack();
            continue;
          }
          if (!(await isAgentPaused(pool, event.chat_id))) {
            await dispatchNextQueuedCanvasMessage(pool, nc, event.chat_id);
          }
        }
      } catch {
        // ignore decode issues while handling error path
      }
      // NAK with delay for retry
      msg.nak(5000);
    }
  }
}

async function markChatProcessing(pool: pg.Pool, chatId: string, processing: boolean): Promise<void> {
  if (!chatId) return;
  try {
    await pool.query(
      `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (chat_id) DO UPDATE
       SET is_processing = EXCLUDED.is_processing, updated_at = NOW()`,
      [chatId, processing],
    );
  } catch (err) {
    const code = String((err as { code?: string })?.code || '');
    if (isMissingChatQueueDispatchError(err)) return;
    if (code !== '42P01' && code !== '42703') throw err;
  }
}

async function doesChatExist(pool: pg.Pool, chatId: string): Promise<boolean> {
  if (!chatId) return false;
  const res = await pool.query(
    `SELECT 1
     FROM chats
     WHERE id = $1
     LIMIT 1`,
    [chatId],
  );
  return res.rows.length > 0;
}

async function isAgentPaused(pool: pg.Pool, chatId: string): Promise<boolean> {
  if (!chatId) return false;
  try {
    const res = await pool.query(
      `SELECT agent_paused
       FROM session_settings
       WHERE session_id = $1
       LIMIT 1`,
      [chatId],
    );
    return Boolean(res.rows[0]?.agent_paused);
  } catch (err) {
    const code = String((err as { code?: string })?.code || '');
    if (code === '42P01' || code === '42703') return false;
    throw err;
  }
}

async function getNudgeNonce(pool: pg.Pool, chatId: string): Promise<number> {
  if (!chatId) return 0;
  try {
    const res = await pool.query(
      `SELECT nudge_nonce
       FROM session_settings
       WHERE session_id = $1
       LIMIT 1`,
      [chatId],
    );
    return Number(res.rows[0]?.nudge_nonce || 0);
  } catch (err) {
    const code = String((err as { code?: string })?.code || '');
    if (code === '42P01' || code === '42703') return 0;
    throw err;
  }
}

async function hasNudgeAdvanced(pool: pg.Pool, chatId: string, baseline: number): Promise<boolean> {
  const current = await getNudgeNonce(pool, chatId);
  return current > baseline;
}

async function pruneExpiredQueuedMessages(pool: pg.Pool, chatId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE chat_message_queue
       SET status = 'expired'
       WHERE chat_id = $1
         AND status IN ('queued', 'failed', 'dispatching')
         AND expires_at <= NOW()`,
      [chatId],
    );
  } catch (err) {
    const code = String((err as { code?: string })?.code || '');
    if (code !== '42P01' && code !== '42703') throw err;
  }
}

function sanitizeQueueDispatchError(err: unknown): string {
  const raw = String((err as Error)?.message || err || 'dispatch_failed').trim();
  if (!raw) return 'dispatch_failed';
  return raw.slice(0, 1000);
}

function isInferenceUnavailableError(err: unknown): boolean {
  const raw = String((err as Error)?.message || err || '').trim().toLowerCase();
  if (!raw) return false;
  return (
    raw.includes('fetch failed') ||
    raw.includes('econnrefused') ||
    raw.includes('enotfound') ||
    raw.includes('litellm') ||
    raw.includes('ollama')
  );
}

function computeQueueRetryDelaySeconds(attempt: number): number {
  const base = Math.max(1, Number(process.env.CHAT_QUEUE_RETRY_BASE_SEC || 5));
  const cappedAttempt = Math.max(1, Math.min(10, attempt));
  const delay = base * Math.pow(2, cappedAttempt - 1);
  return Math.min(300, Math.floor(delay));
}

function getQueueMaxDispatchAttempts(): number {
  return Math.max(1, Number(process.env.CHAT_QUEUE_MAX_DISPATCH_ATTEMPTS || 5));
}

async function markQueueDispatchFailure(
  pool: pg.Pool,
  queueId: string,
  attemptCount: number,
  err: unknown,
): Promise<void> {
  const message = sanitizeQueueDispatchError(err);
  const maxAttempts = getQueueMaxDispatchAttempts();
  const status = attemptCount >= maxAttempts ? 'dead_letter' : 'failed';
  const retryDelaySec = computeQueueRetryDelaySeconds(attemptCount);
  try {
    await pool.query(
      `UPDATE chat_message_queue
       SET status = $2,
           last_error = $3,
           next_retry_at = CASE WHEN $2 = 'failed' THEN NOW() + ($4 * INTERVAL '1 second') ELSE NULL END,
           dead_lettered_at = CASE WHEN $2 = 'dead_letter' THEN NOW() ELSE dead_lettered_at END
       WHERE id = $1`,
      [queueId, status, message, retryDelaySec],
    );
  } catch (updateErr) {
    const code = String((updateErr as { code?: string })?.code || '');
    if (code !== '42P01' && code !== '42703') {
      logger.error('Failed to mark queue dispatch failure state', {
        queue_id: queueId,
        error: String(updateErr),
      });
    }
  }
}

async function deadLetterQueuedMessagesForChat(
  pool: pg.Pool,
  chatId: string,
  err: unknown,
): Promise<number> {
  const message = sanitizeQueueDispatchError(err);
  try {
    const res = await pool.query(
      `UPDATE chat_message_queue
       SET status = 'dead_letter',
           last_error = $2,
           next_retry_at = NULL,
           dead_lettered_at = NOW()
       WHERE chat_id = $1
         AND status IN ('queued', 'failed', 'dispatching')`,
      [chatId, message],
    );
    return Number(res.rowCount || 0);
  } catch (updateErr) {
    const code = String((updateErr as { code?: string })?.code || '');
    if (code === '42P01' || code === '42703') return 0;
    throw updateErr;
  }
}

async function dispatchNextQueuedCanvasMessage(
  pool: pg.Pool,
  nc: NatsConnection,
  chatId: string,
): Promise<void> {
  if (!chatId) return;
  const client = await pool.connect();
  let queueId: string | null = null;
  let attemptCount = 0;
  try {
    await pruneExpiredQueuedMessages(pool, chatId);
    if (!(await doesChatExist(pool, chatId))) {
      const deadLettered = await deadLetterQueuedMessagesForChat(
        pool,
        chatId,
        new Error(`queued chat ${chatId} no longer exists`),
      );
      if (deadLettered > 0) {
        logger.warn('Dead-lettered queued messages for deleted chat', {
          chat_id: chatId,
          dead_lettered: deadLettered,
        });
      }
      return;
    }
    await client.query('BEGIN');
    const queued = await client.query(
      `SELECT id, user_id, text, attempt_count
       FROM chat_message_queue
       WHERE chat_id = $1
         AND status IN ('queued', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY created_at ASC, id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [chatId],
    );
    if (queued.rows.length === 0) {
      await client.query('COMMIT');
      return;
    }

    queueId = String(queued.rows[0].id);
    const userId = String(queued.rows[0].user_id);
    const text = String(queued.rows[0].text || '');
    attemptCount = Number(queued.rows[0].attempt_count || 0) + 1;

    await client.query(
      `UPDATE chat_message_queue
       SET status = 'dispatching',
           attempt_count = attempt_count + 1,
           last_error = NULL,
           next_retry_at = NULL
       WHERE id = $1`,
      [queueId],
    );

    let identityId = '';
    const identityRes = await client.query(
      `SELECT id FROM identities WHERE channel = 'canvas' AND channel_user_id = $1 LIMIT 1`,
      [userId],
    );
    if (identityRes.rows.length > 0) {
      identityId = String(identityRes.rows[0].id);
    } else {
      identityId = generateTaskId('identity');
      await client.query(
        `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
         VALUES ($1, $2, 'canvas', $3, $4, NOW())`,
        [identityId, userId, userId, `canvas:${userId}`],
      );
    }

    const messageId = generateTaskId('message');
    await client.query(
      `INSERT INTO messages (id, chat_id, sender_user_id, sender_identity_id, role, content_type, text, channel_message_id, created_at)
       VALUES ($1, $2, $3, $4, 'user', 'text', $5, $6, NOW())`,
      [messageId, chatId, userId, identityId, text, messageId],
    );

    await client.query(
      `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (chat_id) DO UPDATE
       SET is_processing = TRUE, updated_at = NOW()`,
      [chatId],
    );

    await client.query('COMMIT');

    const envelope: EventEnvelope<InboundMessageEvent> = {
      schema_version: '1.0',
      event_id: messageId,
      occurred_at: new Date().toISOString(),
      data: {
        channel: 'canvas',
        channel_message_id: messageId,
        chat_id: chatId,
        sender_identity_id: identityId,
        content_type: 'text',
        text,
        metadata: { correlation_id: messageId },
      },
    };
    nc.publish(NATS_SUBJECTS.inboundMessage('canvas'), jc.encode(envelope));
    await pool.query(
      `UPDATE chat_message_queue
       SET status = 'dispatched', dispatched_at = NOW()
       WHERE id = $1
         AND status = 'dispatching'`,
      [queueId],
    );
    logger.info('Dispatched queued canvas message', {
      chat_id: chatId,
      queue_id: queueId,
      message_id: messageId,
      attempt_count: attemptCount,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    if (isMissingChatQueueDispatchError(err)) {
      const deadLettered = await deadLetterQueuedMessagesForChat(pool, chatId, err);
      logger.warn('Dead-lettered queued messages after missing-chat dispatch failure', {
        chat_id: chatId,
        queue_id: queueId || undefined,
        dead_lettered: deadLettered,
      });
      return;
    }
    if (queueId) {
      await markQueueDispatchFailure(pool, queueId, attemptCount || 1, err);
    }
    const code = String((err as { code?: string })?.code || '');
    if (code !== '42P01' && code !== '42703') {
      logger.error('Failed to dispatch queued canvas message', {
        err: String(err),
        chat_id: chatId,
        queue_id: queueId || undefined,
        attempt_count: attemptCount,
      });
      throw err;
    }
  } finally {
    client.release();
  }
}

async function getIncidentMode(pool: pg.Pool): Promise<string> {
  const result = await pool.query(
    `SELECT value FROM settings_global WHERE key = 'incident.mode'`,
  );
  if (result.rows.length === 0) return 'normal';
  return String(parseSettingValue(result.rows[0].value) || 'normal');
}

function extractCorrelationId(
  metadata: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const raw = metadata?.correlation_id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return fallback;
}

async function loadContext(pool: pg.Pool, chatId: string, senderIdentityId: string) {
  function deriveProjectKey(workspacePath: string): string {
    return basename(String(workspacePath || '').replace(/[\\/]+$/, '')).trim().toLowerCase();
  }

  function composeSystemPrompt(rows: Array<{ scope: string; content: string }>): string {
    const globalDoc = rows.find((row) => row.scope === 'global')?.content?.trim() || '';
    const projectDoc = rows.find((row) => row.scope === 'project')?.content?.trim() || '';
    const chatDoc = rows.find((row) => row.scope === 'chat')?.content?.trim() || '';
    const sections = [globalDoc, projectDoc, chatDoc].filter(Boolean);
    if (sections.length === 0) return 'You are Sven, a helpful AI assistant.';
    return sections.join('\n\n');
  }

  // Get user from identity
  const identityRes = await pool.query(
    `SELECT user_id FROM identities WHERE id = $1`,
    [senderIdentityId],
  );
  const userId = identityRes.rows[0]?.user_id || 'unknown';
  let projectKey: string | null = null;
  try {
    const workspaceRes = await pool.query(
      `SELECT a.workspace_path
       FROM agent_sessions s
       JOIN agents a ON a.id = s.agent_id
       WHERE s.session_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [chatId],
    );
    const workspacePath = String(workspaceRes.rows[0]?.workspace_path || '').trim();
    if (workspacePath) {
      const derived = deriveProjectKey(workspacePath);
      if (derived) projectKey = derived;
    }
  } catch {
    projectKey = null;
  }

  const resetMarkerRes = await pool.query(
    `SELECT created_at FROM messages
     WHERE chat_id = $1
       AND role = 'system'
       AND (text = $2 OR text LIKE $3)
     ORDER BY created_at DESC
     LIMIT 1`,
    [chatId, getSessionResetMarker(), `${getCompactionSummaryPrefix()}%`],
  );
  const resetAfter: Date | null = resetMarkerRes.rows[0]?.created_at || null;

  // Get chat history (last 50 messages)
  const messagesRes = resetAfter
    ? await pool.query(
      `SELECT role, content_type, text, blocks, created_at
       FROM messages
       WHERE chat_id = $1 AND created_at > $2
       ORDER BY created_at DESC LIMIT 50`,
      [chatId, resetAfter],
    )
    : await pool.query(
      `SELECT role, content_type, text, blocks, created_at
       FROM messages WHERE chat_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [chatId],
    );
  const messages = messagesRes.rows.reverse();

  // Get identity doc
  let systemPrompt = 'You are Sven, a helpful AI assistant.';
  try {
    const identityDocRes = await pool.query(
      `SELECT scope, content
       FROM sven_identity_docs
       WHERE scope = 'global'
          OR (scope = 'project' AND project_key = $2)
          OR (scope = 'chat' AND chat_id = $1)
       ORDER BY CASE scope WHEN 'global' THEN 1 WHEN 'project' THEN 2 WHEN 'chat' THEN 3 ELSE 99 END ASC, updated_at DESC`,
      [chatId, projectKey],
    );
    systemPrompt = composeSystemPrompt(identityDocRes.rows as Array<{ scope: string; content: string }>);
  } catch {
    // Backward-compatible fallback before project_key migration is applied.
    const identityDocRes = await pool.query(
      `SELECT scope, content
       FROM sven_identity_docs
       WHERE scope = 'global' OR (scope = 'chat' AND chat_id = $1)
       ORDER BY CASE scope WHEN 'global' THEN 1 WHEN 'chat' THEN 2 ELSE 99 END ASC, updated_at DESC`,
      [chatId],
    );
    systemPrompt = composeSystemPrompt(identityDocRes.rows as Array<{ scope: string; content: string }>);
  }

  // Get relevant memories
  const memoriesRes = await pool.query(
    `SELECT key, value FROM memories
     WHERE (visibility = 'global')
        OR (visibility = 'chat_shared' AND chat_id = $1)
        OR (visibility = 'user_private' AND user_id = $2)
     ORDER BY updated_at DESC LIMIT 20`,
    [chatId, userId],
  );

  let sessionSettings: any = {};
  try {
    const sessionSettingsRes = await pool.query(
      `SELECT think_level, verbose, usage_mode, model_name, profile_name, rag_enabled
       FROM session_settings
       WHERE session_id = $1
       LIMIT 1`,
      [chatId],
    );
    sessionSettings = sessionSettingsRes.rows[0] || {};
  } catch {
    // session_settings may not exist yet in pre-migration environments
    sessionSettings = {};
  }

  const recentToolRunsRes = await pool.query(
    `SELECT tool_name, outputs, created_at
     FROM tool_runs
     WHERE chat_id = $1 AND status IN ('success', 'completed')
     ORDER BY created_at DESC
     LIMIT 5`,
    [chatId],
  );
  if (recentToolRunsRes.rows.length > 0) {
    const toolSummary = recentToolRunsRes.rows
      .map((row: any) => {
        const out = row.outputs ? JSON.stringify(row.outputs).replace(/\s+/g, ' ').slice(0, 200) : '(no output)';
        return `- ${String(row.tool_name)}: ${out}`;
      })
      .join('\n');
    messages.push({
      role: 'system',
      content_type: 'text',
      text: `Recent tool outputs:\n${toolSummary}`,
      created_at: new Date().toISOString(),
    });
  }

  const sessionStitchingPrompt = await maybeBuildSessionStitchingPrompt(pool, chatId, userId);
  if (sessionStitchingPrompt) {
    messages.push({
      role: 'system',
      content_type: 'text',
      text: sessionStitchingPrompt,
      created_at: new Date().toISOString(),
    });
  }

  return {
    user_id: userId,
    messages,
    systemPrompt,
    memories: memoriesRes.rows,
    sessionSettings: {
      think_level: sessionSettings.think_level || null,
      verbose: Boolean(sessionSettings.verbose || false),
      usage_mode: String(sessionSettings.usage_mode || 'off'),
      model_name: sessionSettings.model_name || null,
      profile_name: sessionSettings.profile_name || null,
      rag_enabled: sessionSettings.rag_enabled !== false,
    },
  };
}

async function maybeBuildSessionStitchingPrompt(
  pool: pg.Pool,
  chatId: string,
  userId: string,
): Promise<string> {
  if (!chatId || !userId || userId === 'unknown') return '';
  const enabled = await getBooleanSetting(pool, 'memory.sessionStitching.enabled', true);
  if (!enabled) return '';

  try {
    const res = await pool.query(
      `SELECT chat_id, key, value, updated_at
         FROM memories
        WHERE chat_id <> $1
          AND source = 'session'
          AND user_id = $2
          AND (visibility = 'chat_shared' OR visibility = 'user_private')
          AND archived_at IS NULL
          AND merged_into IS NULL
        ORDER BY updated_at DESC
        LIMIT 4`,
      [chatId, userId],
    );
    return buildSessionStitchingPrompt(res.rows);
  } catch (err) {
    logger.warn('Session stitching context unavailable', { chat_id: chatId, err: String(err) });
    return '';
  }
}

async function buildAvailableToolsPrompt(pool: pg.Pool, chatId: string): Promise<string> {
  let toolsRes;
  try {
    toolsRes = await pool.query(
      `SELECT name
       FROM tools
       WHERE status = 'active'
       ORDER BY name ASC
       LIMIT 200`,
    );
  } catch {
    return '';
  }
  let mcpRows: Array<{ qualified_name: string }> = [];
  try {
    const overrideCount = await pool.query(
      `SELECT COUNT(*)::int AS c FROM mcp_chat_overrides WHERE chat_id = $1`,
      [chatId],
    );
    if (Number(overrideCount.rows[0]?.c || 0) > 0) {
      const res = await pool.query(
        `SELECT t.qualified_name
         FROM mcp_server_tools t
         JOIN mcp_chat_overrides o ON o.server_id = t.server_id
         WHERE o.chat_id = $1 AND o.enabled = true
         ORDER BY t.qualified_name ASC
         LIMIT 80`,
        [chatId],
      );
      mcpRows = res.rows;
    } else {
      const res = await pool.query(
        `SELECT qualified_name
         FROM mcp_server_tools
         ORDER BY qualified_name ASC
         LIMIT 80`,
      );
      mcpRows = res.rows;
    }
  } catch {
    mcpRows = [];
  }

  const names = new Set<string>();
  for (const row of toolsRes.rows) names.add(String((row as any).name));
  for (const row of mcpRows) names.add(String(row.qualified_name));
  if (names.size === 0) return '';

  return [
    'Available tools (call by exact tool name when needed):',
    ...Array.from(names).sort().map((name) => `- ${name}`),
  ].join('\n');
}

async function buildDeviceContextPrompt(pool: pg.Pool, chatId: string): Promise<string> {
  try {
    // Get organization_id from the chat
    const chatRes = await pool.query(
      `SELECT organization_id FROM chats WHERE id = $1`,
      [chatId],
    );
    const orgId = chatRes.rows[0]?.organization_id;
    if (!orgId) return '';

    // Fetch all devices for this org
    const devicesRes = await pool.query(
      `SELECT name, device_type, status, capabilities, last_seen_at
       FROM devices
       WHERE organization_id = $1
       ORDER BY status ASC, name ASC
       LIMIT 20`,
      [orgId],
    );
    if (devicesRes.rows.length === 0) return '';

    const lines = devicesRes.rows.map((d: any) => {
      const caps = Array.isArray(d.capabilities) ? d.capabilities.join(', ') : '';
      const lastSeen = d.last_seen_at
        ? ` (last seen: ${new Date(d.last_seen_at).toISOString().slice(0, 16).replace('T', ' ')})`
        : '';
      return `- ${String(d.name)} (${String(d.device_type)}, ${String(d.status)}${caps ? `, capabilities: ${caps}` : ''}${d.status === 'offline' ? lastSeen : ''})`;
    });

    return [
      'Connected devices you can control via device.* tools:',
      ...lines,
      '',
      'Use device.list to refresh, device.send_command / device.display / device.speak / device.camera_snapshot / device.sensor_read to interact.',
    ].join('\n');
  } catch {
    return '';
  }
}

async function getChatType(pool: pg.Pool, chatId: string): Promise<string> {
  const res = await pool.query(`SELECT type FROM chats WHERE id = $1`, [chatId]);
  return res.rows[0]?.type || 'group';
}

async function handleApprovalCommand(
  pool: pg.Pool,
  approvalManager: ApprovalManager,
  canvasEmitter: CanvasEmitter,
  event: InboundMessageEvent,
  userId: string,
): Promise<boolean> {
  const text = (event.text || '').trim();
  if (!text) return false;

  const match = text.match(/^\/(approve|deny)\s+([a-f0-9-]{8,})$/i);
  if (!match) return false;

  const action = match[1].toLowerCase() as 'approve' | 'deny';
  const approvalId = match[2];

  const roleRes = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  const role = roleRes.rows[0]?.role || 'user';
  if (role !== 'admin') {
    await canvasEmitter.emit({
      chat_id: event.chat_id,
      channel: event.channel,
      text: 'Only admins can vote on approvals.',
    });
    return true;
  }

  try {
    await approvalManager.vote(approvalId, userId, action, { chatId: event.chat_id });
    await canvasEmitter.emit({
      chat_id: event.chat_id,
      channel: event.channel,
      text: `Recorded ${action} vote for approval ${approvalId}.`,
    });
  } catch (err) {
    logger.warn('Approval vote failed', {
      approval_id: approvalId,
      action,
      user_id: userId,
      err: String(err),
    });
    await canvasEmitter.emit({
      chat_id: event.chat_id,
      channel: event.channel,
      text: mapApprovalVoteErrorToUserMessage(err),
    });
  }

  return true;
}

function isImproveYourselfRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes('improve yourself') || normalized.includes('self improve');
}

function isProactivityEnabled(value: string): boolean {
  const normalized = (value || '').toLowerCase();
  return normalized !== 'off' && normalized !== 'disabled' && normalized !== 'false';
}

async function createImprovementItem(
  pool: pg.Pool,
  params: { title: string; description: string; evidence: Record<string, unknown> },
): Promise<string> {
  const id = generateTaskId('improvement');
  await pool.query(
    `INSERT INTO improvement_items (id, source, title, description, evidence, status, priority, created_at, updated_at)
     VALUES ($1, 'buddy', $2, $3, $4, 'proposed', 0, NOW(), NOW())`,
    [id, params.title, params.description, JSON.stringify([params.evidence])],
  );
  return id;
}

async function getBuddySettings(pool: pg.Pool): Promise<{
  enabled: boolean;
  proactivity: string;
  daily_digest_time: string;
}> {
  const keys = ['buddy.enabled', 'buddy.proactivity', 'buddy.daily_digest_time'];
  const res = await pool.query(
    `SELECT key, value FROM settings_global WHERE key = ANY($1::text[])`,
    [keys],
  );

  const map = new Map<string, any>();
  for (const row of res.rows) {
    map.set(row.key, parseSettingValue(row.value));
  }

  return {
    enabled: parseBooleanSetting(map.get('buddy.enabled'), false),
    proactivity: String(map.get('buddy.proactivity') ?? 'off'),
    daily_digest_time: String(map.get('buddy.daily_digest_time') ?? '09:00'),
  };
}

async function getSettingValue(pool: pg.Pool, key: string): Promise<string | null> {
  const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1`, [key]);
  if (res.rows.length === 0) return null;
  return String(parseSettingValue(res.rows[0].value));
}

async function maybeBuildDelayedRecallPrompt(
  pool: pg.Pool,
  chatId: string,
  contextMessages: Array<{ role?: string; text?: string }>,
  memories: Array<{ key?: string; value?: string }>,
): Promise<string> {
  const config = await getDelayedRecallConfig(pool, chatId);
  const userTurnCount = contextMessages.filter((m) => m.role === 'user').length;
  const state = await getDelayedRecallState(pool, chatId);
  if (!shouldEvaluateDelayedRecall({
    enabled: config.enabled,
    everyNTurns: config.everyNTurns,
    userTurnCount,
    lastInjectedUserTurn: state.lastInjectedUserTurn,
    minTurnsBetween: config.minTurnsBetween,
    lastInjectedAtMs: state.lastInjectedAtMs,
    minMinutesBetween: config.minMinutesBetween,
  })) {
    return '';
  }

  const relevant = selectDelayedRecallMemories({
    memories,
    contextMessages,
    maxItems: config.maxItems,
    minOverlap: config.minOverlap,
  });
  if (relevant.length === 0) return '';
  await setDelayedRecallState(pool, chatId, userTurnCount);
  return buildDelayedRecallPrompt(relevant);
}

async function getDelayedRecallConfig(
  pool: pg.Pool,
  chatId: string,
): Promise<{
  enabled: boolean;
  everyNTurns: number;
  minTurnsBetween: number;
  minMinutesBetween: number;
  maxItems: number;
  minOverlap: number;
}> {
  const keys = [
    'memory.delayedRecall.enabled',
    'memory.delayedRecall.everyNTurns',
    'memory.delayedRecall.minTurnsBetween',
    'memory.delayedRecall.minMinutesBetween',
    'memory.delayedRecall.maxItems',
    'memory.delayedRecall.minOverlap',
  ];
  const values = new Map<string, unknown>();

  try {
    const chatRes = await pool.query(
      `SELECT organization_id
       FROM chats
       WHERE id = $1
       LIMIT 1`,
      [chatId],
    );
    const orgId = String(chatRes.rows[0]?.organization_id || '').trim();
    if (orgId) {
      const orgRes = await pool.query(
        `SELECT key, value
         FROM organization_settings
         WHERE organization_id = $1
           AND key = ANY($2::text[])`,
        [orgId, keys],
      );
      for (const row of orgRes.rows) values.set(String(row.key), parseSettingValue(row.value));
    }
  } catch {
    // fall through to global defaults
  }

  const missingKeys = keys.filter((k) => !values.has(k));
  if (missingKeys.length > 0) {
    try {
      const globalRes = await pool.query(
        `SELECT key, value
         FROM settings_global
         WHERE key = ANY($1::text[])`,
        [missingKeys],
      );
      for (const row of globalRes.rows) values.set(String(row.key), parseSettingValue(row.value));
    } catch {
      // ignore; use fallbacks below
    }
  }

  const everyNTurns = Math.max(1, Math.floor(Number(values.get('memory.delayedRecall.everyNTurns') ?? 3)));
  const minTurnsBetween = Math.max(1, Math.floor(Number(values.get('memory.delayedRecall.minTurnsBetween') ?? everyNTurns)));
  const minMinutesBetween = Math.max(0, Math.floor(Number(values.get('memory.delayedRecall.minMinutesBetween') ?? 30)));
  const maxItems = Math.max(1, Math.min(10, Math.floor(Number(values.get('memory.delayedRecall.maxItems') ?? 4))));
  const minOverlap = Math.max(1, Math.min(5, Math.floor(Number(values.get('memory.delayedRecall.minOverlap') ?? 1))));

  return {
    enabled: parseBooleanSetting(values.get('memory.delayedRecall.enabled'), false),
    everyNTurns,
    minTurnsBetween,
    minMinutesBetween,
    maxItems,
    minOverlap,
  };
}

async function getDelayedRecallState(
  pool: pg.Pool,
  chatId: string,
): Promise<{ lastInjectedUserTurn: number; lastInjectedAtMs: number | null }> {
  try {
    const res = await pool.query(
      `SELECT delayed_recall_last_user_turn, delayed_recall_last_injected_at
       FROM session_settings
       WHERE session_id = $1
       LIMIT 1`,
      [chatId],
    );
    const row = res.rows[0] || {};
    const turn = Math.max(0, Math.floor(Number(row.delayed_recall_last_user_turn || 0)));
    const at = row.delayed_recall_last_injected_at
      ? new Date(row.delayed_recall_last_injected_at).getTime()
      : null;
    return { lastInjectedUserTurn: turn, lastInjectedAtMs: Number.isFinite(Number(at)) ? at : null };
  } catch {
    return { lastInjectedUserTurn: 0, lastInjectedAtMs: null };
  }
}

async function setDelayedRecallState(
  pool: pg.Pool,
  chatId: string,
  userTurnCount: number,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO session_settings
         (session_id, delayed_recall_last_user_turn, delayed_recall_last_injected_at, updated_at, updated_by)
       VALUES ($1, $2, NOW(), NOW(), 'runtime.delayed_recall')
       ON CONFLICT (session_id)
       DO UPDATE SET
         delayed_recall_last_user_turn = EXCLUDED.delayed_recall_last_user_turn,
         delayed_recall_last_injected_at = NOW(),
         updated_at = NOW(),
         updated_by = 'runtime.delayed_recall'`,
      [chatId, Math.max(0, Math.floor(userTurnCount || 0))],
    );
  } catch (err) {
    logger.warn('Failed to persist delayed recall state', { chatId, error: String(err) });
  }
}

async function maybeBuildProjectTreePrompt(
  pool: pg.Pool,
  chatId: string,
): Promise<string> {
  const enabled = await getBooleanSetting(pool, 'projectContext.fileTree.enabled', false);
  if (!enabled) return '';

  const workspaceRes = await pool.query(
    `SELECT a.workspace_path
     FROM agent_sessions s
     JOIN agents a ON a.id = s.agent_id
     WHERE s.session_id = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [chatId],
  );
  const workspacePath = String(workspaceRes.rows[0]?.workspace_path || '').trim();
  if (!workspacePath) return '';

  const maxDepth = await getNumberSetting(pool, 'projectContext.fileTree.maxDepth', 3);
  const maxFilesPerDir = await getNumberSetting(pool, 'projectContext.fileTree.maxFilesPerDir', 50);
  const debounceMs = await getNumberSetting(pool, 'projectContext.fileTree.debounceMs', 30000);
  let customPatterns: string[] = [];
  let allowedRoots: string[] = [];
  const envAllowedRoots = String(process.env.SVEN_PROJECT_CONTEXT_ALLOWED_ROOTS || '')
    .split(/[\n,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (envAllowedRoots.length > 0) {
    allowedRoots.push(...envAllowedRoots);
  }
  try {
    const customRes = await pool.query(
      `SELECT value
       FROM settings_global
       WHERE key = 'projectContext.fileTree.excludePatterns'
       LIMIT 1`,
    );
    const parsed = parseSettingValue(customRes.rows[0]?.value);
    if (Array.isArray(parsed)) {
      customPatterns = parsed.map((v) => String(v).trim()).filter(Boolean);
    } else if (typeof parsed === 'string') {
      customPatterns = parsed.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
    }
  } catch {
    customPatterns = [];
  }
  try {
    const rootsRes = await pool.query(
      `SELECT value
       FROM settings_global
       WHERE key = 'projectContext.fileTree.allowedRoots'
       LIMIT 1`,
    );
    const parsed = parseSettingValue(rootsRes.rows[0]?.value);
    if (Array.isArray(parsed)) {
      allowedRoots.push(...parsed.map((v) => String(v).trim()).filter(Boolean));
    } else if (typeof parsed === 'string') {
      allowedRoots.push(...parsed.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean));
    }
  } catch {
    // ignore malformed root config; fail-closed below if no valid roots remain
  }
  allowedRoots = Array.from(new Set(allowedRoots));

  try {
    return await projectTreeCache.getPrompt({
      workspacePath,
      maxDepth,
      maxFilesPerDir,
      customExcludePatterns: customPatterns,
      debounceMs,
      allowedRoots,
    });
  } catch (err) {
    logger.warn('Project tree prompt skipped', { chat_id: chatId, err: String(err) });
    return '';
  }
}

async function extractLongTermMemories(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  text: string,
  extractor?: MemoryExtractor,
  extractorEnabled?: boolean,
): Promise<void> {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  const candidates: Array<{ key: string; value: string; visibility: 'user_private' | 'chat_shared' | 'global' }> = [];
  const mName = normalized.match(/\bmy name is ([a-z0-9 _-]{2,60})/i);
  const mLike = normalized.match(/\bI (?:really )?(?:like|love|prefer) ([a-z0-9 _-]{2,100})/i);
  const mTimezone = normalized.match(/\bmy timezone is ([a-z0-9_/+-]{2,80})/i);
  const mRemember = normalized.match(/\bremember(?: that)?[: ]+(.{3,180})/i);
  if (mName) candidates.push({ key: 'profile.name', value: mName[1].trim(), visibility: 'user_private' });
  if (mLike) candidates.push({ key: 'preference.general', value: mLike[1].trim(), visibility: 'user_private' });
  if (mTimezone) candidates.push({ key: 'profile.timezone', value: mTimezone[1].trim(), visibility: 'user_private' });
  if (mRemember) candidates.push({ key: `memory.note.${Date.now()}`, value: mRemember[1].trim(), visibility: 'chat_shared' });

  // Enhanced extraction via MemoryExtractor (pattern-based category extraction)
  if (extractor && extractorEnabled) {
    try {
      const transcript: TranscriptMessage[] = [{ role: 'user', content: normalized, timestamp: new Date() }];
      const extracted = extractor.extract(transcript, chatId);
      if (extracted.length > 0) {
        const ingested = extractor.ingest(extracted);
        for (const mem of extracted) {
          candidates.push({
            key: `${mem.category}.${mem.id}`,
            value: mem.content,
            visibility: 'chat_shared',
          });
        }
        logger.debug('Memory extractor found patterns', {
          chat_id: chatId,
          extracted: extracted.length,
          added: ingested.added,
          reinforced: ingested.reinforced,
          totalStore: extractor.size,
        });
      }
    } catch (err) {
      logger.warn('Memory extractor failed', { chat_id: chatId, err: String(err) });
    }
  }

  if (candidates.length === 0) return;

  for (const item of candidates) {
    try {
      await pool.query(
        `INSERT INTO memories (id, user_id, chat_id, visibility, key, value, source, importance, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'auto_extract', 1.15, NOW(), NOW())`,
        [generateTaskId('memory'), userId || null, chatId || null, item.visibility, item.key, item.value],
      );
    } catch (err) {
      logger.warn('Memory extraction insert skipped', { err: String(err), key: item.key });
    }
  }
}

async function upsertSettingValue(pool: pg.Pool, key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO settings_global (key, value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), 'system')
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = 'system'`,
    [key, JSON.stringify(value)],
  );
}

function getIsoWeekKey(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = tmp.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

async function maybeAutoCompactSession(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  messages: Array<{ text?: string }>,
): Promise<{ compacted: boolean; beforeTokens: number; afterTokens: number }> {
  const autoEnabled = await getBooleanSettingWithAliases(
    pool,
    ['chat.compaction.auto', 'chat.compaction.safeguard'],
    false,
  );
  if (!autoEnabled) return { compacted: false, beforeTokens: 0, afterTokens: 0 };

  const contextWindow = await getNumberSetting(pool, 'chat.model_context_window', 0);
  if (contextWindow <= 0) return { compacted: false, beforeTokens: 0, afterTokens: 0 };
  const thresholdPctPrimary = await getNumberSettingWithAliases(
    pool,
    ['chat.compaction.threshold_pct', 'chat.compaction.memoryFlush.softThresholdPct'],
    NaN,
  );
  const thresholdPct = Number.isFinite(thresholdPctPrimary) && thresholdPctPrimary > 0
    ? thresholdPctPrimary
    : await (async () => {
      const softThresholdTokens = await getNumberSettingWithAliases(
        pool,
        ['chat.compaction.memoryFlush.softThresholdTokens'],
        0,
      );
      if (Number.isFinite(softThresholdTokens) && softThresholdTokens > 0) {
        return Math.max(1, Math.min(100, (softThresholdTokens / contextWindow) * 100));
      }
      return 80;
    })();

  const estimatedTokens = estimateRowsTokens(messages);
  const thresholdTokens = Math.floor((thresholdPct / 100) * contextWindow);
  if (estimatedTokens < thresholdTokens) {
    return { compacted: false, beforeTokens: estimatedTokens, afterTokens: estimatedTokens };
  }

  return compactChatContext(pool, chatId, userId);
}

async function compactChatContext(
  pool: pg.Pool,
  chatId: string,
  userId: string,
): Promise<{ compacted: boolean; beforeTokens: number; afterTokens: number }> {
  const keepRecent = 10;
  const resetMarkerRes = await pool.query(
    `SELECT created_at
     FROM messages
     WHERE chat_id = $1
       AND role = 'system'
       AND (text = $2 OR text LIKE $3)
     ORDER BY created_at DESC
     LIMIT 1`,
    [chatId, getSessionResetMarker(), `${getCompactionSummaryPrefix()}%`],
  );
  const resetAfter: Date | null = resetMarkerRes.rows[0]?.created_at || null;
  const historyRes = resetAfter
    ? await pool.query(
      `SELECT role, text
       FROM messages
       WHERE chat_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [chatId, resetAfter],
    )
    : await pool.query(
      `SELECT role, text
       FROM messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId],
    );

  const rows = historyRes.rows.filter((r) => r.role === 'user' || r.role === 'assistant');
  const beforeTokens = estimateRowsTokens(rows);
  if (rows.length <= keepRecent) {
    return { compacted: false, beforeTokens, afterTokens: beforeTokens };
  }

  const older = rows.slice(0, Math.max(0, rows.length - keepRecent));
  const recent = rows.slice(Math.max(0, rows.length - keepRecent));
  const summaryText = await composeCompactionSummary(pool, chatId, userId, older);

  await pool.query(
    `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
     VALUES ($1, $2, 'system', 'text', $3, NOW())`,
    [generateTaskId('message'), chatId, summaryText],
  );

  const afterTokens = estimateRowsTokens(recent) + estimateTextTokens(summaryText);
  try {
    await pool.query(
      `INSERT INTO compaction_events (id, session_id, before_tokens, after_tokens, summary_text, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [generateTaskId('audit_entry'), chatId, beforeTokens, afterTokens, summaryText],
    );
  } catch {
    // Best effort for pre-migration environments.
  }
  await maybeIndexSessionTranscript(pool, chatId, userId);
  return { compacted: true, beforeTokens, afterTokens };
}

async function isSessionIndexingEnabledForChat(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const agentRes = await pool.query(
      `SELECT c.settings ->> 'memory_index_sessions_enabled' AS enabled
       FROM agent_sessions s
       JOIN agent_configs c ON c.agent_id = s.agent_id
       WHERE s.session_id = $1`,
      [chatId],
    );
    if (agentRes.rows.length > 0) {
      for (const row of agentRes.rows) {
        const enabled = parseBooleanSetting(parseSettingValue(row.enabled), false);
        if (enabled) return true;
      }
      return false;
    }
  } catch {
    // Fall through to global setting
  }
  return getBooleanSetting(pool, 'memory.indexSessions.enabled', false);
}

async function hasSessionIndexConsent(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT memory_index_consent FROM session_settings WHERE session_id = $1 LIMIT 1`,
      [chatId],
    );
    return Boolean(res.rows[0]?.memory_index_consent);
  } catch {
    return false;
  }
}

async function maybeIndexSessionTranscript(pool: pg.Pool, chatId: string, userId: string): Promise<void> {
  if (!chatId) return;
  try {
    const enabled = await isSessionIndexingEnabledForChat(pool, chatId);
    if (!enabled) return;
    const consent = await hasSessionIndexConsent(pool, chatId);
    if (!consent) return;

    let since: string | null = null;
    try {
      const sinceRes = await pool.query(
        `SELECT memory_last_indexed_at FROM session_settings WHERE session_id = $1 LIMIT 1`,
        [chatId],
      );
      since = sinceRes.rows[0]?.memory_last_indexed_at
        ? new Date(sinceRes.rows[0].memory_last_indexed_at).toISOString()
        : null;
    } catch {
      since = null;
    }

    const msgRes = await pool.query(
      `SELECT role, text, created_at
       FROM messages
       WHERE chat_id = $1
         AND role IN ('user', 'assistant')
         AND ($2::timestamptz IS NULL OR created_at > $2::timestamptz)
       ORDER BY created_at ASC
       LIMIT 400`,
      [chatId, since],
    );
    const toolRes = await pool.query(
      `SELECT tool_name, outputs, created_at
       FROM tool_runs
       WHERE chat_id = $1
         AND status = 'success'
         AND ($2::timestamptz IS NULL OR created_at > $2::timestamptz)
       ORDER BY created_at ASC
       LIMIT 120`,
      [chatId, since],
    );

    if (msgRes.rows.length === 0 && toolRes.rows.length === 0) return;

    const lines: string[] = [];
    for (const row of msgRes.rows) {
      const ts = new Date(row.created_at).toISOString();
      lines.push(`[${ts}] ${String(row.role)}: ${String(row.text || '').replace(/\s+/g, ' ').trim()}`);
    }
    for (const row of toolRes.rows) {
      const ts = new Date(row.created_at).toISOString();
      const outputs = row.outputs ? JSON.stringify(row.outputs) : '(no output)';
      lines.push(`[${ts}] tool:${String(row.tool_name)} => ${outputs.slice(0, 1200)}`);
    }

    const memoryId = generateTaskId('memory');
    const key = `session.transcript.${chatId}.${Date.now()}`;
    const value = lines.join('\n').slice(0, 64000);
    await pool.query(
      `INSERT INTO memories (id, user_id, chat_id, visibility, key, value, source, importance, created_at, updated_at)
       VALUES ($1, $2, $3, 'chat_shared', $4, $5, 'session', 1.05, NOW(), NOW())`,
      [memoryId, userId, chatId, key, value],
    );

    await pool.query(
      `INSERT INTO session_settings (session_id, memory_index_consent, memory_last_indexed_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (session_id) DO UPDATE
       SET memory_last_indexed_at = NOW()`,
      [chatId],
    );
  } catch (err) {
    logger.warn('Session transcript indexing skipped', { chat_id: chatId, err: String(err) });
  }
}

async function composeCompactionSummary(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  olderRows: Array<{ role?: string; text?: string }>,
): Promise<string> {
  const conversation = olderRows
    .slice(-20)
    .map((r) => `- ${r.role}: ${String(r.text || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`)
    .join('\n');

  const memoryRes = await pool.query(
    `SELECT key, value
     FROM memories
     WHERE (
          visibility = 'global'
       OR (visibility = 'chat_shared' AND chat_id = $1)
       OR (visibility = 'user_private' AND user_id = $2)
     )
       AND archived_at IS NULL
       AND merged_into IS NULL
     ORDER BY updated_at DESC
     LIMIT 40`,
    [chatId, userId],
  );
  const pinnedFacts = memoryRes.rows
    .filter((r) => /pinned|profile|preference/i.test(String(r.key || '')))
    .slice(0, 10)
    .map((r) => `- ${String(r.key)}: ${String(r.value || '').replace(/\s+/g, ' ').trim().slice(0, 200)}`)
    .join('\n');

  const toolRes = await pool.query(
    `SELECT tool_name, outputs
     FROM tool_runs
     WHERE chat_id = $1
       AND status = 'success'
     ORDER BY created_at DESC
     LIMIT 5`,
    [chatId],
  );
  const recentTools = toolRes.rows
    .map((r) => {
      const output = r.outputs ? JSON.stringify(r.outputs) : '';
      const trimmed = output.replace(/\s+/g, ' ').slice(0, 220);
      return `- ${String(r.tool_name)}: ${trimmed || '(no output)'}`;
    })
    .join('\n');

  return [
    getCompactionSummaryPrefix(),
    'conversation_summary:',
    conversation || '- (no summary content)',
    '',
    'preserved_facts:',
    pinnedFacts || '- (no pinned/profile facts found)',
    '',
    'recent_tool_results:',
    recentTools || '- (no recent successful tool runs)',
  ].join('\n');
}

async function recordSessionTokenUsage(
  pool: pg.Pool,
  sessionId: string,
  modelName: string | null,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  if (!sessionId) return;
  if (inputTokens <= 0 && outputTokens <= 0) return;
  try {
    await pool.query(
      `INSERT INTO session_token_usage (id, session_id, model_name, input_tokens, output_tokens, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [generateTaskId('audit_entry'), sessionId, modelName, Math.max(0, inputTokens), Math.max(0, outputTokens)],
    );
  } catch (err) {
    logger.warn('Failed to record session token usage', { err: String(err), session_id: sessionId });
  }
}

async function recordLlmAudit(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  modelName: string,
  thinkLevel: string | null,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO llm_audit_log (id, chat_id, user_id, model_name, think_level, prompt_tokens, completion_tokens, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [generateTaskId('audit_entry'), chatId, userId, modelName, thinkLevel, promptTokens, completionTokens],
    );
  } catch (err) {
    logger.warn('Failed to record LLM audit log', { err: String(err) });
  }
}

async function getNumberSetting(pool: pg.Pool, key: string, fallback: number): Promise<number> {
  const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1`, [key]);
  if (res.rows.length === 0) return fallback;
  const parsed = Number(parseSettingValue(res.rows[0].value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getNumberSettingWithAliases(pool: pg.Pool, keys: string[], fallback: number): Promise<number> {
  for (const key of keys) {
    const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1`, [key]);
    if (res.rows.length === 0) continue;
    const parsed = Number(parseSettingValue(res.rows[0].value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

async function getBooleanSetting(pool: pg.Pool, key: string, fallback: boolean): Promise<boolean> {
  const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1`, [key]);
  if (res.rows.length === 0) return fallback;
  return parseBooleanSetting(parseSettingValue(res.rows[0].value), fallback);
}

async function getBooleanSettingWithAliases(pool: pg.Pool, keys: string[], fallback: boolean): Promise<boolean> {
  for (const key of keys) {
    const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1`, [key]);
    if (res.rows.length === 0) continue;
    return parseBooleanSetting(parseSettingValue(res.rows[0].value), fallback);
  }
  return fallback;
}

async function getChatSelfChatEnabled(pool: pg.Pool, chatId: string): Promise<boolean> {
  return getBooleanSetting(pool, `chat.selfchat.${chatId}`, false);
}

function getSelfChatTurn(metadata: Record<string, unknown> | undefined): number {
  if (!metadata || typeof metadata !== 'object') return 0;
  const raw = Number((metadata as Record<string, unknown>).selfchat_turn || 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

async function buildEmotionToneHint(
  pool: pg.Pool,
  metadata: Record<string, unknown> | undefined,
): Promise<string> {
  if (!metadata || typeof metadata !== 'object') return '';
  const adjustEnabled = await getBooleanSetting(pool, 'voice.emotionDetection.adjustTone', true);
  if (!adjustEnabled) return '';

  const emotionRaw = (metadata as Record<string, unknown>).emotion;
  const emotion = emotionRaw && typeof emotionRaw === 'object'
    ? (emotionRaw as Record<string, unknown>)
    : null;
  const label = String((emotion?.label || (metadata as Record<string, unknown>).emotion_label || '')).trim().toLowerCase();
  if (!label) return '';
  const confidence = Number(emotion?.confidence || (metadata as Record<string, unknown>).emotion_confidence || 0);
  const confidenceText = Number.isFinite(confidence) && confidence > 0
    ? ` (confidence ${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%)`
    : '';

  switch (label) {
    case 'urgent':
      return `User mood hint: urgent${confidenceText}. Keep responses concise, action-oriented, and prioritize immediate next steps.`;
    case 'angry':
    case 'frustrated':
      return `User mood hint: ${label}${confidenceText}. Use a calm, empathetic tone. Acknowledge friction and propose a clear recovery plan.`;
    case 'sad':
      return `User mood hint: sad${confidenceText}. Use a supportive, reassuring tone while staying practical.`;
    case 'happy':
      return `User mood hint: happy${confidenceText}. Keep a warm tone and maintain momentum.`;
    case 'calm':
      return `User mood hint: calm${confidenceText}. Keep a steady, concise, and clear tone.`;
    default:
      return '';
  }
}

async function buildVoiceLanguageHint(
  pool: pg.Pool,
  event: InboundMessageEvent,
): Promise<string> {
  if (event.content_type !== 'audio') return '';
  const enabled = await getBooleanSetting(pool, 'voice.multiLanguage.enabled', true);
  const respondInKind = await getBooleanSetting(pool, 'voice.multiLanguage.respondInKind', true);
  if (!enabled || !respondInKind) return '';
  const metadata = event.metadata && typeof event.metadata === 'object'
    ? (event.metadata as Record<string, unknown>)
    : {};
  const detected = String(metadata.language_detected || metadata.language || '').trim().toLowerCase();
  if (!detected) return '';
  const probability = Number(metadata.language_probability || 0);
  const conf = Number.isFinite(probability) && probability > 0
    ? ` (detected confidence ${Math.round(Math.max(0, Math.min(1, probability)) * 100)}%)`
    : '';
  return `Voice language hint: respond in ${detected}${conf} unless the user explicitly requests another language.`;
}

async function maybeHandleVoiceShortcut(params: {
  pool: pg.Pool;
  nc: NatsConnection;
  policyEngine: PolicyEngine;
  approvalManager: ApprovalManager;
  canvasEmitter: CanvasEmitter;
  event: InboundMessageEvent;
  userId: string;
  correlationId: string;
}): Promise<boolean> {
  const { pool, nc, policyEngine, approvalManager, canvasEmitter, event, userId, correlationId } = params;
  if (event.content_type !== 'audio') return false;
  const enabled = await getBooleanSetting(pool, 'voice.shortcuts.enabled', false);
  if (!enabled) return false;
  const shortcut = parseVoiceShortcut(String(event.text || ''));
  if (!shortcut) return false;

  const allowRawRes = await pool.query(
    `SELECT value FROM settings_global WHERE key = 'voice.shortcuts.allowedServices' LIMIT 1`,
  );
  const allowed = parseAllowedShortcutServices(
    allowRawRes.rows[0]?.value,
    ['light.turn_off', 'light.turn_on', 'switch.turn_off', 'switch.turn_on'],
  );
  const service = String(shortcut.inputs.service || '').toLowerCase();
  if (!allowed.has(service)) {
    await canvasEmitter.emit({
      chat_id: event.chat_id,
      channel: event.channel,
      text: `Voice shortcut matched "${service}" but it is not allowlisted.`,
    });
    return true;
  }

  const decision = await policyEngine.evaluateToolCall({
    scope: shortcut.scope,
    tool_name: shortcut.tool_name,
    user_id: userId,
    chat_id: event.chat_id,
    inputs: shortcut.inputs,
  });

  if (!decision.allowed && decision.requires_approval) {
    const approvalId = await approvalManager.createApproval({
      chat_id: event.chat_id,
      tool_name: shortcut.tool_name,
      scope: shortcut.scope,
      requester_user_id: userId,
      quorum_required: decision.approval_quorum || 1,
      expires_in_ms: decision.approval_expires_in_ms,
      details: {
        source: 'voice_shortcut',
        transcript: String(event.text || ''),
        inputs: shortcut.inputs,
      },
    });
    await canvasEmitter.emit({
      chat_id: event.chat_id,
      channel: event.channel,
      text: `Voice shortcut requires approval. Approve with /approve ${approvalId} or deny with /deny ${approvalId}.`,
    });
    return true;
  }

  if (!decision.allowed) {
    await canvasEmitter.emit({
      chat_id: event.chat_id,
      channel: event.channel,
      text: `Voice shortcut blocked by policy: ${decision.reason || 'not allowed'}.`,
    });
    return true;
  }

  const runId = generateTaskId('tool_run');
  nc.publish(
    NATS_SUBJECTS.TOOL_RUN_REQUEST,
    jc.encode({
      schema_version: '1.0',
      event_id: runId,
      occurred_at: new Date().toISOString(),
      data: {
        run_id: runId,
        correlation_id: correlationId,
        tool_name: shortcut.tool_name,
        chat_id: event.chat_id,
        user_id: userId,
        inputs: shortcut.inputs,
        justification: {
          user_message_ids: [event.channel_message_id],
        },
      },
    }),
  );

  await canvasEmitter.emit({
    chat_id: event.chat_id,
    channel: event.channel,
    text: `Voice shortcut executed: ${service}.`,
  });
  return true;
}

function estimateRowsTokens(rows: Array<{ text?: string }>): number {
  return rows.reduce((sum, r) => sum + estimateTextTokens(String(r.text || '')), 0);
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

async function sendBuddyDigest(
  pool: pg.Pool,
  canvasEmitter: CanvasEmitter,
  title: string,
  personalityEngine: PersonalityEngine,
): Promise<void> {
  const hqRes = await pool.query(
    `SELECT id, channel FROM chats WHERE type = 'hq' LIMIT 1`,
  );
  if (hqRes.rows.length === 0) return;

  const hqChatId = hqRes.rows[0].id;
  const channel = hqRes.rows[0].channel || 'internal';

  // ── Core metrics ──
  const approvalsRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM approvals WHERE status = 'pending'`,
  );
  const improvementsRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM improvement_items WHERE status IN ('proposed', 'in_progress')`,
  );
  const errorsRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM tool_runs
     WHERE status IN ('error', 'timeout') AND created_at > NOW() - INTERVAL '24 hours'`,
  );

  // ── Enhanced metrics: success rate, busiest tools, error patterns ──
  const toolStatsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'success')::int AS successes,
      COUNT(*) FILTER (WHERE status IN ('error', 'timeout'))::int AS failures
    FROM tool_runs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  const totalRuns = toolStatsRes.rows[0]?.total ?? 0;
  const successes = toolStatsRes.rows[0]?.successes ?? 0;
  const errorRate = totalRuns > 0 ? (totalRuns - successes) / totalRuns : 0;
  const successRate = totalRuns > 0 ? Math.round((successes / totalRuns) * 100) : 100;

  const topToolsRes = await pool.query(`
    SELECT tool_name, COUNT(*)::int AS cnt
    FROM tool_runs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY tool_name
    ORDER BY cnt DESC
    LIMIT 5
  `);

  const errPatternRes = await pool.query(`
    SELECT tool_name, COUNT(*)::int AS cnt
    FROM tool_runs
    WHERE status IN ('error', 'timeout') AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY tool_name
    ORDER BY cnt DESC
    LIMIT 3
  `);

  // ── Conversation activity ──
  const chatActivityRes = await pool.query(`
    SELECT COUNT(DISTINCT chat_id)::int AS active_chats,
           COUNT(*)::int AS total_messages
    FROM messages
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  const activeChats = chatActivityRes.rows[0]?.active_chats ?? 0;
  const totalMessages = chatActivityRes.rows[0]?.total_messages ?? 0;

  // ── Streak tracking ──
  const streakRes = await pool.query(`
    SELECT COUNT(DISTINCT created_at::date)::int AS streak_days
    FROM messages
    WHERE created_at > NOW() - INTERVAL '30 days'
      AND created_at::date <= CURRENT_DATE
  `);
  const streakDays = streakRes.rows[0]?.streak_days ?? 0;

  // ── Last activity check for returning-user greeting ──
  const lastActivityRes = await pool.query(`
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS seconds_since
    FROM messages
  `);
  const minutesSinceActivity = Math.round((lastActivityRes.rows[0]?.seconds_since ?? 0) / 60);
  const hour = new Date().getHours();

  // ── Derive mood via personality engine ──
  const milestones = personalityEngine.checkMilestones(totalRuns, totalRuns);
  personalityEngine.deriveMood({
    errorRate,
    pendingApprovals: approvalsRes.rows[0].c,
    streakDays,
    toolRuns: totalRuns,
    milestoneHit: milestones.length > 0,
    hourOfDay: hour,
    minutesSinceActivity,
  });

  // Award XP for daily activity
  if (totalRuns > 0) personalityEngine.awardXp('tool_run', totalRuns);
  if (streakDays > 0) personalityEngine.awardXp('streak_day', 1);
  const newAchievements = personalityEngine.awardXp('tool_run', 0); // trigger achievement check without extra XP

  // ── Build digest sections ──
  const sections: string[] = [];

  // Header with personality-driven greeting
  const isReturning = minutesSinceActivity > 120;
  const greeting = personalityEngine.getGreeting(hour, isReturning);
  sections.push(`**${greeting} — ${title}**`);

  // Mood message
  const moodMsg = personalityEngine.getMoodMessage();
  if (moodMsg) sections.push(moodMsg);

  // Buddy profile summary
  const profile = personalityEngine.getProfile();
  const progress = personalityEngine.getLevelProgress();
  sections.push(`\n**Buddy Status** — Level ${profile.level} (${Math.round(progress.progress * 100)}% → ${profile.level + 1}) | ${profile.xp} XP | Mood: ${profile.mood}`);

  // Activity summary
  if (totalMessages > 0) {
    sections.push(`\n**Activity**`);
    sections.push(`Conversations: ${activeChats} active chats, ${totalMessages} messages`);
    if (streakDays > 1) {
      sections.push(`Streak: ${streakDays} days active in the last 30 days`);
    }
  }

  // Tool performance
  sections.push(`\n**Tool Performance**`);
  sections.push(`Runs: ${totalRuns} | Success rate: ${successRate}%`);
  if (topToolsRes.rows.length > 0) {
    const topTools = topToolsRes.rows.map((r: any) => `${r.tool_name} (${r.cnt})`).join(', ');
    sections.push(`Most used: ${topTools}`);
  }

  // Error patterns — proactive insight
  if (errPatternRes.rows.length > 0) {
    sections.push(`\n**Error Patterns**`);
    for (const row of errPatternRes.rows) {
      sections.push(`- ${row.tool_name}: ${row.cnt} failures`);
    }
    if (errPatternRes.rows.length > 0 && errPatternRes.rows[0].cnt >= 3) {
      sections.push(`_I noticed repeated failures in **${errPatternRes.rows[0].tool_name}**. Want me to investigate and create an improvement ticket?_`);
    }
  }

  // Action items
  const actionItems: string[] = [];
  if (approvalsRes.rows[0].c > 0) actionItems.push(`${approvalsRes.rows[0].c} pending approvals`);
  if (improvementsRes.rows[0].c > 0) actionItems.push(`${improvementsRes.rows[0].c} open improvements`);
  if (errorsRes.rows[0].c > 0) actionItems.push(`${errorsRes.rows[0].c} tool errors (24h)`);
  if (actionItems.length > 0) {
    sections.push(`\n**Action Items**`);
    for (const item of actionItems) sections.push(`- ${item}`);
  } else {
    sections.push(`\n_All clear — no pending actions._`);
  }

  // Milestone celebrations
  for (const m of milestones) {
    sections.push(`\n🎯 **Milestone:** ${m.message}`);
  }

  // New achievements
  for (const a of newAchievements) {
    sections.push(`\n${a.icon} **Achievement Unlocked:** ${a.title} — ${a.description}`);
  }

  // Signoff
  const signoff = personalityEngine.getSignoff();
  if (signoff) sections.push(`\n_${signoff}_`);

  const text = sections.join('\n');

  await canvasEmitter.emit({
    chat_id: hqChatId,
    channel,
    text,
  });
}

function startBuddyScheduler(pool: pg.Pool, canvasEmitter: CanvasEmitter, personalityEngine: PersonalityEngine): void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const settings = await getBuddySettings(pool);
      if (!settings.enabled || !isProactivityEnabled(settings.proactivity)) return;

      const now = new Date();
      const [hh, mm] = settings.daily_digest_time.split(':').map((v) => parseInt(v, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) return;

      if (now.getHours() !== hh || now.getMinutes() !== mm) return;

      const todayKey = now.toISOString().slice(0, 10);
      const lastDaily = await getSettingValue(pool, 'buddy.last_daily_digest');
      if (lastDaily !== todayKey) {
        await sendBuddyDigest(pool, canvasEmitter, 'Daily Digest', personalityEngine);
        await upsertSettingValue(pool, 'buddy.last_daily_digest', todayKey);
      }

      if (now.getDay() === 0) {
        const weekKey = getIsoWeekKey(now);
        const lastWeekly = await getSettingValue(pool, 'buddy.last_weekly_digest');
        if (lastWeekly !== weekKey) {
          await sendBuddyDigest(pool, canvasEmitter, 'Weekly Digest', personalityEngine);
          await upsertSettingValue(pool, 'buddy.last_weekly_digest', weekKey);
        }
      }
    } catch (err) {
      logger.error('Buddy scheduler error', { err: String(err) });
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, 60_000);
}

function startMemoryMaintenance(pool: pg.Pool, extractor: MemoryExtractor, isEnabled: () => boolean, bgSessions: BackgroundSessionManager): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await pool.query(
        `UPDATE memories
         SET importance = GREATEST(0.2::real, importance * EXP(-LN(2) * (EXTRACT(EPOCH FROM (NOW() - COALESCE(last_accessed_at, updated_at))) / 86400.0) / 90.0)),
             updated_at = NOW()
         WHERE importance > 0.2`,
      );

      await pool.query(`
        WITH ranked AS (
          SELECT id, visibility, user_id, chat_id, key, value, updated_at,
                 ROW_NUMBER() OVER (
                   PARTITION BY visibility, COALESCE(user_id::text, ''), COALESCE(chat_id::text, ''), lower(key)
                   ORDER BY updated_at DESC
                 ) AS rn
          FROM memories
        )
        DELETE FROM memories m
        USING ranked r
        WHERE m.id = r.id
          AND r.rn > 1
      `);

      // Memory extractor consolidation ("dream" — merge similar, apply decay, prune weak)
      if (isEnabled() && extractor.size > 0) {
        bgSessions.submit(async (report) => {
          report(10);
          const result = extractor.consolidate();
          report(100);
          logger.info('Memory extractor dream consolidation complete', {
            merged: result.merged,
            pruned: result.pruned,
            remaining: result.remaining,
          });
        }, { type: 'memory-consolidation', parentSessionId: 'maintenance' });
      }
    } catch (err) {
      logger.warn('Memory maintenance skipped', { err: String(err) });
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, 6 * 60 * 60 * 1000);
}

main().catch((err) => {
  logger.fatal('Agent runtime failed', { err: String(err) });
  process.exit(1);
});
