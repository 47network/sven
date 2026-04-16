/**
 * Typography system — type scales, font pairing, readability analysis.
 *
 * Generates modular type scales, fluid typography (CSS clamp()),
 * and evaluates reading comfort metrics.
 */

// ──── Types ──────────────────────────────────────────────────────

export type TypeScaleRatio =
  | 'minor-second'    // 1.067
  | 'major-second'    // 1.125
  | 'minor-third'     // 1.200
  | 'major-third'     // 1.250
  | 'perfect-fourth'  // 1.333
  | 'augmented-fourth' // 1.414
  | 'perfect-fifth'   // 1.500
  | 'golden-ratio';    // 1.618

export interface TypeScale {
  ratio: TypeScaleRatio;
  ratioValue: number;
  baseSizePx: number;
  steps: TypeStep[];
}

export interface TypeStep {
  name: string;
  sizePx: number;
  sizeRem: number;
  lineHeight: number;
  letterSpacing: string;
  /** CSS clamp() for fluid responsive sizing */
  fluidClamp: string;
}

export interface FontPairing {
  heading: FontSpec;
  body: FontSpec;
  mono: FontSpec;
  mood: string;
  fallbackStack: string;
}

export interface FontSpec {
  family: string;
  weight: number;
  style: string;
  fallback: string[];
}

export interface ReadabilityAnalysis {
  score: number;            // 0-100
  lineHeightOk: boolean;
  lineLengthOk: boolean;    // 45-75 characters
  fontSizeOk: boolean;      // ≥ 16px for body
  letterSpacingOk: boolean;
  issues: string[];
  suggestions: string[];
}

// ──── Constants ──────────────────────────────────────────────────

const SCALE_RATIOS: Record<TypeScaleRatio, number> = {
  'minor-second': 1.067,
  'major-second': 1.125,
  'minor-third': 1.200,
  'major-third': 1.250,
  'perfect-fourth': 1.333,
  'augmented-fourth': 1.414,
  'perfect-fifth': 1.500,
  'golden-ratio': 1.618,
};

const STEP_NAMES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];

// ──── Type Scale Generator ───────────────────────────────────────

/** Generate a modular type scale from a base size and ratio. */
export function generateTypeScale(
  baseSizePx: number = 16,
  ratio: TypeScaleRatio = 'major-third',
): TypeScale {
  const rv = SCALE_RATIOS[ratio];
  if (!rv) throw new Error(`Unknown type scale ratio: ${ratio}`);

  // Base is at index 2 (xs=-2, sm=-1, base=0, lg=+1, ...)
  const steps: TypeStep[] = STEP_NAMES.map((name, i) => {
    const exponent = i - 2; // xs=-2, sm=-1, base=0, ...
    const sizePx = Math.round(baseSizePx * Math.pow(rv, exponent) * 100) / 100;
    const sizeRem = Math.round((sizePx / 16) * 1000) / 1000;

    // Line height decreases as font size increases
    const lineHeight = sizePx <= 16 ? 1.6 : sizePx <= 24 ? 1.4 : sizePx <= 40 ? 1.2 : 1.1;

    // Letter spacing: looser for small text, tighter for large headings
    const tracking = sizePx <= 14 ? '0.025em' : sizePx <= 20 ? '0em' : sizePx <= 40 ? '-0.01em' : '-0.02em';

    // Fluid clamp: scales between 320px and 1280px viewport
    const minPx = Math.round(sizePx * 0.85 * 100) / 100;
    const maxPx = sizePx;
    const vw = Math.round(((maxPx - minPx) / (1280 - 320)) * 100 * 1000) / 1000;
    const offset = Math.round((minPx - (320 * vw) / 100) * 100) / 100;
    const fluidClamp = `clamp(${minPx / 16}rem, ${offset / 16}rem + ${vw}vw, ${maxPx / 16}rem)`;

    return { name, sizePx, sizeRem, lineHeight, letterSpacing: tracking, fluidClamp };
  });

  return { ratio, ratioValue: rv, baseSizePx, steps };
}

