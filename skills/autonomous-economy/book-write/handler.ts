// ---------------------------------------------------------------------------
// Book Writing Skill Handler
// ---------------------------------------------------------------------------
// Creative writing engine with persona system. Each writer agent adopts a
// unique author persona with genre expertise, voice signatures, and style.
// ---------------------------------------------------------------------------

export interface AuthorPersona {
  name: string;
  style: 'lyrical' | 'gritty' | 'minimalist' | 'verbose' | 'poetic';
  tone: 'dark' | 'playful' | 'intense' | 'tender' | 'sarcastic';
  signaturePhrases?: string[];
  genreExpertise: string[];
}

export interface WriteInput {
  action: 'outline' | 'write-chapter' | 'write-blurb' | 'generate-title' | 'write-synopsis';
  genre: string;
  authorPersona?: AuthorPersona;
  outline?: string;
  chapterNumber?: number;
  maxWords?: number;
  characters?: Array<{ name: string; role: string; description: string }>;
  previousContext?: string;
}

export interface WriteOutput {
  content: string;
  wordCount: number;
  genre: string;
  action: string;
  chapterNumber: number | null;
  persona: string | null;
  quality: 'draft' | 'polished';
}

// ── Genre writing hints ─────────────────────────────────────────────────
const GENRE_HINTS: Record<string, string> = {
  'dark-romance': 'Morally grey heroes. Possessive, intense. Taboo elements. The line between love and obsession blurs. Power imbalances. Emotional damage as foreplay.',
  'mafia-romance': 'Criminal underworld meets passion. Loyalty, betrayal, arranged marriages. Italian/Russian cultural elements. Blood-soaked devotion.',
  'why-choose': 'Multiple love interests, no choosing required. Group dynamics, jealousy management, found family. Each partner brings something unique.',
  'step-sibling': 'Forbidden proximity. Shared spaces, stolen glances. The tension of "we shouldn\'t" driving every interaction.',
  'enemies-to-lovers': 'Verbal sparring as foreplay. Hate that masks attraction. The moment they realise they\'re fighting feelings, not each other.',
  'enemies-to-lovers-to-enemies': 'The cycle. Trust built, then shattered. Betrayal that cuts deeper because they let their guard down. Twice the angst.',
  'college-romance': 'Campus setting. Study sessions that aren\'t about studying. Parties, dorm rooms, first experiences. Growth and self-discovery.',
  'bully-romance': 'Power dynamics. Cruel hero with hidden vulnerability. The victim who refuses to break. Redemption must be earned.',
  'ex-boyfriend-dad': 'Age gap. Forbidden family dynamics. Mature hero, younger heroine discovering herself. The son/friend who must never know.',
  'psychological-thriller': 'Unreliable narrators. Twists that recontextualise everything. Paranoia as atmosphere. Trust no one, including the protagonist.',
  'romantasy': 'Fantasy world-building meets romance. Fated mates, magical bonds, kingdoms at stake. Epic love in epic settings.',
  'reverse-harem': 'One heroine, multiple devoted heroes. Each with distinct personality and role. Power dynamics favour the heroine.',
};

// ── Preset personas ─────────────────────────────────────────────────────
const PRESET_PERSONAS: Record<string, AuthorPersona> = {
  'valentina-noir': {
    name: 'Valentina Noir',
    style: 'gritty',
    tone: 'dark',
    signaturePhrases: ['the devil wears devotion', 'blood promises', 'shattered crowns'],
    genreExpertise: ['dark-romance', 'mafia-romance', 'enemies-to-lovers'],
  },
  'cassandra-wolfe': {
    name: 'Cassandra Wolfe',
    style: 'lyrical',
    tone: 'intense',
    signaturePhrases: ['souls intertwined', 'the gravity of us', 'starfire and shadow'],
    genreExpertise: ['why-choose', 'reverse-harem', 'romantasy'],
  },
  'mira-ashford': {
    name: 'Mira Ashford',
    style: 'minimalist',
    tone: 'tender',
    signaturePhrases: ['quiet storms', 'between heartbeats', 'the space you left'],
    genreExpertise: ['college-romance', 'bully-romance', 'step-sibling'],
  },
  'roman-blackwell': {
    name: 'Roman Blackwell',
    style: 'verbose',
    tone: 'sarcastic',
    signaturePhrases: ['the mind is the real cage', 'trust is just betrayal on layaway'],
    genreExpertise: ['psychological-thriller', 'enemies-to-lovers-to-enemies'],
  },
};

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildWritingPrompt(input: WriteInput): string {
  const parts: string[] = [];
  const persona = input.authorPersona ?? PRESET_PERSONAS['valentina-noir'];
  const genreHint = GENRE_HINTS[input.genre] ?? '';

  parts.push(`You are ${persona.name}, a bestselling author known for your ${persona.style} ${persona.tone} writing style.`);
  if (persona.signaturePhrases?.length) {
    parts.push(`Your signature motifs include: "${persona.signaturePhrases.join('", "')}".`);
  }

  parts.push(`\nGenre: ${input.genre}`);
  if (genreHint) parts.push(`Genre guide: ${genreHint}`);

  switch (input.action) {
    case 'outline':
      parts.push('\nCreate a detailed chapter-by-chapter outline for a full novel. Include character arcs, plot twists, and emotional beats.');
      break;
    case 'write-chapter':
      parts.push(`\nWrite chapter ${input.chapterNumber ?? 1}. Target: ${input.maxWords ?? 3000} words.`);
      if (input.outline) parts.push(`\nOutline: ${input.outline}`);
      if (input.previousContext) parts.push(`\nPrevious context: ${input.previousContext}`);
      break;
    case 'write-blurb':
      parts.push('\nWrite a compelling back-cover blurb (150-250 words) that hooks readers and hints at the central conflict without spoilers.');
      break;
    case 'generate-title':
      parts.push('\nGenerate 5 evocative book title options that capture the genre essence and stand out in the market.');
      break;
    case 'write-synopsis':
      parts.push('\nWrite a full plot synopsis (500-800 words) suitable for publisher submissions.');
      break;
  }

  if (input.characters?.length) {
    parts.push('\nCharacters:');
    for (const c of input.characters) {
      parts.push(`- ${c.name} (${c.role}): ${c.description}`);
    }
  }

  return parts.join('\n');
}

export async function handle(input: WriteInput): Promise<WriteOutput> {
  const persona = input.authorPersona ?? PRESET_PERSONAS['valentina-noir'];
  const prompt = buildWritingPrompt(input);

  // In production, calls SVEN_LLM_URL with the prompt.
  // For now, returns structured placeholder that the task executor expects.
  const content = `[${persona.name}] [${input.genre}] [${input.action}]\n\n${prompt.slice(0, 500)}...`;

  return {
    content,
    wordCount: countWords(content),
    genre: input.genre,
    action: input.action,
    chapterNumber: input.chapterNumber ?? null,
    persona: persona.name,
    quality: 'draft',
  };
}

export const metadata = {
  name: 'book-write',
  version: '1.0.0',
  archetype: 'writer',
  supportedActions: ['outline', 'write-chapter', 'write-blurb', 'generate-title', 'write-synopsis'],
  genreHints: Object.keys(GENRE_HINTS),
  presetPersonas: Object.keys(PRESET_PERSONAS),
};
