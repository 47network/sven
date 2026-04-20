---
name: genre-research-v2
version: 2.0.0
description: Advanced trending genre analysis — monitors bestseller lists, BookTok, Bookstagram, and publisher data to identify profitable genres, tropes, and market gaps.
archetype: researcher
category: publishing

actions:
  - name: trending-report
    description: Generate a comprehensive trending genres report for a target market.
    inputs:
      - name: market
        type: string
        required: false
        description: Target market (global, us, uk, ro, de, fr). Defaults to global.
      - name: sources
        type: array
        required: false
        description: Data sources to include (amazon_bestseller, goodreads, booktok, bookstagram, google_trends, publisher_weekly).
      - name: genres
        type: array
        required: false
        description: Specific genres to focus on. If empty, analyses all genres.
    outputs:
      - name: trends
        type: array
        description: Ranked list of trending genres with scores and metrics.
      - name: emergingTropes
        type: array
      - name: marketGaps
        type: array
      - name: recommendations
        type: array
      - name: reportDate
        type: string

  - name: trope-analysis
    description: Deep analysis of specific tropes — popularity, competition, reader demographics.
    inputs:
      - name: trope
        type: string
        required: true
      - name: genre
        type: string
        required: false
    outputs:
      - name: popularityScore
        type: number
      - name: competitionLevel
        type: string
      - name: demographics
        type: object
      - name: averagePrice
        type: number
      - name: topTitles
        type: array
      - name: relatedTropes
        type: array

  - name: competition-scan
    description: Analyse competition density for a genre/sub-genre combination.
    inputs:
      - name: genre
        type: string
        required: true
      - name: subGenre
        type: string
        required: false
      - name: market
        type: string
        required: false
    outputs:
      - name: totalTitles
        type: number
      - name: newReleasesPerMonth
        type: number
      - name: averageRating
        type: number
      - name: priceRange
        type: object
      - name: topPublishers
        type: array
      - name: entryDifficulty
        type: string

  - name: keyword-research
    description: Identify high-value keywords for book titles and descriptions.
    inputs:
      - name: genre
        type: string
        required: true
      - name: market
        type: string
        required: false
    outputs:
      - name: keywords
        type: array
        description: Ranked keywords with search volume and competition scores.
      - name: longtailKeywords
        type: array
      - name: avoidKeywords
        type: array

pricing:
  model: per_call
  amount: 2.99
  currency: EUR

rate_limit:
  requests_per_minute: 15
  requests_per_hour: 200

tags:
  - genre-research
  - market-analysis
  - trends
  - publishing
  - booktok
  - bestseller
---

# Genre Research v2 — Advanced Trend Analysis

Advanced genre research agent that monitors bestseller lists (Amazon, Goodreads),
social media trends (BookTok, Bookstagram), and publisher data to identify
profitable genres, emerging tropes, and market gaps.

## Key Genres Tracked

- Dark Romance, Mafia Romance, Why Choose
- Enemies-to-Lovers, Bully Romance, College Romance
- Age-Gap, Psychological Thriller, Romantasy
- Reverse Harem, Gothic Romance, Paranormal Romance
- New Adult, Forbidden Romance

## Key Tropes Tracked

- Enemies-to-Lovers, Enemies-to-Lovers-to-Enemies
- Grumpy-Sunshine, Forced-Proximity, Fake-Dating
- One-Bed, Touch-Her-and-Die, Morally-Grey
- Who-Did-This-to-You, Possessive-Hero
- Good-Girl-Bad-Boy, Hidden-Identity, Second-Chance
- Forbidden-Love, Slow-Burn, Love-Triangle

## Integration

Extends the original `genre_research` handler with deeper market analysis.
Results feed into `genre_trends` table and inform author persona strategy.
