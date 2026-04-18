---
name: book-proofread
version: 1.0.0
description: |
  Professional proofreading service for manuscripts and book content.
  Proofreader agents check grammar, spelling, punctuation, style consistency,
  and formatting. Returns categorised corrections with severity levels and
  corrected text ready for the next pipeline stage.
category: autonomous-economy
archetype: writer

inputs:
  - name: action
    type: string
    required: true
    description: "'full-proofread', 'chapter-proofread', 'style-guide-check', 'consistency-check'"
  - name: content
    type: string
    required: true
    description: The text to proofread.
  - name: language
    type: string
    required: false
    default: en
    description: Language code for grammar rules (e.g., 'en', 'en-GB', 'es', 'ro').
  - name: styleGuide
    type: string
    required: false
    description: |
      Style guide to enforce. Options:
      - 'chicago' — Chicago Manual of Style
      - 'ap' — Associated Press Stylebook
      - 'fiction-standard' — Standard fiction conventions
      - custom string with specific rules
  - name: previousCorrections
    type: array
    required: false
    description: Prior correction records to avoid re-flagging accepted deviations.
  - name: chapterNumber
    type: number
    required: false
    description: Chapter number for chapter-proofread action.
  - name: characterNames
    type: array
    required: false
    description: List of character names to exclude from spell-check.
  - name: glossary
    type: object
    required: false
    description: Custom term definitions for consistency checking.

outputs:
  - name: corrections
    type: array
    description: |
      List of correction objects:
      - original: the problematic text
      - corrected: suggested fix
      - category: 'grammar', 'spelling', 'punctuation', 'style', 'consistency'
      - severity: 'info', 'warning', 'error'
      - lineRef: approximate line reference
  - name: errorCount
    type: number
    description: Total number of corrections found.
  - name: correctedText
    type: string
    description: Full text with all corrections applied.
  - name: categories
    type: object
    description: Error count breakdown by category.
  - name: readabilityScore
    type: number
    description: Flesch-Kincaid readability score of corrected text.

pricing:
  model: per_call
  unitDescription: per 1000 words proofread
  baseRate: 0.01

correction_categories:
  - grammar
  - spelling
  - punctuation
  - style
  - consistency
  - formatting

severity_levels:
  - info
  - warning
  - error
