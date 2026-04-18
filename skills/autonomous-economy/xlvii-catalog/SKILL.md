---
name: xlvii-catalog
version: 1.0.0
description: >
  Manage the XLVII premium brand product catalog — create collections, add products
  with variants (size/colour), set pricing tiers, and track inventory across
  print-on-demand and premium embroidered lines.
author: sven
license: proprietary
price: 2.99
currency: USD
archetype: seller
tags:
  - xlvii
  - merch
  - catalog
  - e-commerce
  - brand
  - inventory
actions:
  - id: create-collection
    description: Create a new seasonal or thematic product collection.
    inputs:
      - name: collectionName
        type: string
        required: true
      - name: season
        type: string
        enum: [spring_summer, autumn_winter, capsule, permanent, collab]
      - name: description
        type: string
      - name: theme
        type: string
    outputs:
      - name: collectionId
        type: string
      - name: status
        type: string

  - id: add-product
    description: Add a product to an existing collection with category, quality tier, and base pricing.
    inputs:
      - name: collectionId
        type: string
        required: true
      - name: productName
        type: string
        required: true
      - name: category
        type: string
        enum: [tshirt, hoodie, cap, jacket, accessory, poster, sticker, mug, tote_bag, phone_case]
        required: true
      - name: qualityTier
        type: string
        enum: [standard, premium, luxury]
      - name: description
        type: string
    outputs:
      - name: productId
        type: string
      - name: sku
        type: string
      - name: basePrice
        type: number

  - id: manage-variants
    description: Create or update size/colour variants for a product.
    inputs:
      - name: productId
        type: string
        required: true
      - name: size
        type: string
        enum: [XS, S, M, L, XL, XXL, XXXL, ONE_SIZE]
      - name: colour
        type: string
      - name: stockQuantity
        type: number
    outputs:
      - name: variantId
        type: string
      - name: variantSku
        type: string

  - id: check-inventory
    description: Query current stock levels and flag low-stock or out-of-stock items.
    inputs:
      - name: collectionId
        type: string
      - name: threshold
        type: number
        description: Stock level below which items are considered low-stock (default 10).
    outputs:
      - name: lowStockItems
        type: array
      - name: outOfStockItems
        type: array
      - name: totalVariants
        type: number
---

# XLVII Catalog Management

Manages the XLVII premium brand product catalog for Sven's merchandise platform.
Handles collections, products, variants, pricing, and inventory tracking across
both print-on-demand (standard) and premium embroidered lines.

## Brand Guidelines

- **Theme**: Element 47 (Silver/Argentum) — futuristic, minimalist, premium
- **Quality tiers**: Standard (POD print), Premium (embroidered), Luxury (hand-finished)
- **Pricing**: Base price × quality multiplier (1.0 / 1.8 / 3.5)
- **SKU format**: `XLVII-{CATEGORY}-{TIMESTAMP}-{RANDOM}`

## Integration

- Connects to marketplace for listing published products
- Uses treasury for revenue tracking
- NATS events: `sven.xlvii.collection_created`, `sven.xlvii.product_created`
