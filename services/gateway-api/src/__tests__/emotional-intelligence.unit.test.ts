import { describe, expect, it } from '@jest/globals';
import { analyzeText } from '../services/EmotionalIntelligenceService';

describe('Emotional Intelligence — analyzeText', () => {
  it('detects neutral text', () => {
    const result = analyzeText('The meeting is at 3pm.');
    expect(result.mood).toBe('neutral');
    expect(result.sentiment).toBeCloseTo(0, 1);
  });

  it('detects positive sentiment', () => {
    const result = analyzeText('This is great! Thanks for the help, really appreciate it.');
    expect(result.mood).toBe('positive');
    expect(result.sentiment).toBeGreaterThan(0);
  });

  it('detects negative sentiment', () => {
    const result = analyzeText('This is terrible and useless. Everything is wrong.');
    expect(result.mood).toBe('negative');
    expect(result.sentiment).toBeLessThan(0);
  });

  it('detects frustration', () => {
    const result = analyzeText("It's not working again! Why can't this be fixed? I'm stuck and frustrated!!");
    expect(result.frustration).toBeGreaterThan(0.2);
    expect(result.mood).toBe('frustrated');
  });

  it('detects excitement', () => {
    const result = analyzeText('Amazing!! This is awesome and fantastic! Finally works!');
    expect(result.excitement).toBeGreaterThan(0.2);
  });

  it('detects confusion', () => {
    const result = analyzeText("I don't understand. What do you mean? How does this work? I'm confused.");
    expect(result.confusion).toBeGreaterThan(0.2);
  });

  it('confidence increases with signal strength', () => {
    const weak = analyzeText('ok');
    const strong = analyzeText('This is great! Amazing! Wonderful! Thank you so much! Excellent work!');
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });

  it('handles empty text', () => {
    const result = analyzeText('');
    expect(result.mood).toBe('neutral');
    expect(result.sentiment).toBe(0);
    expect(result.confidence).toBe(0.2);
  });

  it('returns signals metadata', () => {
    const result = analyzeText('Great work, thanks!');
    expect(result.signals).toHaveProperty('positive_signals');
    expect(result.signals).toHaveProperty('word_count');
    expect(result.signals.word_count).toBe(3);
  });
});
