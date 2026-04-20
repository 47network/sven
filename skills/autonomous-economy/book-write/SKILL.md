---
name: book-write
version: 1.0.0
description: |
  Autonomous creative writing service. Writer agents adopt unique author
  personas with genre expertise, voice signatures, and style preferences.
  Targets trending book genres for autonomous revenue generation.
category: autonomous-economy
archetype: writer

inputs:
  - name: action
    type: string
    required: true
    description: "'outline', 'write-chapter', 'write-blurb', 'generate-title', 'write-synopsis'"
  - name: genre
    type: string
    required: true
    description: Target genre for the content.
  - name: authorPersona
    type: object
    required: false
    description: |
      Author personality configuration:
      - name: pen name
      - style: 'lyrical', 'gritty', 'minimalist', 'verbose', 'poetic'
      - tone: 'dark', 'playful', 'intense', 'tender', 'sarcastic'
      - signaturePhrases: recurring motifs or expressions
      - genreExpertise: list of genres this persona excels at
  - name: outline
    type: string
    required: false
    description: Book/chapter outline for write-chapter action.
  - name: chapterNumber
    type: number
    required: false
    description: Which chapter to write.
  - name: maxWords
    type: number
    required: false
    default: 3000
    description: Maximum word count for generated content.
  - name: characters
    type: array
    required: false
    description: Character profiles for consistency across chapters.
  - name: previousContext
    type: string
    required: false
    description: Summary of previous chapters for continuity.

outputs:
  - name: content
    type: string
  - name: wordCount
    type: number
  - name: genre
    type: string
  - name: chapterNumber
    type: number
  - name: persona
    type: string

pricing:
  model: one_time
  unitDescription: per piece (chapter, blurb, outline)
  baseRate: 4.99

trending_genres:
  - dark-romance
  - mafia-romance
  - why-choose
  - step-sibling
  - enemies-to-lovers
  - enemies-to-lovers-to-enemies
  - college-romance
  - bully-romance
  - ex-boyfriend-dad
  - psychological-thriller
  - romantasy
  - reverse-harem

persona_presets:
  - name: "Valentina Noir"
    style: gritty
    tone: dark
    genres: [dark-romance, mafia-romance, enemies-to-lovers]
  - name: "Cassandra Wolfe"
    style: lyrical
    tone: intense
    genres: [why-choose, reverse-harem, romantasy]
  - name: "Mira Ashford"
    style: minimalist
    tone: tender
    genres: [college-romance, bully-romance, step-sibling]
  - name: "Roman Blackwell"
    style: verbose
    tone: sarcastic
    genres: [psychological-thriller, enemies-to-lovers-to-enemies]
---
