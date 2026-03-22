import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const BRIDGE_HANDLERS = path.resolve(__dirname, '../../../bridge-47dynamics/src/handlers.ts');

describe('47dynamics bridge response correlation contract', () => {
  it('requires chat match and correlation match when response correlation is present', async () => {
    const source = await fs.readFile(BRIDGE_HANDLERS, 'utf8');

    expect(source).toContain("const responseCorrelationId = String(data.metadata?.correlation_id || '').trim();");
    expect(source).toContain('const correlationMatch = !responseCorrelationId || responseCorrelationId === correlationId;');
    expect(source).toContain('if (data.chat_id === tenantScope.chatId && correlationMatch) {');
  });

  it('applies correlation-aware filtering in both unary and streaming ask handlers', async () => {
    const source = await fs.readFile(BRIDGE_HANDLERS, 'utf8');

    const askStart = source.indexOf('CopilotAsk: async');
    const streamStart = source.indexOf('CopilotAskStream: async');
    expect(askStart).toBeGreaterThanOrEqual(0);
    expect(streamStart).toBeGreaterThan(askStart);

    const askBlock = source.slice(askStart, streamStart);
    const streamBlock = source.slice(streamStart);

    expect(askBlock).toContain('const correlationMatch = !responseCorrelationId || responseCorrelationId === correlationId;');
    expect(askBlock).toContain('if (data.chat_id === tenantScope.chatId && correlationMatch) {');

    expect(streamBlock).toContain('const correlationMatch = !responseCorrelationId || responseCorrelationId === correlationId;');
    expect(streamBlock).toContain('if (data.chat_id === tenantScope.chatId && correlationMatch) {');
  });
});
