// ---------------------------------------------------------------------------
// Communication Coach
// ---------------------------------------------------------------------------
// Covers three Pillar 7 capabilities:
//   1. Conversation Simulator — practice hard conversations
//   2. Language Analyzer — extract leadership-level communication patterns
//   3. Communication Auditor — self-perception mirror for your writing
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

// --- Conversation Simulator ---

export type ConversationRole = 'raise_negotiation' | 'bad_news' | 'performance_feedback' | 'client_objection' | 'conflict_resolution' | 'custom';

export interface ConversationScenario {
  id: string;
  role: ConversationRole;
  title: string;
  context: string;
  otherParty: string; // who Sven plays
  objectives: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ConversationTurn {
  speaker: 'user' | 'sven';
  message: string;
  analysis: TurnAnalysis | null;
}

export interface TurnAnalysis {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  effectivenessScore: number; // 0-100
}

export interface ConversationDebrief {
  overallScore: number;
  objectivesMet: string[];
  objectivesMissed: string[];
  communicationStyle: string;
  topStrengths: string[];
  areasForImprovement: string[];
  specificPhrases: { good: string[]; improve: string[] };
}

// --- Language Analyzer ---

export interface LanguageAnalysis {
  level: string; // the level being analyzed
  frameworks: FrameworkPattern[];
  vocabularyPatterns: VocabularyPattern[];
  communicationStructure: StructurePattern[];
  decisionLanguage: string[];
  recommendedAdoptions: string[];
}

export interface FrameworkPattern {
  name: string;
  description: string;
  examples: string[];
  frequency: 'frequent' | 'occasional' | 'rare';
}

export interface VocabularyPattern {
  category: string;
  terms: string[];
  context: string;
}

export interface StructurePattern {
  pattern: string;
  description: string;
  example: string;
}

// --- Communication Auditor ---

export interface CommunicationAudit {
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  impliedLevel: string;
  styleProfile: StyleProfile;
  perceptionAnalysis: PerceptionAnalysis;
  recommendations: AuditRecommendation[];
}

export interface StyleProfile {
  formality: number; // 0.0-1.0
  assertiveness: number;
  empathy: number;
  clarity: number;
  conciseness: number;
  analyticalDepth: number;
  strategicThinking: number;
}

export interface PerceptionAnalysis {
  likelyPerceived: string[];
  strengths: string[];
  blindSpots: string[];
  credibilityMarkers: string[];
  credibilityDetractors: string[];
}

export interface AuditRecommendation {
  area: string;
  currentState: string;
  targetState: string;
  actionableSteps: string[];
  priority: 'high' | 'medium' | 'low';
}

/* ---------------------------------------- conversation scenario presets */

const PRESET_SCENARIOS: ConversationScenario[] = [
  {
    id: 'CS-001',
    role: 'raise_negotiation',
    title: 'Salary Raise Negotiation',
    context: 'You are preparing to negotiate a significant raise with your manager based on recent achievements',
    otherParty: 'Your direct manager who is budget-conscious but appreciates strong performers',
    objectives: ['Present a clear business case for the raise', 'Handle pushback on timing and budget', 'Negotiate specific numbers confidently', 'Maintain the relationship'],
    difficulty: 'intermediate',
  },
  {
    id: 'CS-002',
    role: 'bad_news',
    title: 'Delivering Bad Project News',
    context: 'A critical project is going to miss its deadline by 3 weeks and you need to inform stakeholders',
    otherParty: 'VP of Engineering who promised the board a specific delivery date',
    objectives: ['Deliver the news clearly and early', 'Present a mitigation plan', 'Take ownership without blame-shifting', 'Negotiate new realistic timeline'],
    difficulty: 'advanced',
  },
  {
    id: 'CS-003',
    role: 'performance_feedback',
    title: 'Giving Difficult Performance Feedback',
    context: 'A direct report is underperforming and you need to have a tough but constructive conversation',
    otherParty: 'Team member who is defensive about feedback and believes they are doing well',
    objectives: ['Be specific about performance gaps', 'Use examples not generalisations', 'Create a clear improvement plan', 'End with motivation not discouragement'],
    difficulty: 'advanced',
  },
  {
    id: 'CS-004',
    role: 'client_objection',
    title: 'Handling Client Price Objection',
    context: 'A prospective client loves the product but says pricing is too high compared to competitors',
    otherParty: 'CTO at a mid-stage startup evaluating multiple vendors',
    objectives: ['Reframe the conversation from price to value', 'Address competitor comparisons', 'Explore flexible deal structures', 'Move toward a commitment'],
    difficulty: 'intermediate',
  },
  {
    id: 'CS-005',
    role: 'conflict_resolution',
    title: 'Cross-Team Conflict Resolution',
    context: 'Two teams disagree on architecture decisions and it is blocking progress',
    otherParty: 'Lead of the opposing team who has strong opinions',
    objectives: ['Understand the other perspective genuinely', 'Find common ground', 'Propose a pragmatic compromise', 'Agree on decision-making framework'],
    difficulty: 'intermediate',
  },
];

export function listConversationScenarios(): ConversationScenario[] {
  return [...PRESET_SCENARIOS];
}

export function getScenario(id: string): ConversationScenario | undefined {
  return PRESET_SCENARIOS.find((s) => s.id === id);
}

export function createCustomScenario(
  title: string,
  context: string,
  otherParty: string,
  objectives: string[],
  difficulty: ConversationScenario['difficulty'] = 'intermediate',
): ConversationScenario {
  return {
    id: `CS-CUSTOM-${crypto.randomUUID().slice(0, 8)}`,
    role: 'custom',
    title,
    context,
    otherParty,
    objectives,
    difficulty,
  };
}

/* ---------------------------------------------- conversation analysis */

export function analyzeConversationTurn(
  message: string,
  scenario: ConversationScenario,
): TurnAnalysis {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  // Check for active language
  const activeVerbs = ['believe', 'recommend', 'propose', 'suggest', 'expect', 'commit', 'deliver'];
  if (activeVerbs.some((v) => lower.includes(v))) {
    strengths.push('Uses active, confident language');
  }

  // Check for passive/hedging
  const hedgeWords = ['maybe', 'perhaps', 'sort of', 'kind of', 'i think', 'i guess', 'hopefully'];
  const hedges = hedgeWords.filter((h) => lower.includes(h));
  if (hedges.length > 0) {
    weaknesses.push(`Hedging language detected: ${hedges.join(', ')}`);
    suggestions.push('Replace hedging phrases with direct statements');
  }

  // Check for specificity
  const hasNumbers = /\d+/.test(message);
  if (hasNumbers) {
    strengths.push('Includes specific numbers or data points');
  } else if (scenario.role === 'raise_negotiation') {
    suggestions.push('Include specific numbers to strengthen your position');
  }

  // Check for empathy markers
  const empathyMarkers = ['understand', 'appreciate', 'recognize', 'acknowledge', 'respect'];
  if (empathyMarkers.some((e) => lower.includes(e))) {
    strengths.push('Shows empathy and acknowledgment');
  }

  // Check conciseness
  if (wordCount > 150) {
    weaknesses.push('Response is verbose — may lose the listener');
    suggestions.push('Aim for 50-100 words per turn for maximum impact');
  } else if (wordCount < 10) {
    weaknesses.push('Response too brief — may appear disengaged');
  }

  // Check for questions (good for dialogue)
  if (message.includes('?')) {
    strengths.push('Asks questions — keeps dialogue collaborative');
  }

  const positives = strengths.length * 20;
  const negatives = weaknesses.length * 15;
  const effectivenessScore = Math.max(0, Math.min(100, 60 + positives - negatives));

  return { strengths, weaknesses, suggestions, effectivenessScore };
}

export function generateDebrief(
  scenario: ConversationScenario,
  turns: ConversationTurn[],
): ConversationDebrief {
  const userTurns = turns.filter((t) => t.speaker === 'user');
  const analyses = userTurns
    .map((t) => t.analysis)
    .filter((a): a is TurnAnalysis => a !== null);

  const avgScore =
    analyses.length > 0
      ? analyses.reduce((s, a) => s + a.effectivenessScore, 0) / analyses.length
      : 50;

  const allContent = userTurns.map((t) => t.message).join(' ').toLowerCase();

  // Check objective coverage (simple keyword matching)
  const objectivesMet: string[] = [];
  const objectivesMissed: string[] = [];
  for (const obj of scenario.objectives) {
    const objWords = obj.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matched = objWords.filter((w) => allContent.includes(w));
    if (matched.length >= objWords.length * 0.4) {
      objectivesMet.push(obj);
    } else {
      objectivesMissed.push(obj);
    }
  }

  const allStrengths = analyses.flatMap((a) => a.strengths);
  const allWeaknesses = analyses.flatMap((a) => a.weaknesses);

  const strengthCounts = countOccurrences(allStrengths);
  const weaknessCounts = countOccurrences(allWeaknesses);

  return {
    overallScore: Math.round(avgScore),
    objectivesMet,
    objectivesMissed,
    communicationStyle: inferStyle(analyses),
    topStrengths: Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s),
    areasForImprovement: Object.entries(weaknessCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s),
    specificPhrases: { good: [], improve: [] },
  };
}

