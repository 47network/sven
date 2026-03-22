import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const FASTER_WHISPER_INDEX = path.resolve(__dirname, '../../../faster-whisper/src/index.ts');
const FASTER_WHISPER_SCRIPT = path.resolve(__dirname, '../../../faster-whisper/transcribe.py');
const AGENT_RUNTIME_INDEX = path.resolve(__dirname, '../../../agent-runtime/src/index.ts');
const MULTILANGUAGE_MIGRATION = path.resolve(__dirname, '../db/migrations/130_voice_multilanguage_settings.sql');

describe('D5 Multi-language Voice', () => {
  it('Faster-whisper transcribe script emits detected language metadata', async () => {
    const source = await fs.readFile(FASTER_WHISPER_SCRIPT, 'utf8');
    expect(source.includes('detected_language')).toBe(true);
    expect(source.includes('language_probability')).toBe(true);
  });

  it('Faster-whisper worker propagates detected language to transcript and inbound metadata', async () => {
    const source = await fs.readFile(FASTER_WHISPER_INDEX, 'utf8');
    expect(source.includes('language_detected')).toBe(true);
    expect(source.includes('language_probability')).toBe(true);
    expect(source.includes('voice.multiLanguage.autoDetect')).toBe(true);
  });

  it('Agent runtime applies respond-in-kind hint for voice turns', async () => {
    const source = await fs.readFile(AGENT_RUNTIME_INDEX, 'utf8');
    expect(source.includes('buildVoiceLanguageHint')).toBe(true);
    expect(source.includes('voice.multiLanguage.respondInKind')).toBe(true);
    expect(source.includes('respond in')).toBe(true);
  });

  it('Migration defines multi-language voice setting defaults', async () => {
    const migration = await fs.readFile(MULTILANGUAGE_MIGRATION, 'utf8');
    expect(migration.includes('voice.multiLanguage.enabled')).toBe(true);
    expect(migration.includes('voice.multiLanguage.autoDetect')).toBe(true);
    expect(migration.includes('voice.multiLanguage.respondInKind')).toBe(true);
  });
});
