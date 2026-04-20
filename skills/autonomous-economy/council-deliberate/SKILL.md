---
name: council-deliberate
version: 1.0.0
description: |
  Multi-model LLM Council deliberation — orchestrates a panel of language models
  that debate, critique, and synthesize answers. Implements Andrej Karpathy's
  "LLM Council" pattern for higher-quality AI responses on complex queries.
archetype: strategist
category: intelligence
pricing:
  base: 0.00
  per_use: 0.05
  currency: EUR
  note: Cost varies by model count and rounds — base fee plus actual inference cost

triggers:
  - council deliberation
  - multi-model debate
  - llm council
  - model panel
  - consensus query

actions:
  - name: deliberate
    description: >
      Fan-out a query to multiple models, collect opinions, run peer reviews,
      and synthesize a final answer. Returns the winning response plus full
      deliberation artifacts.
    inputs:
      query:
        type: string
        required: true
        description: The question or task to deliberate on
      strategy:
        type: string
        enum: [best_of_n, majority_vote, debate, weighted]
        default: weighted
        description: Strategy for combining model outputs
      models:
        type: string[]
        default: [qwen2.5-coder:32b, qwen2.5:7b, deepseek-r1:7b]
        description: Model aliases to include in the panel
      rounds:
        type: integer
        default: 1
        min: 1
        max: 5
        description: Number of deliberation rounds (debate uses multiple)
      anonymize:
        type: boolean
        default: true
        description: Hide model identity during peer review to reduce bias
      queryCategory:
        type: string
        enum: [coding, reasoning, creative, analysis, general, math, research]
        description: Hint for auto-selecting specialist models
      costLimit:
        type: number
        description: Maximum cost in EUR for this session
    outputs:
      sessionId:
        type: string
        description: Unique council session identifier
      synthesis:
        type: string
        description: Final synthesized answer
      winningModel:
        type: string
        description: Model alias that produced the best response
      opinions:
        type: object[]
        description: Individual model responses with confidence scores
      scores:
        type: object
        description: Final scores per model
      totalCost:
        type: number
        description: Actual cost of the deliberation session
      elapsedMs:
        type: integer
        description: Total deliberation time in milliseconds

  - name: vote
    description: >
      Quick majority-vote on a binary or multiple-choice question.
      Each model votes independently, result is the majority choice.
    inputs:
      question:
        type: string
        required: true
        description: The question to vote on
      choices:
        type: string[]
        required: true
        description: Available choices to vote between
      models:
        type: string[]
        default: [qwen2.5-coder:32b, qwen2.5:7b, deepseek-r1:7b]
    outputs:
      winner:
        type: string
        description: The choice that received the most votes
      votes:
        type: object
        description: Vote tally per choice
      confidence:
        type: number
        description: Percentage of models that agreed

  - name: critique
    description: >
      Submit a draft response for peer critique by the council.
      Returns structured feedback from multiple model perspectives.
    inputs:
      draft:
        type: string
        required: true
        description: The draft text to critique
      context:
        type: string
        description: Original question or context for the draft
      criteria:
        type: string[]
        default: [accuracy, completeness, clarity, reasoning]
        description: Evaluation criteria
    outputs:
      overallScore:
        type: number
        description: Average score across all models and criteria (0-100)
      reviews:
        type: object[]
        description: Individual model reviews with per-criterion scores
      suggestions:
        type: string[]
        description: Consolidated improvement suggestions

  - name: select-model
    description: >
      Recommend the best model(s) for a given query type based on
      historical performance metrics from past council sessions.
    inputs:
      queryCategory:
        type: string
        required: true
        enum: [coding, reasoning, creative, analysis, general, math, research]
      count:
        type: integer
        default: 3
        description: Number of models to recommend
    outputs:
      recommended:
        type: string[]
        description: Ordered list of recommended model aliases
      metrics:
        type: object[]
        description: Performance metrics for each recommended model

integrations:
  litellm:
    description: Uses LiteLLM proxy for unified model access
    endpoint: http://10.47.47.9:4000
    aliases: [coding, coding-fast, reasoning, general]
  nats:
    subjects:
      - sven.council.session_started
      - sven.council.round_completed
      - sven.council.session_completed
      - sven.council.model_ranked

notes: |
  The council pattern is most valuable for:
  - Complex coding decisions where multiple approaches exist
  - Reasoning tasks that benefit from diverse perspectives
  - Content quality assessment (reviews, proofreading)
  - Strategic decisions for agent autonomy
  
  Cost optimization: Simple queries auto-downgrade to single model.
  The council tracks which models win debates to improve future selection.
  
  Inspired by Andrej Karpathy's "LLM Council" concept and
  the multi-agent debate patterns from research literature.
---
