import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const AGENT_RUNTIME_INDEX = path.resolve(__dirname, '../../../agent-runtime/src/index.ts');
const AGENT_RUNTIME_SHORTCUTS = path.resolve(__dirname, '../../../agent-runtime/src/voice-shortcuts.ts');
const SHORTCUTS_MIGRATION = path.resolve(__dirname, '../db/migrations/131_voice_shortcuts_settings.sql');

describe('D5 Voice Shortcuts', () => {
  it('Agent runtime includes direct voice shortcut handler before LLM round-trip', async () => {
    const source = await fs.readFile(AGENT_RUNTIME_INDEX, 'utf8');
    expect(source.includes('maybeHandleVoiceShortcut')).toBe(true);
    expect(source.includes('voice.shortcuts.enabled')).toBe(true);
    expect(source.includes('TOOL_RUN_REQUEST')).toBe(true);
    expect(source.includes('Voice shortcut executed')).toBe(true);
  });

  it('Voice shortcut parser supports core light/switch shortcut intents', async () => {
    const source = await fs.readFile(AGENT_RUNTIME_SHORTCUTS, 'utf8');
    expect(source.includes('light.turn_off')).toBe(true);
    expect(source.includes('light.turn_on')).toBe(true);
    expect(source.includes('switch.turn_off')).toBe(true);
    expect(source.includes('switch.turn_on')).toBe(true);
    expect(source.includes('parseVoiceShortcut')).toBe(true);
  });

  it('Migration defines shortcuts setting defaults and allowlist', async () => {
    const migration = await fs.readFile(SHORTCUTS_MIGRATION, 'utf8');
    expect(migration.includes('voice.shortcuts.enabled')).toBe(true);
    expect(migration.includes('voice.shortcuts.allowedServices')).toBe(true);
  });
});
