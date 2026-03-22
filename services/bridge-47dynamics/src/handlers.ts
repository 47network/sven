/**
 * SvenBridge gRPC Handler Implementations
 *
 * Each handler authenticates the service token, validates the tenant context,
 * and routes the request through TheSven's internal systems (NATS → agent-runtime,
 * RAG pipeline, etc.). Responses are mapped back to the proto contract.
 */

import { type ServerUnaryCall, type sendUnaryData, type ServerWritableStream, status as grpcStatus } from '@grpc/grpc-js';
import { v7 as uuidv7 } from 'uuid';
import { type Pool } from 'pg';
import { type NatsConnection, type JetStreamClient, StringCodec, JSONCodec } from 'nats';
import { type Logger } from '@sven/shared';

const sc = StringCodec();
const jc = JSONCodec();

// ─── Types (mirrors proto definitions) ──────────────────────────────────────

interface TenantContext {
  tenant_id: string;
  correlation_id: string;
}

interface CopilotAskRequest {
  tenant: TenantContext;
  question: string;
  context_device_ids: string[];
  context_alert_ids: string[];
  operational_context: {
    device_summary?: { total: number; online: number; offline: number };
    alert_summary?: { open_24h: number; critical: number; high: number };
    ticket_summary?: { open: number };
    context_devices?: Array<{ hostname: string; os: string; status: string; last_seen: string }>;
  };
}

interface SubmitActionRequest {
  tenant: TenantContext;
  source_model: string;
  action_type: string;
  summary: string;
  details_json: string;
  target_type: string;
  target_id: string;
  risk_level: string;
  proposed_by: string;
}

interface EdgeSummarizeRequest {
  tenant: TenantContext;
  text: string;
  max_length: number;
}

interface IndexDomainKnowledgeRequest {
  tenant: TenantContext;
  knowledge_type: string;
  documents: Array<{
    document_id: string;
    title: string;
    content: string;
    metadata: Record<string, string>;
    updated_at: string;
  }>;
}

interface RunbookSuggestRequest {
  tenant: TenantContext;
  alert_type: string;
  alert_severity: string;
  alert_description: string;
  device_context: string[];
}

interface HealthCheckRequest {
  tenant: TenantContext;
}

// ─── Dependencies ───────────────────────────────────────────────────────────

interface BridgeDeps {
  pool: Pool;
  nc: NatsConnection;
  js: JetStreamClient;
  config: {
    serviceToken: string;
    orgId: string;
    agentId: string;
    chatId: string;
    inferenceUrl: string;
    inferenceApiKey: string;
    embeddingsUrl: string;
    embeddingsModel: string;
    summarizeModel: string;
    requireTenantMapping: boolean;
  };
  logger: Logger;
}

interface BridgeTenantScope {
  organizationId: string;
  chatId: string;
  agentId: string;
  resolvedFromMapping: boolean;
  mappingTenantId: string;
}

// ─── Auth Interceptor ───────────────────────────────────────────────────────

function authenticateCall(call: ServerUnaryCall<any, any> | ServerWritableStream<any, any>, token: string): boolean {
  const meta = call.metadata;
  const authValues = meta.get('authorization');
  if (authValues.length === 0) return false;

  const provided = String(authValues[0]).replace(/^Bearer\s+/i, '');
  // Constant-time comparison via buffer
  const a = Buffer.from(provided, 'utf-8');
  const b = Buffer.from(token, 'utf-8');
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

function validateTenant(tenant: TenantContext | undefined): string | null {
  if (!tenant) return 'tenant context required';
  if (!tenant.tenant_id || tenant.tenant_id.length > 64) return 'invalid tenant_id';
  // Sanitize: only allow UUID-like or alphanumeric tenant IDs
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenant.tenant_id)) return 'tenant_id contains invalid characters';
  return null;
}

// ─── Handler Registration ───────────────────────────────────────────────────

