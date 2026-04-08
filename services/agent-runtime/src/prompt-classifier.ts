import { createLogger } from '@sven/shared';

const logger = createLogger('prompt-classifier');

export type TaskCategory =
  | 'code'
  | 'reasoning'
  | 'math'
  | 'creative'
  | 'analysis'
  | 'general';

export type ComplexityTier = 'simple' | 'moderate' | 'complex';

export interface ClassificationResult {
  primary: TaskCategory;
  confidence: number;
  complexity: ComplexityTier;
  scores: Record<TaskCategory, number>;
}

const CODE_PATTERNS: RegExp[] = [
  /\b(code|coding|program|programming|function|class|method|variable|compile|syntax|debug|refactor|implement|api|endpoint|module|import|export|deploy|docker|kubernetes|k8s|nginx|sql|query|database|schema|migration|regex|regexp)\b/i,
  /\b(javascript|typescript|python|rust|golang|java|ruby|php|html|css|react|vue|angular|node|npm|pnpm|yarn|git|github|bash|shell|linux|command\s*line|cli|terminal|makefile|webpack|vite|eslint|prettier)\b/i,
  /\b(bug|fix|error|exception|stack\s*trace|segfault|null\s*pointer|undefined|type\s*error|syntax\s*error|lint|typecheck|unit\s*test|integration\s*test|test\s*case|coverage|ci\/cd|pipeline)\b/i,
  /```[\s\S]*```/,
  /\b(def|fn|func|const|let|var|return|async|await|try|catch|throw|import|from|require|module\.exports|interface|struct|enum|trait|impl|class)\b/,
  /[{}\[\]();].*[{}\[\]();]/,
  /\.(ts|js|py|rs|go|rb|php|java|cpp|c|h|jsx|tsx|vue|svelte|sql|sh|yml|yaml|json|toml|xml|html|css|scss)\b/i,
];

const REASONING_PATTERNS: RegExp[] = [
  /\b(reason|reasoning|think|thinking|analyze|logic|logical|deduce|deduction|infer|inference|step\s*by\s*step|chain\s*of\s*thought|pros?\s*and\s*cons?|trade-?offs?|compare|comparison|evaluate|evaluation|assess|assessment)\b/i,
  /\b(why|how\s+come|what\s+if|suppose|assume|given\s+that|therefore|hence|thus|consequently|implication|what\s+would\s+happen|cause\s+and\s+effect)\b/i,
  /\b(prove|proof|theorem|hypothesis|argument|counterargument|fallacy|paradox|dilemma|puzzle)\b/i,
  /\b(strategy|strategic|plan|planning|decision|decide|prioriti[sz]e|weigh\s+options?|consider\s+the)\b/i,
];

const MATH_PATTERNS: RegExp[] = [
  /\b(math|mathematics|mathematical|calcul|arithmetic|algebra|geometry|trigonometry|statistics|probability|equation|formula|integral|derivative|matrix|matrices|vector|linear\s*algebra|differential|polynomial)\b/i,
  /\b(solve|compute|calculate|sum|product|factorial|permutation|combination|logarithm|exponent|fraction|percentage|ratio|proportion)\b/i,
  /[+\-*/^=]{2,}|\\frac|\\sqrt|\\sum|\\int|\d+\s*[+\-*/^]\s*\d+/,
  /\b(\d+\s*[\+\-\*\/\^%]\s*\d+)\b/,
  /\b(average|mean|median|mode|variance|standard\s*deviation|correlation|regression|distribution|normal|binomial|poisson)\b/i,
  // Natural-language arithmetic and unit conversions
  /\b(plus|minus|times|multiplied\s*by|divided\s*by|squared|cubed|modulo|remainder|power\s*of|to\s*the\s*power)\b/i,
  /\b(equals|equal\s*to|greater\s*than|less\s*than|how\s*much|how\s*many|what\s*is\s*\d|convert\s+\d)\b/i,
  // Digit-word-digit patterns: "5 times 12", "100 divided by 4"
  /\d+\s*(times|plus|minus|divided\s*by|multiplied\s*by|mod|over|x)\s*\d+/i,
];

const CREATIVE_PATTERNS: RegExp[] = [
  /\b(write|writing|story|stories|poem|poetry|creative|fiction|narrative|novel|chapter|character|plot|dialogue|screenplay|script|lyrics|song|compose|composition)\b/i,
  /\b(imagine|fantasy|fantasy|invent|create|brainstorm|idea|ideas|inspiration|metaphor|simile|alliteration|rhyme|haiku|sonnet|limerick|essay)\b/i,
  /\b(blog\s*post|article|copy|copywriting|slogan|tagline|pitch|marketing|content|newsletter|email\s*(draft|template)|social\s*media\s*post)\b/i,
  /\b(role\s*play|roleplay|pretend|act\s+as|you\s+are\s+a|persona|tone|voice|style|rewrite|rephrase|paraphrase)\b/i,
];

const ANALYSIS_PATTERNS: RegExp[] = [
  /\b(analy[sz]|summary|summari[sz]|explain|explanation|breakdown|overview|review|critique|interpret|interpretation|insight|report|findings|conclusion|extract|key\s*points?|takeaway|tldr|tl;dr)\b/i,
  /\b(data|dataset|csv|spreadsheet|chart|graph|trend|pattern|correlation|metric|kpi|benchmark|performance|growth|decline|forecast|predict|projection)\b/i,
  /\b(document|documentation|paper|research|study|survey|whitepaper|case\s*study|literature|source|reference|citation)\b/i,
  /\b(translate|translation|convert|transform|parse|format|restructure|organize|categorize|classify|sort|filter|group|aggregate)\b/i,
];

