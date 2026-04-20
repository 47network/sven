---
name: author-persona
version: 1.0.0
description: Author brand development and evolution — creates unique pen names, writing voices, social profiles, and manages backlists for writer agents.
archetype: writer
category: publishing

actions:
  - name: create-persona
    description: Create a new author persona tailored to a specific genre and audience.
    inputs:
      - name: targetGenre
        type: string
        required: true
        description: Primary genre for this author persona.
      - name: targetAudience
        type: string
        required: false
        description: Target audience demographic (young-adult, new-adult, adult).
      - name: voicePreferences
        type: object
        required: false
        description: Desired voice traits (tone, pacing, themes, vocabulary level).
      - name: existingPersonas
        type: array
        required: false
        description: Other personas by the same agent — to ensure uniqueness.
    outputs:
      - name: penName
        type: string
      - name: bio
        type: string
      - name: voiceStyle
        type: string
      - name: writingTraits
        type: object
      - name: brandGuidelines
        type: object
      - name: suggestedAvatarPrompt
        type: string

  - name: evolve-persona
    description: Evolve a persona based on reader feedback, sales data, and market trends.
    inputs:
      - name: personaId
        type: string
        required: true
      - name: readerFeedback
        type: array
        required: false
      - name: salesTrend
        type: string
        required: false
        description: Sales direction (growing, stable, declining).
      - name: marketShifts
        type: array
        required: false
    outputs:
      - name: changes
        type: array
      - name: newVoiceStyle
        type: string
      - name: evolutionNotes
        type: string
      - name: recommendedActions
        type: array

  - name: cross-promote
    description: Generate cross-promotion strategies between author personas.
    inputs:
      - name: personaIds
        type: array
        required: true
      - name: strategy
        type: string
        required: false
        description: Cross-promo strategy (shared-universe, genre-adjacent, pen-name-reveal).
    outputs:
      - name: campaignPlan
        type: object
      - name: teaserContent
        type: array
      - name: expectedReachIncrease
        type: number

  - name: build-backlist
    description: Plan a backlist strategy for a persona — sequels, series, standalones.
    inputs:
      - name: personaId
        type: string
        required: true
      - name: currentTitles
        type: array
        required: false
      - name: readerDemand
        type: object
        required: false
    outputs:
      - name: nextBookSuggestions
        type: array
      - name: seriesOpportunities
        type: array
      - name: timeline
        type: array
      - name: projectedRevenue
        type: number

pricing:
  model: per_call
  amount: 3.99
  currency: EUR

rate_limit:
  requests_per_minute: 10
  requests_per_hour: 100

tags:
  - author
  - persona
  - branding
  - publishing
  - voice
  - backlist
---

# Author Persona — Brand Development & Evolution

Writer agent skill for developing and evolving unique author personas. Each
persona has a distinct pen name, voice style, writing traits, avatar, and
social media presence. Personas evolve based on reader feedback, sales data,
and market trends.

## Capabilities

- **Persona creation**: Generate unique pen names, bios, and brand guidelines
  tailored to specific genres and audiences.
- **Voice evolution**: Adapt writing style based on reader feedback and market
  changes while maintaining brand consistency.
- **Cross-promotion**: Create promotion strategies between personas sharing
  the same agent (shared universes, genre-adjacent recommendations).
- **Backlist planning**: Strategic planning for series, sequels, and standalone
  releases to maximise reader retention and revenue.

## Integration

Used by the `author_persona` task type. Personas are stored in
`author_personas` table with evolution logs tracking all changes. Each persona
can have multiple books in `book_catalog` via their agent_id link.
