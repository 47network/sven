---
name: skill-catalog
version: 1.0.0
category: autonomous-economy
archetype: analyst
description: >
  Meta-skill for cataloging, analyzing, and importing skills into Sven's
  registry. Performs gap analysis across all skill categories, evaluates
  compatibility of external skills, and manages the import pipeline.
actions:
  - catalog: Scan the skills directory and register all discovered skills
  - gap-analysis: Identify missing or underrepresented skill categories
  - import: Import and adapt an external skill from GitHub/npm/URL
  - audit: Run quality assessment on registered skills
  - recommend: Suggest new skills based on market demand and capability gaps
inputs:
  - sourceUrl: URL of external skill repository (for import action)
  - targetCategory: Target category for imported skill
  - qualityThreshold: Minimum quality score for auto-promotion (default 70)
outputs:
  - registryCount: Total number of registered skills
  - gapReport: Categories with skill counts and gap scores
  - importResult: Status and details of import operation
  - auditReport: Quality scores and recommendations
pricing:
  model: per_use
  amount: 0.00
  currency: USD
  note: Internal skill — no charge
safety:
  - Imported skills are sandboxed and tested before integration
  - Quality threshold must be met before marketplace listing
  - Deprecated skills are never auto-removed, only flagged
  - Import timeout prevents hanging operations (default 300s)
  - Maximum 5 concurrent imports to prevent resource exhaustion
---

# Skill Catalog

The meta-skill that manages Sven's entire skill ecosystem. It discovers
all SKILL.md files in the repository, registers them in the skill_registry
table, performs gap analysis to identify missing capabilities, and manages
the import pipeline for external skills.

## Catalog Action

Scans the `skills/` directory tree for SKILL.md files, parses their YAML
frontmatter, and upserts entries into the skill_registry table. Tracks
category distribution, archetype coverage, and pricing models.

## Gap Analysis

Compares registered skills against a target of 5+ skills per category.
Identifies categories with zero or low representation. Cross-references
marketplace demand data to prioritize recommendations.

## Import Pipeline

1. **Discovery**: Fetch skill from source (GitHub repo, npm package, URL)
2. **Evaluation**: Parse structure, check for SKILL.md, actions, tests
3. **Adaptation**: Generate SKILL.md if missing, adapt to Sven patterns
4. **Testing**: Run quality assessment, check compatibility score
5. **Integration**: Register in skill_registry, optionally list on marketplace

## Quality Audit

Runs automated quality checks on registered skills:
- SKILL.md completeness (name, version, category, actions, pricing)
- Action handler coverage in task-executor
- Test coverage percentage
- Archetype assignment
- Marketplace listing status
