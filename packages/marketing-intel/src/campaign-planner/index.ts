// ---------------------------------------------------------------------------
// Campaign Planner
// ---------------------------------------------------------------------------
// Marketing campaign design, planning, scheduling, and performance tracking
// for multi-channel campaigns across the 47Network ecosystem.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type CampaignStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface CampaignGoal {
  metric: string;      // e.g. 'signups', 'page_views', 'downloads'
  target: number;
  current: number;
  unit: string;        // e.g. 'users', 'views', 'clicks'
}

export interface CampaignBudget {
  total: number;
  currency: string;
  allocated: Record<string, number>; // channel → amount
  spent: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  goals: CampaignGoal[];
  targetAudience: string;
  channels: string[];
  startDate: string | null;
  endDate: string | null;
  budget: CampaignBudget | null;
  status: CampaignStatus;
  contentIds: string[];
  performance: CampaignPerformance | null;
  createdAt: string;
}

export interface CampaignPerformance {
  totalReach: number;
  totalEngagement: number;
  totalConversions: number;
  costPerConversion: number | null;
  roi: number | null; // percentage
  channelBreakdown: Record<string, ChannelPerf>;
  measuredAt: string;
}

export interface ChannelPerf {
  reach: number;
  engagement: number;
  conversions: number;
  spend: number;
}

export interface CampaignTimeline {
  phases: CampaignPhase[];
  totalDays: number;
  criticalPath: string[];
}

export interface CampaignPhase {
  name: string;
  startDay: number;
  durationDays: number;
  tasks: string[];
  dependencies: string[];
}

/* ------------------------------------------------------ campaign creation */

