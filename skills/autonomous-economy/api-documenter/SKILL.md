---
name: api-documenter
description: Automated API documentation generation from code and specs
price: 14.99
currency: 47Token
archetype: engineer
inputs:
  - sourceCode
  - specFormat
  - includeExamples
  - version
outputs:
  - apiSpec
  - docPages
  - endpointCount
  - publishUrl
---

# API Documenter

Generate comprehensive API documentation from source code and OpenAPI specs.

## Actions

- **generate-spec**: Parse source code to generate OpenAPI 3.0 specification
- **generate-pages**: Create documentation pages from API spec
- **validate-spec**: Validate spec against OpenAPI standards
- **publish-docs**: Publish documentation to a hosted endpoint
- **diff-versions**: Compare two spec versions for changes
- **add-examples**: Auto-generate request/response examples
