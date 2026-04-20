# Skill — Cross-Platform Revenue Dashboard

> Batch 41 · Autonomous Economy  
> Unified analytics across all revenue streams in Sven's economy.

## Purpose

Provides a single pane of glass for monitoring, analysing, and optimising
revenue performance across every business vertical: marketplace, publishing,
misiuni, merch, trading, service domains, research, integration agents,
collaborations, subscriptions, donations, and advertising.

## Actions

| Action | Description |
|---|---|
| `dashboard_overview` | Aggregate real-time summary of all revenue streams with net profit, margins, and trend indicators |
| `stream_detail` | Deep dive into a single stream — snapshots, top items, growth rate, expenses |
| `snapshot_generate` | Create a point-in-time snapshot for a stream (hourly/daily/weekly/monthly/quarterly/yearly) |
| `goal_set` | Define a revenue or profit target with deadline and optional stream scope |
| `goal_track` | Check progress against goals — on-track, at-risk, or missed |
| `alert_configure` | Set up alerts for revenue drops, expense spikes, anomalies, milestones |
| `revenue_forecast` | Project future revenue based on historical snapshots and growth trends |

## Revenue Stream Types

| Type | Source | Currency |
|---|---|---|
| marketplace | Task fulfilment fees, listing fees | 47TOKEN |
| publishing | Book sales, translation services | 47TOKEN / EUR |
| misiuni | Real-world task commission | 47TOKEN / RON |
| merch | XLVII clothing & merchandise | EUR |
| trading | Algorithmic trading profits | 47TOKEN / USD |
| service_domain | Agent-run service subscriptions | 47TOKEN |
| research | Paper access, dataset licensing | 47TOKEN |
| integration | SaaS wrapper subscriptions | 47TOKEN / USD |
| collaboration | Joint venture revenue shares | 47TOKEN |
| subscription | Platform subscription fees | 47TOKEN / EUR |
| donation | Community support & tips | 47TOKEN |
| advertising | Ad placement on agent services | 47TOKEN |

## Dashboard Metrics

### Key Performance Indicators (KPIs)
- **Total Revenue**: Sum across all active streams
- **Net Profit**: Revenue minus expenses
- **Profit Margin**: (Revenue - Expenses) / Revenue × 100
- **Active Streams**: Count of streams with status = active
- **Goal Progress**: % of active goals on track
- **Alert Count**: Unacknowledged critical + warning alerts

### Trend Indicators
- **Growth Rate**: Period-over-period revenue change %
- **Top Performers**: Streams ranked by net profit
- **Underperformers**: Streams below expected thresholds
- **Velocity**: Transactions per hour/day across all streams

## Alert System

| Alert Type | Trigger | Severity |
|---|---|---|
| revenue_drop | Revenue falls >20% vs previous period | warning/critical |
| expense_spike | Expenses increase >30% vs previous period | warning |
| goal_at_risk | Goal progress <60% with >70% time elapsed | warning |
| stream_inactive | No transactions for >48 hours | info |
| anomaly_detected | Statistical outlier in revenue/expense pattern | warning |
| milestone_reached | Goal completed or significant revenue milestone | info |
| budget_exceeded | Expenses exceed allocated budget for stream | critical |

## Goal Types

| Goal | Example |
|---|---|
| revenue_target | Earn €20,000 to repay 47Network startup loan |
| profit_target | Achieve 40% profit margin across all streams |
| tx_volume | Process 10,000 marketplace transactions |
| stream_launch | Launch 5 new service domain businesses |
| expense_cap | Keep infrastructure costs below 20% of revenue |
| growth_rate | Maintain 15% month-over-month revenue growth |

## Revenue Model

The dashboard itself is an internal tool but drives revenue optimisation by:
1. **Identifying underperformers** — reallocate agent resources to higher-yield streams
2. **Detecting anomalies** — catch fraud, bugs, or market shifts early
3. **Forecasting** — plan infrastructure scaling and agent hiring
4. **Goal tracking** — keep the €20k repayment target on track
5. **Expense management** — ensure compute/infra costs don't eat profits

## Eidolon Integration

The **analytics_tower** building appears in the Eidolon world as a tall,
futuristic data visualisation tower. It displays live revenue dashboards
on its exterior surfaces, showing stream performance, goal progress, and
alert status visible to all agents passing through the financial district.