export function registerBridgeHandlers(deps: BridgeDeps) {
  const { pool, nc, js, config, logger } = deps;

  async function resolveTenantScope(externalTenantId: string): Promise<BridgeTenantScope | null> {
    try {
      const mapping = await pool.query(
        `SELECT m.organization_id, m.chat_id, m.agent_id, m.external_tenant_id
         FROM bridge_tenant_mappings m
         JOIN chats c
           ON c.id = m.chat_id
          AND c.organization_id = m.organization_id
         JOIN agents a
           ON a.id = m.agent_id
          AND a.status = 'active'
         WHERE m.source_platform = '47dynamics'
           AND m.is_active = TRUE
           AND m.external_tenant_id IN ($1, '*')
         ORDER BY CASE WHEN m.external_tenant_id = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [externalTenantId],
      );
      if (mapping.rowCount && mapping.rows[0]) {
        return {
          organizationId: String(mapping.rows[0].organization_id),
          chatId: String(mapping.rows[0].chat_id),
          agentId: String(mapping.rows[0].agent_id),
          resolvedFromMapping: true,
          mappingTenantId: String(mapping.rows[0].external_tenant_id),
        };
      }
    } catch (err) {
      if (config.requireTenantMapping) {
        logger.error('bridge_tenant_mappings lookup failed', {
          tenant_id: externalTenantId,
          error: (err as Error).message,
        });
        return null;
      }
      logger.warn('bridge_tenant_mappings lookup unavailable; using fallback tenant scope', {
        tenant_id: externalTenantId,
        error: (err as Error).message,
      });
    }

    if (config.requireTenantMapping) {
      return null;
    }

    return {
      organizationId: config.orgId,
      chatId: config.chatId,
      agentId: config.agentId,
      resolvedFromMapping: false,
      mappingTenantId: '*fallback*',
    };
  }

  return {
    /**
     * CopilotAsk — synchronous RAG-augmented question answering.
     * Routes through NATS to the agent-runtime, waits for response.
     */
    CopilotAsk: async (call: ServerUnaryCall<CopilotAskRequest, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: tenantErr });
      }

      if (!req.question || req.question.length === 0 || req.question.length > 4000) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'question required (max 4000 chars)' });
      }

      const correlationId = req.tenant.correlation_id || uuidv7();
      const messageId = uuidv7();
      const tenantScope = await resolveTenantScope(req.tenant.tenant_id);
      if (!tenantScope) {
        return callback({ code: grpcStatus.NOT_FOUND, message: `tenant mapping not found for ${req.tenant.tenant_id}` });
      }

      logger.info('CopilotAsk received', {
        tenant_id: req.tenant.tenant_id,
        correlation_id: correlationId,
        mapped_tenant_id: tenantScope.mappingTenantId,
        mapped_org_id: tenantScope.organizationId,
        mapped_chat_id: tenantScope.chatId,
        question_length: req.question.length,
      });

      try {
        // Build the enriched message content for the agent
        let enrichedQuestion = req.question;
        if (req.operational_context) {
          const ctx = req.operational_context;
          const contextParts: string[] = [];

          if (ctx.device_summary) {
            contextParts.push(`[Device Inventory: ${ctx.device_summary.total} total, ${ctx.device_summary.online} online, ${ctx.device_summary.offline} offline]`);
          }
          if (ctx.alert_summary) {
            contextParts.push(`[Alerts 24h: ${ctx.alert_summary.open_24h} open, ${ctx.alert_summary.critical} critical, ${ctx.alert_summary.high} high]`);
          }
          if (ctx.ticket_summary) {
            contextParts.push(`[Open Tickets: ${ctx.ticket_summary.open}]`);
          }
          if (ctx.context_devices && ctx.context_devices.length > 0) {
            const deviceInfo = ctx.context_devices.map(
              (d: { hostname: string; os: string; status: string; last_seen: string }) => `${d.hostname} (${d.os}, ${d.status}, last seen: ${d.last_seen})`
            ).join('; ');
            contextParts.push(`[Devices in context: ${deviceInfo}]`);
          }

          if (contextParts.length > 0) {
            enrichedQuestion = `${contextParts.join('\n')}\n\nQuestion: ${req.question}`;
          }
        }

        // Store message in the 47Dynamics chat context
        await pool.query(
          `INSERT INTO messages (id, chat_id, sender_user_id, sender_identity_id, role, content_type, text, created_at)
           VALUES ($1, $2, $3, $3, 'user', 'text', $4, NOW())`,
          [messageId, tenantScope.chatId, '47dynamics-svc', enrichedQuestion]
        );

        // Publish to NATS for agent-runtime processing
        const inboundEvent = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            channel: '47dynamics',
            channel_message_id: messageId,
            chat_id: tenantScope.chatId,
            sender_identity_id: '47dynamics-svc',
            agent_id: tenantScope.agentId,
            content_type: 'text',
            text: enrichedQuestion,
            metadata: {
              agent_id: tenantScope.agentId,
              correlation_id: correlationId,
              source_tenant_id: req.tenant.tenant_id,
              source_platform: '47dynamics',
              organization_id: tenantScope.organizationId,
            },
          },
        };

        await js.publish('inbound.message.47dynamics', jc.encode(inboundEvent));

        // Wait for agent response via subscription with timeout
        const responseSub = nc.subscribe(`outbox.enqueue`, {
          timeout: 30_000,
        });

        let responseText = '';
        let sources: string[] = [];
        let suggestedActions: any[] = [];
        let modelUsed = '';
        let promptTokens = 0;
        let completionTokens = 0;

        // Poll for the response matching our chat context
        const timeout = setTimeout(() => {
          responseSub.unsubscribe();
        }, 30_000);

        for await (const msg of responseSub) {
          try {
            const envelope = jc.decode(msg.data) as any;
            const data = envelope.data ?? envelope;

            const responseCorrelationId = String(data.metadata?.correlation_id || '').trim();
            const correlationMatch = !responseCorrelationId || responseCorrelationId === correlationId;
            if (data.chat_id === tenantScope.chatId && correlationMatch) {
              responseText = data.text ?? '';
              sources = data.metadata?.sources ?? [];
              suggestedActions = data.metadata?.suggested_actions ?? [];
              modelUsed = data.metadata?.model ?? '';
              promptTokens = data.metadata?.prompt_tokens ?? 0;
              completionTokens = data.metadata?.completion_tokens ?? 0;
              clearTimeout(timeout);
              responseSub.unsubscribe();
              break;
            }
          } catch {
            // Skip non-matching messages
          }
        }

        clearTimeout(timeout);

        callback(null, {
          answer: responseText,
          sources,
          suggested_actions: suggestedActions.map((a: any) => ({
            label: a.label ?? '',
            action_type: a.action_type ?? '',
            payload: typeof a.payload === 'string' ? a.payload : JSON.stringify(a.payload ?? {}),
          })),
          model_used: modelUsed,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
        });
      } catch (err) {
        logger.error('CopilotAsk failed', {
          correlation_id: correlationId,
          error: (err as Error).message,
        });
        callback({ code: grpcStatus.INTERNAL, message: 'AI processing failed' });
      }
    },

    /**
     * CopilotAskStream — streaming RAG response for real-time token delivery.
     */
    CopilotAskStream: async (call: ServerWritableStream<CopilotAskRequest, any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        call.destroy(new Error('UNAUTHENTICATED: invalid service token'));
        return;
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        call.destroy(new Error(`INVALID_ARGUMENT: ${tenantErr}`));
        return;
      }

      const correlationId = req.tenant.correlation_id || uuidv7();
      const tenantScope = await resolveTenantScope(req.tenant.tenant_id);
      if (!tenantScope) {
        call.destroy(new Error(`NOT_FOUND: tenant mapping not found for ${req.tenant.tenant_id}`));
        return;
      }

      logger.info('CopilotAskStream received', {
        tenant_id: req.tenant.tenant_id,
        correlation_id: correlationId,
        mapped_tenant_id: tenantScope.mappingTenantId,
        mapped_org_id: tenantScope.organizationId,
        mapped_chat_id: tenantScope.chatId,
      });

      try {
        // Publish inbound message (same as CopilotAsk)
        const messageId = uuidv7();
        const inboundEvent = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            channel: '47dynamics',
            channel_message_id: messageId,
            chat_id: tenantScope.chatId,
            sender_identity_id: '47dynamics-svc',
            agent_id: tenantScope.agentId,
            content_type: 'text',
            text: req.question,
            metadata: {
              agent_id: tenantScope.agentId,
              correlation_id: correlationId,
              source_tenant_id: req.tenant.tenant_id,
              source_platform: '47dynamics',
              organization_id: tenantScope.organizationId,
              stream: true,
            },
          },
        };

        await js.publish('inbound.message.47dynamics', jc.encode(inboundEvent));

        // Stream responses
        const responseSub = nc.subscribe('outbox.enqueue', { timeout: 60_000 });

        for await (const msg of responseSub) {
          try {
            const envelope = jc.decode(msg.data) as any;
            const data = envelope.data ?? envelope;

            const responseCorrelationId = String(data.metadata?.correlation_id || '').trim();
            const correlationMatch = !responseCorrelationId || responseCorrelationId === correlationId;
            if (data.chat_id === tenantScope.chatId && correlationMatch) {
              const isDone = data.metadata?.done === true;

              call.write({
                token: data.text ?? '',
                done: isDone,
                final_response: isDone ? {
                  answer: data.text ?? '',
                  sources: data.metadata?.sources ?? [],
                  suggested_actions: [],
                  model_used: data.metadata?.model ?? '',
                  prompt_tokens: data.metadata?.prompt_tokens ?? 0,
                  completion_tokens: data.metadata?.completion_tokens ?? 0,
                } : undefined,
              });

              if (isDone) {
                responseSub.unsubscribe();
                break;
              }
            }
          } catch {
            // Skip malformed messages
          }
        }

        call.end();
      } catch (err) {
        logger.error('CopilotAskStream failed', {
          correlation_id: correlationId,
          error: (err as Error).message,
        });
        call.destroy(new Error('AI processing failed'));
      }
    },

    /**
     * SubmitAction — stores an AI-proposed action for human-in-the-loop approval.
     */
    SubmitAction: async (call: ServerUnaryCall<SubmitActionRequest, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: tenantErr });
      }

      if (!req.action_type || !req.summary) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'action_type and summary required' });
      }

      const actionId = uuidv7();
      const correlationId = req.tenant.correlation_id || uuidv7();
      const tenantScope = await resolveTenantScope(req.tenant.tenant_id);
      if (!tenantScope) {
        return callback({ code: grpcStatus.NOT_FOUND, message: `tenant mapping not found for ${req.tenant.tenant_id}` });
      }

      logger.info('SubmitAction received', {
        tenant_id: req.tenant.tenant_id,
        correlation_id: correlationId,
        mapped_tenant_id: tenantScope.mappingTenantId,
        mapped_org_id: tenantScope.organizationId,
        mapped_chat_id: tenantScope.chatId,
        action_type: req.action_type,
        risk_level: req.risk_level,
      });

      try {
        // Publish as tool run request for approval gate
        const toolRequest = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            run_id: actionId,
            correlation_id: correlationId,
            tool_name: `47dynamics.action.${req.action_type}`,
            chat_id: tenantScope.chatId,
            user_id: '47dynamics-svc',
            inputs: {
              source_model: req.source_model,
              summary: req.summary,
              details: req.details_json,
              target_type: req.target_type,
              target_id: req.target_id,
              risk_level: req.risk_level,
              proposed_by: req.proposed_by,
              source_tenant_id: req.tenant.tenant_id,
            },
            justification: {
              user_message_ids: [],
              rag_citations: [],
            },
          },
        };

        await js.publish('tool.run.request', jc.encode(toolRequest));

        callback(null, {
          action_id: actionId,
          status: 'ACTION_STATUS_PENDING',
        });
      } catch (err) {
        logger.error('SubmitAction failed', {
          correlation_id: correlationId,
          error: (err as Error).message,
        });
        callback({ code: grpcStatus.INTERNAL, message: 'action submission failed' });
      }
    },

    /**
     * GetActionStatus — retrieves the current status of a submitted action.
     */
    GetActionStatus: async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: tenantErr });
      }

      if (!req.action_id) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'action_id required' });
      }
      const tenantScope = await resolveTenantScope(req.tenant.tenant_id);
      if (!tenantScope) {
        return callback({ code: grpcStatus.NOT_FOUND, message: `tenant mapping not found for ${req.tenant.tenant_id}` });
      }

      try {
        const result = await pool.query(
          `SELECT tr.status, tr.outputs, tr.duration_ms, tr.created_at
           FROM tool_runs tr
           WHERE tr.id = $1 AND tr.chat_id = $2`,
          [req.action_id, tenantScope.chatId]
        );

        if (result.rowCount === 0) {
          return callback({ code: grpcStatus.NOT_FOUND, message: 'action not found' });
        }

        const row = result.rows[0];
        const statusMap: Record<string, string> = {
          running: 'ACTION_STATUS_PENDING',
          success: 'ACTION_STATUS_EXECUTED',
          error: 'ACTION_STATUS_REJECTED',
          timeout: 'ACTION_STATUS_EXPIRED',
          denied: 'ACTION_STATUS_REJECTED',
        };

        callback(null, {
          action_id: req.action_id,
          status: statusMap[row.status] ?? 'ACTION_STATUS_UNSPECIFIED',
          reviewed_by: row.outputs?.reviewed_by ?? '',
          review_comment: row.outputs?.review_comment ?? '',
          executed_at: row.status === 'success' ? row.created_at?.toISOString() ?? '' : '',
        });
      } catch (err) {
        logger.error('GetActionStatus failed', { error: (err as Error).message });
        callback({ code: grpcStatus.INTERNAL, message: 'status lookup failed' });
      }
    },

    /**
     * EdgeSummarize — CPU-quantized summarization for edge/gateway deployments.
     * Routes to local Ollama model via LiteLLM.
     */
    EdgeSummarize: async (call: ServerUnaryCall<EdgeSummarizeRequest, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: tenantErr });
      }

      if (!req.text || req.text.length === 0) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'text required' });
      }

      const correlationId = req.tenant.correlation_id || uuidv7();

      try {
        // Call LiteLLM directly for edge summarization (uses local Ollama model)
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.inferenceApiKey) {
          headers['Authorization'] = `Bearer ${config.inferenceApiKey}`;
        }
        const response = await fetch(`${config.inferenceUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.summarizeModel,
            messages: [
              { role: 'system', content: 'You are a concise summarizer for IT operations data. Provide clear, actionable summaries.' },
              { role: 'user', content: `Summarize the following in ${req.max_length || 200} tokens or fewer:\n\n${req.text}` },
            ],
            max_tokens: req.max_length || 200,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          throw new Error(`LiteLLM returned ${response.status}`);
        }

        const result = await response.json() as any;
        const summary = result.choices?.[0]?.message?.content ?? '';

        callback(null, {
          summary,
          model_used: result.model ?? config.summarizeModel,
        });
      } catch (err) {
        logger.error('EdgeSummarize failed', {
          correlation_id: correlationId,
          error: (err as Error).message,
        });
        callback({ code: grpcStatus.INTERNAL, message: 'summarization failed' });
      }
    },

    /**
     * IndexDomainKnowledge — ingests 47Dynamics domain documents into TheSven's RAG pipeline.
     */
    IndexDomainKnowledge: async (call: ServerUnaryCall<IndexDomainKnowledgeRequest, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: tenantErr });
      }

      if (!req.documents || req.documents.length === 0) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'at least one document required' });
      }

      // Cap batch size
      if (req.documents.length > 100) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'max 100 documents per batch' });
      }

      const correlationId = req.tenant.correlation_id || uuidv7();
      const tenantScope = await resolveTenantScope(req.tenant.tenant_id);
      if (!tenantScope) {
        return callback({ code: grpcStatus.NOT_FOUND, message: `tenant mapping not found for ${req.tenant.tenant_id}` });
      }
      let indexed = 0;
      let skipped = 0;
      const errors: string[] = [];

      logger.info('IndexDomainKnowledge received', {
        tenant_id: req.tenant.tenant_id,
        correlation_id: correlationId,
        mapped_tenant_id: tenantScope.mappingTenantId,
        mapped_org_id: tenantScope.organizationId,
        mapped_chat_id: tenantScope.chatId,
        knowledge_type: req.knowledge_type,
        document_count: req.documents.length,
      });

      try {
        for (const doc of req.documents) {
          try {
            // Publish each document to the RAG indexing pipeline
            const indexEvent = {
              schema_version: '1.0',
              event_id: uuidv7(),
              occurred_at: new Date().toISOString(),
              data: {
                document_id: doc.document_id,
                title: doc.title,
                content: doc.content,
                metadata: {
                  ...doc.metadata,
                  source_platform: '47dynamics',
                  source_tenant_id: req.tenant.tenant_id,
                  knowledge_type: req.knowledge_type,
                  organization_id: tenantScope.organizationId,
                },
                updated_at: doc.updated_at,
              },
            };

            await js.publish('rag.index.request', jc.encode(indexEvent));
            indexed++;
          } catch (docErr) {
            errors.push(`${doc.document_id}: ${(docErr as Error).message}`);
          }
        }

        callback(null, {
          documents_indexed: indexed,
          documents_skipped: skipped,
          errors,
        });
      } catch (err) {
        logger.error('IndexDomainKnowledge failed', {
          correlation_id: correlationId,
          error: (err as Error).message,
        });
        callback({ code: grpcStatus.INTERNAL, message: 'indexing failed' });
      }
    },

    /**
     * RunbookSuggest — RAG-powered runbook recommendation for alert types.
     */
    RunbookSuggest: async (call: ServerUnaryCall<RunbookSuggestRequest, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const req = call.request;
      const tenantErr = validateTenant(req.tenant);
      if (tenantErr) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: tenantErr });
      }

      if (!req.alert_type) {
        return callback({ code: grpcStatus.INVALID_ARGUMENT, message: 'alert_type required' });
      }

      const correlationId = req.tenant.correlation_id || uuidv7();
      const tenantScope = await resolveTenantScope(req.tenant.tenant_id);
      if (!tenantScope) {
        return callback({ code: grpcStatus.NOT_FOUND, message: `tenant mapping not found for ${req.tenant.tenant_id}` });
      }

      try {
        // Build a RAG query for runbook retrieval
        const queryText = [
          `Alert type: ${req.alert_type}`,
          `Severity: ${req.alert_severity || 'unknown'}`,
          req.alert_description ? `Description: ${req.alert_description}` : '',
          req.device_context.length > 0 ? `Device context: ${req.device_context.join(', ')}` : '',
          'Find the most relevant operational runbooks for this alert.',
        ].filter(Boolean).join('\n');

        // Query the RAG pipeline via NATS
        const queryId = uuidv7();
        const ragQuery = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            query_id: queryId,
            query: queryText,
            filters: {
              knowledge_type: 'KNOWLEDGE_TYPE_RUNBOOK',
              organization_id: tenantScope.organizationId,
              source_tenant_id: req.tenant.tenant_id,
            },
            top_k: 5,
          },
        };

        await js.publish('rag.index.request', jc.encode(ragQuery));

        // Wait for RAG results
        const resultSub = nc.subscribe('rag.index.result', { timeout: 15_000 });
        const suggestions: any[] = [];

        for await (const msg of resultSub) {
          try {
            const envelope = jc.decode(msg.data) as any;
            const data = envelope.data ?? envelope;

            if (data.query_id === queryId) {
              const results = data.results ?? [];
              for (const result of results) {
                suggestions.push({
                  runbook_id: result.document_id ?? '',
                  runbook_name: result.title ?? '',
                  summary: result.snippet ?? result.content?.substring(0, 200) ?? '',
                  confidence: result.score ?? 0,
                  reasoning: `Matched via ${result.match_type ?? 'hybrid'} search with score ${result.score?.toFixed(3) ?? 'N/A'}`,
                });
              }
              resultSub.unsubscribe();
              break;
            }
          } catch {
            // Skip
          }
        }

        callback(null, { suggestions });
      } catch (err) {
        logger.error('RunbookSuggest failed', {
          correlation_id: correlationId,
          error: (err as Error).message,
        });
        callback({ code: grpcStatus.INTERNAL, message: 'runbook suggestion failed' });
      }
    },

    /**
     * HealthCheck — verifies TheSven backend health for 47Dynamics monitoring.
     */
    HealthCheck: async (call: ServerUnaryCall<HealthCheckRequest, any>, callback: sendUnaryData<any>) => {
      if (!authenticateCall(call, config.serviceToken)) {
        return callback({ code: grpcStatus.UNAUTHENTICATED, message: 'invalid service token' });
      }

      const checks: Record<string, string> = {
        overall: 'SERVICE_HEALTH_HEALTHY',
        llm_provider: 'SERVICE_HEALTH_UNSPECIFIED',
        rag_pipeline: 'SERVICE_HEALTH_UNSPECIFIED',
        vector_store: 'SERVICE_HEALTH_UNSPECIFIED',
      };

      // Check PostgreSQL
      try {
        await pool.query('SELECT 1');
      } catch {
        checks.overall = 'SERVICE_HEALTH_UNHEALTHY';
      }

      // Check NATS
      try {
        if (nc.isClosed()) {
          checks.overall = 'SERVICE_HEALTH_DEGRADED';
        }
      } catch {
        checks.overall = 'SERVICE_HEALTH_DEGRADED';
      }

      // Check LLM provider (LiteLLM)
      try {
        const resp = await fetch(`${config.inferenceUrl}/health/liveliness`, {
          signal: AbortSignal.timeout(5_000),
        });
        checks.llm_provider = resp.ok ? 'SERVICE_HEALTH_HEALTHY' : 'SERVICE_HEALTH_DEGRADED';
      } catch {
        checks.llm_provider = 'SERVICE_HEALTH_UNHEALTHY';
      }

      // RAG and vector store health derived from NATS + DB connectivity
      checks.rag_pipeline = checks.overall;
      checks.vector_store = checks.overall;

      callback(null, checks);
    },
  };
}
