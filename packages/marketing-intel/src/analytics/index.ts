// ---------------------------------------------------------------------------
// Marketing Analytics & Reporting
// ---------------------------------------------------------------------------
// Aggregates performance data across channels, generates marketing reports,
// tracks KPIs, and provides trend analysis for the 47Network ecosystem.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type MetricPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface MarketingMetrics {
  period: MetricPeriod;
  startDate: string;
  endDate: string;
  channels: Record<string, ChannelMetrics>;
  totals: AggregateTotals;
  trends: TrendAnalysis;
}

export interface ChannelMetrics {
  channel: string;
  reach: number;
  impressions: number;
  engagement: number;
  clicks: number;
  conversions: number;
  spend: number;
  engagementRate: number; // 0.0-1.0
  clickThroughRate: number; // 0.0-1.0
  conversionRate: number; // 0.0-1.0
  costPerClick: number;
  costPerConversion: number;
}

export interface AggregateTotals {
  totalReach: number;
  totalImpressions: number;
  totalEngagement: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  overallEngagementRate: number;
  overallConversionRate: number;
  overallCostPerConversion: number;
}

export interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'declining';
  reachTrend: number; // % change
  engagementTrend: number;
  conversionTrend: number;
  highlights: string[];
  concerns: string[];
}

export interface MarketingReport {
  id: string;
  title: string;
  period: MetricPeriod;
  generatedAt: string;
  metrics: MarketingMetrics;
  topContent: ContentRanking[];
  recommendations: string[];
  markdown: string;
}

export interface ContentRanking {
  contentId: string;
  title: string;
  channel: string;
  engagement: number;
  conversions: number;
  rank: number;
}

/* -------------------------------------------------------- channel metrics */

export function calculateChannelMetrics(
  channel: string,
  data: {
    reach: number;
    impressions: number;
    engagement: number;
    clicks: number;
    conversions: number;
    spend: number;
  },
): ChannelMetrics {
  return {
    channel,
    ...data,
    engagementRate: data.impressions > 0 ? data.engagement / data.impressions : 0,
    clickThroughRate: data.impressions > 0 ? data.clicks / data.impressions : 0,
    conversionRate: data.clicks > 0 ? data.conversions / data.clicks : 0,
    costPerClick: data.clicks > 0 ? data.spend / data.clicks : 0,
    costPerConversion: data.conversions > 0 ? data.spend / data.conversions : 0,
  };
}

/* ----------------------------------------------------------- aggregation */

export function aggregateMetrics(
  channelData: ChannelMetrics[],
  period: MetricPeriod,
  startDate: string,
  endDate: string,
  previousTotals?: AggregateTotals,
): MarketingMetrics {
  const channels: Record<string, ChannelMetrics> = {};
  for (const cm of channelData) {
    channels[cm.channel] = cm;
  }

  const totalReach = channelData.reduce((s, c) => s + c.reach, 0);
  const totalImpressions = channelData.reduce((s, c) => s + c.impressions, 0);
  const totalEngagement = channelData.reduce((s, c) => s + c.engagement, 0);
  const totalClicks = channelData.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = channelData.reduce((s, c) => s + c.conversions, 0);
  const totalSpend = channelData.reduce((s, c) => s + c.spend, 0);

  const totals: AggregateTotals = {
    totalReach,
    totalImpressions,
    totalEngagement,
    totalClicks,
    totalConversions,
    totalSpend,
    overallEngagementRate: totalImpressions > 0 ? totalEngagement / totalImpressions : 0,
    overallConversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
    overallCostPerConversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
  };

  const trends = calculateTrends(totals, previousTotals ?? null);

  return { period, startDate, endDate, channels, totals, trends };
}

/* ------------------------------------------------------- trend analysis */

