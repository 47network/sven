// ---------------------------------------------------------------------------
// Competitive Intelligence Engine
// ---------------------------------------------------------------------------
// Provides types and logic for competitor profiling, signal tracking,
// strategic analysis, and report generation for the 47Network ecosystem.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export interface CompetitorProfile {
  id: string;
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  githubOrg: string | null;
  industry: string | null;
  description: string | null;
  trackedSince: string; // ISO-8601
  isActive: boolean;
}

export type SignalType =
  | 'job_listing'
  | 'website_change'
  | 'social_post'
  | 'press_release'
  | 'github_activity'
  | 'app_store_update'
  | 'patent_filing';

export interface CompetitorSignal {
  id: string;
  competitorId: string;
  signalType: SignalType;
  title: string;
  content: string | null;
  sourceUrl: string | null;
  detectedAt: string; // ISO-8601
  analysis: string | null;
  impactLevel: 1 | 2 | 3 | 4 | 5;
  raw: Record<string, unknown> | null;
}

export type ReportType = 'weekly_summary' | 'alert' | 'deep_dive';

export interface CompetitiveReport {
  id: string;
  createdAt: string;
  reportType: ReportType;
  title: string;
  content: string; // Markdown
  competitorIds: string[];
  keyFindings: CompetitiveFinding[];
}

export interface CompetitiveFinding {
  competitorName: string;
  category: 'strategy' | 'product' | 'talent' | 'marketing' | 'technology';
  summary: string;
  impactLevel: 1 | 2 | 3 | 4 | 5;
  recommendedAction: string | null;
}

export interface SignalDiff {
  signalType: SignalType;
  added: number;
  changed: number;
  removed: number;
  highlights: string[];
}

/* --------------------------------------------------------- profile mgmt */

export function createProfile(
  name: string,
  opts: Partial<Omit<CompetitorProfile, 'id' | 'name' | 'trackedSince'>> = {},
): CompetitorProfile {
  return {
    id: crypto.randomUUID(),
    name,
    website: opts.website ?? null,
    linkedinUrl: opts.linkedinUrl ?? null,
    githubOrg: opts.githubOrg ?? null,
    industry: opts.industry ?? null,
    description: opts.description ?? null,
    trackedSince: new Date().toISOString(),
    isActive: opts.isActive ?? true,
  };
}

/* -------------------------------------------------------- signal analysis */

export function classifyImpact(
  signalType: SignalType,
  content: string,
): 1 | 2 | 3 | 4 | 5 {
  const lower = content.toLowerCase();

  // High-impact keywords
  const criticalTerms = [
    'funding', 'acquisition', 'ipo', 'series', 'partnership', 'breach',
    'shutdown', 'layoff', 'pivot', 'launch', 'billion', 'million',
  ];
  const highTerms = [
    'hiring', 'expansion', 'new product', 'rebrand', 'open source',
    'patent', 'api launch', 'enterprise', 'integration',
  ];

  if (criticalTerms.some((t) => lower.includes(t))) return 5;
  if (highTerms.some((t) => lower.includes(t))) return 4;

  // Signal-type baseline
  const typeWeight: Record<SignalType, 1 | 2 | 3 | 4 | 5> = {
    patent_filing: 4,
    press_release: 3,
    job_listing: 2,
    website_change: 2,
    github_activity: 2,
    app_store_update: 3,
    social_post: 1,
  };
  return typeWeight[signalType] ?? 2;
}

export function createSignal(
  competitorId: string,
  signalType: SignalType,
  title: string,
  content: string,
  sourceUrl: string | null = null,
): CompetitorSignal {
  return {
    id: crypto.randomUUID(),
    competitorId,
    signalType,
    title,
    content,
    sourceUrl,
    detectedAt: new Date().toISOString(),
    analysis: null,
    impactLevel: classifyImpact(signalType, content),
    raw: null,
  };
}

/* ------------------------------------------------------------ change diff */

export function diffSignals(
  previous: CompetitorSignal[],
  current: CompetitorSignal[],
): SignalDiff[] {
  const prevById = new Map(previous.map((s) => [s.id, s]));
  const currById = new Map(current.map((s) => [s.id, s]));

  const types = new Set<SignalType>([
    ...previous.map((s) => s.signalType),
    ...current.map((s) => s.signalType),
  ]);

  const diffs: SignalDiff[] = [];

  for (const st of types) {
    const prev = previous.filter((s) => s.signalType === st);
    const curr = current.filter((s) => s.signalType === st);
    const prevIds = new Set(prev.map((s) => s.id));
    const currIds = new Set(curr.map((s) => s.id));

    const added = curr.filter((s) => !prevIds.has(s.id));
    const removed = prev.filter((s) => !currIds.has(s.id));
    const changed = curr.filter(
      (s) => prevIds.has(s.id) && prevById.get(s.id)?.content !== s.content,
    );

    if (added.length > 0 || changed.length > 0 || removed.length > 0) {
      diffs.push({
        signalType: st,
        added: added.length,
        changed: changed.length,
        removed: removed.length,
        highlights: [
          ...added.slice(0, 3).map((s) => `+ ${s.title}`),
          ...changed.slice(0, 2).map((s) => `~ ${s.title}`),
          ...removed.slice(0, 2).map((s) => `- ${s.title}`),
        ],
      });
    }
  }

  return diffs;
}

