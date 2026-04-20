---
name: social-media-post
version: 1.0.0
description: >
  Create, schedule, and publish social media content across platforms
  (Instagram, TikTok, YouTube, Twitter, Facebook, LinkedIn, Threads).
  Generates captions, selects hashtags, picks optimal posting times,
  and manages multi-platform distribution.
author: Sven Autonomous Economy
license: proprietary
pricing:
  model: per_post
  basePrice: 1.99
  currency: "47Token"
archetype: marketer
category: social-media
platforms:
  - instagram
  - tiktok
  - youtube
  - twitter
  - facebook
  - linkedin
  - threads
---

# Social Media Post Skill

## Purpose

Enables Sven's marketer agents to autonomously create, schedule, and publish
social media content. Supports all major platforms with platform-specific
formatting, hashtag optimization, and optimal posting time selection.

## Actions

### create-post
Generate a social media post with caption, hashtags, and media suggestions.

**Inputs:**
- `platform` (string, required) — Target platform
- `topic` (string, required) — Topic or product to promote
- `contentType` (string) — image | video | story | reel | carousel | text
- `tone` (string) — professional | casual | playful | urgent | inspirational
- `targetAudience` (string) — Description of target audience
- `mediaUrls` (string[]) — URLs of media assets to include
- `campaignId` (string) — Associated campaign ID

**Outputs:**
- `caption` (string) — Generated caption (within platform limits)
- `hashtags` (string[]) — Optimized hashtag list (within platform limits)
- `suggestedMediaPrompt` (string) — AI image generation prompt if no media provided
- `scheduledAt` (string) — Suggested optimal posting time (ISO 8601)
- `platformTips` (string[]) — Platform-specific optimization suggestions

### schedule-post
Schedule a draft post for future publication.

**Inputs:**
- `postId` (string, required) — ID of the draft post
- `scheduledAt` (string) — Desired posting time (ISO 8601)
- `autoOptimize` (boolean) — Let agent pick optimal time if true

**Outputs:**
- `scheduledAt` (string) — Confirmed schedule time
- `estimatedReach` (number) — Predicted reach based on historical data
- `competingPosts` (number) — Number of scheduled posts in same time window

### multi-platform
Create variants of the same content for multiple platforms simultaneously.

**Inputs:**
- `topic` (string, required) — Core topic
- `platforms` (string[], required) — Target platforms
- `sharedMedia` (string[]) — Media URLs to adapt per platform
- `campaignId` (string) — Campaign to associate posts with

**Outputs:**
- `posts` (object[]) — Array of platform-specific post objects, each with:
  - `platform` (string)
  - `caption` (string) — Platform-adapted caption
  - `hashtags` (string[]) — Platform-optimized hashtags
  - `contentType` (string) — Best content type for the platform
  - `scheduledAt` (string)

### generate-content-calendar
Create a week or month of planned content for a campaign.

**Inputs:**
- `campaignId` (string, required)
- `platforms` (string[], required)
- `duration` (string) — "week" | "month"
- `postsPerWeek` (number) — Target posts per week per platform
- `themes` (string[]) — Content themes to rotate

**Outputs:**
- `calendarEntries` (object[]) — Planned content items with dates, topics, types
- `totalPosts` (number) — Total posts planned
- `coverageReport` (object) — Platform/theme distribution analysis

## Platform Limits Reference

| Platform  | Hashtags | Caption Length | Best Content Types      |
|-----------|----------|---------------|------------------------|
| Instagram | 30       | 2,200 chars   | image, reel, carousel  |
| TikTok    | 100      | 4,000 chars   | video, reel            |
| YouTube   | 15       | 5,000 chars   | video, live            |
| Twitter   | 5        | 280 chars     | text, image            |
| Facebook  | 10       | 63,206 chars  | image, video, text     |
| LinkedIn  | 5        | 3,000 chars   | text, image, carousel  |
| Threads   | 10       | 500 chars     | text, image            |

## Dependencies
- Sven API: `POST /v1/admin/social/posts`
- Sven API: `POST /v1/admin/social/calendar`
- LLM endpoint for caption generation
- Image generation endpoint for media creation
