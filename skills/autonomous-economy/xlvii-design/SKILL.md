---
name: xlvii-design
version: 1.0.0
description: >
  Generate and manage AI-powered designs for XLVII merchandise — create design
  briefs, generate AI art prompts, manage design approval workflows, and prepare
  print-ready assets for production.
author: sven
license: proprietary
price: 4.99
currency: USD
archetype: designer
tags:
  - xlvii
  - design
  - ai-art
  - branding
  - merchandise
  - creative
actions:
  - id: generate-brief
    description: Create a design brief based on product category, collection theme, and brand guidelines.
    inputs:
      - name: productId
        type: string
        required: true
      - name: collectionTheme
        type: string
      - name: category
        type: string
        enum: [tshirt, hoodie, cap, jacket, accessory, poster, sticker, mug, tote_bag, phone_case]
      - name: style
        type: string
        enum: [minimalist, bold, vintage, futuristic, abstract, typographic]
      - name: colourPalette
        type: array
    outputs:
      - name: designBrief
        type: object
      - name: moodKeywords
        type: array
      - name: suggestedPlacements
        type: array

  - id: generate-prompt
    description: Create an AI image generation prompt from a design brief.
    inputs:
      - name: designBrief
        type: object
        required: true
      - name: model
        type: string
        description: Target image model (e.g., sdxl, dalle3, midjourney).
      - name: aspectRatio
        type: string
        enum: ['1:1', '4:5', '16:9', '9:16']
    outputs:
      - name: prompt
        type: string
      - name: negativePrompt
        type: string
      - name: parameters
        type: object

  - id: submit-for-approval
    description: Submit a generated design for review and approval.
    inputs:
      - name: productId
        type: string
        required: true
      - name: designUrl
        type: string
        required: true
      - name: designType
        type: string
        enum: [logo, pattern, illustration, typography, photo, mixed]
      - name: placement
        type: string
        enum: [front, back, sleeve, all_over, pocket, label, wrap]
    outputs:
      - name: designId
        type: string
      - name: approvalStatus
        type: string

  - id: prepare-print-assets
    description: Prepare print-ready files from an approved design for POD or premium production.
    inputs:
      - name: designId
        type: string
        required: true
      - name: targetProvider
        type: string
        enum: [printful, printify, gooten, local_embroidery, custom]
      - name: format
        type: string
        enum: [png_300dpi, svg, pdf_cmyk, dst_embroidery]
    outputs:
      - name: assetUrl
        type: string
      - name: dimensions
        type: object
      - name: printReady
        type: boolean
---

# XLVII Design Generation

AI-powered design creation and management for the XLVII premium merchandise brand.
Generates design briefs, AI art prompts, handles approval workflows, and prepares
print-ready assets for both POD and premium embroidered production.

## Design Philosophy

- **Brand**: XLVII — Element 47 (Silver/Argentum)
- **Style**: Futuristic minimalism with tech-inspired motifs
- **Colour palette**: Silver (#C0C0C0), Deep Navy (#0A1628), Electric Blue (#00D4FF),
  Matte Black (#1A1A2E), White (#FFFFFF)
- **Typography**: Clean sans-serif, monospace accents for tech feel

## Workflow

1. **Brief** → Define design requirements from product + collection context
2. **Prompt** → Generate AI image prompt tailored to target model
3. **Review** → Submit for approval (Sven oversight)
4. **Assets** → Prepare print-ready files for production pipeline

## Integration

- NATS events: `sven.xlvii.design_created`, `sven.xlvii.design_approved`
- Connects to fulfillment pipeline for print-ready asset delivery
- Quality tiers affect asset preparation (POD vs embroidery vs hand-finished)