/* -------------------------------------------------------- report generation */

function extractKeyFindings(
  profiles: CompetitorProfile[],
  signals: CompetitorSignal[],
): CompetitiveFinding[] {
  const findings: CompetitiveFinding[] = [];

  for (const profile of profiles) {
    const psignals = signals.filter((s) => s.competitorId === profile.id);
    if (psignals.length === 0) continue;

    const topSignals = psignals
      .sort((a, b) => b.impactLevel - a.impactLevel)
      .slice(0, 5);

    for (const sig of topSignals) {
      findings.push({
        competitorName: profile.name,
        category: signalToCategory(sig.signalType),
        summary: sig.analysis ?? sig.title,
        impactLevel: sig.impactLevel,
        recommendedAction: null,
      });
    }
  }

  findings.sort((a, b) => b.impactLevel - a.impactLevel);
  return findings;
}

function generateReportMarkdown(
  profiles: CompetitorProfile[],
  signals: CompetitorSignal[],
  findings: CompetitiveFinding[],
  reportDateIso: string,
): string {
  const executives = findings.slice(0, 3).map((f) => `${f.competitorName}: ${f.summary}`);
  return [
    '# Weekly Competitive Intelligence Report',
    '',
    `**Period**: Week of ${reportDateIso.slice(0, 10)}`,
    `**Competitors tracked**: ${profiles.length}`,
    `**New signals**: ${signals.length}`,
    '',
    '## Executive Summary',
    '',
    ...executives,
    '',
    '## Findings by Impact',
    '',
    ...findings.map(
      (f) =>
        `- **[${f.impactLevel}/5]** ${f.competitorName} (${f.category}): ${f.summary}`,
    ),
    '',
    '## Recommended Actions',
    '',
    ...findings
      .filter((f) => f.impactLevel >= 4)
      .map(
        (f) =>
          `- \`${f.competitorName}\`: ${f.recommendedAction ?? 'Review and assess strategic response'}`,
      ),
  ].join('\n');
}

export function generateWeeklyReport(
  profiles: CompetitorProfile[],
  signals: CompetitorSignal[],
): CompetitiveReport {
  const findings = extractKeyFindings(profiles, signals);
  const reportDate = new Date().toISOString();
  const content = generateReportMarkdown(profiles, signals, findings, reportDate);

  return {
    id: crypto.randomUUID(),
    createdAt: reportDate,
    reportType: 'weekly_summary',
    title: `Competitive Report — ${reportDate.slice(0, 10)}`,
    content,
    competitorIds: profiles.map((p) => p.id),
    keyFindings: findings,
  };
}

function signalToCategory(
  st: SignalType,
): CompetitiveFinding['category'] {
  switch (st) {
    case 'job_listing':
      return 'talent';
    case 'website_change':
    case 'app_store_update':
      return 'product';
    case 'social_post':
      return 'marketing';
    case 'github_activity':
    case 'patent_filing':
      return 'technology';
    case 'press_release':
      return 'strategy';
  }
}

/* ----------------------------------------------------------- threat matrix */

export interface ThreatEntry {
  competitorName: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: number;
  topCategory: CompetitiveFinding['category'];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export function buildThreatMatrix(
  profiles: CompetitorProfile[],
  currentSignals: CompetitorSignal[],
  previousSignals: CompetitorSignal[],
): ThreatEntry[] {
  return profiles.map((p) => {
    const curr = currentSignals.filter((s) => s.competitorId === p.id);
    const prev = previousSignals.filter((s) => s.competitorId === p.id);
    const avgImpact =
      curr.length > 0
        ? curr.reduce((sum, s) => sum + s.impactLevel, 0) / curr.length
        : 0;

    const categoryCount = new Map<CompetitiveFinding['category'], number>();
    for (const sig of curr) {
      const cat = signalToCategory(sig.signalType);
      categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
    }
    const topCategory = [...categoryCount.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] ?? 'strategy';

    let trend: ThreatEntry['trend'] = 'stable';
    if (curr.length > prev.length * 1.3) trend = 'increasing';
    else if (curr.length < prev.length * 0.7) trend = 'decreasing';

    let threatLevel: ThreatEntry['threatLevel'] = 'low';
    if (avgImpact >= 4) threatLevel = 'critical';
    else if (avgImpact >= 3) threatLevel = 'high';
    else if (avgImpact >= 2) threatLevel = 'medium';

    return {
      competitorName: p.name,
      threatLevel,
      signals: curr.length,
      topCategory,
      trend,
    };
  });
}
