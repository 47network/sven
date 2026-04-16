// ---------------------------------------------------------------------------
// Brand Voice Engine
// ---------------------------------------------------------------------------
// Maintains brand profiles for 47Network products, validates content against
// brand guidelines, and provides tone/style scoring and recommendations.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export interface BrandProfile {
  name: string;
  tagline: string;
  voice: {
    tone: string[];
    avoid: string[];
    personality: string;
  };
  targetAudience: {
    primary: string;
    secondary: string;
    painPoints: string[];
    motivations: string[];
  };
  competitors: string[];
  differentiators: string[];
  keyMessages: string[];
}

export interface BrandCheckResult {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  violations: BrandViolation[];
  suggestions: string[];
  toneAnalysis: ToneScore[];
  keyMessageCoverage: KeyMessageHit[];
}

export interface BrandViolation {
  type: 'prohibited_word' | 'tone_mismatch' | 'missing_cta' | 'off_brand' | 'audience_mismatch';
  severity: 'low' | 'medium' | 'high';
  location: string;
  description: string;
  suggestion: string;
}

export interface ToneScore {
  tone: string;
  score: number; // 0.0-1.0
  present: boolean;
}

export interface KeyMessageHit {
  message: string;
  found: boolean;
  matchStrength: 'strong' | 'weak' | 'absent';
}

/* ------------------------------------------------ default 47Network brand */

export const DEFAULT_47NETWORK_BRAND: BrandProfile = {
  name: '47Network',
  tagline: 'Intelligence infrastructure for the modern enterprise',
  voice: {
    tone: ['professional', 'innovative', 'approachable', 'confident', 'precise'],
    avoid: [
      'synergy', 'leverage', 'disrupt', 'paradigm shift', 'game-changer',
      'circle back', 'deep dive', 'low-hanging fruit', 'move the needle',
      'best-in-class', 'world-class', 'cutting-edge', 'revolutionary',
    ],
    personality:
      'A knowledgeable senior engineer who communicates clearly and directly. ' +
      'Explains complex ideas without dumbing them down. Uses specifics over vague claims.',
  },
  targetAudience: {
    primary: 'Engineering leaders and technical founders building AI-first products',
    secondary: 'DevOps engineers and platform teams evaluating infrastructure',
    painPoints: [
      'Fragmented toolchains for AI agent management',
      'Lack of visibility into agent behaviour at scale',
      'Security blind spots in LLM-powered systems',
      'Vendor lock-in with proprietary AI platforms',
    ],
    motivations: [
      'Ship reliable AI features faster',
      'Maintain control over infrastructure and data',
      'Reduce operational complexity',
      'Build on open, extensible systems',
    ],
  },
  competitors: [],
  differentiators: [
    'Self-hosted, full control — no vendor lock-in',
    'Unified agent runtime with skill system',
    'Enterprise security built-in from day one',
    'Open-source core with premium support',
  ],
  keyMessages: [
    'Own your AI infrastructure',
    'Enterprise-grade security without enterprise complexity',
    'From prototype to production in days, not months',
    'Open by default, secure by design',
  ],
};

/* --------------------------------------------------------- brand checking */

export function checkBrandVoice(
  content: string,
  profile: BrandProfile = DEFAULT_47NETWORK_BRAND,
): BrandCheckResult {
  const lower = content.toLowerCase();

  const violations: BrandViolation[] = [
    ...getProhibitedWordViolations(lower, profile.voice.avoid),
    ...getCtaViolations(lower, content.length),
    ...getJargonViolations(lower),
  ];

  const toneAnalysis = getToneAnalysis(content, profile.voice.tone);
  const keyMessageCoverage = getKeyMessageCoverage(lower, profile.keyMessages);

  const score = calculateBrandScore(toneAnalysis, keyMessageCoverage, violations);
  const suggestions = generateBrandSuggestions(toneAnalysis, keyMessageCoverage);

  return {
    score,
    grade: scoreToGrade(score),
    violations,
    suggestions,
    toneAnalysis,
    keyMessageCoverage,
  };
}

/* --------------------------------------------------------- helper functions */

function getProhibitedWordViolations(lowerContent: string, avoidPhrases: string[]): BrandViolation[] {
  const violations: BrandViolation[] = [];
  for (const phrase of avoidPhrases) {
    const pl = phrase.toLowerCase();
    const idx = lowerContent.indexOf(pl);
    if (idx >= 0) {
      violations.push({
        type: 'prohibited_word',
        severity: 'medium',
        location: `char ${idx}`,
        description: `Prohibited phrase "${phrase}" found`,
        suggestion: `Remove or replace "${phrase}" with a more specific term`,
      });
    }
  }
  return violations;
}

function getToneAnalysis(content: string, tones: string[]): ToneScore[] {
  return tones.map((tone) => {
    const score = estimateTone(content, tone);
    return { tone, score, present: score > 0.3 };
  });
}