/* ---------------------------------------------- language analysis */

const LEADERSHIP_FRAMEWORKS: FrameworkPattern[] = [
  {
    name: 'First Principles Thinking',
    description: 'Breaking down complex problems to fundamental truths',
    examples: ['the core issue is', 'fundamentally', 'at its root', 'if we strip away'],
    frequency: 'frequent',
  },
  {
    name: 'Second-Order Thinking',
    description: 'Considering the consequences of consequences',
    examples: ['downstream effect', 'if that happens then', 'the ripple effect', 'cascading impact'],
    frequency: 'occasional',
  },
  {
    name: 'Inversion',
    description: 'Thinking about what NOT to do to find what to do',
    examples: ['what would make this fail', 'avoid', 'the opposite approach', 'instead of'],
    frequency: 'occasional',
  },
  {
    name: 'Stakeholder Mapping',
    description: 'Explicitly identifying who is affected and how',
    examples: ['stakeholders', 'who is affected', 'alignment', 'buy-in', 'whom this impacts'],
    frequency: 'frequent',
  },
  {
    name: 'Trade-off Articulation',
    description: 'Explicitly naming what you are giving up with each choice',
    examples: ['the trade-off', 'cost of', 'at the expense of', 'what we gain', 'what we lose'],
    frequency: 'frequent',
  },
];

