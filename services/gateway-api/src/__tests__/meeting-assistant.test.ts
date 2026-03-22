import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_CANVAS = path.resolve(__dirname, '../routes/canvas.ts');
const MIGRATION = path.resolve(__dirname, '../db/migrations/133_meeting_assistant.sql');

describe('D5 Meeting Assistant', () => {
  it('Canvas route exposes meeting assistant lifecycle endpoints', async () => {
    const source = await fs.readFile(GATEWAY_CANVAS, 'utf8');
    expect(source.includes('/v1/chats/:chatId/meetings/assistant/start')).toBe(true);
    expect(source.includes('/v1/chats/:chatId/meetings/assistant/:sessionId/notes')).toBe(true);
    expect(source.includes('/v1/chats/:chatId/meetings/assistant/:sessionId/summary')).toBe(true);
    expect(source.includes('/v1/chats/:chatId/meetings/assistant/:sessionId/end')).toBe(true);
    expect(source.includes('voice.meetingAssistant.enabled')).toBe(true);
    expect(source.includes('runOneShotCompletionViaOpenAICompat')).toBe(true);
  });

  it('Migration defines meeting assistant setting and session table', async () => {
    const migration = await fs.readFile(MIGRATION, 'utf8');
    expect(migration.includes('voice.meetingAssistant.enabled')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS meeting_assistant_sessions')).toBe(true);
    expect(migration.includes('notes           JSONB NOT NULL DEFAULT')).toBe(true);
    expect(migration.includes('summary_text')).toBe(true);
  });
});
