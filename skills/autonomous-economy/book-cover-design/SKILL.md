---
name: book-cover-design
version: 1.0.0
description: |
  AI-powered book cover design service. Designer agents create detailed
  design briefs, generate AI image prompts optimised for cover art,
  suggest typography pairings, and review cover compositions. Specialises
  in genre-appropriate aesthetics and commercial appeal.
category: autonomous-economy
archetype: designer

inputs:
  - name: action
    type: string
    required: true
    description: "'generate-brief', 'generate-prompt', 'review-cover', 'suggest-typography'"
  - name: title
    type: string
    required: true
    description: Book title for the cover.
  - name: genre
    type: string
    required: true
    description: Genre for genre-appropriate visual style.
  - name: synopsis
    type: string
    required: false
    description: Brief synopsis to inform visual storytelling.
  - name: targetAudience
    type: string
    required: false
    default: adult
    description: "'ya', 'adult', 'new-adult', 'middle-grade'"
  - name: colorScheme
    type: string
    required: false
    description: |
      Preferred color palette:
      - 'dark-moody' — blacks, deep purples, crimson (dark romance, thriller)
      - 'warm-romantic' — golds, blush, warm tones (romance, contemporary)
      - 'cool-minimal' — greys, whites, accent blue (literary fiction, sci-fi)
      - 'vibrant-bold' — saturated primaries (YA, fantasy)
      - 'earthy-natural' — greens, browns, cream (historical, nature)
      - custom hex array
  - name: mood
    type: string
    required: false
    description: "'dark', 'romantic', 'mysterious', 'epic', 'whimsical', 'minimalist', 'intense'"
  - name: existingCoverUrl
    type: string
    required: false
    description: URL of an existing cover to review (for review-cover action).
  - name: referenceCovers
    type: array
    required: false
    description: URLs of reference covers for style inspiration.
  - name: authorName
    type: string
    required: false
    description: Author name for typography placement.
  - name: seriesInfo
    type: object
    required: false
    description: |
      Series branding:
      - seriesName: name of the series
      - bookNumber: position in series
      - consistentElements: design elements to maintain across series

outputs:
  - name: designBrief
    type: object
    description: |
      Structured design brief:
      - concept: overall visual concept
      - composition: layout description (centred, asymmetric, full-bleed)
      - primaryImage: main visual element description
      - backgroundTreatment: background style
      - textPlacement: title and author name positioning
      - colorPalette: hex colour array
      - mood: intended emotional response
  - name: aiPrompt
    type: string
    description: Optimised prompt for AI image generation (DALL-E, Midjourney, Stable Diffusion).
  - name: coverUrl
    type: string
    description: URL of generated or reviewed cover image.
  - name: typography
    type: object
    description: |
      Typography recommendations:
      - titleFont: font family for the title
      - authorFont: font family for the author name
      - titleSize: relative size ('large', 'medium', 'small')
      - titleWeight: 'bold', 'regular', 'light'
      - titleColor: hex colour
      - authorColor: hex colour
      - titleEffect: 'none', 'embossed', 'foil', 'shadow', 'outline'
  - name: colorPalette
    type: array
    description: 5-colour palette as hex strings.
  - name: reviewNotes
    type: string
    description: Feedback on existing cover (for review-cover action).

pricing:
  model: one_time
  unitDescription: per cover design (brief + prompt + typography)
  baseRate: 14.99

genre_aesthetics:
  dark-romance:
    mood: dark, intense
    colors: ['#1a0a0a', '#4a0e1f', '#8b1a2b', '#c7a17a', '#f5e6d0']
    imagery: silhouettes, chains, roses, rain, urban nights
    typography: serif with metallic accents
  mafia-romance:
    mood: dangerous, luxurious
    colors: ['#0d0d0d', '#1a1a2e', '#b8860b', '#c0c0c0', '#8b0000']
    imagery: skylines, suits, weapons, luxury items, smoke
    typography: condensed sans-serif, gold foil
  romantasy:
    mood: epic, magical
    colors: ['#1a0533', '#2d1b69', '#7b68ee', '#ffd700', '#e8d5b7']
    imagery: castles, magic, swords, ethereal landscapes
    typography: decorative serif, ornamental
  psychological-thriller:
    mood: unsettling, cerebral
    colors: ['#0a0a0a', '#1c1c1c', '#8b0000', '#ffffff', '#4a4a4a']
    imagery: faces, mirrors, corridors, shadows, abstract
    typography: clean sans-serif, distorted
  sci-fi:
    mood: futuristic, vast
    colors: ['#0a192f', '#172a45', '#00d4ff', '#64ffda', '#e6f1ff']
    imagery: ships, planets, circuits, neon, geometric
    typography: mono or geometric sans-serif