export function analyzeLanguageLevel(
  content: string,
  currentLevel: string,
  targetLevel: string,
): LanguageAnalysis {
  const lower = content.toLowerCase();

  const frameworks: FrameworkPattern[] = LEADERSHIP_FRAMEWORKS.filter((f) =>
    f.examples.some((ex) => lower.includes(ex)),
  );

  const vocabularyPatterns = analyzeVocabularyPatterns(lower);
  const communicationStructure = analyzeCommunicationStructure(lower);
  const decisionLanguage = analyzeDecisionLanguage(lower);
  const recommendedAdoptions = generateLanguageRecommendations(
    frameworks,
    vocabularyPatterns,
  );

  return {
    level: targetLevel,
    frameworks,
    vocabularyPatterns,
    communicationStructure,
    decisionLanguage,
    recommendedAdoptions,
  };
}

function analyzeVocabularyPatterns(lower: string): VocabularyPattern[] {
  const vocabCategories: VocabularyPattern[] = [];

  const strategicTerms = [
    'strategy', 'vision', 'roadmap', 'north star', 'mission',
    'long-term', 'positioning', 'competitive advantage', 'moat',
  ].filter((t) => lower.includes(t));
  if (strategicTerms.length > 0) {
    vocabCategories.push({
      category: 'Strategic Thinking',
      terms: strategicTerms,
      context: 'Terms indicating strategic-level reasoning',
    });
  }

  const executionTerms = [
    'execute', 'deliver', 'ship', 'milestone', 'sprint', 'velocity',
    'throughput', 'bottleneck', 'unblock',
  ].filter((t) => lower.includes(t));
  if (executionTerms.length > 0) {
    vocabCategories.push({
      category: 'Execution Focus',
      terms: executionTerms,
      context: 'Terms indicating operational execution mindset',
    });
  }

  const influenceTerms = [
    'align', 'consensus', 'influence', 'persuade', 'navigate',
    'sponsor', 'champion', 'advocate',
  ].filter((t) => lower.includes(t));
  if (influenceTerms.length > 0) {
    vocabCategories.push({
      category: 'Influence & Navigation',
      terms: influenceTerms,
      context: 'Terms indicating political-organisational awareness',
    });
  }

  return vocabCategories;
}

function analyzeCommunicationStructure(lower: string): StructurePattern[] {
  const structures: StructurePattern[] = [];
  if (lower.includes('problem') && lower.includes('solution')) {
    structures.push({
      pattern: 'Problem → Solution',
      description: 'Frames issues before presenting answers',
      example: 'The problem is X, the proposed solution is Y',
    });
  }
  if (lower.includes('context') || lower.includes('background')) {
    structures.push({
      pattern: 'Context Setting',
      description: 'Provides background before making a point',
      example: 'For context, last quarter we saw...',
    });
  }
  if (lower.includes('recommend') || lower.includes('propose')) {
    structures.push({
      pattern: 'Recommendation Framing',
      description: 'Leads with a clear recommendation',
      example: 'My recommendation is...',
    });
  }
  return structures;
}

function analyzeDecisionLanguage(lower: string): string[] {
  return [
    'decision', 'decide', 'chose', 'opt', 'go with', 'commit to',
    'rule out', 'prioritise', 'deprioritise',
  ].filter((t) => lower.includes(t));
}

