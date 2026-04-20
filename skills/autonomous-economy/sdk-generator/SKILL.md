---
name: sdk-generator
description: Multi-language SDK generation from API specifications
price: 19.99
currency: 47Token
archetype: engineer
inputs:
  - apiSpec
  - targetLanguage
  - packagePrefix
  - version
outputs:
  - sdkPackage
  - methodCount
  - fileCount
  - publishUrl
---

# SDK Generator

Generate type-safe client SDKs in multiple languages from API specifications.

## Actions

- **generate-sdk**: Generate SDK for target language from API spec
- **build-package**: Build and package the generated SDK
- **run-tests**: Run generated SDK tests against mock server
- **publish-package**: Publish SDK to package registry (npm, PyPI, etc)
- **update-sdk**: Regenerate SDK for new API version with breaking change detection
- **list-methods**: List all generated SDK methods with signatures