function getKeyMessageCoverage(lowerContent: string, keyMessages: string[]): KeyMessageHit[] {
  return keyMessages.map((msg) => {
    const msgWords = msg.toLowerCase().split(/\s+/);
    const matchedWords = msgWords.filter((w) => lowerContent.includes(w));
    const ratio = matchedWords.length / msgWords.length;
    let matchStrength: KeyMessageHit['matchStrength'] = 'absent';
    if (ratio >= 0.7) matchStrength = 'strong';
    else if (ratio >= 0.4) matchStrength = 'weak';
    return { message: msg, found: matchStrength !== 'absent', matchStrength };
  });
}

function getCtaViolations(lowerContent: string, contentLength: number): BrandViolation[] {
  const ctaPatterns = [
    'get started', 'try', 'sign up', 'learn more', 'start', 'deploy',
    'install', 'contact', 'schedule', 'book', 'download', 'explore',
  ];
  const hasCta = ctaPatterns.some((p) => lowerContent.includes(p));
  if (!hasCta && contentLength > 200) {
    return [{
      type: 'missing_cta',
      severity: 'low',
      location: 'end',
      description: 'No call-to-action detected in content',
      suggestion: 'Add a clear CTA aligned with campaign goals',
    }];
  }
  return [];
}

function getJargonViolations(lowerContent: string): BrandViolation[] {
  const violations: BrandViolation[] = [];
  const jargonTerms = [
    'utilize', 'solutionize', 'ideate', 'actionable insights',
    'thought leadership', 'holistic approach', 'end-to-end',
  ];
  for (const term of jargonTerms) {
    if (lowerContent.includes(term)) {
      violations.push({
        type: 'tone_mismatch',
        severity: 'low',
        location: `contains "${term}"`,
        description: `Jargon term "${term}" conflicts with brand personality`,
        suggestion: 'Use plain, direct language per brand voice guidelines',
      });
    }
  }
  return violations;
}

function calculateBrandScore(toneAnalysis: ToneScore[], keyMessageCoverage: KeyMessageHit[], violations: BrandViolation[]): number {
  const toneScore = toneAnalysis.reduce((s, t) => s + t.score, 0) / (toneAnalysis.length || 1);
  const messageScore = keyMessageCoverage.filter((k) => k.found).length / (keyMessageCoverage.length || 1);
  const violationPenalty = violations.reduce(
    (s, v) => s + (v.severity === 'high' ? 15 : v.severity === 'medium' ? 8 : 3),
    0,
  );

  const raw = Math.round(toneScore * 50 + messageScore * 30 + 20 - violationPenalty);
  return Math.max(0, Math.min(100, raw));
}

function generateBrandSuggestions(toneAnalysis: ToneScore[], keyMessageCoverage: KeyMessageHit[]): string[] {
  const suggestions: string[] = [];
  const missingTones = toneAnalysis.filter((t) => !t.present);
  if (missingTones.length > 0) {
    suggestions.push(
      `Strengthen ${missingTones.map((t) => t.tone).join(', ')} tone(s) in the content`,
    );
  }
  const missingMessages = keyMessageCoverage.filter((k) => !k.found);
  if (missingMessages.length > 0) {
    suggestions.push(
      `Incorporate key messages: ${missingMessages.map((k) => `"${k.message}"`).join(', ')}`,
    );
  }
  return suggestions;
}

/* --------------------------------------------------------- tone estimation */

const TONE_INDICATORS: Record<string, string[]> = {
  professional: [
    'enterprise', 'infrastructure', 'architecture', 'engineering', 'production',
    'reliability', 'compliance', 'governance', 'scalable', 'robust',
  ],
  innovative: [
    'new', 'novel', 'advance', 'pioneer', 'evolve', 'modern', 'next',
    'intelligent', 'autonomous', 'smart', 'adaptive', 'dynamic',
  ],
  approachable: [
    'easy', 'simple', 'straightforward', 'you', 'your', 'let\'s',
    'together', 'help', 'guide', 'friendly', 'welcome',
  ],
  confident: [
    'proven', 'built', 'designed', 'delivers', 'guarantees', 'ensures',
    'handles', 'manages', 'powers', 'secure', 'reliable',
  ],
  precise: [
    'specifically', 'exactly', 'measurable', 'concrete', 'defined',
    'milliseconds', 'percent', 'reduction', 'increase', 'metric',
  ],
};

function estimateTone(content: string, tone: string): number {
  const indicators = TONE_INDICATORS[tone];
  if (!indicators) return 0.5;
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/).length;
  if (words === 0) return 0;
  const hits = indicators.filter((i) => lower.includes(i)).length;
  return Math.min(1, hits / Math.max(3, indicators.length * 0.4));
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