function generateLanguageRecommendations(
  frameworks: FrameworkPattern[],
  vocabularyPatterns: VocabularyPattern[],
): string[] {
  const recommendedAdoptions: string[] = [];

  const missingFrameworks = LEADERSHIP_FRAMEWORKS.filter(
    (f) => !frameworks.some((found) => found.name === f.name),
  );
  if (missingFrameworks.length > 0) {
    recommendedAdoptions.push(
      `Adopt frameworks: ${missingFrameworks.slice(0, 3).map((f) => f.name).join(', ')}`,
    );
  }

  const strategicPattern = vocabularyPatterns.find((p) => p.category === 'Strategic Thinking');
  const strategicTermsLength = strategicPattern ? strategicPattern.terms.length : 0;
  if (strategicTermsLength < 3) {
    recommendedAdoptions.push(
      'Increase use of strategic vocabulary to signal higher-level thinking',
    );
  }

  const influencePattern = vocabularyPatterns.find((p) => p.category === 'Influence & Navigation');
  if (!influencePattern || influencePattern.terms.length === 0) {
    recommendedAdoptions.push(
      'Add influence/alignment language to demonstrate organisational awareness',
    );
  }

  return recommendedAdoptions;
}

/* ------------------------------------------------ communication auditor */

export function auditCommunication(
  content: string,
  role: string,
): CommunicationAudit {
  const lower = content.toLowerCase();
  const words = content.split(/\s+/);
  const wordCount = words.length;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentLen = wordCount / Math.max(1, sentences.length);

  // Style profile
  const formality = calculateFormality(lower, words);
  const assertiveness = calculateAssertiveness(lower);
  const empathy = calculateEmpathy(lower);
  const clarity = calculateClarity(avgSentLen, wordCount);
  const conciseness = Math.min(1, 100 / Math.max(10, wordCount)) * 2;
  const analyticalDepth = calculateAnalytical(lower);
  const strategicThinking = calculateStrategic(lower);

  const styleProfile: StyleProfile = {
    formality: clamp01(formality),
    assertiveness: clamp01(assertiveness),
    empathy: clamp01(empathy),
    clarity: clamp01(clarity),
    conciseness: clamp01(conciseness),
    analyticalDepth: clamp01(analyticalDepth),
    strategicThinking: clamp01(strategicThinking),
  };

  // Perception analysis
  const likelyPerceived: string[] = [];
  if (formality > 0.7) likelyPerceived.push('formal and professional');
  if (assertiveness > 0.6) likelyPerceived.push('confident and decisive');
  if (empathy > 0.5) likelyPerceived.push('warm and considerate');
  if (analyticalDepth > 0.6) likelyPerceived.push('thorough and analytical');
  if (strategicThinking > 0.5) likelyPerceived.push('strategic and visionary');
  if (likelyPerceived.length === 0) likelyPerceived.push('neutral or unclear');

  const strengths: string[] = [];
  const blindSpots: string[] = [];
  if (clarity > 0.6) strengths.push('Clear and readable');
  else blindSpots.push('Writing could be more clear and direct');
  if (assertiveness > 0.5) strengths.push('Decisive tone');
  else blindSpots.push('May come across as uncertain');

  const credibilityMarkers = [
    ...(analyticalDepth > 0.5 ? ['Data-informed reasoning'] : []),
    ...(strategicThinking > 0.5 ? ['Strategic perspective'] : []),
    ...(formality > 0.5 ? ['Professional register'] : []),
  ];
  const credibilityDetractors = [
    ...(formality < 0.3 ? ['Overly casual tone for context'] : []),
    ...(assertiveness < 0.3 ? ['Excessive hedging undermines authority'] : []),
  ];

  // Implied level
  const avgDimension =
    (formality + assertiveness + clarity + analyticalDepth + strategicThinking) / 5;
  let impliedLevel = 'individual contributor';
  if (avgDimension > 0.7) impliedLevel = 'senior leader / executive';
  else if (avgDimension > 0.55) impliedLevel = 'manager / senior IC';
  else if (avgDimension > 0.4) impliedLevel = 'mid-level';

  // Recommendations
  const recommendations: AuditRecommendation[] = [];
  if (assertiveness < 0.4) {
    recommendations.push({
      area: 'Assertiveness',
      currentState: 'Frequent hedging and tentative language',
      targetState: 'Direct, confident statements with clear ownership',
      actionableSteps: [
        'Replace "I think" with "I recommend"',
        'Remove "maybe", "perhaps", "sort of"',
        'Lead sentences with action verbs',
      ],
      priority: 'high',
    });
  }
  if (strategicThinking < 0.4) {
    recommendations.push({
      area: 'Strategic Framing',
      currentState: 'Primarily tactical or execution-focused',
      targetState: 'Connects work to business outcomes and strategy',
      actionableSteps: [
        'Start messages with business context ("This will improve X by Y")',
        'Reference broader goals and company direction',
        'Frame decisions as trade-offs with explicit rationale',
      ],
      priority: 'medium',
    });
  }
  if (empathy < 0.3) {
    recommendations.push({
      area: 'Empathy & Connection',
      currentState: 'Primarily transactional communication',
      targetState: 'Acknowledges others\' perspectives and efforts',
      actionableSteps: [
        'Acknowledge the recipient\'s situation before making requests',
        'Use "we" language to create shared ownership',
        'Express gratitude for specific contributions',
      ],
      priority: 'medium',
    });
  }

  const overall = Math.round(avgDimension * 100);
  let grade: CommunicationAudit['grade'] = 'F';
  if (overall >= 80) grade = 'A';
  else if (overall >= 65) grade = 'B';
  else if (overall >= 50) grade = 'C';
  else if (overall >= 35) grade = 'D';

  return {
    overallScore: overall,
    grade,
    impliedLevel,
    styleProfile,
    perceptionAnalysis: {
      likelyPerceived,
      strengths,
      blindSpots,
      credibilityMarkers,
      credibilityDetractors,
    },
    recommendations,
  };
}

