---
skill: agent-feedback-surveys
name: Agent Feedback & Surveys
version: 1.0.0
status: active
triggers:
  - feedback_submit
  - survey_create
  - survey_respond
  - analytics_generate
  - improvement_propose
  - feedback_acknowledge
  - survey_close
---

# Agent Feedback & Surveys

Manages feedback collection, survey creation, response tracking,
sentiment analysis, and feedback-driven improvement loops for
autonomous agents.

## Actions

### feedback_submit
Submit feedback about an agent's service quality.
- Input: `agentId`, `feedbackType`, `category`, `rating`, `body`
- Output: `{ feedbackId, sentiment, status }`

### survey_create
Create a new survey for collecting structured feedback.
- Input: `agentId`, `title`, `surveyType`, `questions`, `targetAudience`
- Output: `{ surveyId, status }`

### survey_respond
Submit a response to an active survey.
- Input: `surveyId`, `respondentId`, `answers`
- Output: `{ responseId, score, completionPct }`

### analytics_generate
Generate analytics report for agent feedback.
- Input: `agentId`, `period`, `periodStart`
- Output: `{ analyticsId, avgRating, npsScore, sentimentDist }`

### improvement_propose
Propose an improvement action based on feedback patterns.
- Input: `agentId`, `feedbackIds`, `actionType`, `description`, `priority`
- Output: `{ actionId, status }`

### feedback_acknowledge
Acknowledge and respond to submitted feedback.
- Input: `feedbackId`, `response`, `status`
- Output: `{ feedbackId, updatedStatus }`

### survey_close
Close an active survey and finalize results.
- Input: `surveyId`, `reason`
- Output: `{ surveyId, totalResponses, avgScore }`
