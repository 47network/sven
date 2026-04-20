---
name: social-analytics
version: 1.0.0
description: >
  Track, analyze, and report on social media performance across platforms.
  Monitors engagement metrics, identifies trends, calculates ROI,
  and recommends strategy adjustments based on data.
author: Sven Autonomous Economy
license: proprietary
pricing:
  model: per_analysis
  basePrice: 0.99
  currency: "47Token"
archetype: analyst
category: social-media
platforms:
  - instagram
  - tiktok
  - youtube
  - twitter
  - facebook
  - linkedin
  - threads
---

# Social Analytics Skill

## Purpose

Enables Sven's analyst agents to monitor, track, and derive insights from
social media performance data. Provides engagement analysis, audience
insights, content performance ranking, campaign ROI calculation, and
strategic recommendations.

## Actions

### track-engagement
Collect and store engagement metrics for a published post.

**Inputs:**
- `postId` (string, required) — Social post ID to track
- `impressions` (number) — Total impressions
- `reach` (number) — Unique accounts reached
- `likes` (number) — Like/heart count
- `comments` (number) — Comment count
- `shares` (number) — Share/repost count
- `saves` (number) — Save/bookmark count
- `clicks` (number) — Link clicks

**Outputs:**
- `engagementRate` (number) — Calculated engagement rate (%)
- `performanceRating` (string) — "exceptional" | "good" | "average" | "below_average" | "poor"
- `benchmarkComparison` (object) — How this post compares to platform averages

### analyze-campaign
Aggregate analytics across all posts in a campaign.

**Inputs:**
- `campaignId` (string, required) — Campaign to analyze
- `dateRange` (object) — { from: string, to: string } ISO dates

**Outputs:**
- `totalPosts` (number)
- `totalImpressions` (number)
- `totalReach` (number)
- `avgEngagementRate` (number)
- `topPerformingPost` (object) — Best post by engagement
- `worstPerformingPost` (object) — Worst post for improvement
- `platformBreakdown` (object[]) — Per-platform performance
- `recommendations` (string[]) — Data-driven suggestions

### audience-insights
Analyze audience demographics and behavior patterns.

**Inputs:**
- `accountId` (string, required) — Social account to analyze
- `period` (string) — "7d" | "30d" | "90d"

**Outputs:**
- `followerGrowth` (number) — Net new followers in period
- `growthRate` (number) — Percentage growth
- `peakActivityHours` (number[]) — Hours when audience is most active
- `topContentTypes` (string[]) — Best performing content types
- `audienceDemographics` (object) — Age, location, interests breakdown

### content-ranking
Rank all posts by performance to identify winning patterns.

**Inputs:**
- `accountId` (string, required)
- `period` (string) — Time period
- `metric` (string) — "engagement_rate" | "reach" | "likes" | "comments"
- `limit` (number) — Top N posts to return

**Outputs:**
- `rankings` (object[]) — Ranked posts with metrics
- `patterns` (object) — Common traits of top performers:
  - `bestPostingTimes` (string[])
  - `bestContentTypes` (string[])
  - `bestHashtagCounts` (number)
  - `avgCaptionLength` (number)
- `actionItems` (string[]) — Specific recommendations

### roi-report
Calculate return on investment for social media spend.

**Inputs:**
- `campaignId` (string) — Specific campaign or all
- `period` (string) — Time period
- `tokensBudget` (number) — Tokens invested

**Outputs:**
- `tokensSpent` (number)
- `impressionsEarned` (number)
- `engagementsEarned` (number)
- `costPerImpression` (number)
- `costPerEngagement` (number)
- `estimatedRevenueImpact` (number) — Estimated marketplace traffic driven
- `roi` (number) — Percentage return

## Performance Benchmarks

| Platform  | Avg Engagement Rate | Good   | Exceptional |
|-----------|---------------------|--------|-------------|
| Instagram | 1.5%                | > 3%   | > 6%        |
| TikTok    | 5.0%                | > 8%   | > 15%       |
| YouTube   | 2.0%                | > 4%   | > 8%        |
| Twitter   | 0.5%                | > 1%   | > 3%        |
| Facebook  | 0.5%                | > 1%   | > 3%        |
| LinkedIn  | 2.0%                | > 4%   | > 8%        |
| Threads   | 3.0%                | > 5%   | > 10%       |

## Dependencies
- Sven API: `GET /v1/admin/social/analytics/overview`
- Sven API: `POST /v1/admin/social/posts/:postId/analytics`
- Platform APIs for real-time metrics collection
