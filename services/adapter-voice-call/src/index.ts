import Fastify from 'fastify';
import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { createLogger } from '@sven/shared';

const logger = createLogger('adapter-voice-call');

const PORT = Number(process.env.VOICE_CALL_PORT || 8490);
const HOST = process.env.VOICE_CALL_HOST || '0.0.0.0';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const SVEN_ADAPTER_TOKEN = process.env.SVEN_ADAPTER_TOKEN || '';
const VOICE_CALL_API_KEY = process.env.VOICE_CALL_API_KEY || '';
const DEFAULT_PROVIDER = process.env.VOICE_CALL_PROVIDER || 'mock';
const VOICE_CALL_REQUIRE_APPROVAL = (process.env.VOICE_CALL_REQUIRE_APPROVAL || 'true').toLowerCase() !== 'false';
const PUBLIC_BASE_URL = process.env.VOICE_CALL_PUBLIC_BASE_URL || '';
const FETCH_TIMEOUT_MS = Number(process.env.VOICE_CALL_FETCH_TIMEOUT_MS || 10_000);
const TELNYX_SIGNATURE_TOLERANCE_SECONDS = Number(process.env.TELNYX_SIGNATURE_TOLERANCE_SECONDS || 300);

type VoiceProvider = 'mock' | 'twilio' | 'telnyx' | 'plivo';

type OutboundCallRequest = {
  provider?: VoiceProvider;
  to: string;
  from?: string;
  approval_id?: string;
  chat_id?: string;
  channel_user_id?: string;
  sender_identity_id?: string;
  metadata?: Record<string, unknown>;
};

type NormalizedCallEvent = {
  provider: VoiceProvider;
  call_id: string;
  from: string;
  to?: string;
  status: string;
  transcript?: string;
  recording_url?: string;
  metadata?: Record<string, unknown>;
};

class VoiceTransportError extends Error {
  code: 'TRANSPORT_TIMEOUT' | 'TRANSPORT_ERROR';

  constructor(code: 'TRANSPORT_TIMEOUT' | 'TRANSPORT_ERROR', message: string) {
    super(message);
    this.code = code;
    this.name = 'VoiceTransportError';
  }
}

function resolveFetchTimeoutMs(): number {
  if (!Number.isFinite(FETCH_TIMEOUT_MS) || FETCH_TIMEOUT_MS <= 0) return 10_000;
  return Math.min(Math.max(Math.floor(FETCH_TIMEOUT_MS), 1_000), 60_000);
}

function isAbortTimeoutError(err: unknown): boolean {
  const name = String((err as { name?: string })?.name || '');
  const code = String((err as { code?: string })?.code || '');
  return name === 'AbortError' || name === 'TimeoutError' || code === 'ABORT_ERR';
}

async function fetchWithDeadline(url: string, init: RequestInit, operation: string): Promise<Response> {
  const timeoutMs = resolveFetchTimeoutMs();
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isAbortTimeoutError(err)) {
      throw new VoiceTransportError('TRANSPORT_TIMEOUT', `${operation} timed out after ${timeoutMs}ms`);
    }
    throw new VoiceTransportError('TRANSPORT_ERROR', `${operation} transport error`);
  }
}

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/[^\d+]/g, '').trim();
}

function ensureApiKey(request: any, reply: any) {
  const apiKey = String(request.headers['x-voice-api-key'] || '');
  if (!apiKey || apiKey !== VOICE_CALL_API_KEY) {
    reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'x-voice-api-key is invalid' },
    });
  }
}

