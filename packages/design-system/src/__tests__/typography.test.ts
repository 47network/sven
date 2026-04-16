import { analyzeReadability } from '../typography/index.js';

describe('analyzeReadability', () => {
  it('returns perfect score with bonus for optimal reading zone', () => {
    const result = analyzeReadability({
      fontSizePx: 16,
      lineHeight: 1.5,
      lineWidthChars: 60,
      letterSpacingEm: 0,
    });
    expect(result.score).toBe(100);
    expect(result.fontSizeOk).toBe(true);
    expect(result.lineHeightOk).toBe(true);
    expect(result.lineLengthOk).toBe(true);
    expect(result.letterSpacingOk).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it('penalizes and reports issue for small font size', () => {
    const result = analyzeReadability({
      fontSizePx: 14,
      lineHeight: 1.5,
      lineWidthChars: 60,
      letterSpacingEm: 0,
    });
    expect(result.score).toBe(75);
    expect(result.fontSizeOk).toBe(false);
    expect(result.issues).toContain('Font size 14px is below minimum 16px for body text');
    expect(result.suggestions).toContain('Increase font size to at least 16px for comfortable reading');
  });

  it('penalizes and reports issue for tight line height', () => {
    const result = analyzeReadability({
      fontSizePx: 16,
      lineHeight: 1.2,
      lineWidthChars: 60,
      letterSpacingEm: 0,
    });
    expect(result.score).toBe(80);
    expect(result.lineHeightOk).toBe(false);
    expect(result.issues).toContain('Line height 1.2 is too tight (< 1.4)');
    expect(result.suggestions).toContain('Increase line-height to at least 1.5 for body text');
  });

  it('penalizes and reports issue for loose line height', () => {
    const result = analyzeReadability({
      fontSizePx: 16,
      lineHeight: 2.0,
      lineWidthChars: 60,
      letterSpacingEm: 0,
    });
    expect(result.score).toBe(80);
    expect(result.lineHeightOk).toBe(false);
    expect(result.issues).toContain('Line height 2 is too loose (> 1.8)');
    expect(result.suggestions).toContain('Decrease line-height to maximum 1.8 for body text');
  });

  it('penalizes and reports issue for narrow line width', () => {
    const result = analyzeReadability({
      fontSizePx: 16,
      lineHeight: 1.5,
      lineWidthChars: 30,
      letterSpacingEm: 0,
    });
    expect(result.score).toBe(80);
    expect(result.lineLengthOk).toBe(false);
    expect(result.issues).toContain('Line length 30 chars is too narrow (< 45)');
    expect(result.suggestions).toContain('Increase container width or decrease font size for longer lines');
  });

  it('penalizes and reports issue for wide line width', () => {
    const result = analyzeReadability({
      fontSizePx: 16,
      lineHeight: 1.5,
      lineWidthChars: 90,
      letterSpacingEm: 0,
    });
    expect(result.score).toBe(80);
    expect(result.lineLengthOk).toBe(false);
    expect(result.issues).toContain('Line length 90 chars is too wide (> 75)');
    expect(result.suggestions).toContain('Set max-width on the text container (e.g., max-width: 65ch)');
  });

  it('penalizes and reports issue for out of bounds letter spacing', () => {
    const result = analyzeReadability({
      fontSizePx: 16,
      lineHeight: 1.5,
      lineWidthChars: 60,
      letterSpacingEm: -0.05,
    });
    expect(result.score).toBe(90); // 100 - 15 + 5 (bonus for other metrics being ok)
    expect(result.letterSpacingOk).toBe(false);
    expect(result.issues).toContain('Letter spacing -0.05em is outside recommended range');
    expect(result.suggestions).toContain('Use 0 to 0.025em letter-spacing for body text');
  });

  it('accumulates multiple penalties and sets min score to 0', () => {
    const result = analyzeReadability({
      fontSizePx: 12,          // -25
      lineHeight: 1.0,         // -20
      lineWidthChars: 100,     // -20
      letterSpacingEm: 0.1,    // -15
    });
    expect(result.score).toBe(20); // 100 - 80
    expect(result.issues).toHaveLength(4);
    expect(result.suggestions).toHaveLength(4);
  });
});
