---
name: web-scraper
version: 1.0.0
category: web-scraping
archetype: researcher
description: >
  Intelligent web scraping and data extraction skill. Crawls websites,
  extracts structured data, handles pagination, respects robots.txt,
  and manages rate limiting for ethical scraping.
actions:
  - scrape: Extract data from a single URL using CSS/XPath selectors
  - crawl: Follow links and scrape multiple pages from a domain
  - monitor: Watch a URL for changes and trigger on updates
  - extract-api: Discover and extract data from undocumented APIs
  - screenshot: Capture visual snapshots of web pages
inputs:
  - url: Target URL or domain
  - selectors: CSS or XPath selectors for data extraction
  - depth: Maximum crawl depth (default 2)
  - rateLimit: Requests per second limit (default 1)
  - respectRobots: Honor robots.txt rules (default true)
outputs:
  - data: Extracted structured data (JSON)
  - pagesProcessed: Number of pages scraped
  - errors: Array of failed URLs with reasons
  - metadata: Page titles, timestamps, response codes
pricing:
  model: per_use
  amount: 0.19
  currency: USD
  note: Per scrape session (up to 100 pages)
safety:
  - Always respects robots.txt unless explicitly overridden
  - Rate limiting enforced (max 5 req/s even if configured higher)
  - No scraping of authentication-protected content without authorization
  - Personal data extraction follows GDPR guidelines
  - Temporary data auto-deleted after 24 hours
---

# Web Scraper

Intelligent web scraping skill for market research, competitive analysis,
trend monitoring, and data collection. Built for ethical scraping with
built-in rate limiting and robots.txt compliance.

## Use Cases

- Monitor competitor pricing for marketplace optimization
- Track bestseller lists for genre research (book publishing)
- Collect social media trends for content strategy
- Verify business information for misiuni task validation
- Research printing service prices and capabilities
