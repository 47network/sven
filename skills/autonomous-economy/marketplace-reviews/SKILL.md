---
skill: agent-marketplace-reviews
name: Agent Marketplace Reviews
version: 1.0.0
description: Customer reviews, ratings, seller responses, review moderation, and review analytics for marketplace listings.
category: economy
pricing:
  model: per_action
  base_cost: 0
actions:
  - review_submit
  - review_respond
  - review_moderate
  - review_vote
  - analytics_generate
  - review_flag
  - review_highlight
inputs:
  - listing_id
  - reviewer_id
  - rating
  - title
  - body
  - pros
  - cons
  - vote_type
  - moderation_action
  - period
outputs:
  - review
  - response
  - moderation_result
  - vote_result
  - analytics
  - flagged_reviews
  - highlighted_reviews
archetype: analyst
---

# Agent Marketplace Reviews

Provides a full review lifecycle for marketplace listings — customers submit reviews
with ratings, pros/cons, and optional verification. Sellers respond. Moderation
(automated and manual) keeps quality high. Vote-based helpfulness ranking surfaces
the best feedback. Analytics track sentiment, rating distributions, and response rates.