function calculateTrends(
  current: AggregateTotals,
  previous: AggregateTotals | null,
): TrendAnalysis {
  if (!previous) {
    return {
      direction: 'stable',
      reachTrend: 0,
      engagementTrend: 0,
      conversionTrend: 0,
      highlights: ['First reporting period — baseline established'],
      concerns: [],
    };
  }

  const reachTrend = pctChange(current.totalReach, previous.totalReach);
  const engagementTrend = pctChange(current.totalEngagement, previous.totalEngagement);
  const conversionTrend = pctChange(current.totalConversions, previous.totalConversions);

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (reachTrend > 10) highlights.push(`Reach up ${reachTrend.toFixed(0)}%`);
  if (engagementTrend > 10) highlights.push(`Engagement up ${engagementTrend.toFixed(0)}%`);
  if (conversionTrend > 10) highlights.push(`Conversions up ${conversionTrend.toFixed(0)}%`);

  if (reachTrend < -10) concerns.push(`Reach down ${Math.abs(reachTrend).toFixed(0)}%`);
  if (engagementTrend < -10) concerns.push(`Engagement down ${Math.abs(engagementTrend).toFixed(0)}%`);
  if (conversionTrend < -10) concerns.push(`Conversions down ${Math.abs(conversionTrend).toFixed(0)}%`);

  const avgTrend = (reachTrend + engagementTrend + conversionTrend) / 3;
  let direction: TrendAnalysis['direction'] = 'stable';
  if (avgTrend > 5) direction = 'improving';
  else if (avgTrend < -5) direction = 'declining';

  return { direction, reachTrend, engagementTrend, conversionTrend, highlights, concerns };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------ report generation */

function generateRecommendations(metrics: MarketingMetrics, channelList: ChannelMetrics[]): string[] {
  const recommendations: string[] = [];

  const bestChannel = [...channelList].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  if (bestChannel) {
    recommendations.push(
      `Top converting channel: ${bestChannel.channel} (${(bestChannel.conversionRate * 100).toFixed(1)}% CVR) — consider increasing investment`,
    );
  }

  const worstChannel = [...channelList].sort((a, b) => a.conversionRate - b.conversionRate)[0];
  if (worstChannel && channelList.length > 1) {
    recommendations.push(
      `Lowest converting channel: ${worstChannel.channel} (${(worstChannel.conversionRate * 100).toFixed(1)}% CVR) — review targeting and creative`,
    );
  }

  if (metrics.trends.direction === 'declining') {
    recommendations.push('Overall trend declining — review content strategy and channel mix');
  }

  if (metrics.totals.overallCostPerConversion > 50) {
    recommendations.push(
      `Cost per conversion (${metrics.totals.overallCostPerConversion.toFixed(2)}) is elevated — optimise targeting`,
    );
  }

  return recommendations;
}

function generateMarkdown(
  metrics: MarketingMetrics,
  topContent: ContentRanking[],
  recommendations: string[],
  channelList: ChannelMetrics[],
): string {
  const md = [
    `# Marketing Report — ${metrics.period}`,
    '',
    `**Period**: ${metrics.startDate} to ${metrics.endDate}`,
    `**Overall Trend**: ${metrics.trends.direction}`,
    '',
    '## Key Metrics',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Reach | ${metrics.totals.totalReach.toLocaleString()} |`,
    `| Total Impressions | ${metrics.totals.totalImpressions.toLocaleString()} |`,
    `| Total Engagement | ${metrics.totals.totalEngagement.toLocaleString()} |`,
    `| Total Conversions | ${metrics.totals.totalConversions.toLocaleString()} |`,
    `| Total Spend | $${metrics.totals.totalSpend.toFixed(2)} |`,
    `| Engagement Rate | ${(metrics.totals.overallEngagementRate * 100).toFixed(1)}% |`,
    `| Conversion Rate | ${(metrics.totals.overallConversionRate * 100).toFixed(1)}% |`,
    `| Cost/Conversion | $${metrics.totals.overallCostPerConversion.toFixed(2)} |`,
    '',
    '## Channel Breakdown',
    '',
    '| Channel | Reach | Engagement | Conversions | CVR | CPC |',
    '|---------|-------|------------|-------------|-----|-----|',
    ...channelList.map(
      (c) =>
        `| ${c.channel} | ${c.reach.toLocaleString()} | ${c.engagement.toLocaleString()} | ${c.conversions} | ${(c.conversionRate * 100).toFixed(1)}% | $${c.costPerClick.toFixed(2)} |`,
    ),
  ];

  if (metrics.trends.highlights.length > 0 || metrics.trends.concerns.length > 0) {
    md.push('', '## Trends');
    for (const h of metrics.trends.highlights) md.push(`- :chart_increasing: ${h}`);
    for (const c of metrics.trends.concerns) md.push(`- :warning: ${c}`);
  }

  if (topContent.length > 0) {
    md.push('', '## Top Content');
    for (const tc of topContent.slice(0, 5)) {
      md.push(`${tc.rank}. **${tc.title}** (${tc.channel}) — ${tc.engagement} engagements, ${tc.conversions} conversions`);
    }
  }

  if (recommendations.length > 0) {
    md.push('', '## Recommendations');
    for (const r of recommendations) md.push(`- ${r}`);
  }

  return md.join('\n');
}

export function generateMarketingReport(
  metrics: MarketingMetrics,
  topContent: ContentRanking[] = [],
): MarketingReport {
  const channelList = Object.values(metrics.channels);

  const recommendations = generateRecommendations(metrics, channelList);
  const markdown = generateMarkdown(metrics, topContent, recommendations, channelList);

  return {
    id: crypto.randomUUID(),
    title: `Marketing Report — ${metrics.period} (${metrics.startDate})`,
    period: metrics.period,
    generatedAt: new Date().toISOString(),
    metrics,
    topContent,
    recommendations,
    markdown,
  };
}
