# Pillar 7 — Marketing & Business Intelligence

> **Source**: Video 10 + User Vision
> **Priority**: MEDIUM | **Complexity**: Medium
> **Status**: Specification Complete — Implementation Not Started

---

## Executive Summary

Transform Sven into a marketing intelligence engine that autonomously handles competitive analysis, brand voice management, performance reviews, communication strategy, and content creation for the 47Network and all its products (including Sven itself). Sven analyzes how competitors operate, identifies strategic opportunities, and generates marketing assets — from copy to campaign strategies.

**User Vision**: "Make sven smart regarding all these, since we also want him to take over the marketing of the 47Network and all thats under including sven."

---

## Table of Contents

1. [Capabilities from Video 10](#1-capabilities-from-video-10)
2. [Architecture](#2-architecture)
3. [Competitive Intelligence Engine](#3-competitive-intelligence-engine)
4. [Communication & Brand Voice](#4-communication--brand-voice)
5. [Performance Review Generator](#5-performance-review-generator)
6. [Strategic Language Analysis](#6-strategic-language-analysis)
7. [Self-Perception Audit](#7-self-perception-audit)
8. [Content Generation Pipeline](#8-content-generation-pipeline)
9. [Marketing Campaign Automation](#9-marketing-campaign-automation)
10. [Analytics & Reporting](#10-analytics--reporting)
11. [Skills & Tools](#11-skills--tools)
12. [Implementation Phases](#12-implementation-phases)
13. [Granular Checklist](#13-granular-checklist)

---

## 1. Capabilities from Video 10

The video identifies 5 AI-powered marketing capabilities. All are implemented as Sven skills:

| # | Capability | Sven Implementation |
|---|-----------|---------------------|
| 1 | **Practice hard conversations** — Role-play difficult scenarios (raises, bad news, negotiations) | `skill: conversation_simulator` — Sven simulates the other party, pushes back, identifies weak points |
| 2 | **Competitive analysis** — Analyze job listings, website copy, LinkedIn activity to predict competitor moves | `skill: competitive_intel` — Automated scraping + LLM analysis of competitor signals |
| 3 | **Performance review authoring** — Write quarterly reviews positioning for promotion | `skill: performance_reviewer` — Generate reviews as a senior leader building a business case |
| 4 | **Strategic language learning** — Analyze language patterns at leadership levels | `skill: language_analyzer` — Extract frameworks and vocabulary used by people above your level |
| 5 | **Self-perception mirror** — Analyze your own communications to reveal how others see you | `skill: communication_auditor` — Analyze emails, messages, reports for communication style |

---

## 2. Architecture

```
skills/
└── marketing/
    ├── competitive-intel.yaml         — Competitive intelligence skill definition
    ├── conversation-simulator.yaml    — Hard conversation practice skill
    ├── performance-reviewer.yaml      — Performance review generator skill
    ├── language-analyzer.yaml         — Strategic language analysis skill
    ├── communication-auditor.yaml     — Self-perception audit skill
    ├── content-generator.yaml         — Marketing content generation skill
    ├── campaign-planner.yaml          — Campaign strategy and planning skill
    ├── brand-voice-enforcer.yaml      — Brand consistency checker skill
    ├── social-media-manager.yaml      — Social media content + scheduling skill
    └── analytics-reporter.yaml        — Marketing analytics and reporting skill

services/
└── agent-runtime/src/skills/marketing/
    ├── competitive-intel.ts           — Scrape, analyze, report on competitors
    ├── conversation-simulator.ts      — Role-play conversation engine
    ├── performance-reviewer.ts        — Review generation logic
    ├── language-analyzer.ts           — Language pattern extraction
    ├── communication-auditor.ts       — Communication style analysis
    ├── content-generator.ts           — Content creation pipeline
    ├── campaign-planner.ts            — Campaign planning logic
    ├── brand-voice-enforcer.ts        — Brand consistency validation
    ├── social-media-manager.ts        — Social content management
    └── analytics-reporter.ts          — Analytics aggregation
```

No new services needed — all marketing capabilities live as skills within the existing agent-runtime, invocable through chat or automated schedules.

---

## 3. Competitive Intelligence Engine

### 3.1 Data Sources

| Source | Data | Method |
|--------|------|--------|
| Competitor websites | Product pages, pricing, blog posts, changelog | HTTP scrape + diff tracking |
| Job listings (LinkedIn, Indeed, Glassdoor) | Open positions → infer what they're building | API/scrape + LLM analysis |
| LinkedIn company pages | Activity, employee count, new hires | Scrape |
| GitHub (public repos) | Open source activity, tech stack, priorities | GitHub API |
| Social media (X, Reddit) | Mentions, sentiment, campaigns | API/scrape |
| Press releases | Announcements, partnerships, funding | NewsAPI/RSS |
| App store listings | Feature updates, reviews, ratings | Scrape |
| Patent filings (Google Patents) | Innovation direction, future products | API |

### 3.2 Analysis Pipeline

```
Data Collection (scheduled) → Change Detection (diff against last snapshot)
→ Entity Extraction (products, features, team changes)
→ Strategic Analysis (LLM) → Report Generation → Notification to Admin
```

### 3.3 Competitor Profile Schema

```sql
CREATE TABLE competitor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  website         TEXT,
  linkedin_url    TEXT,
  github_org      TEXT,
  industry        TEXT,
  description     TEXT,
  tracked_since   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE competitor_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES competitor_profiles(id),
  signal_type     TEXT NOT NULL,  -- 'job_listing', 'website_change', 'social_post', 'press_release', 'github_activity'
  title           TEXT NOT NULL,
  content         TEXT,
  source_url      TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analysis        TEXT,          -- LLM-generated strategic analysis
  impact_level    INTEGER,       -- 1-5
  raw_data        JSONB
);

CREATE TABLE competitive_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_type     TEXT NOT NULL,  -- 'weekly_summary', 'alert', 'deep_dive'
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,  -- Markdown report
  competitors     UUID[],        -- competitor IDs covered
  key_findings    JSONB          -- structured findings
);
```

### 3.4 Sven's Competitive Analysis Prompt

```
Given the following competitor signals from the past week:
[job_listings, website_changes, social_activity, press_releases]

For each competitor, analyze:
1. What are they building? (inferred from job listings and changes)
2. Where are they heading strategically?
3. What threats do they pose to 47Network?
4. What opportunities do their moves create for us?
5. Are there any team/talent changes we should note?
6. What is their apparent marketing strategy?

Generate a structured report with:
- Executive summary (3 sentences)
- Per-competitor breakdown
- Recommended 47Network responses
- Priority action items
```

---

## 4. Communication & Brand Voice

### 4.1 47Network Brand Profile

Sven maintains a living brand profile that governs all marketing output:

```typescript
interface BrandProfile {
  name: string;                    // '47Network'
  tagline: string;
  voice: {
    tone: string[];                // ['professional', 'innovative', 'approachable']
    avoid: string[];               // ['corporate jargon', 'buzzwords', 'hyperbole']
    personality: string;           // description of brand personality
  };
  visualIdentity: {
    primaryColors: string[];
    typography: string[];
    logoUsage: string;
  };
  targetAudience: {
    primary: string;
    secondary: string;
    pain_points: string[];
    motivations: string[];
  };
  competitors: string[];
  differentiators: string[];
  keyMessages: string[];
}
```

### 4.2 Brand Consistency Checker

Before publishing any marketing content, Sven validates:

- [ ] Tone matches brand voice profile
- [ ] No prohibited words/phrases used
- [ ] Key messages reinforced
- [ ] Target audience addressed appropriately
- [ ] Visual identity guidelines followed
- [ ] Call-to-action present and aligned with campaign goals

---

## 5. Performance Review Generator

### 5.1 Capability

Sven can generate performance reviews positioned for career advancement:

**Input**: Work accomplished this quarter (projects, metrics, contributions)
**Process**: Sven writes the review as a senior leader building a business case to promote
**Output**: Structured performance review highlighting strategic impact

### 5.2 Skill Definition

```yaml
name: performance_reviewer
description: Generate strategic performance reviews that position work for career advancement
parameters:
  - name: accomplishments
    type: string
    required: true
    description: List of work accomplished this quarter
  - name: level
    type: string
    description: Current role level (e.g., 'senior engineer', 'team lead')
  - name: target_level
    type: string
    description: Level being promoted to
output: Structured performance review in Markdown
```

---

## 6. Strategic Language Analysis

### 6.1 Capability

Analyze content produced by people at higher levels to extract:
- Frameworks and mental models they use
- Vocabulary patterns unique to their level
- Communication structure (how they organize arguments)
- Decision-making language

### 6.2 Skill Definition

```yaml
name: language_analyzer
description: Analyze communication patterns at a target leadership level
parameters:
  - name: content
    type: string
    required: true
    description: Sample content from target level (reports, emails, strategy docs)
  - name: current_level
    type: string
    description: Your current level
  - name: target_level
    type: string
    description: The level you're analyzing
output: Language analysis with actionable vocabulary and framework recommendations
```

---

## 7. Self-Perception Audit

### 7.1 Capability

Analyze your own communications to reveal:
- How others likely perceive your communication style
- Level of thinking implied by your writing
- Strengths and weaknesses in your messaging
- Specific improvement recommendations

### 7.2 Skill Definition

```yaml
name: communication_auditor
description: Analyze your own communications to reveal how others perceive you
parameters:
  - name: content
    type: string
    required: true
    description: Your emails, messages, reports, or other communications
  - name: context
    type: string
    description: What role/level you're communicating from
output: Detailed audit of communication style with improvement recommendations
```

---

## 8. Content Generation Pipeline

### 8.1 Content Types

| Type | Format | Channel | Frequency |
|------|--------|---------|-----------|
| Blog posts | Markdown → HTML | sven.systems/blog | Weekly |
| Social media posts | Text + image | X, LinkedIn, Reddit | Daily |
| Newsletter | HTML email | Email list | Biweekly |
| Product announcements | Markdown | Blog + social | Per release |
| Documentation updates | Markdown | docs.sven.systems | Continuous |
| Video scripts | Text | YouTube/TikTok | Monthly |
| Case studies | PDF/HTML | Website | Quarterly |

### 8.2 Content Pipeline

```
Topic Ideation (Sven + trends + competitive intel)
→ Content Brief (outline, key points, audience, CTA)
→ Draft Generation (Sven LLM)
→ Brand Voice Check (automated)
→ Admin Review Queue
→ Publish (scheduled or immediate)
→ Performance Tracking (views, engagement, conversion)
```

### 8.3 Content Schema

```sql
CREATE TABLE marketing_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'review', 'approved', 'published', 'archived'
  channel         TEXT NOT NULL,
  content_body    TEXT NOT NULL,
  brief           JSONB,
  brand_check     JSONB,          -- brand consistency check results
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  scheduled_for   TIMESTAMPTZ,
  performance     JSONB,          -- views, clicks, engagement post-publish
  created_by      TEXT NOT NULL DEFAULT 'sven'
);
```

---

## 9. Marketing Campaign Automation

### 9.1 Campaign Management

Sven plans and executes multi-channel marketing campaigns:

1. **Campaign Planning** — Define goals, audience, channels, timeline, budget
2. **Content Creation** — Generate all campaign assets
3. **Scheduling** — Queue content across channels with optimal timing
4. **Monitoring** — Track performance in real-time
5. **Optimization** — Adjust messaging based on performance data
6. **Reporting** — Generate campaign performance reports

### 9.2 Campaign Schema

```sql
CREATE TABLE marketing_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  goals           JSONB NOT NULL,
  target_audience JSONB NOT NULL,
  channels        TEXT[] NOT NULL,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  budget          JSONB,
  status          TEXT NOT NULL DEFAULT 'planning',  -- 'planning', 'active', 'paused', 'completed'
  content_ids     UUID[],         -- linked marketing_content
  performance     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 10. Analytics & Reporting

### 10.1 Metrics Tracked

| Metric | Source | Frequency |
|--------|--------|-----------|
| Website traffic | Analytics API | Daily |
| Social media engagement | Platform APIs | Daily |
| Content performance | All channels | Per-content |
| Competitor movements | Competitive intel | Weekly |
| Brand sentiment | Social listening | Weekly |
| Conversion rates | Analytics API | Daily |
| Email open/click rates | Email service | Per-send |

### 10.2 Automated Reports

| Report | Frequency | Content |
|--------|-----------|---------|
| Weekly Marketing Summary | Monday 9 AM | Performance overview, top content, competitive alerts |
| Monthly Deep Dive | 1st of month | Full analytics, trends, recommendations |
| Campaign Performance | Per campaign | ROI, engagement, conversion analysis |
| Competitive Intel Brief | Weekly | New signals, strategic analysis |
| Brand Health Check | Monthly | Sentiment, share of voice, perception |

---

## 11. Skills & Tools

### 11.1 Marketing Skills for Sven

| Skill | Trigger | Description |
|-------|---------|-------------|
| `competitive_intel` | "analyze competitors" | Run competitive analysis cycle |
| `conversation_simulator` | "practice conversation" | Role-play hard conversation |
| `performance_reviewer` | "write my review" | Generate performance review |
| `language_analyzer` | "analyze language level" | Extract leadership language patterns |
| `communication_auditor` | "audit my communication" | Analyze personal communication style |
| `content_generator` | "create content for..." | Generate marketing content |
| `campaign_planner` | "plan campaign for..." | Design marketing campaign |
| `brand_voice_enforcer` | "check brand voice" | Validate content against brand profile |
| `social_media_manager` | "post to social" | Create + schedule social content |
| `analytics_reporter` | "marketing report" | Generate analytics report |

### 11.2 Scheduled Automation

```yaml
schedules:
  competitive_scan:
    cron: "0 6 * * 1"          # Monday 6 AM
    skill: competitive_intel
    action: full_scan_and_report

  content_calendar:
    cron: "0 8 * * *"          # Daily 8 AM
    skill: content_generator
    action: check_and_queue_scheduled

  weekly_report:
    cron: "0 9 * * 1"          # Monday 9 AM
    skill: analytics_reporter
    action: weekly_summary

  brand_health:
    cron: "0 10 1 * *"         # 1st of month 10 AM
    skill: brand_voice_enforcer
    action: monthly_brand_audit
```

---

## 12. Implementation Phases

### Phase 7A — Core Skills (Week 1-2)

- [ ] `competitive_intel` skill: scraper + LLM analysis
- [ ] `conversation_simulator` skill: role-play engine
- [ ] `performance_reviewer` skill: review generator
- [ ] `language_analyzer` skill: language pattern extraction
- [ ] `communication_auditor` skill: communication style analysis
- [ ] Database tables: competitor_profiles, competitor_signals, competitive_reports

### Phase 7B — Content & Campaigns (Week 2-3)

- [ ] `content_generator` skill: multi-format content creation
- [ ] `campaign_planner` skill: campaign design and planning
- [ ] `brand_voice_enforcer` skill: brand consistency validation
- [ ] `social_media_manager` skill: social content + scheduling
- [ ] Brand profile definition for 47Network
- [ ] Content schema and publishing pipeline

### Phase 7C — Analytics & Automation (Week 3-4)

- [ ] `analytics_reporter` skill: metrics aggregation + reporting
- [ ] Scheduled automation: competitive scans, content calendar, reports
- [ ] Dashboard integration in admin-ui
- [ ] Notification system: alerts for competitive signals, content due

---

## 13. Granular Checklist

### Competitive Intelligence
- [ ] Competitor profile management (CRUD)
- [ ] Website scraper with change detection
- [ ] Job listing scraper (LinkedIn, Indeed)
- [ ] Social media monitor (X, LinkedIn, Reddit)
- [ ] GitHub activity tracker
- [ ] Press release / RSS monitor
- [ ] Change detection and diff generation
- [ ] LLM-powered strategic analysis per signal
- [ ] Weekly competitive report generation
- [ ] Alert system for high-impact signals
- [ ] Competitor signal database with hypertable
- [ ] Rate limiting and respectful scraping

### Communication Skills
- [ ] Conversation simulator with pushback logic
- [ ] Performance review generator (promotion-focused)
- [ ] Language pattern extractor
- [ ] Communication style auditor
- [ ] Context-aware prompting for each skill
- [ ] Output formatting: Markdown with actionable items

### Content Pipeline
- [ ] Multi-format content generation (blog, social, email, scripts)
- [ ] Brand voice validation before publish
- [ ] Content scheduling with optimal timing
- [ ] Admin review queue with approval workflow
- [ ] Content performance tracking post-publish
- [ ] Content calendar management
- [ ] Image/graphic suggestions for visual content

### Campaign Management
- [ ] Campaign creation with goals, audience, channels
- [ ] Multi-channel content coordination
- [ ] Campaign performance monitoring
- [ ] A/B testing support for messaging
- [ ] Campaign reporting with ROI analysis
- [ ] Budget tracking (if applicable)

### Analytics & Reporting
- [ ] Website traffic integration
- [ ] Social media metrics aggregation
- [ ] Email performance tracking
- [ ] Automated weekly summary report
- [ ] Monthly deep dive report
- [ ] Campaign performance reports
- [ ] Brand health / sentiment tracking
- [ ] Dashboard widgets in admin-ui

### Brand Management
- [ ] Brand profile definition (voice, visual, audience)
- [ ] Brand consistency checker (automated)
- [ ] Key message reinforcement tracking
- [ ] Competitor positioning analysis
- [ ] Brand perception monitoring (social listening)

### Infrastructure
- [ ] Database tables provisioned
- [ ] Skill definitions registered
- [ ] Scheduled jobs configured
- [ ] Notification hooks to admin (chat/email)
- [ ] Rate limiting for external API calls
- [ ] Structured logging for all marketing operations

---

## Cross-References

- **Pillar 2** (Multi-Model): LLM analysis for competitive intel and content
- **Pillar 5** (Security): Credential management for social media APIs
- **Pillar 8** (Distributed Compute): Heavy competitive analysis runs distributed
- **Master Plan**: `docs/features/EXPANSION_MASTER_PLAN.md`
