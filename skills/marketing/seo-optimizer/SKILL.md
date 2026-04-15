---
name: seo-optimizer
description: SEO analysis and optimization — meta tags, content structure, keyword density, and technical SEO checks.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to analyze SEO, optimize page content for search engines, or check meta tags.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [analyze, optimize_meta, keyword_analysis, technical_check]
    content:
      type: string
    url:
      type: string
    target_keyword:
      type: string
    meta:
      type: object
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# seo-optimizer

SEO analysis and optimization advisor — checks meta tags, heading structure,
keyword density, content length, and technical SEO best practices.
