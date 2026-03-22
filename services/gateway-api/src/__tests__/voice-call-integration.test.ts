import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_CANVAS = path.resolve(__dirname, '../routes/canvas.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/132_voice_call_integration.sql');
const ADAPTER = path.resolve(__dirname, '../../../adapter-voice-call/src/index.ts');

describe('D5 Voice Call Integration', () => {
  it('Canvas route exposes outbound voice call endpoint and adapter wiring', async () => {
    const source = await fs.readFile(GATEWAY_CANVAS, 'utf8');
    expect(source.includes('/v1/chats/:chatId/voice/calls/outbound')).toBe(true);
    expect(source.includes('voice.call.enabled')).toBe(true);
    expect(source.includes('VOICE_CALL_ADAPTER_URL')).toBe(true);
    expect(source.includes('VOICE_CALL_ADAPTER_TIMEOUT_MS')).toBe(true);
    expect(source.includes('x-voice-api-key')).toBe(true);
    expect(source.includes('/v1/calls/outbound')).toBe(true);
    expect(source.includes('normalizeVoiceCallOutboundTimeoutMs')).toBe(true);
    expect(source.includes('signal: timeoutSignal')).toBe(true);
    expect(source.includes('VOICE_CALL_ADAPTER_TIMEOUT')).toBe(true);
  });

  it('Migration registers voice call feature setting + tool', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('voice.call.enabled')).toBe(true);
    expect(migration.includes('voice.call.place')).toBe(true);
    expect(migration.includes('voice.write')).toBe(true);
  });

  it('Voice adapter exposes outbound + webhook receive paths', async () => {
    const source = await fs.readFile(ADAPTER, 'utf8');
    expect(source.includes('/v1/calls/outbound')).toBe(true);
    expect(source.includes('/v1/providers/:provider/webhook')).toBe(true);
    expect(source.includes('verifyApproval')).toBe(true);
    expect(source.includes('AbortSignal.timeout')).toBe(true);
    expect(source.includes('VOICE_UPSTREAM_TIMEOUT')).toBe(true);
    expect(source.includes('VOICE_UPSTREAM_TRANSPORT_ERROR')).toBe(true);
    expect(source.includes('VOICE_CALL_API_KEY is required')).toBe(true);
  });
});
