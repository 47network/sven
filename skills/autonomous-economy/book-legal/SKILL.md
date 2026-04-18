---
name: book-legal
version: 1.0.0
description: Legal compliance research for publishing — ISBN, copyright, distribution, tax, and regulatory requirements per market/country.
archetype: legal
category: publishing

actions:
  - name: research-country
    description: Research all publishing legal requirements for a specific country.
    inputs:
      - name: countryCode
        type: string
        required: true
        description: ISO 3166-1 alpha-2 country code (e.g., RO, US, GB, DE).
      - name: publishingType
        type: string
        required: false
        description: Type of publication (digital, paperback, hardcover, audiobook). Defaults to all.
      - name: genre
        type: string
        required: false
        description: Genre for content-rating requirements.
    outputs:
      - name: requirements
        type: array
        description: List of legal requirements with authority, cost, processing time.
      - name: mandatoryCount
        type: number
      - name: estimatedCostEur
        type: number
      - name: estimatedProcessingDays
        type: number

  - name: check-isbn
    description: Verify ISBN availability and registration process for a country.
    inputs:
      - name: countryCode
        type: string
        required: true
      - name: title
        type: string
        required: true
      - name: authorName
        type: string
        required: true
    outputs:
      - name: isbnAgency
        type: string
      - name: registrationUrl
        type: string
      - name: costEur
        type: number
      - name: processingDays
        type: number

  - name: draft-contract
    description: Generate a draft author contract template for a publishing agreement.
    inputs:
      - name: authorName
        type: string
        required: true
      - name: publisherName
        type: string
        required: false
      - name: royaltyPercentage
        type: number
        required: false
      - name: territory
        type: string
        required: false
    outputs:
      - name: contractDraft
        type: string
      - name: keyTerms
        type: array
      - name: warnings
        type: array

  - name: compliance-check
    description: Check if a book meets all legal requirements for a target market.
    inputs:
      - name: projectId
        type: string
        required: true
      - name: targetMarkets
        type: array
        required: true
    outputs:
      - name: compliant
        type: boolean
      - name: missingRequirements
        type: array
      - name: estimatedComplianceCostEur
        type: number

pricing:
  model: per_call
  amount: 4.99
  currency: EUR

rate_limit:
  requests_per_minute: 10
  requests_per_hour: 100

tags:
  - legal
  - publishing
  - compliance
  - isbn
  - copyright
---

# Book Legal — Publishing Compliance Research

Autonomous legal compliance research agent for the publishing pipeline. Handles
ISBN registration, copyright filing, distribution licensing, tax obligations,
content rating, deposit copies, import/export rules, data protection, censorship
review, and author contracts across any target market.

## Capabilities

- **Country-specific research**: Deep analysis of publishing requirements per
  jurisdiction including costs, timelines, and mandatory vs optional items.
- **ISBN verification**: Check availability and guide registration through
  national ISBN agencies.
- **Contract drafting**: Generate template author contracts with standard
  publishing industry terms.
- **Compliance auditing**: Verify a publishing project meets all legal
  requirements for its target markets before publication.

## Integration

This skill is used by the `legal_research` task type in the marketplace task
executor. Results are stored in the `legal_requirements` table and surfaced
in the Publishing v2 admin dashboard.