/** Convert a type scale to CSS custom properties. */
export function typeScaleToCSS(scale: TypeScale): string {
  const lines: string[] = [':root {'];

  for (const step of scale.steps) {
    lines.push(`  --font-size-${step.name}: ${step.fluidClamp};`);
    lines.push(`  --line-height-${step.name}: ${step.lineHeight};`);
    lines.push(`  --letter-spacing-${step.name}: ${step.letterSpacing};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ──── Font Pairing Database ──────────────────────────────────────

const PAIRINGS: FontPairing[] = [
  {
    heading: { family: 'Inter', weight: 700, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    body: { family: 'Inter', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'JetBrains Mono', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'clean',
    fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    heading: { family: 'Playfair Display', weight: 700, style: 'normal', fallback: ['Georgia', 'serif'] },
    body: { family: 'Source Sans 3', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'Source Code Pro', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'elegant',
    fallbackStack: 'Georgia, "Times New Roman", Times, serif',
  },
  {
    heading: { family: 'Space Grotesk', weight: 700, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    body: { family: 'Space Grotesk', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'Space Mono', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'technical',
    fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    heading: { family: 'DM Sans', weight: 700, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    body: { family: 'DM Sans', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'DM Mono', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'modern',
    fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    heading: { family: 'Merriweather', weight: 700, style: 'normal', fallback: ['Georgia', 'serif'] },
    body: { family: 'Open Sans', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'Fira Code', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'editorial',
    fallbackStack: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    heading: { family: 'Sora', weight: 700, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    body: { family: 'Sora', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'JetBrains Mono', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'geometric',
    fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    heading: { family: 'Cabinet Grotesk', weight: 800, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    body: { family: 'Satoshi', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'Berkeley Mono', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'startup',
    fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    heading: { family: 'Archivo', weight: 800, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    body: { family: 'Archivo', weight: 400, style: 'normal', fallback: ['system-ui', 'sans-serif'] },
    mono: { family: 'IBM Plex Mono', weight: 400, style: 'normal', fallback: ['Consolas', 'monospace'] },
    mood: 'bold',
    fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
];

/** Get a font pairing by mood. */
export function getFontPairing(mood: string): FontPairing | undefined {
  return PAIRINGS.find((p) => p.mood === mood.toLowerCase());
}

/** Get all available font pairing moods. */
export function getAvailableMoods(): string[] {
  return PAIRINGS.map((p) => p.mood);
}

/** Generate a CSS font-face stack string from a FontSpec. */
export function fontSpecToCSS(spec: FontSpec): string {
  const fallbacks = spec.fallback.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');
  return `"${spec.family}", ${fallbacks}`;
}

// ──── Readability Analysis ───────────────────────────────────────

export interface ReadabilityInput {
  fontSizePx: number;
  lineHeight: number;
  lineWidthChars: number;
  letterSpacingEm: number;
}

interface CheckResult {
  ok: boolean;
  penalty: number;
  issues: string[];
  suggestions: string[];
}

function checkFontSize(fontSizePx: number): CheckResult {
  const ok = fontSizePx >= 16;
  const issues: string[] = [];
  const suggestions: string[] = [];
  let penalty = 0;

  if (!ok) {
    penalty = 25;
    issues.push(`Font size ${fontSizePx}px is below minimum 16px for body text`);
    suggestions.push(`Increase font size to at least 16px for comfortable reading`);
  }

  return { ok, penalty, issues, suggestions };
}

function checkLineHeight(lineHeight: number): CheckResult {
  const ok = lineHeight >= 1.4 && lineHeight <= 1.8;
  const issues: string[] = [];
  const suggestions: string[] = [];
  let penalty = 0;

  if (!ok) {
    penalty = 20;
    if (lineHeight < 1.4) {
      issues.push(`Line height ${lineHeight} is too tight (< 1.4)`);
      suggestions.push('Increase line-height to at least 1.5 for body text');
    } else {
      issues.push(`Line height ${lineHeight} is too loose (> 1.8)`);
      suggestions.push('Decrease line-height to maximum 1.8 for body text');
    }
  }

  return { ok, penalty, issues, suggestions };
}

function checkLineWidth(lineWidthChars: number): CheckResult {
  const ok = lineWidthChars >= 45 && lineWidthChars <= 75;
  const issues: string[] = [];
  const suggestions: string[] = [];
  let penalty = 0;

  if (!ok) {
    penalty = 20;
    if (lineWidthChars < 45) {
      issues.push(`Line length ${lineWidthChars} chars is too narrow (< 45)`);
      suggestions.push('Increase container width or decrease font size for longer lines');
    } else {
      issues.push(`Line length ${lineWidthChars} chars is too wide (> 75)`);
      suggestions.push('Set max-width on the text container (e.g., max-width: 65ch)');
    }
  }

  return { ok, penalty, issues, suggestions };
}

function checkLetterSpacing(letterSpacingEm: number): CheckResult {
  const ok = letterSpacingEm >= -0.01 && letterSpacingEm <= 0.05;
  const issues: string[] = [];
  const suggestions: string[] = [];
  let penalty = 0;

  if (!ok) {
    penalty = 15;
    issues.push(`Letter spacing ${letterSpacingEm}em is outside recommended range`);
    suggestions.push('Use 0 to 0.025em letter-spacing for body text');
  }

  return { ok, penalty, issues, suggestions };
}

/** Analyze text readability against typographic best practices. */
export function analyzeReadability(input: ReadabilityInput): ReadabilityAnalysis {
  let score = 100;

  const fontSizeResult = checkFontSize(input.fontSizePx);
  const lineHeightResult = checkLineHeight(input.lineHeight);
  const lineLengthResult = checkLineWidth(input.lineWidthChars);
  const letterSpacingResult = checkLetterSpacing(input.letterSpacingEm);

  const allIssues = [
    ...fontSizeResult.issues,
    ...lineHeightResult.issues,
    ...lineLengthResult.issues,
    ...letterSpacingResult.issues,
  ];

  const allSuggestions = [
    ...fontSizeResult.suggestions,
    ...lineHeightResult.suggestions,
    ...lineLengthResult.suggestions,
    ...letterSpacingResult.suggestions,
  ];

  score -= fontSizeResult.penalty;
  score -= lineHeightResult.penalty;
  score -= lineLengthResult.penalty;
  score -= letterSpacingResult.penalty;

  // Bonus: optimal reading zone
  if (
    fontSizeResult.ok &&
    lineHeightResult.ok &&
    lineLengthResult.ok &&
    input.lineWidthChars >= 55 &&
    input.lineWidthChars <= 65
  ) {
    score = Math.min(100, score + 5); // Bonus for sweet spot
  }

  return {
    score: Math.max(0, score),
    lineHeightOk: lineHeightResult.ok,
    lineLengthOk: lineLengthResult.ok,
    fontSizeOk: fontSizeResult.ok,
    letterSpacingOk: letterSpacingResult.ok,
    issues: allIssues,
    suggestions: allSuggestions,
  };
}

/** Generate a vertical rhythm baseline CSS from a base size. */
export function generateVerticalRhythm(baseSizePx: number = 16, baseLineHeight: number = 1.5): string {
  const rhythmUnit = baseSizePx * baseLineHeight;
  const lines = [
    ':root {',
    `  --rhythm-unit: ${rhythmUnit}px;`,
    `  --rhythm-half: ${rhythmUnit / 2}px;`,
    `  --rhythm-quarter: ${rhythmUnit / 4}px;`,
    `  --rhythm-double: ${rhythmUnit * 2}px;`,
    '}',
    '',
    '/* Vertical rhythm helper */',
    `body { font-size: ${baseSizePx}px; line-height: ${baseLineHeight}; }`,
    `h1 { margin-top: var(--rhythm-double); margin-bottom: var(--rhythm-unit); }`,
    `h2 { margin-top: var(--rhythm-double); margin-bottom: var(--rhythm-half); }`,
    `h3 { margin-top: var(--rhythm-unit); margin-bottom: var(--rhythm-half); }`,
    `p, ul, ol { margin-bottom: var(--rhythm-unit); }`,
  ];
  return lines.join('\n');
}
