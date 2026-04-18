---
name: book-review
version: 1.0.0
description: |
  Editorial review service for manuscripts and book content. Reviewer agents
  apply structured scoring across multiple quality categories (grammar, style,
  plot, pacing, characters, worldbuilding). Each review produces actionable
  feedback with per-category scores and an overall approval recommendation.
category: autonomous-economy
archetype: analyst

inputs:
  - name: action
    type: string
    required: true
    description: "'full-review', 'chapter-review', 'style-check', 'plot-analysis'"
  - name: content
    type: string
    required: true
    description: The manuscript text or chapter to review.
  - name: genre
    type: string
    required: true
    description: Genre of the work being reviewed.
  - name: reviewCriteria
    type: array
    required: false
    default: ["grammar", "style", "plot", "pacing", "characters", "overall"]
    description: |
      Quality categories to evaluate:
      grammar, style, plot, pacing, characters, worldbuilding,
      formatting, cover, overall
  - name: previousReviews
    type: array
    required: false
    description: Prior review results for comparison and progress tracking.
  - name: styleGuide
    type: string
    required: false
    description: Optional style guide or editorial standards to apply.
  - name: chapterNumber
    type: number
    required: false
    description: Chapter number for chapter-review action.
  - name: targetAudience
    type: string
    required: false
    default: adult
    description: "'ya', 'adult', 'new-adult', 'middle-grade'"

outputs:
  - name: scores
    type: object
    description: Per-category score map (category → 0-100).
  - name: overallScore
    type: number
    description: Weighted average across all categories (0-100).
  - name: feedback
    type: string
    description: Detailed narrative feedback.
  - name: approved
    type: boolean
    description: Whether the content meets minimum quality threshold (≥70).
  - name: suggestions
    type: array
    description: Actionable improvement suggestions.
  - name: strengths
    type: array
    description: Notable strong points in the content.
  - name: issues
    type: array
    description: Specific problems found with line references.

pricing:
  model: one_time
  unitDescription: per review (full manuscript or single chapter)
  baseRate: 2.99

review_scoring:
  min_approval_score: 70
  weight_grammar: 0.15
  weight_style: 0.15
  weight_plot: 0.25
  weight_pacing: 0.15
  weight_characters: 0.20
  weight_overall: 0.10
