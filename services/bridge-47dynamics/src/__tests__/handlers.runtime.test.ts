import test from 'node:test';
import assert from 'node:assert/strict';

import { registerBridgeHandlers } from '../handlers.ts';

function authMetadata(token: string) {
  return {
    get(key: string) {
      if (key.toLowerCase() === 'authorization') return [`Bearer ${token}`];
      return [] as string[];
    },
  };
}

function createPoolMock() {
  return {
    query: async (sql: string) => {
      if (sql.includes('FROM bridge_tenant_mappings')) {
        return {
          rowCount: 1,
          rows: [
            {
              organization_id: 'org-1',
              chat_id: 'chat-1',
              agent_id: 'agent-1',
              external_tenant_id: 'tenant-1',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO messages')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

function createUnmappedPoolMock() {
  return {
    query: async (sql: string) => {
      if (sql.includes('FROM bridge_tenant_mappings')) {
        return {
          rowCount: 0,
          rows: [],
        };
      }
      if (sql.includes('INSERT INTO messages')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

function createActionStatusPoolMock() {
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM bridge_tenant_mappings')) {
        return {
          rowCount: 1,
          rows: [
            {
              organization_id: 'org-1',
              chat_id: 'chat-1',
              agent_id: 'agent-1',
              external_tenant_id: 'tenant-1',
            },
          ],
        };
      }
      if (sql.includes('FROM tool_runs tr')) {
        const actionId = String(params?.[0] || '');
        const chatId = String(params?.[1] || '');
        if (actionId === 'action-owned-by-chat-1' && chatId === 'chat-1') {
          return {
            rowCount: 1,
            rows: [
              {
                status: 'success',
                outputs: { reviewed_by: 'human-approver', review_comment: 'approved' },
                duration_ms: 200,
                created_at: new Date('2026-03-21T09:00:00.000Z'),
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

function createHealthPoolMock(options?: { failDb?: boolean }) {
  return {
    query: async (sql: string) => {
      if (sql.includes('SELECT 1') && options?.failDb) {
        throw new Error('db unavailable');
      }
      return { rowCount: 1, rows: [{ ok: 1 }] };
    },
  };
}

function toJsonBytes(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(value));
}

function createSubscription(messages: unknown[]) {
  let unsubscribed = false;
  return {
    unsubscribe() {
      unsubscribed = true;
    },
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) {
        if (unsubscribed) break;
        yield { data: toJsonBytes(msg) };
      }
    },
  };
}

test('CopilotAsk ignores same-chat response with different correlation id and returns matching response', async () => {
  const published: Array<{ subject: string; data: Uint8Array }> = [];
  const nc = {
    subscribe: () => createSubscription([
      {
        data: {
          chat_id: 'chat-1',
          text: 'wrong response',
          metadata: { correlation_id: 'corr-other' },
        },
      },
      {
        data: {
          chat_id: 'chat-1',
          text: 'correct response',
          metadata: { correlation_id: 'corr-1', model: 'ollama/llama3.2:3b' },
        },
      },
    ]),
  };
  const js = {
    publish: async (subject: string, data: Uint8Array) => {
      published.push({ subject, data });
    },
  };

  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: nc as any,
    js: js as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const result = await new Promise<any>((resolve, reject) => {
    handlers.CopilotAsk(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-1' },
          question: 'What is the status?',
          context_device_ids: [],
          context_alert_ids: [],
          operational_context: {},
        },
      } as any,
      (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response);
      },
    );
  });

  assert.equal(result.answer, 'correct response');
  assert.equal(result.model_used, 'ollama/llama3.2:3b');

  assert.ok(published.length > 0);
  const inbound = JSON.parse(Buffer.from(published[0]!.data).toString('utf8'));
  assert.equal(inbound.data.metadata.correlation_id, 'corr-1');
});

test('CopilotAskStream emits only matching-correlation chunk for same chat', async () => {
  const writes: any[] = [];
  let ended = false;

  const nc = {
    subscribe: () => createSubscription([
      {
        data: {
          chat_id: 'chat-1',
          text: 'ignore me',
          metadata: { correlation_id: 'corr-other', done: true },
        },
      },
      {
        data: {
          chat_id: 'chat-1',
          text: 'final token',
          metadata: { correlation_id: 'corr-stream', done: true, model: 'ollama/llama3.2:3b' },
        },
      },
    ]),
  };

  const js = {
    publish: async () => {},
  };

  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: nc as any,
    js: js as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  await handlers.CopilotAskStream({
    metadata: authMetadata('svc-token'),
    request: {
      tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-stream' },
      question: 'Stream please',
      context_device_ids: [],
      context_alert_ids: [],
      operational_context: {},
    },
    write(chunk: any) {
      writes.push(chunk);
      return true;
    },
    end() {
      ended = true;
    },
    destroy(err: any) {
      throw err;
    },
  } as any);

  assert.equal(ended, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.token, 'final token');
  assert.equal(writes[0]?.done, true);
  assert.equal(writes[0]?.final_response?.model_used, 'ollama/llama3.2:3b');
});

test('CopilotAsk returns NOT_FOUND when strict tenant mapping is enabled and tenant is unmapped', async () => {
  const handlers = registerBridgeHandlers({
    pool: createUnmappedPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.CopilotAsk(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-unmapped', correlation_id: 'corr-strict' },
          question: 'hello',
          context_device_ids: [],
          context_alert_ids: [],
          operational_context: {},
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 5);
  assert.match(String(err?.message || ''), /tenant mapping not found/i);
});

test('CopilotAsk falls back to legacy scope when strict tenant mapping is disabled', async () => {
  const published: Array<{ subject: string; data: Uint8Array }> = [];
  const handlers = registerBridgeHandlers({
    pool: createUnmappedPoolMock() as any,
    nc: {
      subscribe: () => createSubscription([
        {
          data: {
            chat_id: 'chat-legacy',
            text: 'legacy response',
            metadata: { correlation_id: 'corr-fallback', model: 'ollama/llama3.2:3b' },
          },
        },
      ]),
    } as any,
    js: {
      publish: async (subject: string, data: Uint8Array) => {
        published.push({ subject, data });
      },
    } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: false,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const result = await new Promise<any>((resolve, reject) => {
    handlers.CopilotAsk(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-unmapped', correlation_id: 'corr-fallback' },
          question: 'hello',
          context_device_ids: [],
          context_alert_ids: [],
          operational_context: {},
        },
      } as any,
      (callbackErr: any, response: any) => {
        if (callbackErr) reject(callbackErr);
        else resolve(response);
      },
    );
  });

  assert.equal(result.answer, 'legacy response');
  assert.ok(published.length > 0);
  const inbound = JSON.parse(Buffer.from(published[0]!.data).toString('utf8'));
  assert.equal(inbound.data.chat_id, 'chat-legacy');
  assert.equal(inbound.data.agent_id, 'agent-legacy');
});

test('GetActionStatus rejects invalid service token', async () => {
  const handlers = registerBridgeHandlers({
    pool: createActionStatusPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.GetActionStatus(
      {
        metadata: authMetadata('wrong-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-auth' },
          action_id: 'action-owned-by-chat-1',
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 16);
  assert.match(String(err?.message || ''), /invalid service token/i);
});

test('GetActionStatus enforces tenant-scoped chat isolation for action lookups', async () => {
  const handlers = registerBridgeHandlers({
    pool: createActionStatusPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const notFoundErr = await new Promise<any>((resolve) => {
    handlers.GetActionStatus(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-iso' },
          action_id: 'action-owned-by-other-chat',
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });
  assert.equal(notFoundErr?.code, 5);
  assert.match(String(notFoundErr?.message || ''), /action not found/i);

  const owned = await new Promise<any>((resolve, reject) => {
    handlers.GetActionStatus(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-iso' },
          action_id: 'action-owned-by-chat-1',
        },
      } as any,
      (callbackErr: any, response: any) => {
        if (callbackErr) reject(callbackErr);
        else resolve(response);
      },
    );
  });
  assert.equal(owned.status, 'ACTION_STATUS_EXECUTED');
  assert.equal(owned.reviewed_by, 'human-approver');
});

test('SubmitAction publishes tool.run.request with mapped chat scope and tenant metadata', async () => {
  const published: Array<{ subject: string; data: Uint8Array }> = [];
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: {
      publish: async (subject: string, data: Uint8Array) => {
        published.push({ subject, data });
      },
    } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const response = await new Promise<any>((resolve, reject) => {
    handlers.SubmitAction(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-submit' },
          source_model: 'ollama/llama3.2:3b',
          action_type: 'reboot_device',
          summary: 'Reboot endpoint after patching',
          details_json: '{"reason":"kernel update"}',
          target_type: 'device',
          target_id: 'dev-77',
          risk_level: 'medium',
          proposed_by: 'copilot',
        },
      } as any,
      (err: any, value: any) => {
        if (err) reject(err);
        else resolve(value);
      },
    );
  });

  assert.equal(response.status, 'ACTION_STATUS_PENDING');
  assert.ok(String(response.action_id || '').length > 0);
  assert.equal(published.length, 1);
  assert.equal(published[0]?.subject, 'tool.run.request');

  const envelope = JSON.parse(Buffer.from(published[0]!.data).toString('utf8'));
  assert.equal(envelope.data.correlation_id, 'corr-submit');
  assert.equal(envelope.data.chat_id, 'chat-1');
  assert.equal(envelope.data.tool_name, '47dynamics.action.reboot_device');
  assert.equal(envelope.data.inputs.source_tenant_id, 'tenant-1');
  assert.equal(envelope.data.inputs.target_id, 'dev-77');
});

test('IndexDomainKnowledge publishes rag.index.request with required tenant metadata', async () => {
  const published: Array<{ subject: string; data: Uint8Array }> = [];
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: {
      publish: async (subject: string, data: Uint8Array) => {
        published.push({ subject, data });
      },
    } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const result = await new Promise<any>((resolve, reject) => {
    handlers.IndexDomainKnowledge(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-index' },
          knowledge_type: 'KNOWLEDGE_TYPE_RUNBOOK',
          documents: [
            {
              document_id: 'doc-1',
              title: 'Disk pressure remediation',
              content: 'Runbook content',
              metadata: { source_system: '47dynamics-rmm' },
              updated_at: '2026-03-21T10:00:00.000Z',
            },
          ],
        },
      } as any,
      (err: any, value: any) => {
        if (err) reject(err);
        else resolve(value);
      },
    );
  });

  assert.equal(result.documents_indexed, 1);
  assert.equal(result.documents_skipped, 0);
  assert.deepEqual(result.errors, []);
  assert.equal(published.length, 1);
  assert.equal(published[0]?.subject, 'rag.index.request');

  const envelope = JSON.parse(Buffer.from(published[0]!.data).toString('utf8'));
  assert.equal(envelope.data.document_id, 'doc-1');
  assert.equal(envelope.data.metadata.source_platform, '47dynamics');
  assert.equal(envelope.data.metadata.source_tenant_id, 'tenant-1');
  assert.equal(envelope.data.metadata.knowledge_type, 'KNOWLEDGE_TYPE_RUNBOOK');
  assert.equal(envelope.data.metadata.organization_id, 'org-1');
  assert.equal(envelope.data.metadata.source_system, '47dynamics-rmm');
});

test('RunbookSuggest publishes runbook query and returns only matching-query suggestions', async () => {
  const published: Array<{ subject: string; data: Uint8Array }> = [];
  let queryId = '';

  const js = {
    publish: async (subject: string, data: Uint8Array) => {
      published.push({ subject, data });
      const envelope = JSON.parse(Buffer.from(data).toString('utf8'));
      queryId = String(envelope?.data?.query_id || '');
    },
  };

  const nc = {
    subscribe: () => createSubscription([
      {
        data: {
          query_id: 'query-other',
          results: [
            {
              document_id: 'rb-other',
              title: 'Ignore me',
              snippet: 'wrong correlation',
              score: 0.1,
              match_type: 'text',
            },
          ],
        },
      },
      {
        data: {
          query_id: queryId,
          results: [
            {
              document_id: 'rb-1',
              title: 'Disk Pressure Runbook',
              snippet: 'Check disk usage and prune logs.',
              score: 0.93,
              match_type: 'text',
            },
          ],
        },
      },
    ]),
  };

  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: nc as any,
    js: js as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const response = await new Promise<any>((resolve, reject) => {
    handlers.RunbookSuggest(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-runbook' },
          alert_type: 'disk_pressure',
          alert_severity: 'critical',
          alert_description: 'Disk usage exceeded 90%',
          device_context: ['host-1'],
        },
      } as any,
      (err: any, value: any) => {
        if (err) reject(err);
        else resolve(value);
      },
    );
  });

  assert.equal(published.length, 1);
  assert.equal(published[0]?.subject, 'rag.index.request');
  const queryEnvelope = JSON.parse(Buffer.from(published[0]!.data).toString('utf8'));
  assert.equal(queryEnvelope.data.filters.knowledge_type, 'KNOWLEDGE_TYPE_RUNBOOK');
  assert.equal(queryEnvelope.data.filters.organization_id, 'org-1');
  assert.equal(queryEnvelope.data.filters.source_tenant_id, 'tenant-1');
  assert.equal(queryEnvelope.data.top_k, 5);
  assert.equal(String(queryEnvelope.data.query).includes('Alert type: disk_pressure'), true);

  assert.equal(Array.isArray(response.suggestions), true);
  assert.equal(response.suggestions.length, 1);
  assert.equal(response.suggestions[0]?.runbook_id, 'rb-1');
  assert.equal(response.suggestions[0]?.runbook_name, 'Disk Pressure Runbook');
});

test('RunbookSuggest returns empty suggestions when no matching query result arrives', async () => {
  let queryId = '';
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: {
      subscribe: () => createSubscription([
        { data: { query_id: 'different-query', results: [{ document_id: 'rb-x' }] } },
      ]),
    } as any,
    js: {
      publish: async (_subject: string, data: Uint8Array) => {
        const envelope = JSON.parse(Buffer.from(data).toString('utf8'));
        queryId = String(envelope?.data?.query_id || '');
      },
    } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const response = await new Promise<any>((resolve, reject) => {
    handlers.RunbookSuggest(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-runbook-empty' },
          alert_type: 'cpu_spike',
          alert_severity: 'high',
          alert_description: '',
          device_context: [],
        },
      } as any,
      (err: any, value: any) => {
        if (err) reject(err);
        else resolve(value);
      },
    );
  });

  assert.ok(queryId.length > 0);
  assert.deepEqual(response.suggestions, []);
});

test('HealthCheck reports healthy when DB, NATS, and LiteLLM are healthy', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: true } as unknown as Response)) as typeof fetch;
  try {
    const handlers = registerBridgeHandlers({
      pool: createHealthPoolMock() as any,
      nc: {
        subscribe: () => createSubscription([]),
        isClosed: () => false,
      } as any,
      js: { publish: async () => {} } as any,
      config: {
        serviceToken: 'svc-token',
        orgId: 'org-legacy',
        agentId: 'agent-legacy',
        chatId: 'chat-legacy',
        inferenceUrl: 'http://litellm:4000',
        inferenceApiKey: '',
        embeddingsUrl: 'http://litellm:4000',
        embeddingsModel: 'text-embedding-3-small',
        summarizeModel: 'ollama/llama3.2:3b',
        requireTenantMapping: true,
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        fatal: () => {},
      } as any,
    });

    const result = await new Promise<any>((resolve, reject) => {
      handlers.HealthCheck(
        {
          metadata: authMetadata('svc-token'),
          request: { tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-health-ok' } },
        } as any,
        (err: any, value: any) => {
          if (err) reject(err);
          else resolve(value);
        },
      );
    });

    assert.equal(result.overall, 'SERVICE_HEALTH_HEALTHY');
    assert.equal(result.llm_provider, 'SERVICE_HEALTH_HEALTHY');
    assert.equal(result.rag_pipeline, 'SERVICE_HEALTH_HEALTHY');
    assert.equal(result.vector_store, 'SERVICE_HEALTH_HEALTHY');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('HealthCheck reports degraded/unhealthy based on DB, NATS, and LiteLLM failures', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('litellm down');
  }) as typeof fetch;
  try {
    const handlers = registerBridgeHandlers({
      pool: createHealthPoolMock({ failDb: true }) as any,
      nc: {
        subscribe: () => createSubscription([]),
        isClosed: () => true,
      } as any,
      js: { publish: async () => {} } as any,
      config: {
        serviceToken: 'svc-token',
        orgId: 'org-legacy',
        agentId: 'agent-legacy',
        chatId: 'chat-legacy',
        inferenceUrl: 'http://litellm:4000',
        inferenceApiKey: '',
        embeddingsUrl: 'http://litellm:4000',
        embeddingsModel: 'text-embedding-3-small',
        summarizeModel: 'ollama/llama3.2:3b',
        requireTenantMapping: true,
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        fatal: () => {},
      } as any,
    });

    const result = await new Promise<any>((resolve, reject) => {
      handlers.HealthCheck(
        {
          metadata: authMetadata('svc-token'),
          request: { tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-health-bad' } },
        } as any,
        (err: any, value: any) => {
          if (err) reject(err);
          else resolve(value);
        },
      );
    });

    assert.equal(result.overall, 'SERVICE_HEALTH_DEGRADED');
    assert.equal(result.llm_provider, 'SERVICE_HEALTH_UNHEALTHY');
    assert.equal(result.rag_pipeline, 'SERVICE_HEALTH_DEGRADED');
    assert.equal(result.vector_store, 'SERVICE_HEALTH_DEGRADED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('EdgeSummarize rejects invalid service token', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-legacy',
      agentId: 'agent-legacy',
      chatId: 'chat-legacy',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.EdgeSummarize(
      {
        metadata: authMetadata('wrong-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-sum-auth' },
          text: 'Summarize this.',
          max_length: 120,
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 16);
  assert.match(String(err?.message || ''), /invalid service token/i);
});

test('EdgeSummarize returns summary and model on successful LiteLLM response', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        model: 'ollama/llama3.2:3b',
        choices: [{ message: { content: 'Concise summary output.' } }],
      }),
    } as unknown as Response)) as typeof fetch;
  try {
    const handlers = registerBridgeHandlers({
      pool: createPoolMock() as any,
      nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
      js: { publish: async () => {} } as any,
      config: {
        serviceToken: 'svc-token',
        orgId: 'org-legacy',
        agentId: 'agent-legacy',
        chatId: 'chat-legacy',
        inferenceUrl: 'http://litellm:4000',
        inferenceApiKey: '',
        embeddingsUrl: 'http://litellm:4000',
        embeddingsModel: 'text-embedding-3-small',
        summarizeModel: 'ollama/llama3.2:3b',
        requireTenantMapping: true,
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        fatal: () => {},
      } as any,
    });

    const result = await new Promise<any>((resolve, reject) => {
      handlers.EdgeSummarize(
        {
          metadata: authMetadata('svc-token'),
          request: {
            tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-sum-ok' },
            text: 'Summarize this very long alert context.',
            max_length: 80,
          },
        } as any,
        (err: any, value: any) => {
          if (err) reject(err);
          else resolve(value);
        },
      );
    });

    assert.equal(result.summary, 'Concise summary output.');
    assert.equal(result.model_used, 'ollama/llama3.2:3b');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('EdgeSummarize returns INTERNAL when LiteLLM responds with non-OK status', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response)) as typeof fetch;
  try {
    const handlers = registerBridgeHandlers({
      pool: createPoolMock() as any,
      nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
      js: { publish: async () => {} } as any,
      config: {
        serviceToken: 'svc-token',
        orgId: 'org-legacy',
        agentId: 'agent-legacy',
        chatId: 'chat-legacy',
        inferenceUrl: 'http://litellm:4000',
        inferenceApiKey: '',
        embeddingsUrl: 'http://litellm:4000',
        embeddingsModel: 'text-embedding-3-small',
        summarizeModel: 'ollama/llama3.2:3b',
        requireTenantMapping: true,
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        fatal: () => {},
      } as any,
    });

    const err = await new Promise<any>((resolve) => {
      handlers.EdgeSummarize(
        {
          metadata: authMetadata('svc-token'),
          request: {
            tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-sum-fail' },
            text: 'Summarize this.',
            max_length: 80,
          },
        } as any,
        (callbackErr: any) => resolve(callbackErr),
      );
    });

    assert.equal(err?.code, 13);
    assert.match(String(err?.message || ''), /summarization failed/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CopilotAsk rejects invalid tenant_id format', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.CopilotAsk(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant bad!', correlation_id: 'corr-invalid-tenant' },
          question: 'hello',
          context_device_ids: [],
          context_alert_ids: [],
          operational_context: {},
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /tenant_id contains invalid characters/i);
});

test('CopilotAsk rejects empty question', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.CopilotAsk(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-empty-q' },
          question: '',
          context_device_ids: [],
          context_alert_ids: [],
          operational_context: {},
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /question required/i);
});

test('CopilotAsk rejects question longer than 4000 chars', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]) } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.CopilotAsk(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-long-q' },
          question: 'x'.repeat(4001),
          context_device_ids: [],
          context_alert_ids: [],
          operational_context: {},
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /max 4000 chars/i);
});

