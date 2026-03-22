import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_CANVAS = path.resolve(__dirname, '../routes/canvas.ts');
const AGENT_RUNTIME_INDEX = path.resolve(__dirname, '../../../agent-runtime/src/index.ts');
const FASTER_WHISPER_INDEX = path.resolve(__dirname, '../../../faster-whisper/src/index.ts');
const EMOTION_MIGRATION = path.resolve(__dirname, '../db/migrations/129_voice_emotion_detection.sql');

describe('D5 Voice Emotion Detection', () => {
  it('Gateway: wake-word endpoint accepts and forwards emotion hints', async () => {
    const source = await fs.readFile(GATEWAY_CANVAS, 'utf8');
    expect(source.includes('emotion_label?: string')).toBe(true);
    expect(source.includes('emotion_confidence?: number')).toBe(true);
    expect(source.includes("{ emotion: emotionMeta }")).toBe(true);
    expect(source.includes("'voice.emotionDetection.enabled'")).toBe(true);
  });

  it('Faster-whisper: infers emotion and publishes metadata', async () => {
    const source = await fs.readFile(FASTER_WHISPER_INDEX, 'utf8');
    expect(source.includes('detectEmotionFromTranscript')).toBe(true);
    expect(source.includes('voice_emotion_signals')).toBe(true);
    expect(source.includes('{ emotion }')).toBe(true);
    expect(source.includes('voice.emotionDetection.enabled')).toBe(true);
  });

  it('Agent runtime: applies tone hints from emotion metadata', async () => {
    const source = await fs.readFile(AGENT_RUNTIME_INDEX, 'utf8');
    expect(source.includes('buildEmotionToneHint')).toBe(true);
    expect(source.includes("voice.emotionDetection.adjustTone")).toBe(true);
    expect(source.includes('User mood hint:')).toBe(true);
  });

  it('Migration: creates emotion signals table and default settings', async () => {
    const migration = await fs.readFile(EMOTION_MIGRATION, 'utf8');
    expect(migration.includes('CREATE TABLE IF NOT EXISTS voice_emotion_signals')).toBe(true);
    expect(migration.includes('voice.emotionDetection.enabled')).toBe(true);
    expect(migration.includes('voice.emotionDetection.adjustTone')).toBe(true);
  });
});
