---
name: integration-agent
version: 1.0.0
description: >
  Self-evolving agents that wrap third-party SaaS platforms (Atlassian, Salesforce,
  HubSpot, Zendesk, etc.) and sell their use on Sven's marketplace. Each agent
  monitors its target platform's API for changes, auto-updates when breaking changes
  occur, learns new capabilities over time, and continuously improves reliability.
archetype: engineer
category: autonomous-economy
requires:
  - skill-catalog
  - market-publish
  - asi-evolve
triggers:
  - integration_agent_create
  - integration_agent_invoke
  - integration_agent_evolve
---

# Integration Agent

## Purpose

Build, maintain, and sell AI agents that interact with third-party SaaS platforms on
behalf of users. Many businesses use tools like Jira, Salesforce, or Zendesk but lack
AI agents for those platforms. Sven fills this gap by creating self-evolving integration
agents that wrap these APIs and offer them as marketplace services.

## Actions

### discover-platform
Analyze a third-party platform's public API documentation, identify available endpoints,
authentication methods, rate limits, and capabilities.
- **Input**: `platformUrl`, `apiDocsUrl`, `category`
- **Output**: `platformId`, `endpointCount`, `authType`, `capabilities[]`, `estimatedCoverage`
- **Cost**: 10 47Tokens

### build-agent
Create a new integration agent for a discovered platform. Generates API wrappers,
authentication handlers, error recovery logic, and rate-limit management.
- **Input**: `platformId`, `targetCapabilities[]`, `priorityEndpoints[]`
- **Output**: `agentId`, `version`, `supportedActions[]`, `apiCoveragePct`
- **Cost**: 50 47Tokens

### invoke-action
Execute an action on the target platform through the integration agent. Handles auth,
retries, rate limits, and error translation transparently.
- **Input**: `agentId`, `action`, `params`, `subscriberId`
- **Output**: `result`, `latencyMs`, `tokensCharged`
- **Cost**: 1–10 47Tokens per invocation (depends on action complexity)

### health-check
Monitor the integration agent's health — verify API connectivity, check for deprecation
warnings, validate auth tokens, test critical endpoints.
- **Input**: `agentId`
- **Output**: `healthStatus`, `issuesFound[]`, `lastSuccessful`, `apiVersion`
- **Cost**: 2 47Tokens

### evolve
Trigger self-evolution cycle: detect API changes, learn new endpoints, fix broken
integrations, improve error handling, optimize performance.
- **Input**: `agentId`, `trigger` (scheduled | api_change | error_spike | manual)
- **Output**: `evolutionId`, `evolutionType`, `changes[]`, `autoResolved`, `resolutionMs`
- **Cost**: 15 47Tokens

### subscribe
Create or manage a subscription for a user/business to access an integration agent.
Plans: free_trial (7 days, 100 invocations), basic (1000/mo), pro (10000/mo),
enterprise (unlimited, priority support).
- **Input**: `agentId`, `subscriberId`, `plan`
- **Output**: `subscriptionId`, `monthlyTokens`, `invocationsLimit`, `expiresAt`
- **Cost**: Plan-dependent

### report-coverage
Generate a coverage report showing which API endpoints are wrapped, which are pending,
success rates, common errors, and evolution history.
- **Input**: `agentId`, `from`, `to`
- **Output**: `coveragePct`, `endpointsCovered`, `endpointsPending`, `successRate`, `evolutionCount`
- **Cost**: 5 47Tokens

## Self-Evolution Lifecycle

```
1. MONITOR  →  Watch target API docs, changelogs, deprecation notices
2. DETECT   →  Identify breaking changes, new endpoints, auth updates
3. ANALYZE  →  Assess impact, plan resolution strategy
4. ADAPT    →  Auto-generate updated wrappers, fix auth flows
5. TEST     →  Validate against sandbox/staging environments
6. DEPLOY   →  Roll out updated agent, notify subscribers
7. LEARN    →  Record evolution for future pattern matching
```

## Pricing Model

| Plan       | Monthly Tokens | Invocations | Support     |
|------------|---------------|-------------|-------------|
| Free Trial | 0             | 100 (7 days)| Community   |
| Basic      | 25            | 1,000/mo    | Standard    |
| Pro        | 100           | 10,000/mo   | Priority    |
| Enterprise | Custom        | Unlimited   | Dedicated   |

## Revenue Split

- 70% to Sven treasury (infrastructure + development costs)
- 20% to the integration agent (self-improvement budget)
- 10% to the agent that recruited the subscriber

## Target Platforms (Priority Order)

### Tier 1 — High Demand, Well-Documented APIs
- Atlassian Jira / Confluence
- Salesforce
- HubSpot
- Zendesk / Freshdesk
- Monday.com / Asana / Notion

### Tier 2 — Growing Markets
- Shopify / WooCommerce
- QuickBooks / Xero
- Figma / Canva
- Mailchimp / SendGrid

### Tier 3 — Enterprise & Niche
- ServiceNow / Workday / BambooHR
- Datadog / PagerDuty
- Intercom / Twilio

## Quality Standards

- Minimum 95% uptime per integration agent
- < 500ms p99 latency for standard operations
- Auto-rollback if error rate exceeds 5% post-evolution
- Weekly health checks on all active agents
- Monthly API coverage reports to subscribers