export function createCampaign(
  name: string,
  opts: Partial<Omit<Campaign, 'id' | 'name' | 'createdAt'>> = {},
): Campaign {
  return {
    id: crypto.randomUUID(),
    name,
    description: opts.description ?? '',
    goals: opts.goals ?? [],
    targetAudience: opts.targetAudience ?? '',
    channels: opts.channels ?? [],
    startDate: opts.startDate ?? null,
    endDate: opts.endDate ?? null,
    budget: opts.budget ?? null,
    status: opts.status ?? 'planning',
    contentIds: opts.contentIds ?? [],
    performance: opts.performance ?? null,
    createdAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------- timeline generation */

const DEFAULT_PHASES: CampaignPhase[] = [
  {
    name: 'Research & Strategy',
    startDay: 0,
    durationDays: 3,
    tasks: [
      'Define target audience segments',
      'Competitive landscape review',
      'Set KPIs and success metrics',
      'Budget allocation',
    ],
    dependencies: [],
  },
  {
    name: 'Content Creation',
    startDay: 3,
    durationDays: 5,
    tasks: [
      'Create content briefs per channel',
      'Draft all campaign assets',
      'Brand voice validation',
      'Asset review and approval',
    ],
    dependencies: ['Research & Strategy'],
  },
  {
    name: 'Setup & Launch',
    startDay: 8,
    durationDays: 2,
    tasks: [
      'Configure targeting and scheduling',
      'Set up tracking and UTM parameters',
      'Launch across all channels',
      'Verify delivery and tracking',
    ],
    dependencies: ['Content Creation'],
  },
  {
    name: 'Monitoring & Optimisation',
    startDay: 10,
    durationDays: 14,
    tasks: [
      'Daily performance checks',
      'A/B test analysis',
      'Adjust targeting and bids',
      'Mid-campaign performance report',
    ],
    dependencies: ['Setup & Launch'],
  },
  {
    name: 'Wrap-up & Reporting',
    startDay: 24,
    durationDays: 3,
    tasks: [
      'Final performance analysis',
      'ROI calculation',
      'Lessons learned documentation',
      'Next campaign recommendations',
    ],
    dependencies: ['Monitoring & Optimisation'],
  },
];

export function generateTimeline(
  durationWeeks: number = 4,
  customPhases?: CampaignPhase[],
): CampaignTimeline {
  const phases = customPhases ?? DEFAULT_PHASES;
  const totalDays = durationWeeks * 7;
  const criticalPath = phases.map((p) => p.name);

  // Scale phase durations to fit the total
  const originalTotal = phases.reduce((s, p) => s + p.durationDays, 0);
  const scale = totalDays / originalTotal;

  let cumulativeDay = 0;
  const scaled = phases.map((p) => {
    const duration = Math.max(1, Math.round(p.durationDays * scale));
    const phase = { ...p, startDay: cumulativeDay, durationDays: duration };
    cumulativeDay += duration;
    return phase;
  });

  return { phases: scaled, totalDays, criticalPath };
}

/* --------------------------------------------------- performance scoring */

export interface CampaignScore {
  overall: number; // 0-100
  goalCompletion: number; // 0-100 average across goals
  budgetEfficiency: number; // 0-100
  roiScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  insights: string[];
}

function calculateGoalCompletion(campaign: Campaign, insights: string[]): number {
  if (campaign.goals.length === 0) return 0;

  const completions = campaign.goals.map((g) =>
    g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0,
  );
  const goalCompletion = completions.reduce((s, c) => s + c, 0) / completions.length;

  const exceededGoals = campaign.goals.filter((g) => g.current >= g.target);
  if (exceededGoals.length === campaign.goals.length) {
    insights.push('All campaign goals met or exceeded');
  } else {
    const missed = campaign.goals.filter((g) => g.current < g.target);
    insights.push(
      `${missed.length} goal(s) below target: ${missed.map((g) => g.metric).join(', ')}`,
    );
  }

  return goalCompletion;
}

function calculateBudgetEfficiency(campaign: Campaign, insights: string[]): number {
  if (!campaign.budget) return 50;

  const utilisation = campaign.budget.spent / campaign.budget.total;
  if (utilisation > 0.95) {
    insights.push('Budget nearly exhausted — consider reallocation for next campaign');
    return 40;
  }
  if (utilisation > 0.7) {
    return 80;
  }
  if (utilisation < 0.3 && campaign.status !== 'planning') {
    insights.push('Under-utilising budget — consider increasing channel spend');
    return 60;
  }
  return 70;
}

function calculateRoiScore(campaign: Campaign, insights: string[]): number {
  if (campaign.performance?.roi == null) return 50;

  let roiScore = 20;
  if (campaign.performance.roi > 300) roiScore = 100;
  else if (campaign.performance.roi > 200) roiScore = 90;
  else if (campaign.performance.roi > 100) roiScore = 75;
  else if (campaign.performance.roi > 0) roiScore = 60;

  insights.push(`Campaign ROI: ${campaign.performance.roi.toFixed(0)}%`);
  return roiScore;
}

function calculateGrade(overall: number): CampaignScore['grade'] {
  if (overall >= 90) return 'A';
  if (overall >= 75) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 40) return 'D';
  return 'F';
}

export function scoreCampaign(campaign: Campaign): CampaignScore {
  const insights: string[] = [];

  const goalCompletion = calculateGoalCompletion(campaign, insights);
  const budgetEfficiency = calculateBudgetEfficiency(campaign, insights);
  const roiScore = calculateRoiScore(campaign, insights);

  const overall = Math.round(goalCompletion * 0.5 + budgetEfficiency * 0.2 + roiScore * 0.3);
  const grade = calculateGrade(overall);

  return { overall, goalCompletion, budgetEfficiency, roiScore, grade, insights };
}

/* --------------------------------------------------- report generation */

export function campaignToMarkdown(campaign: Campaign, score?: CampaignScore): string {
  const lines: string[] = [
    `# Campaign: ${campaign.name}`,
    '',
    campaign.description,
    '',
    `**Status**: ${campaign.status} | **Channels**: ${campaign.channels.join(', ')}`,
  ];

  if (campaign.startDate && campaign.endDate) {
    lines.push(`**Period**: ${campaign.startDate} → ${campaign.endDate}`);
  }

  if (campaign.goals.length > 0) {
    lines.push('', '## Goals', '');
    lines.push('| Metric | Target | Current | Progress |');
    lines.push('|--------|--------|---------|----------|');
    for (const g of campaign.goals) {
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      lines.push(`| ${g.metric} | ${g.target} ${g.unit} | ${g.current} ${g.unit} | ${pct}% |`);
    }
  }

  if (campaign.budget) {
    lines.push('', '## Budget', '');
    lines.push(`Total: ${campaign.budget.total} ${campaign.budget.currency}`);
    lines.push(`Spent: ${campaign.budget.spent} ${campaign.budget.currency}`);
  }

  if (score) {
    lines.push('', '## Performance Score', '');
    lines.push(`**Overall**: ${score.overall}/100 (${score.grade})`);
    lines.push(`- Goal Completion: ${score.goalCompletion.toFixed(0)}%`);
    lines.push(`- Budget Efficiency: ${score.budgetEfficiency}/100`);
    lines.push(`- ROI Score: ${score.roiScore}/100`);
    if (score.insights.length > 0) {
      lines.push('', '### Insights');
      for (const insight of score.insights) {
        lines.push(`- ${insight}`);
      }
    }
  }

  return lines.join('\n');
}
