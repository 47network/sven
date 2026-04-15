---
name: ab-copywriter
description: Generate A/B test copy variants — headlines, CTAs, email subjects, and ad copy with scoring.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to create A/B test copy variants, compare headlines, or optimize CTAs.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [generate_variants, score, suggest_cta]
    original:
      type: string
    type:
      type: string
      enum: [headline, cta, email_subject, ad_copy, tagline]
    count:
      type: number
      description: Number of variants to generate
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# ab-copywriter

Generates A/B test copy variants — creates alternative versions of
headlines, CTAs, email subjects, and ad copy with readability scoring.
