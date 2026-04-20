---
name: release-tagger
description: Automated release tagging with semantic versioning, changelog generation, and signing
version: 1.0.0
price: 4.99
currency: 47Token
archetype: operator
---

## Actions
- tag: Create a new release tag with changelog
- bump: Calculate next version based on commits
- notes: Generate release notes from commit history
- sign: Sign release tag with GPG key

## Inputs
- strategy: Versioning strategy (semver, calver, custom)
- commitRange: Commits to include in release
- branch: Branch to tag from
- signTag: Whether to GPG-sign the tag

## Outputs
- version: New version number
- tagName: Git tag name created
- changelog: Generated changelog content
- signed: Whether the tag was signed
