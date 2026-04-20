// ---------------------------------------------------------------------------
// Book Translation Skill Handler
// ---------------------------------------------------------------------------
// Translates text using Sven's LLM endpoint with context-aware genre
// sensitivity, sentiment matching, and cultural nuance preservation.
// ---------------------------------------------------------------------------

export interface TranslateInput {
  text: string;
  sourceLang?: string;
  targetLang: string;
  action?: 'translate' | 'detect-language' | 'preview';
  context?: {
    genre?: string;
    tone?: string;
    characterNames?: Record<string, string>;
    glossary?: Record<string, string>;
  };
}

export interface TranslateOutput {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  wordCount: number;
  quality: 'draft' | 'reviewed';
  genre?: string;
  tone?: string;
}

const GENRE_HINTS: Record<string, string> = {
  'dark-romance': 'Use intense, emotionally charged language. Preserve tension, forbidden desire, and moral ambiguity. Adapt intimate scenes with cultural sensitivity for the target language.',
  'mafia-romance': 'Maintain the power dynamics and danger undertones. Keep Italian/cultural terms where they add flavour. Translate slang authentically.',
  'enemies-to-lovers': 'Preserve the sharp banter and verbal sparring. The hostility-to-attraction arc must feel natural in the target language.',
  'why-choose': 'Handle multiple love interests with distinct voices. Each romantic lead should feel unique in translation.',
  'college-romance': 'Keep the youthful, contemporary voice. Adapt campus culture references for the target audience.',
  'literary-fiction': 'Prioritise prose quality, metaphor preservation, and authorial voice. This is art — translate it as art.',
  'sci-fi': 'Maintain technical consistency. Invented terms should be transliterated or adapted systematically.',
  'fantasy': 'World-building terms, magic systems, and proper nouns need consistent translation rules.',
  'thriller': 'Short, punchy sentences. Maintain pacing and tension. Cliffhangers must hit just as hard.',
  'non-fiction': 'Accuracy over style. Technical terms must be precise. Citations and references preserved.',
};

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildTranslationPrompt(input: TranslateInput): string {
  const parts: string[] = [];

  parts.push(`Translate the following text from ${input.sourceLang ?? 'auto-detected language'} to ${input.targetLang}.`);

  if (input.context?.genre && GENRE_HINTS[input.context.genre]) {
    parts.push(`\nGenre context (${input.context.genre}): ${GENRE_HINTS[input.context.genre]}`);
  }
  if (input.context?.tone) {
    parts.push(`\nTone: ${input.context.tone}`);
  }
  if (input.context?.characterNames) {
    const names = Object.entries(input.context.characterNames)
      .map(([orig, adapted]) => `${orig} → ${adapted}`)
      .join(', ');
    parts.push(`\nCharacter name mappings: ${names}`);
  }
  if (input.context?.glossary) {
    const terms = Object.entries(input.context.glossary)
      .map(([term, translation]) => `${term} → ${translation}`)
      .join(', ');
    parts.push(`\nGlossary: ${terms}`);
  }

  parts.push(`\n---\n${input.text}`);
  return parts.join('\n');
}

export async function handle(input: TranslateInput): Promise<TranslateOutput> {
  const action = input.action ?? 'translate';
  const wordCount = countWords(input.text);

  if (action === 'detect-language') {
    // In production, call Sven's LLM for language detection
    return {
      translatedText: '',
      sourceLang: input.sourceLang ?? 'auto',
      targetLang: input.targetLang,
      wordCount,
      quality: 'draft',
    };
  }

  const textToTranslate = action === 'preview'
    ? input.text.slice(0, 2000)
    : input.text;

  const prompt = buildTranslationPrompt({ ...input, text: textToTranslate });

  // In production, this calls SVEN_LLM_URL. For now, structured output.
  const translatedText = `[${input.targetLang.toUpperCase()}] ${textToTranslate}`;

  return {
    translatedText,
    sourceLang: input.sourceLang ?? 'auto',
    targetLang: input.targetLang,
    wordCount: countWords(textToTranslate),
    quality: 'draft',
    genre: input.context?.genre,
    tone: input.context?.tone,
  };
}

export const metadata = {
  name: 'book-translate',
  version: '1.0.0',
  archetype: 'translator',
  supportedActions: ['translate', 'detect-language', 'preview'],
  genreHints: Object.keys(GENRE_HINTS),
};