function constantTimeEquals(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  try {
    const a = Buffer.from(actual, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getRawBody(request: any): string {
  if (typeof request.rawBody === 'string') return request.rawBody;
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody.toString('utf8');
  if (request.body && typeof request.body === 'object') return JSON.stringify(request.body);
  return String(request.body || '');
}

function getExternalRequestUrl(request: any, provider: VoiceProvider): string {
  if (PUBLIC_BASE_URL) {
    return `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/v1/providers/${provider}/webhook`;
  }
  const proto = String(request.headers['x-forwarded-proto'] || request.protocol || 'http').split(',')[0].trim();
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || 'localhost').split(',')[0].trim();
  const path = String(request.raw?.url || request.url || `/v1/providers/${provider}/webhook`);
  return `${proto}://${host}${path}`;
}

function verifyTwilioSignature(secret: string, requestUrl: string, body: any, headerSignature: string): boolean {
  if (!secret || !headerSignature) return false;
  const params = body && typeof body === 'object' ? body : {};
  const sortedKeys = Object.keys(params).sort();
  let payload = requestUrl;
  for (const key of sortedKeys) {
    payload += `${key}${String(params[key] ?? '')}`;
  }
  const expected = createHmac('sha1', secret).update(payload, 'utf8').digest('base64');
  return constantTimeEquals(headerSignature.trim(), expected);
}

function verifyTelnyxSignature(publicKeyPem: string, rawBody: string, signatureHeader: string, timestampHeader: string): boolean {
  if (!publicKeyPem || !signatureHeader || !timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > Math.max(30, TELNYX_SIGNATURE_TOLERANCE_SECONDS)) return false;

  const message = `${timestampHeader}|${rawBody}`;
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureHeader.trim(), 'base64');
    if (signature.length === 0) return false;
  } catch {
    return false;
  }

  try {
    const publicKey = createPublicKey(publicKeyPem);
    return verify(null, Buffer.from(message, 'utf8'), publicKey, signature);
  } catch {
    return false;
  }
}

function verifyPlivoSignature(secret: string, requestUrl: string, rawBody: string, signatureHeader: string, nonceHeader: string): boolean {
  if (!secret || !signatureHeader || !nonceHeader) return false;
  const payload = `${requestUrl}${nonceHeader}${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
  return constantTimeEquals(signatureHeader.trim(), expected);
}

async function resolveIdentity(channelUserId: string): Promise<{ identity_id: string; user_id: string }> {
  const res = await fetchWithDeadline(`${GATEWAY_URL}/v1/adapter/identity/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': SVEN_ADAPTER_TOKEN,
    },
    body: JSON.stringify({
      channel: 'voice_call',
      channel_user_id: channelUserId,
      display_name: `Caller ${channelUserId}`,
    }),
  }, 'gateway identity resolve');
  if (!res.ok) {
    throw new Error(`identity resolve failed (${res.status})`);
  }
  const payload = (await res.json()) as any;
  return payload.data;
}

async function resolveChat(channelChatId: string): Promise<string> {
  const res = await fetchWithDeadline(`${GATEWAY_URL}/v1/adapter/chat/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': SVEN_ADAPTER_TOKEN,
    },
    body: JSON.stringify({
      channel: 'voice_call',
      channel_chat_id: channelChatId,
      type: 'dm',
      name: `Voice ${channelChatId}`,
    }),
  }, 'gateway chat resolve');
  if (!res.ok) {
    throw new Error(`chat resolve failed (${res.status})`);
  }
  const payload = (await res.json()) as any;
  return String(payload.data.chat_id);
}

async function ensureChatMember(chatId: string, userId: string): Promise<void> {
  const res = await fetchWithDeadline(`${GATEWAY_URL}/v1/adapter/chat/ensure-member`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': SVEN_ADAPTER_TOKEN,
    },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
    }),
  }, 'gateway chat ensure-member');
  if (!res.ok) {
    throw new Error(`chat member ensure failed (${res.status})`);
  }
}

async function emitTextEvent(params: {
  chat_id: string;
  sender_identity_id: string;
  text: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetchWithDeadline(`${GATEWAY_URL}/v1/events/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': SVEN_ADAPTER_TOKEN,
    },
    body: JSON.stringify({
      channel: 'voice_call',
      channel_message_id: `voice-${Date.now()}`,
      chat_id: params.chat_id,
      sender_identity_id: params.sender_identity_id,
      text: params.text,
      metadata: params.metadata || {},
    }),
  }, 'gateway emit message');
  if (!res.ok) throw new Error(`message emit failed (${res.status})`);
}

