---
name: data-classifier
description: Data classification and sensitivity labeling for agent resources
version: 1.0.0
pricing: 0.25 per classification
archetype: analyst
---

# Data Classifier

Classifies agent data resources by sensitivity level and applies handling labels. Supports automatic classification via rules and ML models, with full data lineage tracking.

## Actions

- **classify-resource**: Classify a data resource with sensitivity level and labels
- **create-rule**: Define automatic classification rules based on patterns
- **track-lineage**: Record data movement between systems
- **query-classifications**: Search classifications by level, type, or labels
- **reclassify**: Update classification after review or policy change
- **export-inventory**: Export full data classification inventory
