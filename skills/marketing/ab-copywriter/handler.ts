// ---------------------------------------------------------------------------
// A/B Copywriter Skill — Generate & score copy variants for testing
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'generate_variants': {
      const original = (input.original as string) || '';
      const type = (input.type as string) || 'headline';
      const count = Math.max(2, Math.min(10, (input.count as number) || 3));

      if (!original) return { error: 'original copy is required.' };

      const variants = generateVariants(original, type, count);
      const scored = variants.map((v) => ({
        text: v,
        ...scoreCopy(v, type),
      }));

      scored.sort((a, b) => b.total_score - a.total_score);

      return {
        result: {
          original: { text: original, ...scoreCopy(original, type) },
          variants: scored,
          type,
          recommendation: scored[0]?.text || original,
          variant_count: scored.length,
        },
      };
    }

    case 'score': {
      const original = (input.original as string) || '';
      const type = (input.type as string) || 'headline';

      if (!original) return { error: 'original copy is required.' };

      return { result: { text: original, type, ...scoreCopy(original, type) } };
    }

    case 'suggest_cta': {
      const type = (input.type as string) || 'button';
      const original = (input.original as string) || '';

      const ctas: Record<string, string[]> = {
        button: ['Get Started', 'Try Free', 'Start Now', 'Learn More', 'See How', 'Join Free', 'Unlock Access', 'Claim Offer'],
        link: ['Read the guide →', 'See examples', 'Explore features', 'View pricing', 'Compare plans', 'Watch demo'],
        email: ['Read more', 'Shop now', 'Claim your spot', 'Reserve today', 'See what\'s new', 'Get the details'],
        urgency: ['Act now', 'Limited time', 'Don\'t miss out', 'Last chance', 'Ending soon', 'Only 3 left'],
        social_proof: ['Join 10,000+ users', 'See why teams love it', 'Rated #1', 'Trusted by Fortune 500'],
      };

      const suggestions = ctas[type] || ctas.button;

      return {
        result: {
          type,
          suggestions,
          best_practices: [
            'Use action verbs (Get, Start, Try, Join)',
            'Keep under 5 words for buttons',
            'Create urgency without being pushy',
            'A/B test color AND copy together',
            'Personalize when possible ("Get My Report")',
          ],
          original_score: original ? scoreCopy(original, 'cta') : null,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: generate_variants, score, suggest_cta` };
  }
}

/* -------- Scoring -------- */

interface CopyScore {
  readability: number;
  emotional_impact: number;
  clarity: number;
  brevity: number;
  total_score: number;
  grade: string;
  tips: string[];
}

function scoreCopy(text: string, type: string): CopyScore {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;

  // Readability: short sentences, common words
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / Math.max(wordCount, 1);
  const readability = Math.max(0, Math.min(100, 100 - (avgWordLen - 4) * 15 - Math.max(0, wordCount - 15) * 3));

  // Emotional impact: power words, punctuation
  const powerWords = /\b(free|new|proven|easy|instant|secret|discover|guarantee|save|exclusive|limited|you|your|now|today|imagine|because|breakthrough)\b/gi;
  const powerCount = (text.match(powerWords) || []).length;
  const emotional = Math.min(100, powerCount * 20 + (text.includes('!') ? 10 : 0) + (text.includes('?') ? 10 : 0));

  // Clarity: no jargon, specific
  const jargon = /\b(synergy|leverage|paradigm|scalable|disrupt|ideate|ecosystem|holistic|optimize|actionable)\b/gi;
  const jargonCount = (text.match(jargon) || []).length;
  const hasNumbers = /\d/.test(text);
  const clarity = Math.max(0, 100 - jargonCount * 20 + (hasNumbers ? 10 : 0));

  // Brevity: ideal length depends on type
  const idealLengths: Record<string, { min: number; max: number }> = {
    headline: { min: 4, max: 12 },
    cta: { min: 2, max: 5 },
    email_subject: { min: 4, max: 9 },
    ad_copy: { min: 10, max: 30 },
    tagline: { min: 3, max: 8 },
  };
  const ideal = idealLengths[type] || idealLengths.headline;
  const brevity = wordCount >= ideal.min && wordCount <= ideal.max
    ? 100
    : Math.max(0, 100 - Math.abs(wordCount - (ideal.min + ideal.max) / 2) * 10);

  const total = Math.round((readability + emotional + clarity + brevity) / 4);

  const tips: string[] = [];
  if (readability < 60) tips.push('Use shorter, simpler words');
  if (emotional < 30) tips.push('Add a power word (free, new, proven, discover)');
  if (clarity < 60) tips.push('Remove jargon — use plain language');
  if (brevity < 50) tips.push(`Aim for ${ideal.min}-${ideal.max} words for ${type}`);
  if (!text.match(/[A-Z]/)) tips.push('Capitalize the first word');
  if (charCount > 60 && type === 'email_subject') tips.push('Email subjects > 60 chars get truncated on mobile');

  const grade = total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D';

  return { readability: Math.round(readability), emotional_impact: Math.round(emotional), clarity: Math.round(clarity), brevity: Math.round(brevity), total_score: total, grade, tips };
}

/* -------- Variant Generation -------- */

function generateVariants(original: string, type: string, count: number): string[] {
  const variants: string[] = [];
  const words = original.split(/\s+/);

  // Technique 1: Question form
  if (!original.includes('?')) {
    variants.push(toQuestion(original));
  }

  // Technique 2: Add urgency
  variants.push(addUrgency(original, type));

  // Technique 3: Number/stat prefix
  if (!/^\d/.test(original)) {
    variants.push(addNumber(original));
  }

  // Technique 4: Power word swap
  variants.push(addPowerWord(original));

  // Technique 5: Shorten
  if (words.length > 5) {
    variants.push(shorten(original));
  }

  // Technique 6: Benefit-focused
  variants.push(toBenefit(original));

  // Technique 7: Social proof
  variants.push(addSocialProof(original));

  // De-duplicate and limit
  const unique = [...new Set(variants)].filter((v) => v !== original);
  return unique.slice(0, count);
}

function toQuestion(text: string): string {
  const words = text.split(/\s+/);
  if (words.length < 3) return `Want to ${text.toLowerCase()}?`;
  return `What if you could ${words.slice(0, 6).join(' ').toLowerCase().replace(/[.!]$/, '')}?`;
}

function addUrgency(text: string, type: string): string {
  if (type === 'email_subject') return `[Time Sensitive] ${text}`;
  if (type === 'cta') return `${text} — Today Only`;
  return `${text.replace(/[.!?]$/, '')} — Don't Miss Out`;
}

function addNumber(text: string): string {
  return `5 Ways to ${text.charAt(0).toLowerCase() + text.slice(1).replace(/[.!?]$/, '')}`;
}

function addPowerWord(text: string): string {
  const words = text.split(/\s+/);
  const powerWords = ['Proven', 'Essential', 'Ultimate', 'Exclusive'];
  const pw = powerWords[words.length % powerWords.length];
  return `The ${pw} ${words.slice(0, 6).join(' ')}`;
}

function shorten(text: string): string {
  const words = text.split(/\s+/);
  return words.slice(0, Math.ceil(words.length * 0.6)).join(' ');
}

function toBenefit(text: string): string {
  return `How to ${text.charAt(0).toLowerCase() + text.slice(1).replace(/[.!?]$/, '')} in Half the Time`;
}

function addSocialProof(text: string): string {
  return `Thousands Already Know: ${text}`;
}