test('IndexDomainKnowledge rejects invalid service token', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.IndexDomainKnowledge(
      {
        metadata: authMetadata('wrong-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-index-auth' },
          knowledge_type: 'KNOWLEDGE_TYPE_RUNBOOK',
          documents: [
            {
              document_id: 'doc-1',
              title: 'x',
              content: 'x',
              metadata: {},
              updated_at: '2026-03-21T10:00:00.000Z',
            },
          ],
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 16);
  assert.match(String(err?.message || ''), /invalid service token/i);
});

test('IndexDomainKnowledge rejects empty document batches', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.IndexDomainKnowledge(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-index-empty' },
          knowledge_type: 'KNOWLEDGE_TYPE_RUNBOOK',
          documents: [],
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /at least one document required/i);
});

test('IndexDomainKnowledge enforces max 100 documents per batch', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const docs = Array.from({ length: 101 }, (_, i) => ({
    document_id: `doc-${i + 1}`,
    title: `Doc ${i + 1}`,
    content: 'x',
    metadata: {},
    updated_at: '2026-03-21T10:00:00.000Z',
  }));

  const err = await new Promise<any>((resolve) => {
    handlers.IndexDomainKnowledge(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-index-max' },
          knowledge_type: 'KNOWLEDGE_TYPE_RUNBOOK',
          documents: docs,
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /max 100 documents per batch/i);
});

test('SubmitAction rejects invalid service token', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.SubmitAction(
      {
        metadata: authMetadata('wrong-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-submit-auth' },
          source_model: 'ollama/llama3.2:3b',
          action_type: 'reboot_device',
          summary: 'summary',
          details_json: '{}',
          target_type: 'device',
          target_id: 'dev-1',
          risk_level: 'low',
          proposed_by: 'copilot',
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 16);
  assert.match(String(err?.message || ''), /invalid service token/i);
});

test('SubmitAction enforces required action_type and summary', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.SubmitAction(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-submit-required' },
          source_model: 'ollama/llama3.2:3b',
          action_type: '',
          summary: '',
          details_json: '{}',
          target_type: 'device',
          target_id: 'dev-1',
          risk_level: 'low',
          proposed_by: 'copilot',
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /action_type and summary required/i);
});

