import { describe, expect, it } from '@jest/globals';
import {
  buildDelayedRecallPrompt,
  selectDelayedRecallMemories,
  shouldEvaluateDelayedRecall,
} from '../delayed-recall';

describe('Delayed memory recall', () => {
  it('integration: evaluator triggers on configured every-N turns cadence', () => {
    expect(shouldEvaluateDelayedRecall({
      enabled: true,
      everyNTurns: 3,
      userTurnCount: 1,
    })).toBe(false);
    expect(shouldEvaluateDelayedRecall({
      enabled: true,
      everyNTurns: 3,
      userTurnCount: 2,
    })).toBe(false);
    expect(shouldEvaluateDelayedRecall({
      enabled: true,
      everyNTurns: 3,
      userTurnCount: 3,
    })).toBe(true);
  });

  it('gates recall by min turns between injections and min time between injections', () => {
    expect(shouldEvaluateDelayedRecall({
      enabled: true,
      everyNTurns: 3,
      userTurnCount: 6,
      lastInjectedUserTurn: 4,
      minTurnsBetween: 3,
    })).toBe(false);

    expect(shouldEvaluateDelayedRecall({
      enabled: true,
      everyNTurns: 3,
      userTurnCount: 6,
      lastInjectedUserTurn: 3,
      minTurnsBetween: 3,
      minMinutesBetween: 30,
      nowMs: 60 * 60 * 1000,
      lastInjectedAtMs: (60 * 60 * 1000) - (10 * 60 * 1000),
    })).toBe(false);

    expect(shouldEvaluateDelayedRecall({
      enabled: true,
      everyNTurns: 3,
      userTurnCount: 6,
      lastInjectedUserTurn: 3,
      minTurnsBetween: 3,
      minMinutesBetween: 30,
      nowMs: 60 * 60 * 1000,
      lastInjectedAtMs: (60 * 60 * 1000) - (31 * 60 * 1000),
    })).toBe(true);
  });

  it('integration: relevant memory is selected when topic overlaps recent context', () => {
    const memories = [
      { key: 'preference.food', value: 'The user loves spicy ramen and chili oil.' },
      { key: 'profile.timezone', value: 'UTC+7 timezone preference.' },
      { key: 'project.note', value: 'Use nginx reverse proxy in production.' },
    ];
    const messages = [
      { role: 'user', text: 'I want dinner suggestions tonight.' },
      { role: 'assistant', text: 'Any preference?' },
      { role: 'user', text: 'Something spicy please.' },
    ];
    const selected = selectDelayedRecallMemories({
      memories,
      contextMessages: messages,
      maxItems: 3,
      minOverlap: 1,
    });
    const keys = selected.map((m) => String(m.key));
    expect(keys).toContain('preference.food');
  });

  it('builds concise system prompt section from selected memories', () => {
    const prompt = buildDelayedRecallPrompt([
      { key: 'profile.name', value: 'User goes by Sam.' },
      { key: 'preference.editor', value: 'Prefers Vim keybindings.' },
    ]);
    expect(prompt).toContain('Proactive memory recall');
    expect(prompt).toContain('profile.name');
    expect(prompt).toContain('preference.editor');
  });
});
