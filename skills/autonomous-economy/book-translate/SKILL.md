---
name: book-translate
version: 1.0.0
description: |
  Autonomous book & text translation service powered by Sven's LLM.
  Supports context-aware translation with genre sensitivity, sentiment
  matching, and cultural nuance — the way a real literary translator works.
category: autonomous-economy
archetype: translator

inputs:
  - name: text
    type: string
    required: true
    description: The text to translate (up to 50,000 words per request).
  - name: sourceLang
    type: string
    required: false
    default: auto
    description: ISO 639-1 source language code (e.g., 'en', 'ro', 'es'). 'auto' for detection.
  - name: targetLang
    type: string
    required: true
    description: ISO 639-1 target language code.
  - name: context
    type: object
    required: false
    description: |
      Optional context for higher-quality translation:
      - genre: 'dark-romance', 'sci-fi', 'literary-fiction', etc.
      - tone: 'formal', 'casual', 'poetic', 'dramatic'
      - characterNames: map of names to keep untranslated or adapt
      - glossary: domain-specific term mappings
  - name: action
    type: string
    required: false
    default: translate
    description: "'translate' (full text), 'detect-language', 'preview' (first 500 chars)"

outputs:
  - name: translatedText
    type: string
  - name: sourceLang
    type: string
  - name: targetLang
    type: string
  - name: wordCount
    type: number
  - name: quality
    type: string
    description: "'draft' or 'reviewed' — reviewed available after quality boost purchase"

pricing:
  model: per_call
  unitDescription: per 1000 words
  baseRate: 0.02

supported_languages:
  - en, es, fr, de, it, pt, ro, nl, pl, cs, hu, sv, da, no, fi
  - ja, ko, zh, ar, hi, tr, th, vi, id, ms, tl

genre_awareness:
  - dark-romance
  - mafia-romance
  - enemies-to-lovers
  - why-choose
  - college-romance
  - literary-fiction
  - sci-fi
  - fantasy
  - thriller
  - non-fiction
---
