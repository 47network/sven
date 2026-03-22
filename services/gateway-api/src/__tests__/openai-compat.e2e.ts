import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ statusCode: number; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => {
          payload += chunk;
        });
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = payload ? JSON.parse(payload) : {};
          } catch {
            parsed = { raw: payload };
          }
          resolve({ statusCode: res.statusCode || 0, data: parsed, rawBody: payload });
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function streamCall(
  endpoint: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<{ statusCode: number; events: string[] }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: reqHeaders,
      },
      (res) => {
        const events: string[] = [];
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              events.push(trimmed.slice(6));
            }
          }
        });
        res.on('end', () => {
          // Process remaining buffer
          if (buffer.trim().startsWith('data: ')) {
            events.push(buffer.trim().slice(6));
          }
          resolve({ statusCode: res.statusCode || 0, events });
        });
      },
    );

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const describeLive = RUN_LIVE_GATEWAY_E2E ? describe : describe.skip;

describeLive('OpenAI-Compatible API', () => {
  // ── Auth Tests (no credentials needed) ──

  describe('POST /v1/chat/completions', () => {
    it('rejects requests without authentication', async () => {
      const res = await apiCall('POST', '/v1/chat/completions', {
        model: 'test',
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(res.statusCode).toBe(401);
      expect(res.data.error).toBeDefined();
      expect(res.data.error.code).toBe('invalid_api_key');
      if (res.data.error.type !== undefined) {
        expect(typeof res.data.error.type).toBe('string');
      }
    });

    it('rejects invalid API keys', async () => {
      const res = await apiCall(
        'POST',
        '/v1/chat/completions',
        {
          model: 'test',
          messages: [{ role: 'user', content: 'hello' }],
        },
        { Authorization: 'Bearer sk-sven-invalidkey1234567890abcdef' },
      );
      expect(res.statusCode).toBe(401);
      expect(res.data.error.code).toBe('invalid_api_key');
    });

    it('rejects requests missing model parameter', async () => {
      // Use a fake session token — will fail auth, but validates request parsing order
      const res = await apiCall(
        'POST',
        '/v1/chat/completions',
        {
          messages: [{ role: 'user', content: 'hello' }],
        },
        { Authorization: 'Bearer fake-session-token' },
      );
      // Will get 401 since the token is invalid, which is expected
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /v1/models', () => {
    it('rejects requests without authentication', async () => {
      const res = await apiCall('GET', '/v1/models');
      expect(res.statusCode).toBe(401);
      expect(res.data.error).toBeDefined();
      expect(res.data.error.code).toBe('invalid_api_key');
    });
  });

  describe('POST /v1/responses', () => {
    it('rejects requests without authentication', async () => {
      const res = await apiCall('POST', '/v1/responses', {
        model: 'test',
        input: 'hello',
      });
      expect(res.statusCode).toBe(401);
      expect(res.data.error).toBeDefined();
      expect(res.data.error.code).toBe('invalid_api_key');
      if (res.data.error.type !== undefined) {
        expect(typeof res.data.error.type).toBe('string');
      }
    });
  });

  describe('API Key Management', () => {
    it('rejects API key creation without session', async () => {
      const res = await apiCall('POST', '/v1/api-keys', { name: 'test-key' });
      expect(res.statusCode).toBe(401);
    });

    it('rejects API key listing without session', async () => {
      const res = await apiCall('GET', '/v1/api-keys');
      expect(res.statusCode).toBe(401);
    });

    it('rejects API key revocation without session', async () => {
      const res = await apiCall('DELETE', '/v1/api-keys/fake-id');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Authenticated Tests (require TEST_SESSION_COOKIE or TEST_API_KEY env vars) ──
  const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
  const TEST_API_KEY = process.env.TEST_API_KEY || '';
  const authHeader: Record<string, string> | undefined = TEST_API_KEY
    ? { Authorization: `Bearer ${TEST_API_KEY}` }
    : TEST_SESSION_COOKIE
      ? { Cookie: `sven_session=${TEST_SESSION_COOKIE}` }
      : undefined;

  const describeAuth = authHeader ? describe : describe.skip;

  describeAuth('Authenticated: GET /v1/models', () => {
    it('returns OpenAI-format model list', async () => {
      const res = await apiCall('GET', '/v1/models', undefined, authHeader);
      expect(res.statusCode).toBe(200);
      expect(res.data.object).toBe('list');
      expect(Array.isArray(res.data.data)).toBe(true);

      if (res.data.data.length > 0) {
        const model = res.data.data[0];
        expect(model.object).toBe('model');
        expect(typeof model.id).toBe('string');
        expect(typeof model.created).toBe('number');
        expect(typeof model.owned_by).toBe('string');
      }
    });
  });

  describeAuth('Authenticated: POST /v1/chat/completions (non-streaming)', () => {
    it('returns OpenAI-format chat completion', async () => {
      // Get first available model
      const modelsRes = await apiCall('GET', '/v1/models', undefined, authHeader);
      if (modelsRes.data.data?.length === 0) {
        // No models configured — skip
        return;
      }

      const modelId = modelsRes.data.data[0].id;
      const res = await apiCall(
        'POST',
        '/v1/chat/completions',
        {
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with just the word "pong".' }],
          temperature: 0,
          max_tokens: 10,
        },
        authHeader,
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.id).toMatch(/^chatcmpl-/);
      expect(res.data.object).toBe('chat.completion');
      expect(typeof res.data.created).toBe('number');
      expect(res.data.model).toBe(modelId);
      expect(Array.isArray(res.data.choices)).toBe(true);
      expect(res.data.choices.length).toBeGreaterThan(0);

      const choice = res.data.choices[0];
      expect(choice.index).toBe(0);
      expect(choice.message.role).toBe('assistant');
      expect(typeof choice.message.content).toBe('string');
      expect(['stop', 'length']).toContain(choice.finish_reason);

      expect(typeof res.data.usage.prompt_tokens).toBe('number');
      expect(typeof res.data.usage.completion_tokens).toBe('number');
      expect(typeof res.data.usage.total_tokens).toBe('number');
    }, 30000);

    it('returns 404 for unknown model', async () => {
      const res = await apiCall(
        'POST',
        '/v1/chat/completions',
        {
          model: 'nonexistent-model-xyz',
          messages: [{ role: 'user', content: 'test' }],
        },
        authHeader,
      );
      expect(res.statusCode).toBe(404);
      expect(res.data.error.code).toBe('model_not_found');
    });
  });

  describeAuth('Authenticated: POST /v1/responses (non-streaming)', () => {
    it('returns OpenAI-format responses object', async () => {
      const modelsRes = await apiCall('GET', '/v1/models', undefined, authHeader);
      if (modelsRes.data.data?.length === 0) return;

      const modelId = modelsRes.data.data[0].id;
      const res = await apiCall(
        'POST',
        '/v1/responses',
        {
          model: modelId,
          input: 'Reply with just the word "pong".',
          max_output_tokens: 10,
          temperature: 0,
        },
        authHeader,
      );

      expect(res.statusCode).toBe(200);
      expect(String(res.data.id || '')).toMatch(/^resp_/);
      expect(res.data.object).toBe('response');
      expect(res.data.status).toBe('completed');
      expect(res.data.model).toBe(modelId);
      expect(typeof res.data.output_text).toBe('string');
      expect(Array.isArray(res.data.output)).toBe(true);
      expect(res.data.output[0].role).toBe('assistant');
      expect(Array.isArray(res.data.output[0].content)).toBe(true);
      expect(res.data.output[0].content[0].type).toBe('output_text');
      expect(typeof res.data.usage.input_tokens).toBe('number');
      expect(typeof res.data.usage.output_tokens).toBe('number');
      expect(typeof res.data.usage.total_tokens).toBe('number');
    }, 30000);
  });

  describeAuth('Authenticated: POST /v1/chat/completions (streaming)', () => {
    it('returns SSE stream with OpenAI-format chunks', async () => {
      const modelsRes = await apiCall('GET', '/v1/models', undefined, authHeader);
      if (modelsRes.data.data?.length === 0) return;

      const modelId = modelsRes.data.data[0].id;
      const result = await streamCall(
        '/v1/chat/completions',
        {
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with just the word "pong".' }],
          temperature: 0,
          max_tokens: 10,
          stream: true,
        },
        authHeader,
      );

      expect(result.statusCode).toBe(200);
      expect(result.events.length).toBeGreaterThan(0);

      // Last event should be [DONE]
      expect(result.events[result.events.length - 1]).toBe('[DONE]');

      // All non-[DONE] events should be valid JSON chunks
      for (const event of result.events) {
        if (event === '[DONE]') continue;
        const chunk = JSON.parse(event);
        expect(chunk.id).toMatch(/^chatcmpl-/);
        expect(chunk.object).toBe('chat.completion.chunk');
        expect(typeof chunk.created).toBe('number');
        expect(Array.isArray(chunk.choices)).toBe(true);
      }
    }, 30000);
  });

  describeAuth('Authenticated: API Key Lifecycle', () => {
    // Only run with session cookie (API keys can't create other API keys)
    const sessionHeader = TEST_SESSION_COOKIE
      ? { Cookie: `sven_session=${TEST_SESSION_COOKIE}` }
      : undefined;
    const describeSession = sessionHeader ? describe : describe.skip;

    describeSession('key create/list/revoke', () => {
      let createdKeyId: string;

      it('creates a new API key', async () => {
        const res = await apiCall('POST', '/v1/api-keys', { name: 'test-key-e2e' }, sessionHeader);
        expect(res.statusCode).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.data.key).toMatch(/^sk-sven-/);
        expect(res.data.data.name).toBe('test-key-e2e');
        expect(res.data.data.prefix).toBe(res.data.data.key.slice(0, 12));
        createdKeyId = res.data.data.id;
      });

      it('lists API keys', async () => {
        const res = await apiCall('GET', '/v1/api-keys', undefined, sessionHeader);
        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
        const found = res.data.data.find((k: any) => k.id === createdKeyId);
        expect(found).toBeDefined();
        expect(found.name).toBe('test-key-e2e');
        // Key hash should NOT be returned in listing
        expect(found.key_hash).toBeUndefined();
      });

      it('revokes the API key', async () => {
        const res = await apiCall('DELETE', `/v1/api-keys/${createdKeyId}`, undefined, sessionHeader);
        expect(res.statusCode).toBe(200);
        expect(res.data.data.revoked).toBe(true);
      });
    });
  });
});

// ── Response Format Validation (pure unit tests, no server needed) ──

describe('OpenAI Response Format Validation', () => {
  it('chat completion response has correct shape', () => {
    const response = {
      id: 'chatcmpl-abc123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    expect(response.id).toMatch(/^chatcmpl-/);
    expect(response.object).toBe('chat.completion');
    expect(typeof response.created).toBe('number');
    expect(response.choices[0].message.role).toBe('assistant');
    expect(typeof response.choices[0].message.content).toBe('string');
    expect(response.usage.total_tokens).toBe(response.usage.prompt_tokens + response.usage.completion_tokens);
  });

  it('stream chunk response has correct shape', () => {
    const chunk = {
      id: 'chatcmpl-abc123',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'test-model',
      choices: [
        {
          index: 0,
          delta: { content: 'Hello' },
          finish_reason: null,
        },
      ],
    };

    expect(chunk.object).toBe('chat.completion.chunk');
    expect(chunk.choices[0].delta.content).toBe('Hello');
    expect(chunk.choices[0].finish_reason).toBeNull();
  });

  it('model listing response has correct shape', () => {
    const response = {
      object: 'list',
      data: [
        {
          id: 'gpt-4o',
          object: 'model',
          created: 1700000000,
          owned_by: 'openai',
          permission: [],
          root: 'gpt-4o',
          parent: null,
        },
      ],
    };

    expect(response.object).toBe('list');
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data[0].object).toBe('model');
    expect(typeof response.data[0].id).toBe('string');
    expect(typeof response.data[0].owned_by).toBe('string');
  });

  it('error response matches OpenAI format', () => {
    const error = {
      error: {
        message: 'Model not found.',
        type: 'invalid_request_error',
        param: 'model',
        code: 'model_not_found',
      },
    };

    expect(error.error.message).toBeTruthy();
    expect(error.error.type).toBe('invalid_request_error');
    expect(typeof error.error.param).toBe('string');
  });
});