/* ---------------------------------------------------------- helpers */

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function calculateFormality(lower: string, words: string[]): number {
  const formalIndicators = ['therefore', 'furthermore', 'consequently', 'regarding', 'whereas', 'accordingly', 'henceforth', 'pertaining'];
  const informalIndicators = ['gonna', 'wanna', 'gotta', 'btw', 'lol', 'omg', 'tbh', 'ngl', 'imo', 'haha', 'yeah'];
  const formal = formalIndicators.filter((f) => lower.includes(f)).length;
  const informal = informalIndicators.filter((i) => lower.includes(i)).length;
  return 0.5 + (formal * 0.1) - (informal * 0.15);
}

function calculateAssertiveness(lower: string): number {
  const assertive = ['will', 'commit', 'expect', 'require', 'must', 'need to', 'deliver', 'ensure', 'guarantee'];
  const tentative = ['maybe', 'perhaps', 'might', 'could possibly', 'sort of', 'kind of', 'i think', 'i guess', 'hopefully', 'probably'];
  const a = assertive.filter((t) => lower.includes(t)).length;
  const t = tentative.filter((t) => lower.includes(t)).length;
  return 0.5 + (a * 0.08) - (t * 0.12);
}

function calculateEmpathy(lower: string): number {
  const empathyTerms = ['understand', 'appreciate', 'recognize', 'acknowledge', 'thank', 'grateful', 'value', 'respect', 'support', 'we', 'together', 'team'];
  const hits = empathyTerms.filter((e) => lower.includes(e)).length;
  return Math.min(1, hits * 0.12);
}

function calculateClarity(avgSentLen: number, wordCount: number): number {
  if (wordCount === 0) return 0;
  const sentLenScore = avgSentLen < 20 ? 0.8 : avgSentLen < 30 ? 0.5 : 0.3;
  return sentLenScore;
}

function calculateAnalytical(lower: string): number {
  const analyticalTerms = ['data', 'metric', 'measure', 'evidence', 'analysis', 'trend', 'pattern', 'correlation', 'cause', 'effect', 'percent', 'rate', 'ratio'];
  const hits = analyticalTerms.filter((a) => lower.includes(a)).length;
  return Math.min(1, hits * 0.1);
}

function calculateStrategic(lower: string): number {
  const strategicTerms = ['strategy', 'vision', 'roadmap', 'long-term', 'competitive', 'position', 'market', 'opportunity', 'growth', 'impact', 'priority', 'leverage', 'scale'];
  const hits = strategicTerms.filter((s) => lower.includes(s)).length;
  return Math.min(1, hits * 0.1);
}

function countOccurrences(items: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function inferStyle(analyses: TurnAnalysis[]): string {
  if (analyses.length === 0) return 'Unknown';
  const avgScore =
    analyses.reduce((s, a) => s + a.effectivenessScore, 0) / analyses.length;
  if (avgScore >= 80) return 'Confident and persuasive';
  if (avgScore >= 60) return 'Balanced and collaborative';
  if (avgScore >= 40) return 'Cautious and measured';
  return 'Tentative — needs more assertiveness';
}