async function emitAudioEvent(params: {
  chat_id: string;
  sender_identity_id: string;
  audio_url: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetchWithDeadline(`${GATEWAY_URL}/v1/events/audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': SVEN_ADAPTER_TOKEN,
    },
    body: JSON.stringify({
      channel: 'voice_call',
      channel_message_id: `voice-audio-${Date.now()}`,
      chat_id: params.chat_id,
      sender_identity_id: params.sender_identity_id,
      audio_url: params.audio_url,
      metadata: { transcribe: true, ...(params.metadata || {}) },
    }),
  }, 'gateway emit audio');
  if (!res.ok) throw new Error(`audio emit failed (${res.status})`);
}

async function verifyApproval(approvalId: string): Promise<{ ok: boolean; status?: string; reason?: string }> {
  const res = await fetchWithDeadline(`${GATEWAY_URL}/v1/adapter/approval/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SVEN-ADAPTER-TOKEN': SVEN_ADAPTER_TOKEN,
    },
    body: JSON.stringify({
      approval_id: approvalId,
      tool_name: 'voice.call.place',
      scope: 'voice.write',
    }),
  }, 'gateway approval verify');
  if (!res.ok) {
    return { ok: false, reason: `approval lookup failed (${res.status})` };
  }
  const payload = (await res.json()) as any;
  const approved = Boolean(payload?.data?.approved);
  return {
    ok: approved,
    status: String(payload?.data?.status || ''),
    reason: approved ? undefined : 'approval not approved/matching',
  };
}

function getProviderWebhookUrl(provider: VoiceProvider): string {
  if (!PUBLIC_BASE_URL) return '';
  return `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/v1/providers/${provider}/webhook`;
}

async function placeCall(provider: VoiceProvider, body: OutboundCallRequest): Promise<{ call_id: string; raw: unknown }> {
  const to = normalizePhone(body.to);
  const from = normalizePhone(String(body.from || process.env.VOICE_CALL_FROM || ''));
  const callbackUrl = getProviderWebhookUrl(provider);
  const metadata = body.metadata || {};

  if (provider === 'mock') {
    return {
      call_id: `mock-${Date.now()}`,
      raw: { provider, to, from, callback_url: callbackUrl, metadata },
    };
  }

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID || '';
    const token = process.env.TWILIO_AUTH_TOKEN || '';
    const twimlUrl = process.env.TWILIO_TWIML_URL || callbackUrl;
    const base = process.env.TWILIO_API_BASE || 'https://api.twilio.com/2010-04-01';
    const url = `${base}/Accounts/${sid}/Calls.json`;
    const form = new URLSearchParams();
    form.set('To', to);
    form.set('From', from);
    form.set('Url', twimlUrl);
    if (callbackUrl) form.set('StatusCallback', callbackUrl);
    const res = await fetchWithDeadline(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }, 'twilio place call');
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`twilio call failed (${res.status})`);
    return { call_id: String((raw as any).sid || `twilio-${Date.now()}`), raw };
  }

  if (provider === 'telnyx') {
    const apiKey = process.env.TELNYX_API_KEY || '';
    const connectionId = process.env.TELNYX_CONNECTION_ID || '';
    const url = (process.env.TELNYX_API_BASE || 'https://api.telnyx.com/v2') + '/calls';
    const payload = {
      connection_id: connectionId,
      to,
      from,
      webhook_url: callbackUrl || undefined,
      client_state: Buffer.from(JSON.stringify(metadata)).toString('base64url'),
    };
    const res = await fetchWithDeadline(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 'telnyx place call');
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`telnyx call failed (${res.status})`);
    return { call_id: String((raw as any)?.data?.call_control_id || `telnyx-${Date.now()}`), raw };
  }

  if (provider === 'plivo') {
    const authId = process.env.PLIVO_AUTH_ID || '';
    const authToken = process.env.PLIVO_AUTH_TOKEN || '';
    const answerUrl = process.env.PLIVO_ANSWER_URL || callbackUrl;
    const url = `${process.env.PLIVO_API_BASE || 'https://api.plivo.com/v1/Account'}/${authId}/Call/`;
    const payload = {
      to,
      from,
      answer_url: answerUrl,
      ring_url: callbackUrl || undefined,
    };
    const res = await fetchWithDeadline(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 'plivo place call');
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`plivo call failed (${res.status})`);
    return { call_id: String((raw as any).request_uuid || `plivo-${Date.now()}`), raw };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function normalizeWebhook(provider: VoiceProvider, body: any): NormalizedCallEvent {
  if (provider === 'twilio') {
    return {
      provider,
      call_id: String(body.CallSid || body.call_sid || ''),
      from: normalizePhone(String(body.From || body.from || 'unknown')),
      to: normalizePhone(String(body.To || body.to || '')),
      status: String(body.CallStatus || body.call_status || body.status || 'unknown'),
      transcript: body.TranscriptionText || body.transcript,
      recording_url: body.RecordingUrl || body.recording_url,
      metadata: body.metadata || {},
    };
  }
  if (provider === 'telnyx') {
    const data = body.data || {};
    return {
      provider,
      call_id: String(data.call_control_id || data.call_session_id || ''),
      from: normalizePhone(String(data.from || data.from_number || 'unknown')),
      to: normalizePhone(String(data.to || data.to_number || '')),
      status: String(data.call_status || body.event_type || 'unknown'),
      transcript: data.transcript,
      recording_url: data.recording_url,
      metadata: body.metadata || {},
    };
  }
  if (provider === 'plivo') {
    return {
      provider,
      call_id: String(body.CallUUID || body.request_uuid || ''),
      from: normalizePhone(String(body.From || body.from || 'unknown')),
      to: normalizePhone(String(body.To || body.to || '')),
      status: String(body.CallStatus || body.status || 'unknown'),
      transcript: body.transcript,
      recording_url: body.RecordingUrl || body.recording_url,
      metadata: body.metadata || {},
    };
  }
  return {
    provider,
    call_id: String(body.call_id || `mock-${Date.now()}`),
    from: normalizePhone(String(body.from || 'unknown')),
    to: normalizePhone(String(body.to || '')),
    status: String(body.status || 'unknown'),
    transcript: body.transcript,
    recording_url: body.recording_url,
    metadata: body.metadata || {},
  };
}

