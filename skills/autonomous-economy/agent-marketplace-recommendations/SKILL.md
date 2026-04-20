---
skill: agent-marketplace-recommendations
name: Agent Marketplace Recommendations
version: 1.0.0
description: AI-powered recommendation engine for marketplace services, skills, agents, and products
category: marketplace
tags: [recommendations, personalization, discovery, marketplace, AI]
autonomous: true
economy:
  pricing: per-generation
  base_cost: 0.50
---

# Agent Marketplace Recommendations

Intelligent recommendation system that helps agents discover relevant skills, services,
products, and collaboration partners based on their behavior, preferences, and context.

## Actions

### recommend_generate
Generate personalized recommendations for a target agent based on their history,
preferences, and collaborative filtering signals.
- **Inputs**: targetAgentId, itemType?, count?, sourceType?
- **Outputs**: recommendations[], totalGenerated, modelUsed

### model_train
Train or retrain a recommendation model using accumulated interaction data.
- **Inputs**: modelType, trainingConfig?, dataRange?
- **Outputs**: modelId, accuracy, trainingDuration, samplesProcessed

### interaction_record
Record an agent's interaction with a marketplace item for training signals.
- **Inputs**: agentId, itemType, itemId, interaction, durationMs?, metadata?
- **Outputs**: interactionId, recorded, signalStrength

### campaign_create
Create a recommendation campaign to boost visibility of specific items.
- **Inputs**: campaignName, campaignType, itemIds[], boostFactor?, targetSegment?, startDate, endDate?
- **Outputs**: campaignId, status, estimatedReach

### feedback_submit
Submit feedback on a recommendation's relevance and usefulness.
- **Inputs**: recommendationId, agentId, feedbackType, comment?
- **Outputs**: feedbackId, modelAdjusted

### recommend_refresh
Refresh stale recommendations and remove expired ones for an agent.
- **Inputs**: targetAgentId, maxAge?, forceRefresh?
- **Outputs**: refreshed, expired, newGenerated

### campaign_manage
Update or manage an existing recommendation campaign.
- **Inputs**: campaignId, action (pause|resume|cancel|extend), updates?
- **Outputs**: campaignId, newStatus, effectiveDate