function scorePatterns(text: string, patterns: RegExp[]): number {
  let score = 0;
  for (const pattern of patterns) {
    const matches = text.match(
      pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, pattern.flags + 'g'),
    );
    if (matches) {
      score += matches.length;
    }
  }
  return score;
}

function scoreAllCategories(text: string): Record<TaskCategory, number> {
  return {
    code: scorePatterns(text, CODE_PATTERNS),
    reasoning: scorePatterns(text, REASONING_PATTERNS),
    math: scorePatterns(text, MATH_PATTERNS),
    creative: scorePatterns(text, CREATIVE_PATTERNS),
    analysis: scorePatterns(text, ANALYSIS_PATTERNS),
    general: 1,
  };
}

/** Minimum confidence to trust a specialized classification. Below this, route to general. */
const CONFIDENCE_THRESHOLD = 0.25;

/** Weight given to the latest message vs. conversation history. */
const LATEST_MSG_WEIGHT = 2.5;
const HISTORY_MSG_WEIGHT = 0.3;

function assessComplexity(text: string): ComplexityTier {
  const wordCount = text.split(/\s+/).length;
  const sentenceCount = (text.match(/[.!?]+/g) || []).length || 1;
  const hasCodeBlocks = /```/.test(text);
  const hasMultipleParts = /\b(\d+[\.\)]\s|firstly|secondly|additionally|furthermore|moreover|step\s*\d)\b/i.test(text);
  const hasTechnicalTerms = /\b(implementation|architecture|infrastructure|optimization|algorithm|concurrency|distributed|scalability|authentication|authorization)\b/i.test(text);
  const questionCount = (text.match(/\?/g) || []).length;

  let score = 0;
  if (wordCount > 100) score += 2;
  else if (wordCount > 40) score += 1;
  if (sentenceCount > 5) score += 1;
  if (hasCodeBlocks) score += 2;
  if (hasMultipleParts) score += 2;
  if (hasTechnicalTerms) score += 1;
  if (questionCount > 2) score += 1;

  if (score >= 4) return 'complex';
  if (score >= 2) return 'moderate';
  return 'simple';
}

/** Maximum text length to classify — longer inputs are truncated to avoid CPU abuse on regex scoring. */
const MAX_CLASSIFY_TEXT_LENGTH = 20_000;

export function classifyPrompt(messages: Array<{ role: string; text?: string }>): ClassificationResult {
  const userMessages = messages
    .filter(m => m.role === 'user' && m.text)
    .map(m => m.text!);

  if (userMessages.length === 0 || userMessages.every(m => m.trim().length === 0)) {
    return { primary: 'general', confidence: 0.5, complexity: 'simple', scores: { code: 0, reasoning: 0, math: 0, creative: 0, analysis: 0, general: 1 } };
  }

  const latestMessage = (userMessages[userMessages.length - 1] ?? '').slice(0, MAX_CLASSIFY_TEXT_LENGTH);
  const historyMessages = userMessages.slice(-6, -1).map(m => m.slice(0, MAX_CLASSIFY_TEXT_LENGTH));

  const latestRaw = scoreAllCategories(latestMessage);
  const historyRaw = historyMessages.length > 0
    ? scoreAllCategories(historyMessages.join(' '))
    : null;

  const combined: Record<TaskCategory, number> = { code: 0, reasoning: 0, math: 0, creative: 0, analysis: 0, general: 0 };
  for (const cat of Object.keys(combined) as TaskCategory[]) {
    combined[cat] = latestRaw[cat] * LATEST_MSG_WEIGHT
      + (historyRaw ? historyRaw[cat] * HISTORY_MSG_WEIGHT : 0);
  }
  if (Object.values(combined).every(v => v === 0)) {
    combined.general = 1;
  }

  const codeBlockCount = (latestMessage.match(/```/g) || []).length / 2;
  if (codeBlockCount >= 1) combined.code += codeBlockCount * 4;

  const totalScore = Object.values(combined).reduce((a, b) => a + b, 0);
  const scores = Object.fromEntries(
    Object.entries(combined).map(([k, v]) => [k, totalScore > 0 ? v / totalScore : 0]),
  ) as Record<TaskCategory, number>;

  let primary: TaskCategory = 'general';
  let maxScore = 0;
  for (const [category, score] of Object.entries(combined) as Array<[TaskCategory, number]>) {
    if (score > maxScore) {
      maxScore = score;
      primary = category;
    }
  }

  const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

  // If confidence is too low, fall back to general (let the router pick the biggest model)
  if (confidence < CONFIDENCE_THRESHOLD && primary !== 'general') {
    logger.info('Low confidence classification, falling back to general', {
      original: primary,
      confidence: confidence.toFixed(2),
    });
    primary = 'general';
  }

  const complexity = assessComplexity(latestMessage);

  logger.info('Prompt classified', {
    primary,
    confidence: confidence.toFixed(2),
    complexity,
    top_scores: Object.entries(combined)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v.toFixed(1)}`),
    text_preview: latestMessage.substring(0, 80),
    history_msgs: historyMessages.length,
  });

  return { primary, confidence, complexity, scores };
}

export function getCapabilityForCategory(category: TaskCategory): string {
  switch (category) {
    case 'code': return 'code';
    case 'reasoning': return 'reasoning';
    case 'math': return 'math';
    case 'creative': return 'creative';
    case 'analysis': return 'analysis';
    case 'general': return 'chat';
  }
}