async function main() {
  if (!SVEN_ADAPTER_TOKEN) {
    throw new Error('SVEN_ADAPTER_TOKEN is required');
  }
  if (!VOICE_CALL_API_KEY) {
    throw new Error('VOICE_CALL_API_KEY is required');
  }

  const app = Fastify({ logger: false });

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request: any, body: string, done: any) => {
    request.rawBody = body;
    try {
      const parsed = body.length > 0 ? JSON.parse(body) : {};
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get('/healthz', async () => ({ success: true, service: 'adapter-voice-call' }));

  app.post('/v1/calls/outbound', { preHandler: ensureApiKey }, async (request, reply) => {
    const body = (request.body || {}) as OutboundCallRequest;
    const provider = (body.provider || DEFAULT_PROVIDER) as VoiceProvider;
    if (!body.to) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'to is required' },
      });
    }

    try {
      const approvalId = String(body.approval_id || (body.metadata as any)?.approval_id || '').trim();
      if (VOICE_CALL_REQUIRE_APPROVAL) {
        if (!approvalId) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'APPROVAL_REQUIRED',
              message: 'Outbound voice calls require approval_id (tool=voice.call.place, scope=voice.write)',
            },
          });
        }
        const approval = await verifyApproval(approvalId);
        if (!approval.ok) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'APPROVAL_INVALID',
              message: approval.reason || 'Approval is not valid for outbound voice call',
            },
            data: { approval_id: approvalId, approval_status: approval.status || null },
          });
        }
      }

      const result = await placeCall(provider, body);

      if (body.chat_id && body.sender_identity_id) {
        await emitTextEvent({
          chat_id: body.chat_id,
          sender_identity_id: body.sender_identity_id,
          text: `Outbound call started via ${provider} to ${body.to}`,
          metadata: {
            channel: 'voice_call',
            provider,
            call_id: result.call_id,
            direction: 'outbound',
            approval_id: approvalId || null,
          },
        });
      }

      reply.send({
        success: true,
        data: {
          provider,
          call_id: result.call_id,
        },
      });
    } catch (err) {
      if (err instanceof VoiceTransportError) {
        const statusCode = err.code === 'TRANSPORT_TIMEOUT' ? 504 : 502;
        const errorCode = err.code === 'TRANSPORT_TIMEOUT' ? 'VOICE_UPSTREAM_TIMEOUT' : 'VOICE_UPSTREAM_TRANSPORT_ERROR';
        request.log.warn({ err, provider }, 'outbound call transport failure');
        return reply.status(statusCode).send({
          success: false,
          error: { code: errorCode, message: 'Voice provider/gateway transport request failed' },
        });
      }
      throw err;
    }
  });

  app.post('/v1/providers/:provider/webhook', async (request, reply) => {
    const provider = String((request.params as any).provider || 'mock') as VoiceProvider;
    const body: any = request.body || {};
    const rawBody = getRawBody(request as any);
    const requestUrl = getExternalRequestUrl(request as any, provider);

    // Provider-specific signature verification.
    if (provider === 'twilio' && process.env.TWILIO_WEBHOOK_SECRET) {
      const signature = String(request.headers['x-twilio-signature'] || '').trim();
      const verified = verifyTwilioSignature(process.env.TWILIO_WEBHOOK_SECRET, requestUrl, body, signature);
      if (!verified) {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Twilio signature invalid' } });
      }
    }
    if (provider === 'telnyx' && process.env.TELNYX_WEBHOOK_PUBLIC_KEY) {
      const signature = String(request.headers['telnyx-signature-ed25519'] || '').trim();
      const timestamp = String(request.headers['telnyx-timestamp'] || '').trim();
      const verified = verifyTelnyxSignature(process.env.TELNYX_WEBHOOK_PUBLIC_KEY, rawBody, signature, timestamp);
      if (!verified) {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Telnyx signature invalid' } });
      }
    }
    if (provider === 'plivo' && process.env.PLIVO_WEBHOOK_SECRET) {
      const signature = String(request.headers['x-plivo-signature-v2'] || '').trim();
      const nonce = String(request.headers['x-plivo-signature-v2-nonce'] || '').trim();
      const verified = verifyPlivoSignature(process.env.PLIVO_WEBHOOK_SECRET, requestUrl, rawBody, signature, nonce);
      if (!verified) {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Plivo signature invalid' } });
      }
    }

    try {
      const event = normalizeWebhook(provider, body);
      const channelUserId = String((event.metadata as any)?.channel_user_id || event.from || 'unknown');
      const identity = await resolveIdentity(channelUserId);
      const channelChatId = `voice:${channelUserId}`;
      const chatId = String((event.metadata as any)?.chat_id || (await resolveChat(channelChatId)));
      await ensureChatMember(chatId, identity.user_id);

      if (event.transcript && event.transcript.trim()) {
        await emitTextEvent({
          chat_id: chatId,
          sender_identity_id: String((event.metadata as any)?.sender_identity_id || identity.identity_id),
          text: event.transcript,
          metadata: {
            channel: 'voice_call',
            provider,
            call_id: event.call_id,
            status: event.status,
            direction: 'inbound',
          },
        });
      } else if (event.recording_url) {
        await emitAudioEvent({
          chat_id: chatId,
          sender_identity_id: String((event.metadata as any)?.sender_identity_id || identity.identity_id),
          audio_url: event.recording_url,
          metadata: {
            channel: 'voice_call',
            provider,
            call_id: event.call_id,
            status: event.status,
            direction: 'inbound',
          },
        });
      }

      logger.info('Voice call webhook processed', {
        provider,
        call_id: event.call_id,
        status: event.status,
        from: event.from,
      });
      reply.send({ success: true });
    } catch (err) {
      if (err instanceof VoiceTransportError) {
        const statusCode = err.code === 'TRANSPORT_TIMEOUT' ? 504 : 502;
        const errorCode = err.code === 'TRANSPORT_TIMEOUT' ? 'VOICE_UPSTREAM_TIMEOUT' : 'VOICE_UPSTREAM_TRANSPORT_ERROR';
        request.log.warn({ err, provider }, 'voice webhook transport failure');
        return reply.status(statusCode).send({
          success: false,
          error: { code: errorCode, message: 'Voice provider/gateway transport request failed' },
        });
      }
      throw err;
    }
  });

  await app.listen({ host: HOST, port: PORT });
  logger.info('Voice call adapter started', { host: HOST, port: PORT, provider: DEFAULT_PROVIDER });
}

main().catch((err) => {
  logger.fatal('Voice call adapter failed', { err: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