test('RunbookSuggest rejects invalid service token', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.RunbookSuggest(
      {
        metadata: authMetadata('wrong-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-runbook-auth' },
          alert_type: 'disk_pressure',
          alert_severity: 'critical',
          alert_description: 'desc',
          device_context: [],
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 16);
  assert.match(String(err?.message || ''), /invalid service token/i);
});

test('RunbookSuggest requires alert_type', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.RunbookSuggest(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-runbook-required' },
          alert_type: '',
          alert_severity: 'critical',
          alert_description: 'desc',
          device_context: [],
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /alert_type required/i);
});

test('GetActionStatus requires action_id', async () => {
  const handlers = registerBridgeHandlers({
    pool: createActionStatusPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.GetActionStatus(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-status-missing' },
          action_id: '',
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /action_id required/i);
});

test('GetActionStatus rejects invalid tenant context', async () => {
  const handlers = registerBridgeHandlers({
    pool: createActionStatusPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.GetActionStatus(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant bad!', correlation_id: 'corr-status-bad-tenant' },
          action_id: 'action-owned-by-chat-1',
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /tenant_id contains invalid characters/i);
});

test('EdgeSummarize requires non-empty text', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.EdgeSummarize(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant-1', correlation_id: 'corr-sum-required' },
          text: '',
          max_length: 60,
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /text required/i);
});

test('EdgeSummarize rejects invalid tenant context', async () => {
  const handlers = registerBridgeHandlers({
    pool: createPoolMock() as any,
    nc: { subscribe: () => createSubscription([]), isClosed: () => false } as any,
    js: { publish: async () => {} } as any,
    config: {
      serviceToken: 'svc-token',
      orgId: 'org-1',
      agentId: 'agent-1',
      chatId: 'chat-1',
      inferenceUrl: 'http://litellm:4000',
      inferenceApiKey: '',
      embeddingsUrl: 'http://litellm:4000',
      embeddingsModel: 'text-embedding-3-small',
      summarizeModel: 'ollama/llama3.2:3b',
      requireTenantMapping: true,
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
    } as any,
  });

  const err = await new Promise<any>((resolve) => {
    handlers.EdgeSummarize(
      {
        metadata: authMetadata('svc-token'),
        request: {
          tenant: { tenant_id: 'tenant bad!', correlation_id: 'corr-sum-bad-tenant' },
          text: 'hello',
          max_length: 60,
        },
      } as any,
      (callbackErr: any) => resolve(callbackErr),
    );
  });

  assert.equal(err?.code, 3);
  assert.match(String(err?.message || ''), /tenant_id contains invalid characters/i);
});
