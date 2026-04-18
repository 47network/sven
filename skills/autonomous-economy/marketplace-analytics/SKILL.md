---
skill: marketplace-analytics
name: Marketplace Analytics
description: >
  Comprehensive marketplace performance analytics — snapshot generation,
  agent productivity scoring, revenue trend analysis, category performance
  tracking, and marketplace health monitoring.
version: 1.0.0
author: sven
tags: [analytics, marketplace, revenue, productivity, health]
archetype: analyst
pricing:
  base: 0
  unit: per_query
---

# Marketplace Analytics

## Actions

### snapshot_generate
Generate a marketplace performance snapshot for a given period.
- **Inputs**: periodType (hourly|daily|weekly|monthly|quarterly|yearly), startDate, endDate
- **Outputs**: MarketplaceSnapshot with task counts, revenue, unique participants, top categories
- **Side effects**: Persists snapshot to marketplace_analytics_snapshots table

### productivity_score
Calculate and store agent productivity metrics for a period.
- **Inputs**: agentId, periodType (daily|weekly|monthly), periodStart
- **Outputs**: AgentProductivityMetric with efficiency score, skill utilization, quality score
- **Side effects**: Persists to agent_productivity_metrics table

### revenue_trend
Analyze revenue trends across event types and categories.
- **Inputs**: periodType, startDate, endDate, groupBy (category|event_type|agent)
- **Outputs**: Trend data with direction (rising|falling|stable|volatile), growth rates, totals
- **Side effects**: None (read-only analysis)

### category_analyze
Analyze performance of a marketplace category.
- **Inputs**: category, periodType, periodStart
- **Outputs**: CategoryPerformance with demand score, growth rate, top sellers, revenue
- **Side effects**: Persists to category_performance table

### health_check
Evaluate marketplace health indicators.
- **Inputs**: indicatorType (liquidity|velocity|concentration|satisfaction|fraud_risk|growth|churn|retention)
- **Outputs**: HealthIndicator with status, value, thresholds, details
- **Side effects**: Persists to marketplace_health_indicators table

### leaderboard_query
Query top-performing agents or categories.
- **Inputs**: dimension (agent|category|skill), periodType, limit
- **Outputs**: Ranked list with scores, revenue, task counts
- **Side effects**: None (read-only)

### forecast_generate
Generate revenue and demand forecasts.
- **Inputs**: metric (revenue|tasks|agents), horizon (7d|30d|90d), category?
- **Outputs**: Forecast array with predicted values, confidence intervals, trend direction
- **Side effects**: None (computed on-the-fly)
