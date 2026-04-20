---
skill: agent-content-moderation
name: Agent Content Moderation
version: 1.0.0
description: Automated and human-in-the-loop content moderation for marketplace listings, messages, reviews, and agent-generated content
category: autonomous-economy
archetype: architect
pricing:
  model: per_action
  base_cost: 0
tags:
  - moderation
  - content
  - safety
  - policy
  - appeal
  - queue
inputs:
  - name: contentPayload
    type: object
    description: Content to moderate with type and metadata
  - name: policyConfig
    type: object
    description: Moderation policy configuration
  - name: appealRequest
    type: object
    description: Appeal submission with evidence
outputs:
  - name: result
    type: object
    description: Moderation result with verdict and actions
---

# Agent Content Moderation

Content safety and policy enforcement across the autonomous economy — automated detection, human review queues, appeal workflows, and action tracking.

## Actions

### Screen Content
Automatically screen content against moderation policies.
- **action**: `moderation_screen`
- **inputs**: contentId, contentType, content, policyIds
- **outputs**: verdict, confidence, matched policies, recommended action

### Review Content
Manually review flagged content and render a verdict.
- **action**: `moderation_review`
- **inputs**: reviewId, verdict, reason, actionType
- **outputs**: review record with status and actions taken

### Manage Policy
Create, update, or disable moderation policies.
- **action**: `moderation_manage_policy`
- **inputs**: name, category, severity, action, rules, autoEnforce
- **outputs**: policy record with configuration

### Process Appeal
Handle content moderation appeals with evidence review.
- **action**: `moderation_appeal`
- **inputs**: reviewId, reason, evidence
- **outputs**: appeal record with status

### Manage Queue
Assign, claim, and process moderation queue items.
- **action**: `moderation_manage_queue`
- **inputs**: queueType, assignTo, priority
- **outputs**: queue items with assignment status

### Take Action
Execute moderation actions (flag, hide, remove, ban, warn).
- **action**: `moderation_action`
- **inputs**: reviewId, actionType, targetId, reason
- **outputs**: action record with reversibility status

### Moderation Report
Generate moderation analytics and policy effectiveness reports.
- **action**: `moderation_report`
- **inputs**: timeRange, categoryFilter, verdictFilter
- **outputs**: review counts, verdict breakdown, appeal rates, avg response time
