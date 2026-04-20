---
skill: agent-localization
name: Agent Localization & i18n
version: 1.0.0
description: Multi-language content management, translation workflows, locale detection, and coverage tracking
category: platform
tags: [localization, i18n, translation, multi-language, locale]
autonomous: true
economy:
  pricing: per-translation
  base_cost: 0.10
---

# Agent Localization & i18n

Full internationalization system for the agent economy. Manage locales,
translate content, review translations, detect user locales, and track
coverage across all platform surfaces.

## Actions

### locale_create
Register a new locale with language, region, and direction settings.
- **Inputs**: localeCode, language, region?, direction?, fallbackLocale?
- **Outputs**: localeId, enabled, created

### translation_add
Add or update a translation value for a key in a specific locale.
- **Inputs**: namespace, keyPath, localeCode, value, context?
- **Outputs**: translationId, status, created

### translation_review
Review and approve/reject a translation.
- **Inputs**: translationId, approved, feedback?, qualityScore?
- **Outputs**: translationId, status, reviewedBy

### content_localize
Localize a content item (skill, listing, UI element) for a target locale.
- **Inputs**: contentType, contentId, localeCode, title?, body?
- **Outputs**: localeContentId, status, created

### locale_detect
Detect the best locale for a user/agent based on available signals.
- **Inputs**: agentId?, headers?, cookies?, geoIp?
- **Outputs**: detectedLocale, source, confidence, finalLocale

### translation_export
Export all translations for a locale or namespace.
- **Inputs**: localeCode?, namespace?, format?
- **Outputs**: translations[], count, format

### coverage_report
Generate translation coverage report by locale and namespace.
- **Inputs**: localeCode?, namespace?
- **Outputs**: totalKeys, translated, coveragePercent, missingKeys[]
